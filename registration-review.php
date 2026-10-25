<?php
declare(strict_types=1);
// Source-only prototype. This review endpoint never calls the API or writes an order.
header('Cache-Control: no-store');
// A1_SOURCE_VERIFICATION_BEGIN
// Read-only fixed-file identity check; no API/include/DB/application work.
if (($_SERVER['REQUEST_METHOD'] ?? '') === 'GET' && ($_GET['verify'] ?? '') === 'source') {
    session_start();
    $authorized = !empty($_SESSION['orders_admin']);
    session_write_close();
    header('Content-Type: application/json; charset=utf-8');
    header('X-Content-Type-Options: nosniff');
    if (!$authorized) {
        http_response_code(401);
        echo json_encode(['verification' => false, 'error' => 'Authentication required']);
        exit;
    }
    echo json_encode(['verification' => 'review-adapter-source-v1', 'path' => 'registration-review.php', 'source_sha256' => hash_file('sha256', __FILE__)]);
    exit;
}
// A1_SOURCE_VERIFICATION_END
$wantsJson = ($_GET['response'] ?? '') === 'json' || str_contains($_SERVER['HTTP_ACCEPT'] ?? '', 'application/json');
$values = [];
$error = '';
if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    http_response_code(405);
    $error = 'Для проверки заявки используйте форму курса.';
} else {
    foreach (['name', 'phone', 'email', 'purpose'] as $key) {
        $values[$key] = is_string($_POST[$key] ?? null) ? trim($_POST[$key]) : '';
    }
    if ($values['name'] === '') $error = 'Укажите имя.';
    elseif ($values['phone'] === '') $error = 'Укажите телефон.';
    elseif ($values['email'] === '' || !filter_var($values['email'], FILTER_VALIDATE_EMAIL)) $error = 'Укажите корректный e-mail.';
    elseif ($values['purpose'] === '') $error = 'Укажите цель прохождения курса.';
}
if ($wantsJson) {
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($error === '' ? ['review_ready'=>true, 'review'=>$values] : ['review_ready'=>false, 'error'=>$error], JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR);
    exit;
}
header('Content-Type: text/html; charset=utf-8');
function escapeReview(string $value): string { return htmlspecialchars($value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); }
?>
<!DOCTYPE html>
<html lang="ru"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Проверка заявки</title></head>
<body>
<h1>Проверка заявки</h1>
<?php if ($error !== ''): ?>
<p role="alert"><?= escapeReview($error) ?></p>
<?php endif; ?>
<?php if (($_SERVER['REQUEST_METHOD'] ?? '') === 'POST'): ?>
<p><?= $error === '' ? 'Заявка ещё не сохранена. Проверьте четыре поля и подтвердите отправку. Здесь можно исправить данные.' : 'Исправьте данные и повторите проверку.' ?></p>
<form id="registration-form" action="<?= $error === '' ? 'api/submit.php' : 'registration-review.php' ?>" method="post">
<label>Имя <input type="text" name="name" required autocomplete="name" value="<?= escapeReview($values['name'] ?? '') ?>"></label>
<label>Телефон <input type="tel" name="phone" required autocomplete="tel" value="<?= escapeReview($values['phone'] ?? '') ?>"></label>
<label>E-mail <input type="email" name="email" required autocomplete="email" value="<?= escapeReview($values['email'] ?? '') ?>"></label>
<label>Для чего вам курс? <textarea name="purpose" required rows="2"><?= escapeReview($values['purpose'] ?? '') ?></textarea></label>
<button type="submit"><?= $error === '' ? 'Подтвердить заявку' : 'Проверить заявку' ?></button>
</form>
<?php endif; ?>
<p><a href="./#registration">Вернуться к странице курса</a></p>
</body></html>
