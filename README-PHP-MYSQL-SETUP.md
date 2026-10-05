# Velorian Bank — HTML/CSS/JavaScript + PHP + MySQL

This version replaces the Node/Render backend with a PHP + MySQL backend.

## What is included

- Public Velorian Bank homepage
- Client login and account opening
- Private Admin portal
- Client portal
- Automatic 10-digit account numbers beginning with 1092
- USD / GBP / EUR account currencies
- Admin client management
- Admin deposits and withdrawals
- Admin internal transfers with exchange rates
- Client transaction history
- External-transfer simulation with 6-digit email OTP
- Password changes and admin password resets
- MySQL database and server-side password hashing
- Resend email integration for account confirmation and OTP emails
- Responsive premium UI and existing backgrounds/logo assets

## IMPORTANT

This is a web application/demo. It does NOT connect to real banking rails or move real money. The external transfer feature is simulated. Do not use it for real financial services without appropriate regulated infrastructure, security, KYC/AML, fraud controls, and professional review.

## Easiest way to run it on your computer (XAMPP)

### 1. Install XAMPP

Install XAMPP with Apache, PHP and MySQL/MariaDB.

### 2. Put the project in htdocs

Extract this project into:

`C:\xampp\htdocs\velorian_bank`

You should have:

`C:\xampp\htdocs\velorian_bank\index.html`

and

`C:\xampp\htdocs\velorian_bank\api\index.php`

### 3. Start XAMPP

Open XAMPP Control Panel and start:

- Apache
- MySQL

### 4. Create the database

Open phpMyAdmin and create a database named:

`velorian_bank`

Do not create tables manually yet.

### 5. Configure PHP

Inside:

`api`

copy:

`config.example.php`

to:

`config.php`

Then open `config.php` and replace:

- `YOUR_DATABASE_USER`
- `YOUR_DATABASE_PASSWORD`
- `CHANGE_THIS_TO_A_STRONG_PASSWORD`
- `YOUR_RESEND_API_KEY`

For a normal XAMPP installation, the database user is commonly `root` and the password is commonly blank, but use whatever your XAMPP/MySQL installation actually uses.

### 6. Set the admin email

You can use an email address you actually control. It is used for administrator authentication.

Example:

`ADMIN_EMAIL = 'your-real-email@gmail.com'`

The admin email does NOT have to be the customer's email address.

### 7. Set Resend

Create a Resend API key and put it only in `api/config.php`:

`RESEND_API_KEY = 'YOUR_RESEND_API_KEY'`

Never put this key in `js/config.js`, HTML, or a public GitHub repository.

`MAIL_FROM` must use a sender/domain that Resend has authorized according to your Resend account setup.

### 8. Initialize the database

In your browser open:

`http://localhost/velorian_bank/api/setup.php`

You should see:

`Velorian Bank database setup complete`

After setup, delete `api/setup.php` from the server for security.

### 9. Open the website

Use:

`http://localhost/velorian_bank/`

Do NOT double-click `index.html` for the online PHP version. PHP only runs through a web server such as Apache.

## Admin login

Open:

`http://localhost/velorian_bank/control-center/login.html`

Use the `ADMIN_EMAIL` and `ADMIN_PASSWORD` configured in `api/config.php`.

## Client account opening

Open:

`http://localhost/velorian_bank/client-register.html`

A successful registration creates the client in MySQL and generates the account number. The new client becomes visible to the Admin portal because both use the same database.

## Client login

Open:

`http://localhost/velorian_bank/client-login.html`

The client can log in with the registered email or account number and password.

## Production hosting

For a public website, use a hosting provider that supports:

- PHP 8+
- MySQL/MariaDB
- HTTPS
- PHP cURL extension (for Resend email)
- Apache rewrite rules or equivalent routing

Upload the website files to the hosting public directory and create a MySQL database there. Then configure `api/config.php` with the host's database credentials.

GitHub Pages cannot execute PHP. If you use GitHub Pages, the PHP API will not run there.

## Security notes

- Never commit `api/config.php` to GitHub.
- Never expose `RESEND_API_KEY` in JavaScript.
- Use HTTPS in production.
- Use a strong unique admin password.
- Delete `api/setup.php` after database setup.
- Use a managed database/backups for important data.
- This demo uses bearer tokens stored in the browser; a production banking application should receive a professional security review and use stronger session, CSRF, rate-limit, audit, and infrastructure controls.
