#!/usr/bin/env bash
# Run the ai-service natively (no Docker), for environments like RunPod
# where the host is already a container.
#
# Usage:
#   ./scripts/run-ai-service-native.sh                 # install deps + start with hot-reload
#   ./scripts/run-ai-service-native.sh --no-reload     # start without --reload
#   ./scripts/run-ai-service-native.sh --no-install    # skip pip install (faster restarts)
#   ./scripts/run-ai-service-native.sh --port 8080     # override default port 8001
#   ./scripts/run-ai-service-native.sh --host 0.0.0.0  # override default host 0.0.0.0
#
# Assumes ollama (if used) is reachable at $OLLAMA_URL (defaults to
# http://127.0.0.1:11434 — i.e. running inside the same pod). Set
# OLLAMA_URL in .env to point elsewhere, or rely on GEMINI_API_KEY only.

set -euo pipefail

cd "$(dirname "$0")/.."

HOST="0.0.0.0"
PORT="8001"
RELOAD="--reload"
INSTALL=1
VENV_DIR=".venv-ai-service"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --no-reload)  RELOAD="" ;;
    --no-install) INSTALL=0 ;;
    --host)       HOST="$2"; shift ;;
    --port)       PORT="$2"; shift ;;
    -h|--help)    sed -n '2,15p' "$0"; exit 0 ;;
    *)            echo "unknown arg: $1" >&2; exit 1 ;;
  esac
  shift
done

# Load .env from repo root so GEMINI_API_KEY, OLLAMA_URL, MODEL_NAME, etc.
# are exported into the process environment.
[[ -f .env ]] && set -a && . ./.env && set +a

# Default OLLAMA_URL to localhost (RunPod-style: ollama runs in the same pod).
export OLLAMA_URL="${OLLAMA_URL:-http://127.0.0.1:11434}"

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
