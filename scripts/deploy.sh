#!/usr/bin/env bash
set -euo pipefail

# Deploy current repository content to a remote VPS and restart the app service.
# Usage:
#   TARGET_HOST=example.com TARGET_USER=deploy ./scripts/deploy.sh
# Optional:
#   TARGET_PATH=/opt/blog/app APP_SERVICE=blog-app SSH_PORT=22 ./scripts/deploy.sh
#   AUTO_ROLLBACK_ON_FAILURE=1 BACKUP_PATH=/opt/blog/shared/backup-last ./scripts/deploy.sh
#   SECURITY_SMOKE_AFTER_DEPLOY=1 SMOKE_URL=https://example.com ./scripts/deploy.sh
#   REMOTE_SECURITY_AUDIT_AFTER_DEPLOY=1 REQUIRE_CERTBOT_TIMER=1 ./scripts/deploy.sh
#   REMOTE_SECURITY_AUDIT_FORMAT=json ./scripts/deploy.sh
#   REMOTE_SECURITY_AUDIT_REPORT_PATH=./audit-reports/latest.json ./scripts/deploy.sh
#   REQUIRED_ENV_KEYS="NODE_ENV PORT NEXT_PUBLIC_SITE_URL" ./scripts/deploy.sh

TARGET_HOST="${TARGET_HOST:-}"
TARGET_USER="${TARGET_USER:-deploy}"
TARGET_PATH="${TARGET_PATH:-/opt/blog/app}"
APP_SERVICE="${APP_SERVICE:-blog-app}"
SSH_PORT="${SSH_PORT:-22}"
AUTO_ROLLBACK_ON_FAILURE="${AUTO_ROLLBACK_ON_FAILURE:-0}"
BACKUP_PATH="${BACKUP_PATH:-/opt/blog/shared/backup-last}"
SECURITY_SMOKE_AFTER_DEPLOY="${SECURITY_SMOKE_AFTER_DEPLOY:-0}"
REMOTE_SECURITY_AUDIT_AFTER_DEPLOY="${REMOTE_SECURITY_AUDIT_AFTER_DEPLOY:-0}"
REQUIRE_CERTBOT_TIMER="${REQUIRE_CERTBOT_TIMER:-0}"
REMOTE_SECURITY_AUDIT_FORMAT="${REMOTE_SECURITY_AUDIT_FORMAT:-text}"
REMOTE_SECURITY_AUDIT_REPORT_PATH="${REMOTE_SECURITY_AUDIT_REPORT_PATH:-}"
REQUIRED_ENV_KEYS="${REQUIRED_ENV_KEYS:-NODE_ENV PORT NEXT_PUBLIC_SITE_URL}"

if [[ -z "$TARGET_HOST" ]]; then
  echo "ERROR: TARGET_HOST is required"
  exit 1
fi

rollback_remote() {
  if [[ "$AUTO_ROLLBACK_ON_FAILURE" != "1" ]]; then
    return 0
  fi

  echo "[deploy] auto rollback enabled. restoring from ${BACKUP_PATH} ..."
  ssh -p "${SSH_PORT}" "${TARGET_USER}@${TARGET_HOST}" "
    set -euo pipefail
    test -d '${BACKUP_PATH}' || { echo 'ERROR: backup not found'; exit 1; }
    rm -rf '${TARGET_PATH}'
    cp -a '${BACKUP_PATH}' '${TARGET_PATH}'
    sudo systemctl restart '${APP_SERVICE}'
  "
}

echo "[deploy] preflight checks..."
./scripts/release-preflight.sh

if [[ "$AUTO_ROLLBACK_ON_FAILURE" == "1" ]]; then
  echo "[deploy] creating backup at ${BACKUP_PATH} ..."
  ssh -p "${SSH_PORT}" "${TARGET_USER}@${TARGET_HOST}" "
    set -euo pipefail
    if test -d '${TARGET_PATH}'; then
      mkdir -p \"$(dirname "${BACKUP_PATH}")\"
      rm -rf '${BACKUP_PATH}'
      cp -a '${TARGET_PATH}' '${BACKUP_PATH}'
    fi
  "
fi

echo "[deploy] syncing files to ${TARGET_USER}@${TARGET_HOST}:${TARGET_PATH} ..."
rsync -az --delete \
  --exclude=".git" \
  --exclude=".next" \
  --exclude="node_modules" \
  --exclude="test-results" \
  --exclude=".env.production" \
  -e "ssh -p ${SSH_PORT}" \
  ./ "${TARGET_USER}@${TARGET_HOST}:${TARGET_PATH}/"

echo "[deploy] installing prod dependencies on remote..."
ssh -p "${SSH_PORT}" "${TARGET_USER}@${TARGET_HOST}" \
  "cd ${TARGET_PATH} && npm ci && npm run build"

echo "[deploy] validating environment file..."
ssh -p "${SSH_PORT}" "${TARGET_USER}@${TARGET_HOST}" \
  "test -f ${TARGET_PATH}/.env.production || { echo 'ERROR: .env.production not found on server'; exit 1; }"
