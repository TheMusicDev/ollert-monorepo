#!/usr/bin/env bash
# Installs every sub-project's dependencies. Runs automatically as root
# `bun install`'s postinstall hook — `bun install` (repo root) is enough
# to set up api/, web/, mcp/, and e2e/ too.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "==> web"
(cd "$ROOT_DIR/web" && bun install)

echo "==> mcp"
(cd "$ROOT_DIR/mcp" && bun install)

echo "==> e2e"
(cd "$ROOT_DIR/e2e" && bun install)

echo "==> api"
if command -v composer >/dev/null 2>&1; then
  (cd "$ROOT_DIR/api" && composer install)
else
  echo "composer not found on PATH — skipping api/ deps. Install composer, then run: (cd api && composer install)" >&2
fi
