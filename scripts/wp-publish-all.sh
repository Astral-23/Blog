#!/usr/bin/env bash
set -euo pipefail

WP_ENV_FILE="${WP_ENV_FILE:-.env.wp.local}"
DEPLOY_ENV_FILE="${DEPLOY_ENV_FILE:-.env.deploy.local}"

if [[ -f "${WP_ENV_FILE}" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "${WP_ENV_FILE}"
  set +a
fi

if [[ -f "${DEPLOY_ENV_FILE}" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "${DEPLOY_ENV_FILE}"
  set +a
fi

TARGET_HOST="${TARGET_HOST:-blog-conoha}"
TARGET_USER="${TARGET_USER:-deploy}"
SUDO_PASSWORD="${SUDO_PASSWORD:-deploy}"

echo "[wp:publish:all] step 1/2 publish markdown -> wordpress"
npm run wp:publish:md

echo "[wp:publish:all] step 2/2 sync theme/plugin -> vps"
SUDO_PASSWORD="${SUDO_PASSWORD}" \
TARGET_HOST="${TARGET_HOST}" \
TARGET_USER="${TARGET_USER}" \
npm run wp:sync:content

echo "[wp:publish:all] done"
