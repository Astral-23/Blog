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
CURL_CONNECT_TIMEOUT_SEC="${CURL_CONNECT_TIMEOUT_SEC:-5}"
CURL_MAX_TIME_SEC="${CURL_MAX_TIME_SEC:-10}"
SMOKE_POST_PATH="${SMOKE_POST_PATH:-/blog/1/}"

check_status() {
  local path="$1"
  local expected="$2"
  local code=""
  local attempt=1

  while [[ "$attempt" -le "$SMOKE_RETRIES" ]]; do
    code="$(curl -sS --connect-timeout "${CURL_CONNECT_TIMEOUT_SEC}" --max-time "${CURL_MAX_TIME_SEC}" -o /dev/null -w "%{http_code}" "${BASE_URL}${path}" 2>/dev/null || true)"
    if [[ -z "$code" || "$code" == "000" ]]; then
      code="000"
    fi
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

check_redirect() {
  local path="$1"
  local expected_code="$2"
  local expected_location="$3"
  local headers=""
  local code=""
  local location=""
  local attempt=1

  while [[ "$attempt" -le "$SMOKE_RETRIES" ]]; do
    headers="$(curl -sSI --connect-timeout "${CURL_CONNECT_TIMEOUT_SEC}" --max-time "${CURL_MAX_TIME_SEC}" "${BASE_URL}${path}" 2>/dev/null || true)"
    code="$(printf "%s\n" "$headers" | awk 'toupper($1) ~ /^HTTP\// {c=$2} END {print c}')"
    location="$(printf "%s\n" "$headers" | awk 'BEGIN{IGNORECASE=1} /^location:[[:space:]]*/ {sub(/\r$/, "", $0); sub(/^location:[[:space:]]*/,"",$0); print $0; exit}')"

    if [[ "$code" == "$expected_code" && "$location" == "$expected_location" ]]; then
      echo "OK: ${path} -> ${code} Location=${location} (attempt ${attempt}/${SMOKE_RETRIES})"
      return 0
    fi

    if [[ "$attempt" -lt "$SMOKE_RETRIES" ]]; then
      sleep "$SMOKE_DELAY_SEC"
    fi
    attempt=$((attempt + 1))
  done

  echo "FAIL: ${path} expected ${expected_code} Location=${expected_location}, got ${code} Location=${location}"
  exit 1
}

check_status "/" "200"
check_status "/blog/" "200"
check_status "${SMOKE_POST_PATH}" "200"
check_redirect "/category/blog/" "301" "${BASE_URL}/blog/"
check_status "/api/health" "200"
check_status "/api/access-counter?key=home" "200"

health_body="$(curl -sS --connect-timeout "${CURL_CONNECT_TIMEOUT_SEC}" --max-time "${CURL_MAX_TIME_SEC}" "${BASE_URL}/api/health" 2>/dev/null || true)"
if [[ -z "$health_body" ]]; then
  echo "FAIL: /api/health body request failed or returned empty response"
  exit 1
fi
if [[ "$health_body" != *"\"status\":\"ok\""* ]]; then
  echo "FAIL: /api/health body does not include status ok"
  exit 1
fi
echo "OK: /api/health body includes status ok"

counter_body="$(curl -sS --connect-timeout "${CURL_CONNECT_TIMEOUT_SEC}" --max-time "${CURL_MAX_TIME_SEC}" "${BASE_URL}/api/access-counter?key=home" 2>/dev/null || true)"
if [[ -z "$counter_body" ]]; then
  echo "FAIL: /api/access-counter body request failed or returned empty response"
  exit 1
fi
if [[ "$counter_body" != *"\"total\":"* ]]; then
  echo "FAIL: /api/access-counter body does not include total"
  exit 1
fi
echo "OK: /api/access-counter body includes total"

echo "[smoke-check] done"
