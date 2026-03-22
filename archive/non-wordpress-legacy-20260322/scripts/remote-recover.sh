#!/usr/bin/env bash
set -euo pipefail

# Remote quick recovery for ConoHa VPS.
# Usage:
#   TARGET_HOST=<ip-or-domain> TARGET_USER=deploy ./scripts/remote-recover.sh

TARGET_HOST="${TARGET_HOST:-}"
TARGET_USER="${TARGET_USER:-deploy}"
SSH_PORT="${SSH_PORT:-22}"

if [[ -z "$TARGET_HOST" ]]; then
  echo "ERROR: TARGET_HOST is required"
  exit 1
fi

echo "[remote-recover] host=${TARGET_USER}@${TARGET_HOST}:${SSH_PORT}"
ssh -p "${SSH_PORT}" "${TARGET_USER}@${TARGET_HOST}" <<'EOF'
set -euo pipefail
echo "== restarting services =="
sudo systemctl restart blog-app
sudo systemctl reload nginx

echo
echo "== service status =="
sudo systemctl status blog-app --no-pager -l || true
sudo systemctl status nginx --no-pager -l || true

echo
echo "== local health check =="
curl -sS -o /dev/null -w "/ -> %{http_code}\n" http://127.0.0.1/
curl -sS -o /dev/null -w "/blog -> %{http_code}\n" http://127.0.0.1/blog
curl -sS -o /dev/null -w "/api/health -> %{http_code}\n" http://127.0.0.1/api/health
EOF

echo "[remote-recover] done"
