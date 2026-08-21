# CakePHP Divergances

Tracks every place `/api` deviates from CakePHP 5's default `composer create-project cakephp/app` behavior/scaffold, and why. Check here before "fixing" something back to stock — it's probably intentional.

## No `config/app_local.php`

**Stock:** two-layer config — `config/app.php` (defaults/permanent settings, committed) + `config/app_local.php` (env-specific overrides, gitignored, generated from `config/app_local.example.php` by `Installer::postInstall()` on `composer install`).

**Here:** `app_local.php`/`app_local.example.php` don't exist. All per-environment values (`DATABASE_URL`, `SECURITY_SALT`, `SUPABASE_*`, `CORS_ALLOWED_ORIGINS`, etc.) come from `.env` → `env()` calls directly in `app.php`. `config/bootstrap.php`'s `Configure::load('app_local', 'default')` step is removed; `src/Console/Installer.php`'s `createAppLocalConfig()` and `setSecuritySalt()` (which used to write a random salt into `app_local.php` on install) are removed too.

**Why:** one config file, one place to read, instead of the same keys split across two files where the second silently wins. `.env` was already the intended per-environment mechanism for this project (Supabase/CORS vars, DB creds) — a second override layer on top of it was redundant.

**Consequence:** `composer install` no longer bootstraps anything for you. Copy `api/.env.example` → `api/.env` and fill it in (including `SECURITY_SALT` — nothing generates one automatically anymore) before first run.

## `.env` lives at `api/.env`, not `api/config/.env`

**Stock:** `config/bootstrap.php`'s (normally-commented-out) dotenv loader points at `CONFIG . '.env'`, i.e. `api/config/.env`.

**Here:** uncommented, pointed at `ROOT . DS . '.env'`, i.e. `api/.env` — sitting next to `api/composer.json`, matching where `docker/.env` and (once scaffolded) `web/.env` already live relative to their own service roots. `api/.env.example` moved to match.

**Why:** consistent convention across the three services in this monorepo (`docker/`, `api/`, `web/`) — each service's env file lives at that service's own root, not nested in a subdirectory.

## DSN (`*_URL`) config preferred over discrete host/port/user/pass keys

**Stock:** `app.php` already ships both forms side by side for `Datasources`, `Cache`, `EmailTransport`, and `Log` — literal `'host' => 'localhost'`-style keys as the default, plus a `'url' => env('SOME_URL', null)` key that (when set) overrides them via CakePHP's DSN parsing.

**Here:** same mechanism, but the project's own env vars only ever populate the `*_URL` form (`DATABASE_URL`, `DATABASE_TEST_URL`; optionally `CACHE_DEFAULT_URL`/`CACHE_CAKECORE_URL`/`CACHE_CAKEMODEL_URL`, `EMAIL_TRANSPORT_DEFAULT_URL`, `LOG_DEBUG_URL`/`LOG_ERROR_URL`) — never a `DB_HOST`/`DB_PORT`/`DB_USERNAME`/`DB_PASSWORD`-style split. `api/.env.example` documents the required ones and lists the optional ones commented out.

**Why:** one env var to set per resource instead of four or five; matches how the var was already used for `DATABASE_URL` in the shared `docker/` MariaDB setup.