ssh -p "${SSH_PORT}" "${TARGET_USER}@${TARGET_HOST}" "
  set -euo pipefail
  cd '${TARGET_PATH}'
  ./scripts/validate-env-file.sh --file .env.production --required '${REQUIRED_ENV_KEYS}'
"

echo "[deploy] restarting service ${APP_SERVICE}..."
if ! ssh -p "${SSH_PORT}" "${TARGET_USER}@${TARGET_HOST}" \
  "sudo systemctl restart ${APP_SERVICE} && sudo systemctl status ${APP_SERVICE} --no-pager -l"; then
  echo "[deploy] restart failed. collecting diagnostics..."
  ssh -p "${SSH_PORT}" "${TARGET_USER}@${TARGET_HOST}" \
    "sudo journalctl -u ${APP_SERVICE} -n 120 --no-pager; sudo tail -n 120 /var/log/blog/app.error.log || true"
  rollback_remote || true
  exit 1
fi

echo "[deploy] smoke-check..."
if [[ -z "${SMOKE_URL:-}" ]]; then
  REMOTE_SITE_URL="$(ssh -p "${SSH_PORT}" "${TARGET_USER}@${TARGET_HOST}" "
    set -euo pipefail
    sed -n 's/^NEXT_PUBLIC_SITE_URL=//p' '${TARGET_PATH}/.env.production' | head -n1
  " | tr -d '\r')"
  REMOTE_SITE_URL="${REMOTE_SITE_URL%\"}"
  REMOTE_SITE_URL="${REMOTE_SITE_URL#\"}"
  REMOTE_SITE_URL="${REMOTE_SITE_URL%\'}"
  REMOTE_SITE_URL="${REMOTE_SITE_URL#\'}"
  if [[ -n "${REMOTE_SITE_URL}" ]]; then
    SMOKE_URL="${REMOTE_SITE_URL}"
    echo "[deploy] smoke-check URL from NEXT_PUBLIC_SITE_URL: ${SMOKE_URL}"
  else
    SMOKE_URL="http://${TARGET_HOST}"
    echo "[deploy] smoke-check URL fallback: ${SMOKE_URL}"
  fi
else
  SMOKE_URL="${SMOKE_URL}"
  echo "[deploy] smoke-check URL override: ${SMOKE_URL}"
fi
SMOKE_RETRIES="${SMOKE_RETRIES:-10}"
SMOKE_DELAY_SEC="${SMOKE_DELAY_SEC:-2}"
if ! BASE_URL="${SMOKE_URL}" SMOKE_RETRIES="${SMOKE_RETRIES}" SMOKE_DELAY_SEC="${SMOKE_DELAY_SEC}" ./scripts/smoke-check.sh; then
  echo "[deploy] smoke-check failed."
  rollback_remote || true
  exit 1
fi
if [[ "$AUTO_ROLLBACK_ON_FAILURE" == "1" ]]; then
  echo "[deploy] smoke-check passed. backup retained at ${BACKUP_PATH}"
fi

if [[ "$SECURITY_SMOKE_AFTER_DEPLOY" == "1" ]]; then
  echo "[deploy] security-smoke..."
  if ! BASE_URL="${SMOKE_URL}" ./scripts/security-smoke.sh; then
    echo "[deploy] security-smoke failed."
    rollback_remote || true
    exit 1
  fi
fi

if [[ "$REMOTE_SECURITY_AUDIT_AFTER_DEPLOY" == "1" ]]; then
  echo "[deploy] remote-security-audit..."
  if [[ -n "$REMOTE_SECURITY_AUDIT_REPORT_PATH" ]]; then
    mkdir -p "$(dirname "$REMOTE_SECURITY_AUDIT_REPORT_PATH")"
    if ! TARGET_HOST="${TARGET_HOST}" TARGET_USER="${TARGET_USER}" SSH_PORT="${SSH_PORT}" REQUIRE_CERTBOT_TIMER="${REQUIRE_CERTBOT_TIMER}" AUDIT_FORMAT="${REMOTE_SECURITY_AUDIT_FORMAT}" ./scripts/remote-security-audit.sh > "$REMOTE_SECURITY_AUDIT_REPORT_PATH"; then
      echo "[deploy] remote-security-audit failed."
      echo "[deploy] report saved: $REMOTE_SECURITY_AUDIT_REPORT_PATH"
      rollback_remote || true
      exit 1
    fi
    echo "[deploy] report saved: $REMOTE_SECURITY_AUDIT_REPORT_PATH"
  elif ! TARGET_HOST="${TARGET_HOST}" TARGET_USER="${TARGET_USER}" SSH_PORT="${SSH_PORT}" REQUIRE_CERTBOT_TIMER="${REQUIRE_CERTBOT_TIMER}" AUDIT_FORMAT="${REMOTE_SECURITY_AUDIT_FORMAT}" ./scripts/remote-security-audit.sh; then
    echo "[deploy] remote-security-audit failed."
    rollback_remote || true
    exit 1
  fi
fi

echo "[deploy] done"
