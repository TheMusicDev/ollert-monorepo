#!/usr/bin/env bash
# Builds /web and syncs the static output to the shared PHP host over SSH.
# Local (non-CI) deploy script — see planning/architecture.md#deployment.
#
# Usage:
#   scripts/deploy-web.sh [--dry-run]
#
# Config: copy .env.deploy.example to .env.deploy (repo root) and fill in
# DEPLOY_HOST / DEPLOY_USER / DEPLOY_PATH (see that file for all vars).
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WEB_DIR="$ROOT_DIR/web"
ENV_FILE="$ROOT_DIR/.env.deploy"

DRY_RUN=0
if [[ "${1:-}" == "--dry-run" ]]; then
  DRY_RUN=1
fi

if [[ -f "$ENV_FILE" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
else
  echo "error: $ENV_FILE not found. Copy .env.deploy.example to .env.deploy and fill in real values." >&2
  exit 1
fi

: "${DEPLOY_HOST:?Set DEPLOY_HOST in .env.deploy}"
: "${DEPLOY_USER:?Set DEPLOY_USER in .env.deploy}"
: "${DEPLOY_PATH:?Set DEPLOY_PATH in .env.deploy}"
DEPLOY_PORT="${DEPLOY_PORT:-22}"

echo "==> Building web app (bun run build)"
( cd "$WEB_DIR" && bun run build )

BUILD_DIR="$WEB_DIR/.output/public"
if [[ ! -d "$BUILD_DIR" ]]; then
  echo "error: build output not found at $BUILD_DIR — did 'bun run build' succeed?" >&2
  exit 1
fi

# TanStack Start SPA mode prerenders the app shell to _shell.html rather than
# index.html (see web/README.md#deployment). Copy it to index.html so the
# host's default document and our .htaccess fallback both just work.
SHELL_HTML="$BUILD_DIR/_shell.html"
if [[ ! -f "$SHELL_HTML" ]]; then
  echo "error: expected prerendered shell at $SHELL_HTML — did the build succeed?" >&2
  exit 1
fi
cp "$SHELL_HTML" "$BUILD_DIR/index.html"

echo "==> Writing .htaccess (SPA catch-all rewrite to index.html)"
cat > "$BUILD_DIR/.htaccess" <<'HTACCESS'
<IfModule mod_rewrite.c>
  RewriteEngine On

  # Serve real files/directories as-is (assets, index.html, .htaccess itself).
  RewriteCond %{REQUEST_FILENAME} -f [OR]
  RewriteCond %{REQUEST_FILENAME} -d
  RewriteRule ^ - [L]

  # Everything else is a client-side route — fall back to the SPA shell.
  # No leading slash: mod_rewrite resolves this relative to the directory
  # containing this .htaccess, so it still works when DEPLOY_PATH is a
  # subdirectory rather than a vhost root (a leading slash would instead
  # resolve from the server's DocumentRoot and 404 in that case).
  RewriteRule ^ index.html [L]
</IfModule>
HTACCESS

SSH_CMD="ssh -p $DEPLOY_PORT"
if [[ -n "${DEPLOY_SSH_KEY:-}" ]]; then
  SSH_CMD="$SSH_CMD -i $DEPLOY_SSH_KEY"
fi

RSYNC_ARGS=(-avz --delete -e "$SSH_CMD")
if [[ "$DRY_RUN" -eq 1 ]]; then
  RSYNC_ARGS+=(--dry-run)
  echo "==> Dry run: syncing $BUILD_DIR/ to $DEPLOY_USER@$DEPLOY_HOST:$DEPLOY_PATH/ (no changes will be made)"
else
  echo "==> Syncing $BUILD_DIR/ to $DEPLOY_USER@$DEPLOY_HOST:$DEPLOY_PATH/"
fi

rsync "${RSYNC_ARGS[@]}" "$BUILD_DIR/" "$DEPLOY_USER@$DEPLOY_HOST:$DEPLOY_PATH/"

echo "==> Deploy complete"
