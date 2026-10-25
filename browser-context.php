<?php
/** Draft source for /browser-context.php. Telemetry only; no application/API writes. */
declare(strict_types=1);

header('Content-Type: application/javascript; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');

$cookieName = 'landing_browser_id';
$candidate = $_COOKIE[$cookieName] ?? null;
$id = null;
$created = false;
try {
    if (is_string($candidate) && preg_match('/^[a-p]{24}$/D', $candidate) === 1) {
        $id = $candidate;
    } else {
        $id = strtr(bin2hex(random_bytes(12)), '0123456789abcdef', 'abcdefghijklmnop');
        $created = setcookie($cookieName, $id, [
            'expires' => time() + 7 * 86400,
            'path' => '/',
            'secure' => true,
            'httponly' => true,
            'samesite' => 'Lax',
        ]);
        if (!$created) {
            $id = null;
        }
    }
} catch (Throwable $error) {
    // Missing measurement must not interrupt the landing or invent an identity.
    $id = null;
    $created = false;
}

echo 'window.landingBrowserContext=' . json_encode(
    ['id' => $id, 'created' => $created],
    JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT | JSON_UNESCAPED_SLASHES
) . ";\n";
