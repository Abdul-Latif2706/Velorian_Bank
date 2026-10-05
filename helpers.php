<?php

require_once __DIR__ . '/db.php';

function json_response($data, int $status = 200): never
{
    http_response_code($status);

    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');

    echo json_encode(
        $data,
        JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE
    );

    exit;
}

function request_body(): array
{
    $raw = file_get_contents('php://input');

    if (!$raw) {
        return $_POST ?: [];
    }

    $data = json_decode($raw, true);

    return is_array($data) ? $data : [];
}

function bearer_token(): string
{
    $header = '';

    if (!empty($_SERVER['HTTP_AUTHORIZATION'])) {
        $header = $_SERVER['HTTP_AUTHORIZATION'];
    } elseif (!empty($_SERVER['REDIRECT_HTTP_AUTHORIZATION'])) {
        $header = $_SERVER['REDIRECT_HTTP_AUTHORIZATION'];
    } elseif (!empty($_SERVER['HTTP_X_AUTHORIZATION'])) {
        $header = $_SERVER['HTTP_X_AUTHORIZATION'];
    } elseif (!empty($_SERVER['Authorization'])) {
        $header = $_SERVER['Authorization'];
    } elseif (function_exists('getallheaders')) {
        $headers = getallheaders();

        foreach ($headers as $key => $value) {
            if (strcasecmp($key, 'Authorization') === 0) {
                $header = $value;
                break;
            }
        }
    } elseif (function_exists('apache_request_headers')) {
        $headers = apache_request_headers();

        foreach ($headers as $key => $value) {
            if (strcasecmp($key, 'Authorization') === 0) {
                $header = $value;
                break;
            }
        }
    }

    if (
        !empty($header) &&
        preg_match('/^Bearer\s+(.+)$/i', trim($header), $matches)
    ) {
        return trim($matches[1]);
    }

    return '';
}

function current_session(?string $role = null): ?array
{
    $token = bearer_token();

    if (!$token) {
        return null;
    }

    $st = db()->prepare(
        'SELECT token, role, client_id, created_at, expires_at
         FROM sessions
         WHERE token = ?
         LIMIT 1'
    );

    $st->execute([$token]);

    $session = $st->fetch();

    if (!$session) {
        return null;
    }

    if (
        empty($session['expires_at']) ||
        strtotime($session['expires_at']) < time()
    ) {
        return null;
    }

    if ($role !== null && $session['role'] !== $role) {
        return null;
    }

    return $session;
}

function require_auth(string $role): array
{
    $session = current_session($role);

    if (!$session) {
        json_response(
            [
                'error' => ucfirst($role) . ' authorization required.'
            ],
            401
        );
    }

    return $session;
}

function id_string(string $prefix): string
{
    return $prefix . '_' . bin2hex(random_bytes(10));
}

function account_number(PDO $pdo): string
{
    do {
        /*
         * Velorian Bank account numbers:
         * 1092 + 6 random digits = 10 digits total.
         */
        $number =
            '1092' .
            str_pad(
                (string) random_int(0, 999999),
                6,
                '0',
                STR_PAD_LEFT
            );

        $st = $pdo->prepare(
            'SELECT COUNT(*) FROM clients WHERE account_number = ?'
        );

        $st->execute([$number]);

        $exists = (int) $st->fetchColumn() > 0;
    } while ($exists);

    return $number;
}

function client_row(array $c): array
{
    return [
        'id' => $c['id'],
        'name' => $c['name'],
        'email' => $c['email'],

        'phone' => $c['phone'] ?? '',
        'country' => $c['country'] ?? '',
        'dob' => $c['dob'] ?? '',
        'address' => $c['address'] ?? '',

        'accountType' =>
            $c['account_type'] ??
            'Savings Account',

        'currency' =>
            $c['currency'] ??
            'USD',

        'accountNumber' => $c['account_number'],

        'balance' => (float) $c['balance'],

        'status' =>
            $c['status'] ??
            'Active',

        'createdAt' =>
            $c['created_at'],

        'updatedAt' =>
            $c['updated_at'] ??
            null,

        'forcePasswordChange' =>
            (bool) ($c['force_password_change'] ?? false)
    ];
}

