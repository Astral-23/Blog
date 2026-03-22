#!/usr/bin/env bash
set -euo pipefail

# Extended remote security status for ConoHa VPS.
# Usage:
#   TARGET_HOST=<ip-or-domain> TARGET_USER=deploy ./scripts/remote-security-status.sh

TARGET_HOST="${TARGET_HOST:-}"
TARGET_USER="${TARGET_USER:-deploy}"
SSH_PORT="${SSH_PORT:-22}"

if [[ -z "$TARGET_HOST" ]]; then
  echo "ERROR: TARGET_HOST is required"
  exit 1
fi

echo "[remote-security-status] host=${TARGET_USER}@${TARGET_HOST}:${SSH_PORT}"
ssh -p "${SSH_PORT}" "${TARGET_USER}@${TARGET_HOST}" <<'EOF_REMOTE'
set -euo pipefail

echo "== service status =="
sudo systemctl is-active nginx || true
sudo systemctl is-active blog-app || true

echo
echo "== firewall =="
sudo ufw status verbose || true

echo
echo "== fail2ban =="
sudo fail2ban-client status || true
sudo fail2ban-client status sshd || true

echo
echo "== certbot timer =="
sudo systemctl status certbot.timer --no-pager -l || true

echo
echo "== local endpoint headers =="
for path in / /api/health /media/sample-grid.svg; do
  echo "-- ${path}"
  curl -sS -D - -o /dev/null "http://127.0.0.1${path}" | egrep -i '^(HTTP/|content-security-policy:|x-content-type-options:|x-frame-options:|referrer-policy:|permissions-policy:|content-type:)' || true
  echo
done

echo "== nginx recent errors =="
sudo tail -n 80 /var/log/nginx/error.log || true

echo
echo "== app recent errors =="
sudo tail -n 80 /var/log/blog/app.error.log || true
EOF_REMOTE
