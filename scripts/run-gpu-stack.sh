#!/usr/bin/env bash
# Run the full GPU inference stack on a single box (e.g. RunPod):
#   1. ollama daemon, bound to 127.0.0.1 (internal only)
#   2. ai-service FastAPI, bound to 0.0.0.0:8002 (the API the main app calls)
#
# Topology:
#   main app  ──HTTP──▶  ai-service :8002  ──HTTP──▶  ollama :11434  ──▶  GPU
#                       (public)            (loopback)
#
# Only port 8002 needs to be exposed by the pod / firewall.
#
# Usage:
#   ./scripts/run-gpu-stack.sh                       # full bring-up
#   ./scripts/run-gpu-stack.sh --no-pull             # skip `ollama pull`
#   ./scripts/run-gpu-stack.sh --model qwen2.5:14b   # override MODEL_NAME
#   ./scripts/run-gpu-stack.sh --port 8080           # ai-service port
#   ./scripts/run-gpu-stack.sh --ollama-port 11500   # change ollama loopback port
#   ./scripts/run-gpu-stack.sh --kill-port           # free a port if something is on it
#   MODEL_NAME=llama3.1:70b PORT=8080 ./scripts/run-gpu-stack.sh
#
# Env (read from .env at repo root):
#   MODEL_NAME       (default: llama3.1:8b)        — pulled into ollama
#   GEMINI_API_KEY   (optional)                    — enables translator/embed
#   OLLAMA_URL       (forced to http://127.0.0.1:11434 here)

set -euo pipefail

cd "$(dirname "$0")/.."

# ─── args ────────────────────────────────────────────────────────────────────
HOST="${HOST:-0.0.0.0}"
PORT="${PORT:-8002}"
OLLAMA_PORT="${OLLAMA_PORT:-11434}"
DO_PULL=1
KILL_PORT=0
NO_RELOAD=0
MODEL_OVERRIDE=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --no-pull)     DO_PULL=0 ;;
    --kill-port)   KILL_PORT=1 ;;
    --no-reload)   NO_RELOAD=1 ;;
    --model)       MODEL_OVERRIDE="$2"; shift ;;
    --host)        HOST="$2"; shift ;;
    --port)        PORT="$2"; shift ;;
    --ollama-port) OLLAMA_PORT="$2"; shift ;;
    -h|--help)     sed -n '2,28p' "$0"; exit 0 ;;
    *)             echo "unknown arg: $1" >&2; exit 1 ;;
  esac
  shift
done

log() { printf '\033[1;34m[%s] %s\033[0m\n' "$(date +%H:%M:%S)" "$*"; }
die() { printf '\033[1;31m[%s] ERROR: %s\033[0m\n' "$(date +%H:%M:%S)" "$*" >&2; exit 1; }

# ─── env ─────────────────────────────────────────────────────────────────────
if [[ -f .env ]]; then
  log "loading .env"
  set -a; . ./.env; set +a
fi

MODEL_NAME="${MODEL_OVERRIDE:-${MODEL_NAME:-llama3.1:8b}}"
export MODEL_NAME                                     # ai-service reads this
export OLLAMA_URL="http://127.0.0.1:${OLLAMA_PORT}"   # ai-service talks to local ollama
export OLLAMA_HOST="127.0.0.1:${OLLAMA_PORT}"         # ollama daemon binds here

log "stack config:"
log "  ai-service  ${HOST}:${PORT}     (exposed)"
log "  ollama      ${OLLAMA_HOST}      (loopback only)"
log "  model       ${MODEL_NAME}"
log "  gemini key  $([[ -n "${GEMINI_API_KEY:-}" ]] && echo set || echo unset)"

