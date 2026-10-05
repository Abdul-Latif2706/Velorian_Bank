<?php
// Copy this file to api/config.php and fill in your hosting/database/email details.
// Never commit api/config.php to a public repository.

const DB_HOST = 'localhost';
const DB_NAME = 'velorian_bank';
const DB_USER = 'YOUR_DATABASE_USER';
const DB_PASS = 'YOUR_DATABASE_PASSWORD';

const ADMIN_EMAIL = 'admin@velorianbank.com';
const ADMIN_NAME = 'Hamza';
const ADMIN_PASSWORD = 'CHANGE_THIS_TO_A_STRONG_PASSWORD';

// Resend secret key. Keep this server-side only.
const RESEND_API_KEY = 'YOUR_RESEND_API_KEY';
const MAIL_FROM = 'Velorian Bank <no-reply@velorianbank.com>';

const APP_TIMEZONE = 'UTC';
