#!/usr/bin/env bash
set -euo pipefail

# Validate env file format and required keys.
# Usage:
#   ./scripts/validate-env-file.sh --file .env.production --required "NODE_ENV PORT NEXT_PUBLIC_SITE_URL ACCESS_COUNTER_STORE_PATH"

FILE_PATH=".env.production"
REQUIRED_KEYS="NODE_ENV PORT NEXT_PUBLIC_SITE_URL ACCESS_COUNTER_STORE_PATH"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --file)
      FILE_PATH="$2"
      shift 2
      ;;
    --required)
      REQUIRED_KEYS="$2"
      shift 2
      ;;
    *)
      echo "ERROR: unknown argument: $1"
      exit 1
      ;;
  esac
done

if [[ ! -f "$FILE_PATH" ]]; then
  echo "ERROR: env file not found: $FILE_PATH"
  exit 1
fi

get_value() {
  local key="$1"
  local line
  line="$(grep -E "^${key}=" "$FILE_PATH" | tail -n 1 || true)"
  if [[ -z "$line" ]]; then
    return 1
  fi
  printf '%s' "${line#*=}"
}

require_non_empty_key() {
  local key="$1"
  local value

  if ! value="$(get_value "$key")"; then
    echo "ERROR: required key '$key' is missing in $FILE_PATH"
    exit 1
  fi

  value="${value%\r}"
  value="$(printf '%s' "$value" | sed -E 's/^\"(.*)\"$/\1/; s/^\x27(.*)\x27$/\1/')"

  if [[ -z "$value" ]]; then
    echo "ERROR: required key '$key' is empty in $FILE_PATH"
    exit 1
  fi

  printf '%s' "$value"
}

for key in $REQUIRED_KEYS; do
  require_non_empty_key "$key" >/dev/null
done

node_env="$(require_non_empty_key "NODE_ENV")"
if [[ "$node_env" != "production" ]]; then
  echo "ERROR: NODE_ENV must be 'production' in $FILE_PATH (got '$node_env')"
  exit 1
fi

port="$(require_non_empty_key "PORT")"
if ! [[ "$port" =~ ^[0-9]+$ ]] || (( port < 1 || port > 65535 )); then
  echo "ERROR: PORT must be an integer between 1 and 65535 in $FILE_PATH (got '$port')"
  exit 1
fi

site_url="$(require_non_empty_key "NEXT_PUBLIC_SITE_URL")"
if ! [[ "$site_url" =~ ^https?://[^[:space:]]+$ ]]; then
  echo "ERROR: NEXT_PUBLIC_SITE_URL must start with http:// or https:// in $FILE_PATH"
  exit 1
fi
if [[ "$site_url" =~ /$ ]]; then
  echo "ERROR: NEXT_PUBLIC_SITE_URL must not have trailing slash in $FILE_PATH"
  exit 1
fi

counter_store_path="$(require_non_empty_key "ACCESS_COUNTER_STORE_PATH")"
if ! [[ "$counter_store_path" =~ ^/[^[:space:]]+$ ]]; then
  echo "ERROR: ACCESS_COUNTER_STORE_PATH must be an absolute path in $FILE_PATH"
  exit 1
fi

echo "[validate-env-file] ok: $FILE_PATH"