function transaction_row(array $t): array
{
    $out = [
        'id' => $t['id'],
        'clientId' => $t['client_id'],
        'clientAccountNumber' => $t['client_account_number'],
        'clientName' => $t['client_name'],

        'type' => $t['type'],
        'amount' => (float) $t['amount'],
        'currency' => $t['currency'],
        'status' => $t['status'],

        'description' =>
            $t['description'] ??
            '',

        'timestamp' => $t['timestamp'],

        'reference' =>
            $t['reference'] ??
            $t['id']
    ];

    $map = [
        'receivedAmount' => 'received_amount',
        'receivedCurrency' => 'received_currency',
        'exchangeRate' => 'exchange_rate',
        'relatedClientId' => 'related_client_id',
        'relatedAccountNumber' => 'related_account_number',
        'direction' => 'direction',
        'recipientName' => 'recipient_name',
        'bankName' => 'bank_name',
        'destinationCountry' => 'destination_country',
        'recipientAccount' => 'recipient_account',
        'iban' => 'iban',
        'swift' => 'swift',
        'statusLabel' => 'status_label'
    ];

    foreach ($map as $key => $snake) {

        if (!array_key_exists($snake, $t)) {
            continue;
        }

        if (
            in_array(
                $key,
                [
                    'receivedAmount',
                    'exchangeRate'
                ],
                true
            ) &&
            is_numeric($t[$snake])
        ) {
            $out[$key] = (float) $t[$snake];
        } else {
            $out[$key] = $t[$snake];
        }
    }

    return $out;
}

function audit(
    PDO $pdo,
    string $action,
    string $details
): void {
    $st = $pdo->prepare(
        'INSERT INTO audit_logs
        (id, action, details, actor, timestamp)
        VALUES (?, ?, ?, ?, NOW())'
    );

    $st->execute(
        [
            id_string('AUD'),
            $action,
            $details,
            defined('ADMIN_NAME')
                ? ADMIN_NAME
                : 'Velorian Bank Admin'
        ]
    );
}

function send_email(
    string $to,
    string $subject,
    string $html
): array {

    if (
        !defined('RESEND_API_KEY') ||
        !RESEND_API_KEY ||
        str_starts_with(RESEND_API_KEY, 're_XXXXXXXX')
    ) {
        return [
            'sent' => false,
            'reason' => 'Email provider is not configured.'
        ];
    }

    if (!filter_var($to, FILTER_VALIDATE_EMAIL)) {
        return [
            'sent' => false,
            'reason' => 'Invalid recipient email address.'
        ];
    }

    $ch = curl_init(
        'https://api.resend.com/emails'
    );

    if ($ch === false) {
        return [
            'sent' => false,
            'reason' => 'Could not initialize cURL.'
        ];
    }

    $payload = [
        'from' => MAIL_FROM,
        'to' => [$to],
        'subject' => $subject,
        'html' => $html
    ];

    curl_setopt_array(
        $ch,
        [
            CURLOPT_POST => true,
            CURLOPT_RETURNTRANSFER => true,

            CURLOPT_HTTPHEADER => [
                'Authorization: Bearer ' . RESEND_API_KEY,
                'Content-Type: application/json'
            ],

            CURLOPT_POSTFIELDS => json_encode(
                $payload,
                JSON_UNESCAPED_SLASHES |
                JSON_UNESCAPED_UNICODE
            ),

            CURLOPT_TIMEOUT => 20,

            CURLOPT_CONNECTTIMEOUT => 10
        ]
    );

    $body = curl_exec($ch);

    $code = (int) curl_getinfo(
        $ch,
        CURLINFO_HTTP_CODE
    );

    $error = curl_error($ch);

    curl_close($ch);

    if ($code >= 200 && $code < 300) {
        return [
            'sent' => true,
            'status' => $code
        ];
    }

    /*
     * Do not expose the Resend API key.
     * Return only a safe diagnostic.
     */
    $reason = $error;

    if (!$reason && $body) {
        $decoded = json_decode($body, true);

        if (is_array($decoded)) {
            $reason =
                $decoded['message'] ??
                $decoded['name'] ??
                'Email provider rejected the message.';
        }
    }

    if (!$reason) {
        $reason =
            'Email provider rejected the message. HTTP ' .
            $code;
    }

    return [
        'sent' => false,
        'reason' => $reason,
        'status' => $code
    ];
}

function esc(string $value): string
{
    return htmlspecialchars(
        $value,
        ENT_QUOTES | ENT_SUBSTITUTE,
        'UTF-8'
    );
}

