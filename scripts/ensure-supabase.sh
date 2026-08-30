#!/usr/bin/env bash
# Starts the Supabase CLI local stack if it isn't already running.
# Idempotent — safe to call every `bun dev`. Deliberately does NOT call
# `supabase start` when already running: observed once (2026-08-29, see
# CLAUDE.md Learnings) to silently regenerate supabase/signing_keys.json's
# kid, invalidating already-issued local JWTs.
set -euo pipefail

if ! command -v supabase >/dev/null 2>&1; then
  echo "supabase CLI not found. Install: brew install supabase/tap/supabase (see README.md#local-development)." >&2
  exit 1
fi

if supabase status >/dev/null 2>&1; then
  echo "Supabase local stack already running."
else
  echo "Starting Supabase local stack..."
  supabase start
fi
