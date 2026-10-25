<?php
declare(strict_types=1);

session_start();
$isAuthorized = !empty($_SESSION['orders_admin']);
session_write_close();
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');
if (!$isAuthorized) {
    http_response_code(401);
    echo json_encode(['ok' => false, 'error' => 'Authentication required']);
    exit;
}

$limit = max(1, min(10000, (int) ($_GET['limit'] ?? 1000)));
$path = sys_get_temp_dir() . '/landing-request-context-v1/requests.jsonl';
$records = [];
$total = 0;
$malformed = 0;
$exists = is_file($path) && !is_link($path);
if ($exists) {
    $handle = @fopen($path, 'rb');
    if ($handle === false) {
        http_response_code(503);
        echo json_encode(['ok' => false, 'error' => 'Context log unavailable']);
        exit;
    }
    try {
        if (!flock($handle, LOCK_SH)) {
            throw new RuntimeException('Context log lock unavailable');
        }
        try {
            while (($line = fgets($handle)) !== false) {
                $record = json_decode($line, true);
                if (!is_array($record) || !preg_match('/^[a-p]{24}$/', (string) ($record['request_id'] ?? ''))) {
                    $malformed++;
                    continue;
                }
                $total++;
                $records[] = $record;
                if (count($records) > $limit) {
                    array_shift($records);
                }
            }
        } finally {
            flock($handle, LOCK_UN);
        }
    } catch (Throwable $error) {
        http_response_code(503);
        echo json_encode(['ok' => false, 'error' => 'Context read failed']);
        exit;
    } finally {
        fclose($handle);
    }
}
$runtimeHashes = [];
foreach (['api/submit.php', 'api/visit.php', 'api/db.php', 'api/export.php', 'api/init.php', 'sql/schema.sql', 'admin/request-context.php'] as $relativePath) {
    $runtimePath = dirname(__DIR__) . '/' . $relativePath;
    $runtimeHashes[$relativePath] = is_file($runtimePath) && !is_link($runtimePath)
        ? hash_file('sha256', $runtimePath) : null;
}

echo json_encode([
    'ok' => true,
    'source' => 'main_document_php_context_v1',
    'runtime_hashes' => $runtimeHashes,
    'log_exists' => $exists,
    'log_bytes' => $exists ? filesize($path) : 0,
    'total_records' => $total,
    'returned_records' => count($records),
    'omitted_by_limit' => max(0, $total - count($records)),
    'malformed_lines' => $malformed,
    'records' => $records,
    'limitations' => ['Container-local log; archive before redeploy', 'REMOTE_ADDR/XFF may be a shared proxy, not a person', 'No POST body or application contact values collected'],
], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_INVALID_UTF8_SUBSTITUTE);
