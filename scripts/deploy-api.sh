#!/usr/bin/env bash
# Syncs /api to the shared PHP host over SSH, installs production
# dependencies remotely, and runs pending migrations.
# Local (non-CI) deploy script — see planning/architecture.md#deployment.
#
# Usage:
#   scripts/deploy-api.sh [--dry-run]
#
# Config: copy .env.deploy.example to .env.deploy (repo root) and fill in
# DEPLOY_HOST / DEPLOY_USER / API_DEPLOY_PATH (see that file for all vars —
# DEPLOY_HOST/DEPLOY_USER/DEPLOY_PORT/DEPLOY_SSH_KEY are shared with
# scripts/deploy-web.sh since both deploy to the same host).
#
# What this does NOT do (out of scope / manual, one-time setup on the host):
#   - Create api/.env on the remote host. It holds secrets (DATABASE_URL,
#     SECURITY_SALT, SUPABASE_*) and is deliberately excluded from the sync
#     (see EXCLUDES below) — create/edit it by hand over SSH before the
#     first deploy. See api/.env.example for the required keys.
#   - Install composer on the remote host. Assumed already available on
#     PATH (typical on shared PHP hosts); override the binary with
#     API_REMOTE_COMPOSER_BIN if it isn't called "composer" there.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
API_DIR="$ROOT_DIR/api"
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
: "${API_DEPLOY_PATH:?Set API_DEPLOY_PATH in .env.deploy}"
DEPLOY_PORT="${DEPLOY_PORT:-22}"
API_REMOTE_COMPOSER_BIN="${API_REMOTE_COMPOSER_BIN:-composer}"

if [[ ! -d "$API_DIR" ]]; then
  echo "error: $API_DIR not found." >&2
  exit 1
fi

# --- Local ssh/rsync transport args (plain arrays — no extra quoting needed
# beyond what bash already does for array elements passed as argv). ---
SSH_ARGS=(-p "$DEPLOY_PORT")
if [[ -n "${DEPLOY_SSH_KEY:-}" ]]; then
  SSH_ARGS+=(-i "$DEPLOY_SSH_KEY")
fi

# rsync's -e value is re-split by rsync's OWN argument parser, not a real
# shell, so it needs its own quoting convention (quote-doubling for an
# embedded quote, not the shell's '\'' idiom) — see scripts/deploy-web.sh
# for the full explanation and the history of getting this wrong.
RSYNC_SSH_CMD="ssh -p $DEPLOY_PORT"
if [[ -n "${DEPLOY_SSH_KEY:-}" ]]; then
  ESCAPED_SSH_KEY=$(printf '%s' "$DEPLOY_SSH_KEY" | sed "s/'/''/g")
  RSYNC_SSH_CMD="$RSYNC_SSH_CMD -i '$ESCAPED_SSH_KEY'"
fi

# Excluded from sync — and, since rsync leaves excluded paths alone on the
# receiver by default even with --delete, these are also left untouched on
# the remote across deploys:
#   .git/, .github/  - not needed to run the app
#   .env             - remote-managed secrets, never overwritten by us
#   vendor/          - installed remotely instead (see below): smaller
#                      transfer, and correct platform binaries for the
#                      remote's PHP/OS rather than whatever built this
#                      machine's vendor/ dir
#   tmp/, logs/      - runtime state (cache, sessions, log files); must
#                      survive deploys, not be replaced by an empty local copy
#   tests/           - dev-only, not needed in production
EXCLUDES=(
  --exclude=.git/
  --exclude=.github/
  --exclude=.env
  --exclude=vendor/
  --exclude=tmp/
  --exclude=logs/
  --exclude=tests/
)

RSYNC_ARGS=(-avz --delete -e "$RSYNC_SSH_CMD" "${EXCLUDES[@]}")
if [[ "$DRY_RUN" -eq 1 ]]; then
  RSYNC_ARGS+=(--dry-run)
  echo "==> Dry run: syncing $API_DIR/ to $DEPLOY_USER@$DEPLOY_HOST:$API_DEPLOY_PATH/ (no changes will be made)"
else
  echo "==> Syncing $API_DIR/ to $DEPLOY_USER@$DEPLOY_HOST:$API_DEPLOY_PATH/"
  echo "    --delete is on: any file under $API_DEPLOY_PATH/ not present in api/ (and not"
  echo "    one of the excluded paths above) will be removed. Only proceed if that path"
  echo "    is dedicated to this app (see .env.deploy.example)."
  read -r -p "    Continue? [y/N] " CONFIRM
  if [[ ! "$CONFIRM" =~ ^[Yy]$ ]]; then
    echo "Aborted." >&2
    exit 1
  fi
fi

rsync "${RSYNC_ARGS[@]}" "$API_DIR/" "$DEPLOY_USER@$DEPLOY_HOST:$API_DEPLOY_PATH/"

if [[ "$DRY_RUN" -eq 1 ]]; then
  echo "==> Dry run: skipping remote composer install / migrations."
  echo "==> Dry run complete"
  exit 0
fi

# --- Remote steps, run over a real remote shell (unlike rsync's -e string
# above, this command IS parsed by an actual shell on the far end — so it
# gets ordinary POSIX single-quote escaping, not rsync's quote-doubling). ---
sh_quote() {
  printf "'%s'" "$(printf '%s' "$1" | sed "s/'/'\\\\''/g")"
}

QUOTED_PATH=$(sh_quote "$API_DEPLOY_PATH")
REMOTE_CMD="cd $QUOTED_PATH && \
$API_REMOTE_COMPOSER_BIN install --no-dev --optimize-autoloader --no-interaction && \
mkdir -p tmp/cache/models tmp/cache/persistent tmp/cache/views tmp/sessions tmp/tests logs && \
bin/cake migrations migrate"

echo "==> Installing production dependencies and running migrations on $DEPLOY_HOST"
ssh "${SSH_ARGS[@]}" "$DEPLOY_USER@$DEPLOY_HOST" "$REMOTE_CMD"

echo "==> Deploy complete"
