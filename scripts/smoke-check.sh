#!/usr/bin/env bash
set -euo pipefail

# Usage:
#   BASE_URL=http://<ip-or-domain> ./scripts/smoke-check.sh

BASE_URL="${BASE_URL:-}"
if [[ -z "$BASE_URL" ]]; then
  echo "ERROR: BASE_URL is required (e.g. BASE_URL=http://203.0.113.10)"
  exit 1
fi
SMOKE_RETRIES="${SMOKE_RETRIES:-1}"
SMOKE_DELAY_SEC="${SMOKE_DELAY_SEC:-1}"

check_status() {
  local path="$1"
  local expected="$2"
  local code=""
  local attempt=1

  while [[ "$attempt" -le "$SMOKE_RETRIES" ]]; do
    code="$(curl -sS -o /dev/null -w "%{http_code}" "${BASE_URL}${path}" || echo "000")"
    if [[ "$code" == "$expected" ]]; then
      echo "OK: ${path} -> ${code} (attempt ${attempt}/${SMOKE_RETRIES})"
      return 0
    fi
    if [[ "$attempt" -lt "$SMOKE_RETRIES" ]]; then
      sleep "$SMOKE_DELAY_SEC"
    fi
    attempt=$((attempt + 1))
  done

  echo "FAIL: ${path} expected ${expected}, got ${code} after ${SMOKE_RETRIES} attempts"
  exit 1
}

check_status "/" "200"
check_status "/blog" "200"
check_status "/api/health" "200"

health_body="$(curl -sS "${BASE_URL}/api/health")"
if [[ "$health_body" != *"\"status\":\"ok\""* ]]; then
  echo "FAIL: /api/health body does not include status ok"
  exit 1
fi
echo "OK: /api/health body includes status ok"

echo "[smoke-check] done"
