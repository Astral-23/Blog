#!/usr/bin/env bash
set -euo pipefail

# One-command production deploy for this blog.
# Usage:
#   ./scripts/deploy-prod.sh

TARGET_HOST="${TARGET_HOST:-133.88.121.12}"
TARGET_USER="${TARGET_USER:-deploy}"

echo "[deploy-prod] target: ${TARGET_USER}@${TARGET_HOST}"
TARGET_HOST="${TARGET_HOST}" TARGET_USER="${TARGET_USER}" ./scripts/deploy.sh
