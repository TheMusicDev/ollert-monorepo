# CakePHP 5 / PHP 8.5 API image.
# nginx + php-fpm in one container, fronted by kamal-proxy (which handles
# zero-downtime swaps). Migrations run in docker-entrypoint.sh before
# php-fpm starts — single replica, no race, phinx is idempotent.
FROM php:8.5-fpm-alpine

# ponytail: one container, two processes via a tiny entrypoint script.
# No supervisor — nginx in background, php-fpm is the foreground PID.
# php:8.5-fpm-alpine already ships static: mbstring, intl? no — only these
# are baked in: mbstring, ctype, simplexml, xml, dom, opcache, PDO, curl.
# We only ADD intl (needs icu-dev) + pdo_mysql (needs nothing, uses mysqlnd).
RUN apk add --no-cache \
        nginx \
        icu-dev icu-data-en \
    && docker-php-ext-install -j"$(nproc)" \
        pdo_mysql intl

# Copy composer from the official image — do NOT `apk add composer`, that
# pulls Alpine's system php85 (a second PHP at /etc/php85) which has no intl
# and makes composer install fail. This binary runs against /usr/local/bin/php.
COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

WORKDIR /srv/api

# Install deps first for better layer caching.
COPY composer.json composer.lock ./
RUN composer install --no-dev --optimize-autoloader --no-interaction --no-scripts

# App code. .dockerignore keeps vendor/ (reinstalled above), tmp/, logs/,
# tests/, .env out of the image.
COPY . .

# CakePHP needs writable tmp/ and logs/ (excluded by .dockerignore, so
# create empty ones owned by the php-fpm user).
RUN mkdir -p tmp logs && chown -R www-data:www-data tmp logs

# nginx config — CakePHP's webroot is the doc root, FastCGI to php-fpm:9000.
COPY docker/nginx.conf /etc/nginx/http.d/default.conf

COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
CMD ["php-fpm", "-F"]