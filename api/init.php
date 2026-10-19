<?php

declare(strict_types=1);

require_once __DIR__ . '/db.php';

header('Content-Type: application/json; charset=utf-8');

try {
    ensureDatabaseReady();
    echo json_encode(['ok' => true, 'message' => 'Database initialized.'], JSON_UNESCAPED_UNICODE);
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(['ok' => false, 'error' => 'Database initialization failed.'], JSON_UNESCAPED_UNICODE);
}
