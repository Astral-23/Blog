#!/usr/bin/env bash
set -euo pipefail

# Strict remote security audit for ConoHa VPS.
# Exits non-zero when required checks fail.
# Usage:
#   TARGET_HOST=<ip-or-domain> TARGET_USER=deploy ./scripts/remote-security-audit.sh
# Optional:
#   SSH_PORT=22 REQUIRE_CERTBOT_TIMER=0 AUDIT_FORMAT=text ./scripts/remote-security-audit.sh
#   AUDIT_FORMAT=json ./scripts/remote-security-audit.sh

TARGET_HOST="${TARGET_HOST:-}"
TARGET_USER="${TARGET_USER:-deploy}"
SSH_PORT="${SSH_PORT:-22}"
REQUIRE_CERTBOT_TIMER="${REQUIRE_CERTBOT_TIMER:-0}"
AUDIT_FORMAT="${AUDIT_FORMAT:-text}"

if [[ -z "$TARGET_HOST" ]]; then
  echo "ERROR: TARGET_HOST is required"
  exit 1
fi

if [[ "$AUDIT_FORMAT" != "text" && "$AUDIT_FORMAT" != "json" ]]; then
  echo "ERROR: AUDIT_FORMAT must be 'text' or 'json'"
  exit 1
fi

if [[ "$AUDIT_FORMAT" == "text" ]]; then
  echo "[remote-security-audit] host=${TARGET_USER}@${TARGET_HOST}:${SSH_PORT}"
fi

ssh -p "${SSH_PORT}" "${TARGET_USER}@${TARGET_HOST}" \
  "REQUIRE_CERTBOT_TIMER='${REQUIRE_CERTBOT_TIMER}' AUDIT_FORMAT='${AUDIT_FORMAT}' bash -s" <<'EOF_REMOTE'
set -euo pipefail

AUDIT_FORMAT="${AUDIT_FORMAT:-text}"
REQUIRE_CERTBOT_TIMER="${REQUIRE_CERTBOT_TIMER:-0}"
CHECK_ROWS=""
TOTAL=0
FAILED=0

escape_json() {
  local v="$1"
  v="${v//\\/\\\\}"
  v="${v//\"/\\\"}"
  v="${v//$'\n'/ }"
  printf "%s" "$v"
}

record() {
  local id="$1"
  local status="$2"
  local detail="$3"
  TOTAL=$((TOTAL + 1))
  if [[ "$status" != "pass" ]]; then
    FAILED=$((FAILED + 1))
  fi

  CHECK_ROWS+="${id}|${status}|${detail}"$'\n'

  if [[ "$AUDIT_FORMAT" == "text" ]]; then
    if [[ "$status" == "pass" ]]; then
      echo "OK: ${detail}"
    else
      echo "FAIL: ${detail}"
    fi
  fi
}

require_service_active() {
  local service="$1"
  local id="$2"
  local status
  status="$(sudo systemctl is-active "${service}" || true)"
  if [[ "$status" == "active" ]]; then
    record "$id" "pass" "service '${service}' is active"
  else
    record "$id" "fail" "service '${service}' is not active (got '${status}')"
  fi
}

require_header_contains() {
  local path="$1"
  local header="$2"
  local expected="$3"
  local id="$4"
  local dump

  dump="$(curl -sS -D - -o /dev/null "http://127.0.0.1${path}")"
  if printf "%s\n" "$dump" | grep -Eiq "^${header}:[[:space:]]*.*${expected}"; then
    record "$id" "pass" "${path} ${header} contains '${expected}'"
  else
    record "$id" "fail" "${path} missing header '${header}' containing '${expected}'"
  fi
}

require_status() {
  local path="$1"
  local expected="$2"
  local id="$3"
  local code

  code="$(curl -sS -o /dev/null -w "%{http_code}" "http://127.0.0.1${path}" || echo "000")"
  if [[ "$code" == "$expected" ]]; then
    record "$id" "pass" "${path} returns ${code}"
  else
    record "$id" "fail" "${path} expected ${expected}, got ${code}"
  fi
}

require_service_active "nginx" "service.nginx.active"
require_service_active "blog-app" "service.blog_app.active"

if sudo ufw status verbose | grep -qi '^Status:[[:space:]]*active'; then
  record "security.ufw.active" "pass" "ufw is active"
else
  record "security.ufw.active" "fail" "ufw is not active"
fi

if sudo fail2ban-client status sshd >/dev/null 2>&1; then
  record "security.fail2ban.sshd" "pass" "fail2ban sshd jail is available"
else
  record "security.fail2ban.sshd" "fail" "fail2ban sshd jail unavailable"
fi

if [[ "$REQUIRE_CERTBOT_TIMER" == "1" ]]; then
  require_service_active "certbot.timer" "service.certbot_timer.active"
fi

require_status "/" "200" "http.root.status"
require_status "/blog" "200" "http.blog.status"
require_status "/api/health" "200" "http.health.status"
require_status "/media/sample-grid.svg" "200" "http.media_sample.status"

require_header_contains "/" "content-security-policy" "default-src 'self'" "http.root.header.csp"
require_header_contains "/" "x-content-type-options" "nosniff" "http.root.header.nosniff"
require_header_contains "/" "x-frame-options" "DENY" "http.root.header.xfo"
require_header_contains "/" "referrer-policy" "strict-origin-when-cross-origin" "http.root.header.referrer"
require_header_contains "/" "permissions-policy" "camera=\(\)" "http.root.header.permissions"
require_header_contains "/media/sample-grid.svg" "content-type" "image/svg\+xml" "http.media_sample.header.content_type"
require_header_contains "/media/sample-grid.svg" "x-content-type-options" "nosniff" "http.media_sample.header.nosniff"

if [[ "$AUDIT_FORMAT" == "json" ]]; then
  host="$(hostname 2>/dev/null || echo unknown)"
  timestamp="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
  passed=$((TOTAL - FAILED))

  printf '{'
  printf '"host":"%s",' "$(escape_json "$host")"
  printf '"timestamp":"%s",' "$(escape_json "$timestamp")"
  printf '"require_certbot_timer":%s,' "$([[ "$REQUIRE_CERTBOT_TIMER" == "1" ]] && echo true || echo false)"
  printf '"summary":{"total":%d,"passed":%d,"failed":%d},' "$TOTAL" "$passed" "$FAILED"
  printf '"checks":['

  first=1
  while IFS='|' read -r id status detail; do
    [[ -z "$id" ]] && continue
    if [[ "$first" -eq 0 ]]; then
      printf ','
    fi
    first=0
    printf '{"id":"%s","status":"%s","detail":"%s"}' \
      "$(escape_json "$id")" \
      "$(escape_json "$status")" \
      "$(escape_json "$detail")"
  done <<< "$CHECK_ROWS"

  printf ']}'
  printf '\n'
else
  if [[ "$FAILED" -eq 0 ]]; then
    echo "[remote-security-audit] done: all ${TOTAL} checks passed"
  else
    echo "[remote-security-audit] done: ${FAILED}/${TOTAL} checks failed"
  fi
fi

if [[ "$FAILED" -gt 0 ]]; then
  exit 1
fi
EOF_REMOTE
