VELORIAN BANK — FINAL PHP/MYSQL BUILD
=====================================

This package is a cleaned PHP/MySQL build of the Velorian Bank demonstration system.

IMPORTANT FIX IN THIS BUILD
---------------------------
The browser API client now calls:

    /api/index.php?route=...

for every API operation.

The system therefore does NOT depend on Apache URL rewriting for registration,
login, transactions, transfers, or administrator operations.

INSTALLATION
------------
1. Extract this ZIP.
2. Copy the extracted folder named "velorianbank" directly into:

       C:\xampp\htdocs\

3. Start Apache and MySQL from XAMPP.
4. Open:

       http://localhost/velorianbank/api/setup.php

5. Wait for "Database and tables are ready."
6. Open the homepage:

       http://localhost/velorianbank/

7. Client registration:

       http://localhost/velorianbank/client-register.html

8. Client login:

       http://localhost/velorianbank/client-login.html

9. Administrator login:

       http://localhost/velorianbank/control-center/login.html

10. API health test:

       http://localhost/velorianbank/api/index.php?route=health

LOCAL ADMIN LOGIN
-----------------
Email:
    admin@velorianbank.com

Password:
    Velorian@2026

Change the administrator password before any non-local deployment.

RESEND EMAIL
------------
The ZIP intentionally does NOT contain a private Resend API key.

After extraction, open:

    C:\xampp\htdocs\velorianbank\api\config.php

and put your own Resend API key in:

    const RESEND_API_KEY = 'YOUR_KEY_HERE';

Keep the key in PHP only. Do not put it in JavaScript.

For the account-confirmation email to work with a custom sender such as:

    no-reply@velorianbank.com

your Resend account/domain must be configured to send from that domain.

AFTER SETUP
-----------
Once the database has been created successfully, delete:

    api/setup.php

SECURITY NOTE
-------------
This is a demonstration banking application. It is not a production banking
system and should not be used to hold or transfer real money.
