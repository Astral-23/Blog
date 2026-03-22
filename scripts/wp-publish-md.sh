#!/usr/bin/env bash
set -euo pipefail

PAYLOAD_PATH="${PAYLOAD_PATH:-$(pwd)/migration/wordpress/payload.json}"
WP_ENV_FILE="${WP_ENV_FILE:-.env.wp.local}"
SKIP_ASSET_OPTIMIZE="${SKIP_ASSET_OPTIMIZE:-0}"

if [[ -f "$WP_ENV_FILE" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$WP_ENV_FILE"
  set +a
fi

if [[ -z "${WP_BASE_URL:-}" || -z "${WP_USERNAME:-}" || -z "${WP_APP_PASSWORD:-}" ]]; then
  cat <<'EOF'
ERROR: missing environment variables.
Required:
  WP_BASE_URL
  WP_USERNAME
  WP_APP_PASSWORD

Example:
  WP_BASE_URL=https://hutaroblog.com \
  WP_USERNAME=hutaro_admin \
  WP_APP_PASSWORD='xxxx xxxx xxxx xxxx xxxx xxxx' \
  npm run wp:publish:md

Or create .env.wp.local:
  WP_BASE_URL=https://hutaroblog.com
  WP_USERNAME=hutaro_admin
  WP_APP_PASSWORD=xxxx xxxx xxxx xxxx xxxx xxxx
EOF
  exit 1
fi

if [[ "$SKIP_ASSET_OPTIMIZE" != "1" ]]; then
  echo "[wp:publish:md] optimize assets"
  npm run assets:optimize
else
  echo "[wp:publish:md] skip asset optimize (SKIP_ASSET_OPTIMIZE=1)"
fi

echo "[wp:publish:md] export markdown -> payload"
npm run wp:export -- --out="$(dirname "$PAYLOAD_PATH")"

echo "[wp:publish:md] import payload -> wordpress"
WP_BASE_URL="${WP_BASE_URL}" \
WP_USERNAME="${WP_USERNAME}" \
WP_APP_PASSWORD="${WP_APP_PASSWORD}" \
npm run wp:import:rest -- --payload="$PAYLOAD_PATH"

echo "[wp:publish:md] done"
