#!/usr/bin/env bash
# Run only the ai-service (and its ollama dependency) with hot-reload.
#
# Usage:
#   ./scripts/run-ai-service.sh              # build + start in foreground (logs attached)
#   ./scripts/run-ai-service.sh -d           # detached
#   ./scripts/run-ai-service.sh --no-ollama  # skip ollama (e.g. using Gemini only)
#   ./scripts/run-ai-service.sh --logs       # tail logs of an already-running service
#   ./scripts/run-ai-service.sh --down       # stop the ai-service (and ollama)

set -euo pipefail

cd "$(dirname "$0")/.."

COMPOSE=(docker compose -f docker-compose.yml -f docker-compose.dev.yml)
SERVICES=(ollama ai-service)
DETACH=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    -d|--detach)    DETACH="-d" ;;
    --no-ollama)    SERVICES=(ai-service) ;;
    --logs)         exec "${COMPOSE[@]}" logs -f ai-service ;;
    --down)         exec "${COMPOSE[@]}" stop ai-service ollama ;;
    -h|--help)      sed -n '2,9p' "$0"; exit 0 ;;
    *)              echo "unknown arg: $1" >&2; exit 1 ;;
  esac
  shift
done

# Load .env if present so GEMINI_API_KEY etc. reach the container
[[ -f .env ]] && set -a && . ./.env && set +a

"${COMPOSE[@]}" up --build $DETACH "${SERVICES[@]}"
