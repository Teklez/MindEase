#!/usr/bin/env bash
# Run the ai-service natively (no Docker), for environments like RunPod
# where the host is already a container.
#
# Usage:
#   ./scripts/run-ai-service-native.sh                 # install deps + start with hot-reload
#   ./scripts/run-ai-service-native.sh --no-reload     # start without --reload
#   ./scripts/run-ai-service-native.sh --no-install    # skip pip install (faster restarts)
#   ./scripts/run-ai-service-native.sh --port 8080     # override default port 8002
#   ./scripts/run-ai-service-native.sh --host 0.0.0.0  # override default host 0.0.0.0
#   ./scripts/run-ai-service-native.sh --kill-port     # kill whoever owns the port first
#
# Env-var equivalents (CLI flags win):
#   HOST=0.0.0.0  PORT=8002  ./scripts/run-ai-service-native.sh
#
# Assumes ollama (if used) is reachable at $OLLAMA_URL (defaults to
# http://127.0.0.1:11434 — i.e. running inside the same pod). Set
# OLLAMA_URL in .env to point elsewhere, or rely on GEMINI_API_KEY only.

set -euo pipefail

cd "$(dirname "$0")/.."

HOST="${HOST:-0.0.0.0}"
PORT="${PORT:-8002}"
RELOAD="--reload"
INSTALL=1
KILL_PORT=0
VENV_DIR=".venv-ai-service"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --no-reload)  RELOAD="" ;;
    --no-install) INSTALL=0 ;;
    --host)       HOST="$2"; shift ;;
    --port)       PORT="$2"; shift ;;
    --kill-port)  KILL_PORT=1 ;;
    -h|--help)    sed -n '2,20p' "$0"; exit 0 ;;
    *)            echo "unknown arg: $1" >&2; exit 1 ;;
  esac
  shift
done

# Load .env from repo root so GEMINI_API_KEY, OLLAMA_URL, MODEL_NAME, etc.
# are exported into the process environment.
[[ -f .env ]] && set -a && . ./.env && set +a

# Default OLLAMA_URL to localhost (RunPod-style: ollama runs in the same pod).
export OLLAMA_URL="${OLLAMA_URL:-http://127.0.0.1:11434}"

# --- port-in-use precheck --------------------------------------------------
# Names the offending PID instead of letting uvicorn crash with `Errno 98`.
port_owner() {
  if command -v ss >/dev/null 2>&1; then
    ss -ltnp "sport = :$PORT" 2>/dev/null | awk 'NR>1 {print $0}'
  elif command -v lsof >/dev/null 2>&1; then
    lsof -nP -iTCP:"$PORT" -sTCP:LISTEN 2>/dev/null
  fi
}
owner="$(port_owner || true)"
if [[ -n "$owner" ]]; then
  echo ">>> port ${PORT} is already in use:"
  printf '    %s\n' "$owner"
  if [[ "$KILL_PORT" == "1" ]]; then
    pids="$(echo "$owner" | grep -oE 'pid=[0-9]+|[0-9]+' | grep -oE '[0-9]+' | sort -u || true)"
    if [[ -n "$pids" ]]; then
      echo ">>> --kill-port set; killing: $pids"
      kill $pids 2>/dev/null || true
      sleep 1
    fi
  else
    echo "    rerun with --kill-port to free it, or pick another port:"
    echo "      PORT=8002 $0     # env-var"
    echo "      $0 --port 8002   # flag"
    exit 1
  fi
fi

PYTHON="${PYTHON:-python3}"

if [[ ! -d "$VENV_DIR" ]]; then
  echo ">>> creating venv at $VENV_DIR"
  "$PYTHON" -m venv "$VENV_DIR"
fi

# shellcheck disable=SC1091
. "$VENV_DIR/bin/activate"

if [[ "$INSTALL" == "1" ]]; then
  echo ">>> installing ai-service requirements"
  pip install --disable-pip-version-check -q -r ai-service/requirements.txt
fi

cd ai-service
echo ">>> starting ai-service on ${HOST}:${PORT} (OLLAMA_URL=${OLLAMA_URL})"
exec uvicorn app.main:app --host "$HOST" --port "$PORT" $RELOAD
