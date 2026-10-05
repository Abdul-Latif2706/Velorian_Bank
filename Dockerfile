FROM php:8.2-apache

# Enable Apache rewrite support
RUN a2enmod rewrite

# Install PHP extensions required by Velorian Bank
RUN docker-php-ext-install pdo pdo_mysql

# Install cURL for Resend API requests
RUN apt-get update \
    && apt-get install -y libcurl4-openssl-dev \
    && docker-php-ext-install curl \
    && rm -rf /var/lib/apt/lists/*

# Copy the Velorian Bank application into Apache
COPY . /var/www/html/

# Allow Apache to serve the /api directory correctly
RUN printf '%s\n' \
    '<Directory /var/www/html>' \
    '    AllowOverride All' \
    '    Require all granted' \
    '</Directory>' \
    > /etc/apache2/conf-available/velorian.conf \
    && a2enconf velorian

# Make sure Apache owns the application files
RUN chown -R www-data:www-data /var/www/html

EXPOSE 80