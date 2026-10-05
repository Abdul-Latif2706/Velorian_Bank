VELORIAN BANK — CLEAN PHP + MYSQL XAMPP PACKAGE
================================================

This package is arranged as ONE clean project folder. It is designed to avoid the
nested-folder/path problem that caused the previous Apache 404 errors.

1. Extract this ZIP into:
   C:\xampp\htdocs\

2. The final folder should be exactly:
   C:\xampp\htdocs\velorianbank\

3. Start Apache and MySQL in XAMPP.

4. Open the one-time setup page:
   http://localhost/velorianbank/api/setup.php

   It creates the velorian_bank database and all required tables.

5. After setup succeeds, open:
   Main site:   http://localhost/velorianbank/
   Client:      http://localhost/velorianbank/client-login.html
   Register:    http://localhost/velorianbank/client-register.html
   Admin:       http://localhost/velorianbank/control-center/login.html
   API health:  http://localhost/velorianbank/api/index.php?route=health

LOCAL ADMIN LOGIN
-----------------
Email:    admin@velorianbank.com
Password: Velorian@2026

This password is a temporary local-demo password. Change ADMIN_PASSWORD in
api/config.php before using the project anywhere outside your local computer.

RESEND / OTP EMAILS
-------------------
The PHP backend supports Resend for account confirmation emails and external-transfer
OTP emails. The ZIP intentionally does NOT contain a real API key.

To enable real email delivery, put your Resend key in:
   api/config.php

Set:
   const RESEND_API_KEY = 'YOUR_KEY';

Keep that key server-side. Do not put it in JavaScript or publish it to GitHub.

EXTERNAL TRANSFERS
------------------
Client external transfers are simulated bank transfers. They require a 6-digit OTP,
expire after 5 minutes, allow up to 5 attempts, and have a 25,000 same-currency daily
limit in the demo.

ADMIN CONTROLS
--------------
The administrator can manage client accounts and post deposits/withdrawals/internal
transfers. Client deposits, withdrawals and internal transfers are not available.

IMPORTANT
---------
After you verify that setup and login work, delete:
   api/setup.php

Do not delete api/index.php, api/helpers.php, api/db.php or api/schema.sql.
