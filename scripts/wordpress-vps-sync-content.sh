#!/usr/bin/env bash
set -euo pipefail

# Sync local WordPress theme/plugin code to production VPS.
# Usage:
#   TARGET_HOST=<host> TARGET_USER=deploy ./scripts/wordpress-vps-sync-content.sh
# Optional:
#   SSH_PORT=22 WP_ROOT=/var/www/hutaroblog/wordpress
#   LOCAL_THEME_DIR=wordpress/themes/hutaro-classic
#   LOCAL_PLUGIN_DIR=wordpress/plugins/hutaro-bridge
#   SUDO_PASSWORD='<sudo-password>' DRY_RUN=1 SKIP_REMOTE_LINT=1

TARGET_HOST="${TARGET_HOST:-}"
TARGET_USER="${TARGET_USER:-deploy}"
SSH_PORT="${SSH_PORT:-22}"
WP_ROOT="${WP_ROOT:-/var/www/hutaroblog/wordpress}"
LOCAL_THEME_DIR="${LOCAL_THEME_DIR:-wordpress/themes/hutaro-classic}"
LOCAL_PLUGIN_DIR="${LOCAL_PLUGIN_DIR:-wordpress/plugins/hutaro-bridge}"
REMOTE_STAGE_BASE="${REMOTE_STAGE_BASE:-/tmp/wp-sync-content}"
SUDO_PASSWORD="${SUDO_PASSWORD:-}"
DRY_RUN="${DRY_RUN:-0}"
SKIP_REMOTE_LINT="${SKIP_REMOTE_LINT:-0}"

if [[ -z "${TARGET_HOST}" ]]; then
  echo "ERROR: TARGET_HOST is required"
  exit 1
fi
if [[ ! -d "${LOCAL_THEME_DIR}" ]]; then
  echo "ERROR: LOCAL_THEME_DIR not found: ${LOCAL_THEME_DIR}"
  exit 1
fi
if [[ ! -d "${LOCAL_PLUGIN_DIR}" ]]; then
  echo "ERROR: LOCAL_PLUGIN_DIR not found: ${LOCAL_PLUGIN_DIR}"
  exit 1
fi

THEME_SLUG="$(basename "${LOCAL_THEME_DIR}")"
PLUGIN_SLUG="$(basename "${LOCAL_PLUGIN_DIR}")"
REMOTE_THEME_DIR="${WP_ROOT}/wp-content/themes/${THEME_SLUG}"
REMOTE_PLUGIN_DIR="${WP_ROOT}/wp-content/plugins/${PLUGIN_SLUG}"
REMOTE_THEME_STAGE="${REMOTE_STAGE_BASE}/themes/${THEME_SLUG}"
REMOTE_PLUGIN_STAGE="${REMOTE_STAGE_BASE}/plugins/${PLUGIN_SLUG}"

SSH_OPTS=(-p "${SSH_PORT}" -o ConnectTimeout=8)
RSYNC_RSH="ssh -p ${SSH_PORT} -o ConnectTimeout=8"
RSYNC_FLAGS=(-az --delete --exclude '.DS_Store')
if [[ "${DRY_RUN}" == "1" ]]; then
  RSYNC_FLAGS+=(--dry-run)
fi

echo "[wp-sync-content] host=${TARGET_USER}@${TARGET_HOST}:${SSH_PORT}"
echo "[wp-sync-content] theme: ${LOCAL_THEME_DIR} -> ${REMOTE_THEME_DIR}"
echo "[wp-sync-content] plugin: ${LOCAL_PLUGIN_DIR} -> ${REMOTE_PLUGIN_DIR}"
echo "[wp-sync-content] stage: ${REMOTE_STAGE_BASE}"

ssh "${SSH_OPTS[@]}" "${TARGET_USER}@${TARGET_HOST}" bash -s -- \
  "${REMOTE_THEME_STAGE}" "${REMOTE_PLUGIN_STAGE}" <<'REMOTE'
set -euo pipefail
REMOTE_THEME_STAGE="$1"
REMOTE_PLUGIN_STAGE="$2"
mkdir -p "${REMOTE_THEME_STAGE}" "${REMOTE_PLUGIN_STAGE}"
REMOTE

rsync "${RSYNC_FLAGS[@]}" -e "${RSYNC_RSH}" "${LOCAL_THEME_DIR}/" "${TARGET_USER}@${TARGET_HOST}:${REMOTE_THEME_STAGE}/"
rsync "${RSYNC_FLAGS[@]}" -e "${RSYNC_RSH}" "${LOCAL_PLUGIN_DIR}/" "${TARGET_USER}@${TARGET_HOST}:${REMOTE_PLUGIN_STAGE}/"

ssh "${SSH_OPTS[@]}" "${TARGET_USER}@${TARGET_HOST}" bash -s -- \
  "${REMOTE_THEME_DIR}" "${REMOTE_PLUGIN_DIR}" \
  "${REMOTE_THEME_STAGE}" "${REMOTE_PLUGIN_STAGE}" \
  "${SUDO_PASSWORD}" "${SKIP_REMOTE_LINT}" "${DRY_RUN}" <<'REMOTE'
set -euo pipefail
REMOTE_THEME_DIR="$1"
REMOTE_PLUGIN_DIR="$2"
REMOTE_THEME_STAGE="$3"
REMOTE_PLUGIN_STAGE="$4"
SUDO_PASSWORD="${5:-}"
SKIP_REMOTE_LINT="${6:-0}"
DRY_RUN="${7:-0}"

sudo_exec() {
  if [[ -n "${SUDO_PASSWORD}" ]]; then
    echo "${SUDO_PASSWORD}" | sudo -S -p '' "$@"
  else
    sudo -n "$@"
  fi
}

if ! sudo_exec mkdir -p "${REMOTE_THEME_DIR}" "${REMOTE_PLUGIN_DIR}"; then
  echo "ERROR: cannot prepare remote destination without sudo password."
  echo "       set SUDO_PASSWORD='<password>' and retry."
  exit 1
fi

if [[ "${DRY_RUN}" == "1" ]]; then
  sudo_exec rsync -an --delete "${REMOTE_THEME_STAGE}/" "${REMOTE_THEME_DIR}/"
  sudo_exec rsync -an --delete "${REMOTE_PLUGIN_STAGE}/" "${REMOTE_PLUGIN_DIR}/"
  echo "[wp-sync-content] dry-run complete"
  exit 0
fi

sudo_exec rsync -a --delete "${REMOTE_THEME_STAGE}/" "${REMOTE_THEME_DIR}/"
sudo_exec rsync -a --delete "${REMOTE_PLUGIN_STAGE}/" "${REMOTE_PLUGIN_DIR}/"
sudo_exec chown -R www-data:www-data "${REMOTE_THEME_DIR}" "${REMOTE_PLUGIN_DIR}"

if [[ "${SKIP_REMOTE_LINT}" != "1" ]]; then
  while IFS= read -r -d '' file; do
    php -l "${file}" >/dev/null
  done < <(find "${REMOTE_THEME_DIR}" "${REMOTE_PLUGIN_DIR}" -type f -name '*.php' -print0)
  echo "[wp-sync-content] remote php -l: ok"
else
  echo "[wp-sync-content] skip remote php -l (SKIP_REMOTE_LINT=1)"
fi

rm -rf "${REMOTE_THEME_STAGE}" "${REMOTE_PLUGIN_STAGE}" || true
REMOTE

echo "[wp-sync-content] done"
