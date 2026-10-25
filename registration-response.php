<?php
declare(strict_types=1);

// A3: native form response. The unchanged original API performs the durable insert.
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');

if (($_SERVER['REQUEST_METHOD'] ?? '') === 'GET'
    && in_array($_GET['verify'] ?? '', ['source', 'upstream'], true)) {
    session_start();
    $authorized = !empty($_SESSION['orders_admin']);
    session_write_close();
    header('Content-Type: application/json; charset=utf-8');
    if (!$authorized) {
        http_response_code(401);
        echo json_encode(['verification' => false, 'error' => 'Authentication required']);
        exit;
    }
    if ($_GET['verify'] === 'source') {
        echo json_encode(['verification' => 'native-response-source-v1', 'path' => 'registration-response.php',
            'source_sha256' => hash_file('sha256', __FILE__)]);
        exit;
    }
    $probe = @file_get_contents('http://127.0.0.1/api/submit.php', false,
        stream_context_create(['http' => ['method' => 'GET', 'timeout' => 5, 'ignore_errors' => true]]));
    $probeStatus = 0;
    foreach ($http_response_header ?? [] as $header) {
        if (preg_match('/^HTTP\/\S+\s+(\d{3})\b/', $header, $match)) $probeStatus = (int) $match[1];
    }
    $probeData = is_string($probe) ? json_decode($probe, true) : null;
    echo json_encode(['verification' => 'native-response-upstream-v1',
        'status' => $probeStatus, 'original_api_rejected_get' => $probeStatus === 405
            && is_array($probeData) && ($probeData['ok'] ?? null) === false]);
    exit;
}

function a3Escape(string $value): string
{
    return htmlspecialchars($value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}

function a3Page(string $heading, string $body, array $values = [], bool $emitConversion = false): void
{
    header('Content-Type: text/html; charset=utf-8');
    $marker = 'bhjfnaonleakphaeleeolkhmk';
    $variant = 'A3_native_server_response_flow_pilot10';
    $form = '';
    if ($values !== []) {
        $form = '<form id="registration-form" action="registration-response.php" method="post">'
            . '<label>Имя <input type="text" name="name" required value="' . a3Escape($values['name']) . '"></label>'
            . '<label>Телефон <input type="tel" name="phone" required value="' . a3Escape($values['phone']) . '"></label>'
            . '<label>E-mail <input type="email" name="email" required value="' . a3Escape($values['email']) . '"></label>'
            . '<label>Для чего вам курс? <textarea name="purpose" required>' . a3Escape($values['purpose']) . '</textarea></label>'
            . '<button type="submit">Отправить исправленную заявку</button></form>';
    }
    echo '<!doctype html><html lang="ru"><head><meta charset="UTF-8">'
        . '<meta name="viewport" content="width=device-width, initial-scale=1">'
        . '<meta name="landing-html-build" content="' . $marker . '">'
        . '<title>' . a3Escape($heading) . '</title>'
        . '<link rel="stylesheet" href="css/style.css">'
        . '<script src="js/main.js" defer></script></head><body><main class="container">'
        . '<h1>' . a3Escape($heading) . '</h1><p role="status">' . a3Escape($body) . '</p>'
        . $form . '<p><a href="./#registration">Вернуться к курсу</a></p></main>'
        . '<script defer src="https://vps.alexxz.ru/tracker/static/tracker.js?v=20261025-referrer-empty-5"'
        . ' data-site-key="fsGaFTXh1jtgWDGeo1l73o_tuSgjK63jy8hpt2rS5YU" data-start="auto"></script>';
    if ($emitConversion) {
        echo '<script>document.addEventListener("DOMContentLoaded",()=>{'
            . 'window.sessionTracker?.conversion({source:"registration",variant:"' . $variant . '"});'
            . '});</script>';
    }
    echo '</body></html>';
}

$method = $_SERVER['REQUEST_METHOD'] ?? '';
if ($method === 'GET') {
    $token = $_GET['receipt'] ?? '';
    if (!is_string($token) || !preg_match('/^[a-f0-9]{32}$/', $token)) {
        http_response_code(404);
        a3Page('Заявка не найдена', 'Вернитесь к форме курса.');
        exit;
    }
    session_start();
    $receipt = $_SESSION['a3_receipt'] ?? null;
    if (!is_array($receipt) || !is_string($receipt['token'] ?? null)
        || !hash_equals($receipt['token'], $token) || ($receipt['confirmed'] ?? false) !== true) {
        session_write_close();
        http_response_code(404);
        a3Page('Заявка не найдена', 'Вернитесь к форме курса.');
        exit;
    }
    $emitConversion = ($receipt['tracked'] ?? false) !== true;
    $_SESSION['a3_receipt']['tracked'] = true;
    session_write_close();
    a3Page('Заявка принята', 'Заявка сохранена. Мы свяжемся с вами в ближайшее время.', [], $emitConversion);
    exit;
}

if ($method !== 'POST') {
    http_response_code(405);
    a3Page('Неверный запрос', 'Для подачи заявки используйте форму курса.');
    exit;
}

$values = [];
foreach (['name', 'phone', 'email', 'purpose'] as $key) {
    $values[$key] = is_string($_POST[$key] ?? null) ? $_POST[$key] : '';
}

// Fixed loopback target avoids a Host-header-controlled upstream. The original API
// receives only the four genuine values; this adapter never opens the order DB.
$body = http_build_query($values, '', '&', PHP_QUERY_RFC3986);
$context = stream_context_create(['http' => [
    'method' => 'POST',
    'header' => "Content-Type: application/x-www-form-urlencoded\r\nAccept: application/json\r\n",
    'content' => $body,
    'timeout' => 120,
    'ignore_errors' => true,
]]);
$response = @file_get_contents('http://127.0.0.1/api/submit.php', false, $context);
$status = 0;
foreach ($http_response_header ?? [] as $header) {
    if (preg_match('/^HTTP\/\S+\s+(\d{3})\b/', $header, $match)) $status = (int) $match[1];
}
$data = is_string($response) ? json_decode($response, true) : null;
if ($status === 200 && is_array($data) && ($data['ok'] ?? null) === true) {
    session_start();
    $token = bin2hex(random_bytes(16));
    $_SESSION['a3_receipt'] = ['token' => $token, 'confirmed' => true, 'tracked' => false];
    session_write_close();
    header('Location: registration-response.php?receipt=' . $token, true, 303);
    exit;
}

if ($status === 200 && is_array($data) && ($data['ok'] ?? null) === false
    && is_string($data['error'] ?? null)) {
    http_response_code(422);
    a3Page('Исправьте заявку', $data['error'], $values);
    exit;
}

// Unknown acknowledgement must never be converted into a success or auto-retry.
http_response_code(503);
a3Page('Статус заявки неизвестен', 'Подтверждение сервера не получено. Не отправляйте заявку повторно сразу: сначала свяжитесь с организатором.');
