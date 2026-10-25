<?php

declare(strict_types=1);

require_once __DIR__ . '/db.php';

// Compiled from the reviewed plan. Request parameters never select a policy.
const REQUIRED_FIELDS = ['name', 'email'];
const CONTACT_RULE = 'email';

set_time_limit(120);
header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['ok' => false, 'error' => 'Method not allowed.'], JSON_UNESCAPED_UNICODE);
    exit;
}

$values = [];
foreach (['name', 'phone', 'email', 'purpose'] as $field) {
    $value = $_POST[$field] ?? '';
    if (!is_scalar($value)) {
        echo json_encode(['ok' => false, 'error' => 'Проверьте формат полей заявки.'], JSON_UNESCAPED_UNICODE);
        exit;
    }
    $values[$field] = trim((string) $value);
}

$errors = [
    'name' => 'Укажите имя.',
    'phone' => 'Укажите телефон.',
    'email' => 'Укажите корректный e-mail.',
    'purpose' => 'Укажите цель прохождения курса.',
];
foreach (REQUIRED_FIELDS as $field) {
    if ($values[$field] === '') {
        echo json_encode(['ok' => false, 'error' => $errors[$field]], JSON_UNESCAPED_UNICODE);
        exit;
    }
}

// Empty optional email means not provided; supplied email keeps old validation.
if ($values['email'] !== '' && !filter_var($values['email'], FILTER_VALIDATE_EMAIL)) {
    echo json_encode(['ok' => false, 'error' => $errors['email']], JSON_UNESCAPED_UNICODE);
    exit;
}
$hasPhone = $values['phone'] !== '';
$hasEmail = $values['email'] !== '';
$contactValid = match (CONTACT_RULE) {
    'both' => $hasPhone && $hasEmail,
    'phone' => $hasPhone,
    'email' => $hasEmail,
    'either' => $hasPhone || $hasEmail,
    default => false,
};
if (!$contactValid) {
    echo json_encode(['ok' => false, 'error' => 'Укажите телефон или корректный e-mail.'], JSON_UNESCAPED_UNICODE);
    exit;
}

$name = $values['name'];
$phone = $values['phone'];
$email = $values['email'];
$purpose = $values['purpose'];

try {
    ensureDatabaseReady();

    dbExecuteUntilSuccess(function (PDO $pdo) use ($name, $phone, $email, $purpose): void {
        $stmt = $pdo->prepare(
            'INSERT INTO orders (name, phone, email, purpose)
             VALUES (:name, :phone, :email, :purpose)'
        );
        $stmt->execute([
            'name' => $name,
            'phone' => $phone,
            'email' => $email,
            'purpose' => $purpose,
        ]);
    });

    echo json_encode(['ok' => true], JSON_UNESCAPED_UNICODE);
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(['ok' => false, 'error' => 'Не удалось сохранить заявку.'], JSON_UNESCAPED_UNICODE);
}
