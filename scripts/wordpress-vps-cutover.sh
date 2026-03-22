#!/usr/bin/env bash
set -euo pipefail

# Switch Nginx from Next.js blog site to WordPress site.
# Usage:
#   TARGET_HOST=<host> TARGET_USER=deploy ./scripts/wordpress-vps-cutover.sh
# Optional:
#   SSH_PORT=22 SUDO_PASSWORD='<sudo-password>'

TARGET_HOST="${TARGET_HOST:-}"
TARGET_USER="${TARGET_USER:-deploy}"
SSH_PORT="${SSH_PORT:-22}"
SUDO_PASSWORD="${SUDO_PASSWORD:-}"

if [[ -z "${TARGET_HOST}" ]]; then
  echo "ERROR: TARGET_HOST is required"
  exit 1
fi

SSH_OPTS=(-p "${SSH_PORT}" -o ConnectTimeout=8)

echo "[wp-cutover] host=${TARGET_USER}@${TARGET_HOST}:${SSH_PORT}"

ssh "${SSH_OPTS[@]}" "${TARGET_USER}@${TARGET_HOST}" bash -s -- "${SUDO_PASSWORD}" <<'REMOTE'
set -euo pipefail
SUDO_PASSWORD="$1"

sudo_exec() {
  if [[ -n "${SUDO_PASSWORD}" ]]; then
    echo "${SUDO_PASSWORD}" | sudo -S -p '' "$@"
  else
    sudo "$@"
  fi
}

if [[ ! -f /etc/nginx/sites-available/hutaroblog-wordpress ]]; then
  echo "ERROR: /etc/nginx/sites-available/hutaroblog-wordpress not found"
  exit 1
fi

# backup symlink status
if [[ -L /etc/nginx/sites-enabled/blog ]]; then
  sudo_exec cp -a /etc/nginx/sites-enabled/blog /tmp/blog.symlink.backup || true
fi

if [[ ! -L /etc/nginx/sites-enabled/hutaroblog-wordpress ]]; then
  sudo_exec ln -s /etc/nginx/sites-available/hutaroblog-wordpress /etc/nginx/sites-enabled/hutaroblog-wordpress
fi

if [[ -L /etc/nginx/sites-enabled/blog ]]; then
  sudo_exec rm -f /etc/nginx/sites-enabled/blog
fi

sudo_exec nginx -t
sudo_exec systemctl reload nginx

echo "[wp-cutover] done"
REMOTE
