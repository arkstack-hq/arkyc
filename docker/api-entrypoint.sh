#!/bin/sh
# Entrypoint for the Arkyc API image (see Dockerfile). Prepares runtime state,
# then execs the given command (the server, or `ark queue:work` for the worker).
set -e

cd /app

# APP_KEY derives the key that encrypts at-rest secrets (webhook secrets, 2FA) and
# must stay stable — rotating it makes existing encrypted data unreadable. If it
# isn't passed in, mint one with `ark key:generate` and persist it on the shared
# storage volume so restarts (and the worker) reuse the same key. The primary
# (migrating) container is the sole writer; the worker only ever reads it.
KEY_FILE="/app/storage/app/.appkey"
mkdir -p /app/storage/app

# A key is base64url (the alphabet `ark key:generate` emits). Anything else — empty,
# multi-line, log noise — is rejected rather than persisted, so a failed generation
# can never poison later boots.
is_valid_key() {
  case "$1" in
    '' | *[!A-Za-z0-9_-]*) return 1 ;;
    *) return 0 ;;
  esac
}

if [ -z "${APP_KEY:-}" ] && [ -s "$KEY_FILE" ]; then
  APP_KEY="$(cat "$KEY_FILE")"
  is_valid_key "$APP_KEY" || {
    echo "[entrypoint] $KEY_FILE is corrupt; delete it to have a new key minted." >&2
    exit 1
  }
fi

if [ -z "${APP_KEY:-}" ] && [ "${RUN_MIGRATIONS:-true}" = "true" ]; then
  # No pipe: `set -e` sees ark's real exit status (dash has no `pipefail`).
  APP_KEY="$(ark key:generate --show)"
  is_valid_key "$APP_KEY" || {
    echo "[entrypoint] 'ark key:generate --show' did not return a usable key." >&2
    exit 1
  }
  ( umask 077; printf '%s' "$APP_KEY" > "$KEY_FILE" )
  echo "[entrypoint] minted a new APP_KEY and persisted it to storage/app/.appkey"
fi

if [ -z "${APP_KEY:-}" ]; then
  echo "[entrypoint] APP_KEY is not set and none is persisted at $KEY_FILE." >&2
  echo "[entrypoint] Start the API (app profile) first so it mints one, or pass it:" >&2
  echo "[entrypoint]   APP_KEY=\$(cd apps/api && pnpm -s ark key:generate --show) docker compose --profile app up -d" >&2
  exit 1
fi
export APP_KEY

# Storage tree — a mounted volume may start empty — plus the public symlinks that
# `ark storage:link` would create (targets resolve under /app/storage).
mkdir -p storage/app/public storage/app/organizations public
ln -sfn /app/storage/app/public /app/public/storage
ln -sfn /app/storage/app/organizations /app/public/organizations

# Apply migrations before starting. This also (re)generates the arkormx column map
# (.arkormx/column-mappings.json) the ORM reads at runtime — rebuilt from the
# DB-backed applied-migration state, so it is correct even on a fresh container
# against an already-migrated database. Idempotent. Set RUN_MIGRATIONS=false on
# secondary containers (e.g. the worker) so only one process migrates.
if [ "${RUN_MIGRATIONS:-true}" = "true" ]; then
  echo "[entrypoint] applying migrations…"
  ark migrate
fi

exec "$@"