# ─── 1. install ollama if missing ────────────────────────────────────────────
ensure_linux_prereqs() {
  # ollama installer needs curl + zstd to extract its archive. On a fresh
  # RunPod container the apt cache is empty, so `apt-get install` will fail
  # with "Unable to locate package" until you `apt-get update` first.
  local missing=()
  command -v curl >/dev/null 2>&1 || missing+=(curl)
  command -v zstd >/dev/null 2>&1 || missing+=(zstd)
  [[ ${#missing[@]} -eq 0 ]] && return

  if ! command -v apt-get >/dev/null 2>&1; then
    die "missing tools (${missing[*]}) and no apt-get — install them manually"
  fi
  log "installing prereqs via apt-get: ${missing[*]}"
  apt-get update -qq
  DEBIAN_FRONTEND=noninteractive apt-get install -y -qq --no-install-recommends "${missing[@]}"
}

if ! command -v ollama >/dev/null 2>&1; then
  log "ollama not found — installing"
  case "$(uname -s)" in
    Linux)  ensure_linux_prereqs
            curl -fsSL https://ollama.com/install.sh | sh ;;
    Darwin) command -v brew >/dev/null || die "install Homebrew or Ollama.app manually"
            brew install ollama ;;
    *)      die "unsupported OS: $(uname -s)" ;;
  esac
else
  log "ollama present: $(ollama --version 2>&1 | head -n1)"
fi

# ─── 2. start ollama daemon ──────────────────────────────────────────────────
mkdir -p .runtime
OLLAMA_LOG=".runtime/ollama.log"

if curl -fsS -m 1 "${OLLAMA_URL}/api/tags" >/dev/null 2>&1; then
  log "ollama already serving at ${OLLAMA_URL}"
  OLLAMA_PID=""
else
  log "starting ollama daemon → ${OLLAMA_LOG}"
  ollama serve >"$OLLAMA_LOG" 2>&1 &
  OLLAMA_PID=$!
  log "ollama pid=${OLLAMA_PID}"

  # wait up to 60s for /api/tags
  for i in $(seq 1 60); do
    if curl -fsS -m 1 "${OLLAMA_URL}/api/tags" >/dev/null 2>&1; then
      log "ollama ready after ${i}s"
      break
    fi
    if ! kill -0 "$OLLAMA_PID" 2>/dev/null; then
      die "ollama exited early — see $OLLAMA_LOG"
    fi
    sleep 1
    [[ "$i" == "60" ]] && die "ollama did not become ready in 60s — see $OLLAMA_LOG"
  done
fi

# clean shutdown: kill ollama when this script exits
cleanup() {
  if [[ -n "${OLLAMA_PID:-}" ]] && kill -0 "$OLLAMA_PID" 2>/dev/null; then
    log "stopping ollama (pid ${OLLAMA_PID})"
    kill "$OLLAMA_PID" 2>/dev/null || true
    wait "$OLLAMA_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT INT TERM

# ─── 3. GPU sanity check ─────────────────────────────────────────────────────
if command -v nvidia-smi >/dev/null 2>&1; then
  GPU_LINE="$(nvidia-smi --query-gpu=name,memory.total --format=csv,noheader 2>/dev/null | head -n1 || true)"
  [[ -n "$GPU_LINE" ]] && log "GPU: $GPU_LINE" || log "GPU: nvidia-smi present but no device reported"
else
  log "GPU: no nvidia-smi (ollama will fall back to CPU — slow)"
fi

# ─── 4. pull model ───────────────────────────────────────────────────────────
if [[ "$DO_PULL" == "1" ]]; then
  if ollama list 2>/dev/null | awk '{print $1}' | grep -qx "$MODEL_NAME"; then
    log "model ${MODEL_NAME} already present — skipping pull"
  else
    log "pulling ${MODEL_NAME} (this can take a while)"
    ollama pull "$MODEL_NAME"
  fi
else
  log "skipping model pull (--no-pull)"
fi

# ─── 5. hand off to ai-service ───────────────────────────────────────────────
log "launching ai-service on ${HOST}:${PORT}"
AI_ARGS=(--host "$HOST" --port "$PORT")
[[ "$KILL_PORT" == "1" ]] && AI_ARGS+=(--kill-port)
[[ "$NO_RELOAD" == "1" ]] && AI_ARGS+=(--no-reload)
exec ./scripts/run-ai-service-native.sh "${AI_ARGS[@]}"
