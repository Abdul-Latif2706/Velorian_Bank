<?php
require_once __DIR__ . '/config.php';

date_default_timezone_set(APP_TIMEZONE);

try {
    // Create the database if it does not already exist.
    $server = new PDO(
        'mysql:host=' . DB_HOST . ';charset=utf8mb4',
        DB_USER,
        DB_PASS,
        [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]
    );
    $server->exec('CREATE DATABASE IF NOT EXISTS `' . str_replace('`','',DB_NAME) . '` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci');
    $server = null;

    require_once __DIR__ . '/db.php';
    $pdo = db();
    $sql = file_get_contents(__DIR__ . '/schema.sql');
    $statements = array_filter(array_map('trim', preg_split('/;\s*(?:\r?\n|$)/', $sql)));
    foreach ($statements as $statement) {
        if ($statement !== '') $pdo->exec($statement);
    }

    $ok = true;
    $message = 'Database and tables are ready.';
} catch (Throwable $e) {
    http_response_code(500);
    $ok = false;
    $message = $e->getMessage();
}
?>
<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Velorian Bank Setup</title></head>
<body style="font-family:Arial,sans-serif;background:#07101c;color:#fff;padding:40px;line-height:1.6">
<div style="max-width:760px;margin:auto;background:#101d2d;padding:32px;border-radius:18px">
<h1>Velorian Bank Setup</h1>
<?php if ($ok): ?>
<p style="color:#8ff0b1">✓ <?=htmlspecialchars($message)?></p>
<p>Admin email: <strong><?=htmlspecialchars(ADMIN_EMAIL)?></strong></p>
<p>Local admin password: <strong><?=htmlspecialchars(ADMIN_PASSWORD)?></strong></p>
<p>Next, open the admin login:</p>
<p><a style="color:#d7b56d" href="../control-center/login.html">Open Administrator Portal →</a></p>
<p><strong>After confirming everything works, delete <code>api/setup.php</code>.</strong></p>
<?php else: ?>
<p style="color:#ff9d9d">Setup failed.</p>
<pre style="white-space:pre-wrap;background:#07101c;padding:18px;border-radius:10px"><?=htmlspecialchars($message)?></pre>
<?php endif; ?>
</div>
</body>
</html>
