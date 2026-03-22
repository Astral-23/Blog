#!/usr/bin/env bash
set -euo pipefail

# Run remote security audit in JSON mode and store an audit report file.
# Usage:
#   TARGET_HOST=<ip-or-domain> TARGET_USER=deploy ./scripts/security-audit-report.sh
# Optional:
#   AUDIT_REPORT_DIR=./audit-reports REQUIRE_CERTBOT_TIMER=1 AUDIT_FAIL_ON_FAILED=1 ./scripts/security-audit-report.sh

TARGET_HOST="${TARGET_HOST:-}"
TARGET_USER="${TARGET_USER:-deploy}"
SSH_PORT="${SSH_PORT:-22}"
REQUIRE_CERTBOT_TIMER="${REQUIRE_CERTBOT_TIMER:-0}"
AUDIT_REPORT_DIR="${AUDIT_REPORT_DIR:-./audit-reports}"
AUDIT_FAIL_ON_FAILED="${AUDIT_FAIL_ON_FAILED:-1}"

if [[ -z "$TARGET_HOST" ]]; then
  echo "ERROR: TARGET_HOST is required"
  exit 1
fi

mkdir -p "$AUDIT_REPORT_DIR"

host_safe="${TARGET_HOST//[^a-zA-Z0-9_.-]/_}"
ts="$(date -u +"%Y%m%dT%H%M%SZ")"
report_path="${AUDIT_REPORT_DIR}/security-audit-${host_safe}-${ts}.json"
tmp_json="$(mktemp)"
trap 'rm -f "$tmp_json"' EXIT

set +e
TARGET_HOST="$TARGET_HOST" \
TARGET_USER="$TARGET_USER" \
SSH_PORT="$SSH_PORT" \
REQUIRE_CERTBOT_TIMER="$REQUIRE_CERTBOT_TIMER" \
AUDIT_FORMAT=json \
./scripts/remote-security-audit.sh > "$tmp_json"
audit_exit=$?
set -e

if ! node -e 'const fs=require("fs"); JSON.parse(fs.readFileSync(process.argv[1],"utf8"));' "$tmp_json" >/dev/null 2>&1; then
  echo "ERROR: audit output is not valid JSON"
  cat "$tmp_json"
  exit 1
fi

cp "$tmp_json" "$report_path"

summary="$(node -e 'const fs=require("fs");const d=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));const s=d.summary||{};process.stdout.write(`${s.passed??0}/${s.total??0} passed, failed=${s.failed??0}`);' "$report_path")"
failed_count="$(node -e 'const fs=require("fs");const d=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));process.stdout.write(String((d.summary&&d.summary.failed)||0));' "$report_path")"

echo "[security-audit-report] saved: $report_path"
echo "[security-audit-report] summary: $summary"

if [[ "$AUDIT_FAIL_ON_FAILED" == "1" && "$failed_count" != "0" ]]; then
  echo "[security-audit-report] failed checks detected"
  exit 1
fi

if [[ "$audit_exit" -ne 0 ]]; then
  echo "[security-audit-report] remote audit exited with non-zero (${audit_exit})"
  exit "$audit_exit"
fi

echo "[security-audit-report] done"
