# MindEase — AI-Powered Mental Health Support Platform

Monorepo with a FastAPI backend and Next.js 14 frontend, orchestrated with Docker Compose.

## Quick start

```bash
cp .env.example .env
docker compose up --build
```

If port 5432 is already in use, change the db port in `docker-compose.yml` (e.g. `"5433:5432"`).

- **Frontend:** http://localhost:3000  
- **API:** http://localhost:8000  
- **API docs (Swagger UI):** http://localhost:8000/docs  
- **Health:** http://localhost:8000/api/v1/health  

## Running the stack

| Command | Description |
|--------|-------------|
| `docker compose up --build` | Build and start all services (foreground) |
| `docker compose up --build -d` | Build and start in background |
| `docker compose down` | Stop and remove containers |

Or use the **Makefile** at the project root:

| Make target | Description |
|-------------|-------------|
| `make up` | `docker compose up --build -d` |
| `make down` | `docker compose down` |
| `make logs` | `docker compose logs -f` |
| `make migrate` | Run migrations: `alembic upgrade head` in backend |
| `make makemigrations m="description"` | Create a new migration (e.g. `make makemigrations m="add sessions table"`) |
| `make shell-backend` | Open a bash shell in the backend container |

## Database migrations

- **Apply migrations:**  
  `docker compose exec backend alembic upgrade head`

- **Create a new migration (after changing models):**  
  `docker compose exec backend alembic revision --autogenerate -m "description"`

Example:  
`docker compose exec backend alembic revision --autogenerate -m "add sessions table"`

## Architecture

```
Frontend (Next.js)  →  Backend (FastAPI)  →  AI Service (FastAPI)  →  Ollama (LLM)
       |                      |                        |
   Chat UI, Auth          REST + WebSocket         /generate, /check-crisis
   /api/* proxied         DB (PostgreSQL)          llama3.2:3b
```

- **Frontend** talks to the backend via REST and WebSocket. When `NEXT_PUBLIC_API_URL` is empty, API requests are proxied through Next.js to the backend; for WebSocket, set `NEXT_PUBLIC_WS_URL` (e.g. `ws://localhost:8000`) if the API is proxied.
- **Backend** handles auth, conversations, and messages; it calls the **AI service** for crisis detection and streaming responses. The backend never talks to Ollama directly.
- **AI service** runs the MindEase system prompt and calls **Ollama** for inference. It also exposes `/check-crisis` for keyword-based crisis detection.

## AI service and chat

The chat feature is powered by a separate **AI microservice** (`ai-service/`) that uses [Ollama](https://ollama.ai/) for local LLM inference.

### First-time setup: pull the model

After starting the stack, pull the Ollama model (one-time, ~2 GB):

```bash
docker compose exec ollama ollama pull llama3.2:3b
```

### Chat overview

- **Conversations** are created and listed via the backend; messages are stored in PostgreSQL.
- The **frontend** opens a WebSocket to the backend at `/ws/chat/{conversation_id}?token=...`. The backend streams tokens from the AI service and forwards crisis alerts.
- **Crisis detection** runs on each user message; if keywords are detected, a banner with resources (Ethiopia + international) is shown and the conversation is flagged.

### AI service endpoints

| Endpoint | Description |
|---------|-------------|
| `GET /health` | Service and model name |
| `POST /generate` | Chat completion (body: `messages`, `stream`, optional `user_lang`: `"am"` \| `"en"`) |
| `POST /translate` | Direct translation (body: `text`, `source_lang`, `target_lang`) |
| `POST /check-crisis` | Crisis keyword check (body: `text`) |

Configure via env: `OLLAMA_URL` (default `http://ollama:11434`), `MODEL_NAME` (default `llama3.2:3b`), `GEMINI_API_KEY` (optional; for Amharic chat translation).

### Gemini API key (Amharic chat)

To let users **chat in Amharic**, the AI service uses Google’s Gemini API to translate user messages to English (for Ollama) and AI responses back to Amharic.

1. Go to [Google AI Studio](https://aistudio.google.com/app/apikey).
2. Sign in and click **Create API key**.
3. Copy the key and add it to your `.env` file:
   ```bash
   GEMINI_API_KEY=your-api-key-here
   ```
4. Restart the stack so the ai-service picks up the variable.

If `GEMINI_API_KEY` is not set, the service still runs; Amharic messages are not translated (user text is sent as-is to the model, and responses are not translated).

## Tech stack

| Layer    | Stack |
|----------|--------|
| **Backend** | Python 3.11+, FastAPI, Uvicorn, SQLAlchemy 2.0 (async) + PostgreSQL, Alembic, Pydantic v2 |
| **Frontend** | Next.js 14, TypeScript, App Router, Tailwind CSS |
| **AI service** | FastAPI, httpx, Ollama (llama3.2:3b) |
| **Infra** | Docker Compose: PostgreSQL 16, Redis 7, Ollama, backend, ai-service, frontend |

## Environment variables

| Variable | Service | Description |
|----------|---------|-------------|
| `DATABASE_URL` | backend | PostgreSQL URL (e.g. `postgresql+asyncpg://user:pass@host:5432/db`) |
| `SECRET_KEY` | backend | JWT signing secret |
| `GOOGLE_CLIENT_ID` | backend | Google OAuth client ID (optional; used to verify token audience) |
| `GOOGLE_CLIENT_SECRET` | backend | Google OAuth client secret (optional) |
| `FRONTEND_URL` | backend | Allowed CORS origin(s), comma-separated |
| `REDIS_URL` | backend | Redis URL (optional) |
| `NEXT_PUBLIC_API_URL` | frontend | Backend API base URL |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | frontend | Google OAuth client ID for sign-in button |

See `.env.example` for a full list.

## Google OAuth (optional)

To enable “Sign in with Google” locally:

1. Open [Google Cloud Console](https://console.cloud.google.com/) → **APIs & Services** → **Credentials**.
2. Create an **OAuth 2.0 Client ID** (application type: **Web application**).
3. Under **Authorized JavaScript origins**, add `http://localhost:3000` (and your production origin when you deploy).
4. Copy the **Client ID** into your `.env`:
   - `NEXT_PUBLIC_GOOGLE_CLIENT_ID=<your-client-id>` (frontend)
   - `GOOGLE_CLIENT_ID=<your-client-id>` (backend; optional but recommended so the backend can verify the token audience)
   - `GOOGLE_CLIENT_SECRET` is not required for the current ID-token flow but can be set if you add server-side flows later.

Without these variables, the Google button is shown but disabled or will indicate that Google sign-in is not configured.

## Project structure

```
mindease/
├── ai-service/       # AI microservice (Ollama client, prompts)
├── backend/          # FastAPI app (app/, alembic, Dockerfile)
├── frontend/        # Next.js app (src/app, Dockerfile)
├── docker-compose.yml
├── Makefile
├── .env.example
└── README.md
```

## Development

- **Backend:** Run migrations with `alembic upgrade head` (from `backend/` or `docker compose exec backend alembic upgrade head`).
- **Frontend:** `npm run dev` in `frontend/` for local dev without Docker.
