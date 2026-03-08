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

## Tech stack

| Layer    | Stack |
|----------|--------|
| **Backend** | Python 3.11+, FastAPI, Uvicorn, SQLAlchemy 2.0 (async) + PostgreSQL, Alembic, Pydantic v2 |
| **Frontend** | Next.js 14, TypeScript, App Router, Tailwind CSS |
| **Infra** | Docker Compose: PostgreSQL 16, Redis 7, backend, frontend |

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
├── backend/          # FastAPI app (app/, alembic, Dockerfile)
├── frontend/         # Next.js app (src/app, Dockerfile)
├── docker-compose.yml
├── Makefile
├── .env.example
└── README.md
```

## Development

- **Backend:** Run migrations with `alembic upgrade head` (from `backend/` or `docker compose exec backend alembic upgrade head`).
- **Frontend:** `npm run dev` in `frontend/` for local dev without Docker.
