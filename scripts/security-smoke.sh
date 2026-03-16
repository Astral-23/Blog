#!/usr/bin/env bash
set -euo pipefail

# Security-focused smoke checks for remote environment.
# Usage:
#   BASE_URL=https://example.com ./scripts/security-smoke.sh

BASE_URL="${BASE_URL:-}"
if [[ -z "$BASE_URL" ]]; then
  echo "ERROR: BASE_URL is required (e.g. BASE_URL=https://example.com)"
  exit 1
fi

check_status() {
  local path="$1"
  local expected="$2"
  local code
  code="$(curl -sS -o /dev/null -w "%{http_code}" "${BASE_URL}${path}" || echo "000")"
  if [[ "$code" != "$expected" ]]; then
    echo "FAIL: ${path} expected ${expected}, got ${code}"
    exit 1
  fi
  echo "OK: ${path} -> ${code}"
}

check_header_contains() {
  local path="$1"
  local header="$2"
  local expected="$3"
  local dump
  dump="$(curl -sS -D - -o /dev/null "${BASE_URL}${path}")"

  if ! printf "%s\n" "$dump" | grep -Eiq "^${header}:[[:space:]]*.*${expected}"; then
    echo "FAIL: ${path} missing ${header} containing '${expected}'"
    exit 1
  fi

  echo "OK: ${path} ${header} contains '${expected}'"
}

check_status "/" "200"
check_status "/blog" "200"
check_status "/api/health" "200"
check_status "/media/sample-grid.svg" "200"

health_body="$(curl -sS "${BASE_URL}/api/health")"
if [[ "$health_body" != *"\"status\":\"ok\""* ]]; then
  echo "FAIL: /api/health body does not include status ok"
  exit 1
fi
echo "OK: /api/health body includes status ok"

check_header_contains "/" "content-security-policy" "default-src 'self'"
check_header_contains "/" "x-content-type-options" "nosniff"
check_header_contains "/" "x-frame-options" "DENY"
check_header_contains "/" "referrer-policy" "strict-origin-when-cross-origin"
check_header_contains "/" "permissions-policy" "camera=\(\)"
check_header_contains "/media/sample-grid.svg" "content-type" "image/svg\+xml"
check_header_contains "/media/sample-grid.svg" "x-content-type-options" "nosniff"

echo "[security-smoke] done"
