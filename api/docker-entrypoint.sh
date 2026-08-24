#!/bin/sh
set -e

# ponytail: migrations on every container start. Single replica on negrita
# so no race; phinx migrations are idempotent. Runs before php-fpm accepts
# traffic -> no new-code-old-schema window. If migrations fail the container
# exits, kamal's healthcheck fails, and the deploy rolls back — correct.
echo "==> Running pending migrations"
( cd /srv/api && bin/cake migrations migrate )

# Migrations (and Cake's cache init) run as root here; php-fpm workers run
# as www-data. Cake creates tmp/cache/ (+ models/) during migrations as root,
# which then blocks www-data from writing the JWKS cache -> CacheWriteException
# -> every authed request 401s. Re-own so workers can write.
echo "==> Fixing tmp/logs ownership for www-data"
chown -R www-data:www-data /srv/api/tmp /srv/api/logs

echo "==> Starting nginx (background) + php-fpm (foreground)"
nginx -g 'daemon off;' &
exec php-fpm -F