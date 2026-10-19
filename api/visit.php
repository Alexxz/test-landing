<?php

declare(strict_types=1);

require_once __DIR__ . '/db.php';

set_time_limit(120);
header('Content-Type: application/javascript; charset=utf-8');

try {
    ensureDatabaseReady();

    dbExecuteUntilSuccess(function (PDO $pdo): void {
        $pdo->exec('INSERT INTO visits DEFAULT VALUES');
    });
} catch (Throwable $e) {
    http_response_code(500);
}

echo '// ok';
