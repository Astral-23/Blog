#!/usr/bin/env bash
set -euo pipefail

PORT="${OTHELLO_API_PORT:-8765}"

if ! command -v lsof >/dev/null 2>&1; then
  echo "lsof is required to stop the Othello API process." >&2
  exit 1
fi

PIDS="$(lsof -ti "tcp:${PORT}" -sTCP:LISTEN 2>/dev/null || true)"
if [[ -z "$PIDS" ]]; then
  echo "No Othello API process is listening on port ${PORT}."
  exit 0
fi

echo "$PIDS" | xargs kill
echo "Stopped Othello API on port ${PORT}."
