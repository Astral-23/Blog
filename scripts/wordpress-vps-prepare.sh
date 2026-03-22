#!/usr/bin/env bash
set -euo pipefail

# Prepare WordPress runtime on ConoHa VPS.
# Usage:
#   TARGET_HOST=<host> TARGET_USER=deploy WP_DB_PASSWORD='<password>' ./scripts/wordpress-vps-prepare.sh
# Optional:
#   WP_DB_NAME=hutaro_wp WP_DB_USER=hutaro_wp WP_INSTALL_PATH=/var/www/hutaroblog/wordpress SSH_PORT=22
#   SUDO_PASSWORD='<sudo-password>'

TARGET_HOST="${TARGET_HOST:-}"
TARGET_USER="${TARGET_USER:-deploy}"
SSH_PORT="${SSH_PORT:-22}"
WP_DB_NAME="${WP_DB_NAME:-hutaro_wp}"
WP_DB_USER="${WP_DB_USER:-hutaro_wp}"
WP_DB_PASSWORD="${WP_DB_PASSWORD:-}"
WP_INSTALL_BASE="${WP_INSTALL_BASE:-/var/www/hutaroblog}"
WP_INSTALL_PATH="${WP_INSTALL_PATH:-${WP_INSTALL_BASE}/wordpress}"
WP_VERSION="${WP_VERSION:-latest}"
SUDO_PASSWORD="${SUDO_PASSWORD:-}"

if [[ -z "${TARGET_HOST}" ]]; then
  echo "ERROR: TARGET_HOST is required"
  exit 1
fi
if [[ -z "${WP_DB_PASSWORD}" ]]; then
  echo "ERROR: WP_DB_PASSWORD is required"
  exit 1
fi

SSH_OPTS=(-p "${SSH_PORT}" -o ConnectTimeout=8)

echo "[wp-prepare] host=${TARGET_USER}@${TARGET_HOST}:${SSH_PORT}"

ssh "${SSH_OPTS[@]}" "${TARGET_USER}@${TARGET_HOST}" bash -s -- \
  "${WP_DB_NAME}" "${WP_DB_USER}" "${WP_DB_PASSWORD}" "${WP_INSTALL_BASE}" "${WP_INSTALL_PATH}" "${WP_VERSION}" "${SUDO_PASSWORD}" <<'REMOTE'
set -euo pipefail

WP_DB_NAME="$1"
WP_DB_USER="$2"
WP_DB_PASSWORD="$3"
WP_INSTALL_BASE="$4"
WP_INSTALL_PATH="$5"
WP_VERSION="$6"
SUDO_PASSWORD="$7"

if [[ ! "${WP_DB_NAME}" =~ ^[a-zA-Z0-9_]+$ ]]; then
  echo "ERROR: WP_DB_NAME must match ^[a-zA-Z0-9_]+$"
  exit 1
fi
if [[ ! "${WP_DB_USER}" =~ ^[a-zA-Z0-9_]+$ ]]; then
  echo "ERROR: WP_DB_USER must match ^[a-zA-Z0-9_]+$"
  exit 1
fi

sudo_exec() {
  if [[ -n "${SUDO_PASSWORD}" ]]; then
    echo "${SUDO_PASSWORD}" | sudo -S -p '' "$@"
  else
    sudo "$@"
  fi
}

echo "[wp-prepare] apt install"
sudo_exec apt update
sudo_exec apt install -y nginx mysql-server php-fpm php-mysql php-xml php-mbstring php-curl php-zip php-gd php-intl unzip rsync

echo "[wp-prepare] mysql database/user"
WP_DB_PASSWORD_SQL="${WP_DB_PASSWORD//\'/\'\'}"
MYSQL_SQL="
CREATE DATABASE IF NOT EXISTS ${WP_DB_NAME} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS '${WP_DB_USER}'@'localhost' IDENTIFIED BY '${WP_DB_PASSWORD_SQL}';
ALTER USER '${WP_DB_USER}'@'localhost' IDENTIFIED BY '${WP_DB_PASSWORD_SQL}';
GRANT ALL PRIVILEGES ON ${WP_DB_NAME}.* TO '${WP_DB_USER}'@'localhost';
FLUSH PRIVILEGES;
"
sudo_exec mysql -e "${MYSQL_SQL}"

echo "[wp-prepare] wordpress files"
sudo_exec mkdir -p "${WP_INSTALL_BASE}"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "${TMP_DIR}"' EXIT

if [[ "${WP_VERSION}" == "latest" ]]; then
  curl -fsSL "https://wordpress.org/latest.tar.gz" -o "${TMP_DIR}/wordpress.tar.gz"
else
  curl -fsSL "https://wordpress.org/wordpress-${WP_VERSION}.tar.gz" -o "${TMP_DIR}/wordpress.tar.gz"
fi

tar -xzf "${TMP_DIR}/wordpress.tar.gz" -C "${TMP_DIR}"
sudo_exec mkdir -p "${WP_INSTALL_PATH}"
sudo_exec rsync -a --delete "${TMP_DIR}/wordpress/" "${WP_INSTALL_PATH}/"
sudo_exec chown -R www-data:www-data "${WP_INSTALL_PATH}"

echo "[wp-prepare] wp-config.php"
if [[ ! -f "${WP_INSTALL_PATH}/wp-config.php" ]]; then
  sudo_exec cp "${WP_INSTALL_PATH}/wp-config-sample.php" "${WP_INSTALL_PATH}/wp-config.php"
fi

sudo_exec sed -i "s/database_name_here/${WP_DB_NAME}/" "${WP_INSTALL_PATH}/wp-config.php"
sudo_exec sed -i "s/username_here/${WP_DB_USER}/" "${WP_INSTALL_PATH}/wp-config.php"
sudo_exec sed -i "s/password_here/${WP_DB_PASSWORD//\//\\/}/" "${WP_INSTALL_PATH}/wp-config.php"

echo "[wp-prepare] done"
REMOTE

# Upload nginx config template
REMOTE_NGINX="/tmp/hutaroblog-wordpress.conf"
scp -P "${SSH_PORT}" ops/nginx/wordpress/hutaroblog-wordpress.conf "${TARGET_USER}@${TARGET_HOST}:${REMOTE_NGINX}"

ssh "${SSH_OPTS[@]}" "${TARGET_USER}@${TARGET_HOST}" bash -s -- "${REMOTE_NGINX}" "${SUDO_PASSWORD}" <<'REMOTE'
set -euo pipefail
REMOTE_NGINX="$1"
SUDO_PASSWORD="$2"

sudo_exec() {
  if [[ -n "${SUDO_PASSWORD}" ]]; then
    echo "${SUDO_PASSWORD}" | sudo -S -p '' "$@"
  else
    sudo "$@"
  fi
}

sudo_exec cp "${REMOTE_NGINX}" /etc/nginx/sites-available/hutaroblog-wordpress
sudo_exec nginx -t

echo "[wp-prepare] nginx config deployed to /etc/nginx/sites-available/hutaroblog-wordpress"
echo "[wp-prepare] next: run ./scripts/wordpress-vps-cutover.sh"
REMOTE

echo "[wp-prepare] completed"
