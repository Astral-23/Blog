#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
PYTHON_BIN="${OTHELLO_PYTHON_BIN:-python3}"
if [[ -n "${OTHELLO_VENV_DIR:-}" ]]; then
  VENV_DIR="$OTHELLO_VENV_DIR"
elif [[ -d "$ROOT_DIR/.venv-othello39" ]]; then
  VENV_DIR="$ROOT_DIR/.venv-othello39"
else
  VENV_DIR="$ROOT_DIR/.venv-othello"
fi
HOST="${OTHELLO_API_HOST:-127.0.0.1}"
PORT="${OTHELLO_API_PORT:-8765}"

if [[ ! -d "$VENV_DIR" ]]; then
  "$PYTHON_BIN" -m venv "$VENV_DIR"
fi

source "$VENV_DIR/bin/activate"

if command -v lsof >/dev/null 2>&1; then
  EXISTING_PID="$(lsof -ti "tcp:${PORT}" -sTCP:LISTEN 2>/dev/null | head -n 1 || true)"
  if [[ -n "${EXISTING_PID}" ]]; then
    HEALTH_URL="http://${HOST}:${PORT}/api/othello/health"
    if command -v curl >/dev/null 2>&1 && curl -fsS "$HEALTH_URL" >/dev/null 2>&1; then
      echo "Othello API is already running on ${HOST}:${PORT} (pid=${EXISTING_PID})."
      echo "Use ./scripts/stop-othello-api.sh to stop it first if you need a restart."
      exit 0
    fi
    echo "Port ${PORT} is already in use by pid=${EXISTING_PID}."
    echo "Stop the process or run with a different OTHELLO_API_PORT."
    exit 1
  fi
fi

python - <<'PY'
missing = []
for name in ("fastapi", "uvicorn"):
    try:
        __import__(name)
    except Exception:
        missing.append(name)
if missing:
    raise SystemExit(
        "Missing Python packages: " + ", ".join(missing) +
        ". Run: pip install -r services/othello_api/requirements.txt"
    )
try:
    __import__("pyspiel")
except Exception as exc:
    raise SystemExit(
        "pyspiel is missing or broken. Install OpenSpiel/pyspiel in the service environment first. "
        f"Original error: {exc!r}"
    )
PY

exec uvicorn services.othello_api.app:app --host "$HOST" --port "$PORT"