function send_account_email(array $c): array
{
    $name = esc(
        (string) ($c['name'] ?? 'Customer')
    );

    $accountNumber = esc(
        (string) ($c['account_number'] ?? '')
    );

    $accountType = esc(
        (string) (
            $c['account_type'] ??
            'Savings Account'
        )
    );

    $currency = esc(
        (string) (
            $c['currency'] ??
            'USD'
        )
    );

    $html = '
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <title>Velorian Bank Account</title>
    </head>

    <body style="
        margin:0;
        padding:30px 15px;
        background:#f4f6f8;
        font-family:Arial,sans-serif;
        color:#172333;
    ">

        <div style="
            max-width:620px;
            margin:0 auto;
            background:#ffffff;
            border-radius:14px;
            padding:32px;
        ">

            <h2 style="
                margin-top:0;
                letter-spacing:.08em;
            ">
                VELORIAN BANK
            </h2>

            <p>
                Dear ' . $name . ',
            </p>

            <p>
                Your Velorian Bank online banking account
                has been created successfully.
            </p>

            <div style="
                margin:25px 0;
                padding:24px;
                background:#f4f6f8;
                border-radius:12px;
            ">

                <div style="
                    font-size:12px;
                    color:#6b7785;
                    margin-bottom:8px;
                ">
                    YOUR ACCOUNT NUMBER
                </div>

                <div style="
                    font-size:30px;
                    font-weight:700;
                    letter-spacing:.12em;
                    word-break:break-all;
                ">
                    ' . $accountNumber . '
                </div>

            </div>

            <p>
                <strong>Account type:</strong>
                ' . $accountType . '
            </p>

            <p>
                <strong>Account currency:</strong>
                ' . $currency . '
            </p>

            <p>
                You can use your account number together
                with your password to sign in to Velorian
                Bank online banking.
            </p>

            <p style="
                color:#6b7785;
                font-size:13px;
            ">
                For your security, Velorian Bank will never
                ask you to send your password by email.
            </p>

            <hr style="
                border:0;
                border-top:1px solid #e5e9ee;
                margin:28px 0;
            ">

            <p style="
                font-size:12px;
                color:#7a8490;
            ">
                This is an automated message from
                Velorian Bank. Please do not reply directly
                to this email.
            </p>

        </div>

    </body>
    </html>
    ';

    return send_email(
        (string) $c['email'],
        'Your Velorian Bank account number: ' .
            (string) $c['account_number'],
        $html
    );
}

function send_otp_email(
    array $c,
    string $otp,
    float $amount,
    string $currency,
    string $recipient,
    string $reference
): array {

    $name = esc(
        (string) ($c['name'] ?? 'Customer')
    );

    $safeOtp = esc($otp);
    $safeCurrency = esc($currency);
    $safeRecipient = esc($recipient);
    $safeReference = esc($reference);

    $formattedAmount = number_format(
        $amount,
        2
    );

    $html = '
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <title>Transfer Verification</title>
    </head>

    <body style="
        margin:0;
        padding:30px 15px;
        background:#f4f6f8;
        font-family:Arial,sans-serif;
        color:#172333;
    ">

        <div style="
            max-width:620px;
            margin:0 auto;
            background:#ffffff;
            border-radius:14px;
            padding:32px;
        ">

            <h2>
                VELORIAN BANK
            </h2>

            <p>
                Dear ' . $name . ',
            </p>

            <p>
                Use the verification code below to authorize
                your transfer.
            </p>

            <div style="
                padding:24px;
                background:#f4f6f8;
                border-radius:12px;
                text-align:center;
                margin:25px 0;
            ">

                <div style="
                    font-size:12px;
                    color:#6b7785;
                ">
                    ONE-TIME VERIFICATION CODE
                </div>

                <div style="
                    font-size:34px;
                    font-weight:800;
                    letter-spacing:.22em;
                    margin:12px 0;
                ">
                    ' . $safeOtp . '
                </div>

                <div style="
                    font-size:13px;
                ">
                    ' . esc($formattedAmount) . '
                    ' . $safeCurrency . '
                    &rarr;
                    ' . $safeRecipient . '
                </div>

            </div>

            <p>
                This code expires in 5 minutes.
            </p>

            <p>
                <strong>Reference:</strong>
                ' . $safeReference . '
            </p>

            <p>
                If you did not initiate this transfer,
                do not share this code and contact
                Velorian Bank.
            </p>

            <p style="
                color:#7a8490;
                font-size:12px;
                margin-top:30px;
            ">
                This is an automated security message.
            </p>

        </div>

    </body>
    </html>
    ';

    return send_email(
        (string) $c['email'],
        'Velorian Bank transfer verification code',
        $html
    );
}

function currencies(): array
{
    return [
        'USD' => [
            'USD' => 1,
            'GBP' => 0.78,
            'EUR' => 0.85
        ],

        'GBP' => [
            'USD' => 1.28,
            'GBP' => 1,
            'EUR' => 1.09
        ],

        'EUR' => [
            'USD' => 1.18,
            'GBP' => 0.92,
            'EUR' => 1
        ]
    ];
}