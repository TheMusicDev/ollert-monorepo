#!/bin/sh
set -e

# ponytail: migrations on every container start. Single replica on negrita
# so no race; phinx migrations are idempotent. Runs before php-fpm accepts
# traffic -> no new-code-old-schema window. If migrations fail the container
# exits, kamal's healthcheck fails, and the deploy rolls back — correct.
echo "==> Running pending migrations"
( cd /srv/api && bin/cake migrations migrate )

echo "==> Starting nginx (background) + php-fpm (foreground)"
nginx -g 'daemon off;' &
exec php-fpm -F