#!/usr/bin/env bash
set -euo pipefail

# Daily security audit pipeline.
# 1) run audit report (JSON)
# 2) generate markdown summary
# 3) run regression check if enough reports exist
# 4) prune old reports
#
# Usage:
#   TARGET_HOST=<ip-or-domain> TARGET_USER=deploy ./scripts/security-audit-daily.sh
# Optional:
#   AUDIT_REPORT_DIR=./audit-reports RETAIN_REPORTS=30 MAX_FAILED=0 MAX_NEW_FAILURES=0 ./scripts/security-audit-daily.sh

TARGET_HOST="${TARGET_HOST:-}"
TARGET_USER="${TARGET_USER:-deploy}"
SSH_PORT="${SSH_PORT:-22}"
REQUIRE_CERTBOT_TIMER="${REQUIRE_CERTBOT_TIMER:-0}"
AUDIT_REPORT_DIR="${AUDIT_REPORT_DIR:-./audit-reports}"
RETAIN_REPORTS="${RETAIN_REPORTS:-30}"
MAX_FAILED="${MAX_FAILED:-0}"
MAX_NEW_FAILURES="${MAX_NEW_FAILURES:-0}"

if [[ -z "$TARGET_HOST" ]]; then
  echo "ERROR: TARGET_HOST is required"
  exit 1
fi

mkdir -p "$AUDIT_REPORT_DIR"

echo "[security-audit-daily] step1: audit report"
TARGET_HOST="$TARGET_HOST" \
TARGET_USER="$TARGET_USER" \
SSH_PORT="$SSH_PORT" \
REQUIRE_CERTBOT_TIMER="$REQUIRE_CERTBOT_TIMER" \
AUDIT_REPORT_DIR="$AUDIT_REPORT_DIR" \
AUDIT_FAIL_ON_FAILED=0 \
./scripts/security-audit-report.sh

echo "[security-audit-daily] step2: summary"
node ./scripts/security-audit-summary.mjs \
  --input-dir="$AUDIT_REPORT_DIR" \
  --output="$AUDIT_REPORT_DIR/latest-summary.md" \
  --max-failed="$MAX_FAILED"

echo "[security-audit-daily] step3: regression"
json_count="$(find "$AUDIT_REPORT_DIR" -maxdepth 1 -name '*.json' | wc -l | tr -d ' ')"
if [[ "$json_count" -ge 2 ]]; then
  node ./scripts/security-audit-regression.mjs \
    --input-dir="$AUDIT_REPORT_DIR" \
    --output="$AUDIT_REPORT_DIR/latest-regression.md" \
    --max-new-failures="$MAX_NEW_FAILURES"
else
  echo "[security-audit-daily] skipped regression: need at least 2 reports"
fi

echo "[security-audit-daily] step4: prune old reports"
if [[ "$RETAIN_REPORTS" =~ ^[0-9]+$ ]]; then
  mapfile -t old_reports < <(ls -1t "$AUDIT_REPORT_DIR"/*.json 2>/dev/null | tail -n +$((RETAIN_REPORTS + 1)) || true)
  if [[ "${#old_reports[@]}" -gt 0 ]]; then
    rm -f "${old_reports[@]}"
    echo "[security-audit-daily] pruned ${#old_reports[@]} old reports"
  else
    echo "[security-audit-daily] no old reports to prune"
  fi
else
  echo "ERROR: RETAIN_REPORTS must be numeric"
  exit 1
fi

echo "[security-audit-daily] done"
