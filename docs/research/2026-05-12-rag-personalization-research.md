---
date: 2026-05-12T01:30:00+03:00
researcher: anatoli
git_commit: 7886ba0130c85babd7cbb2c5187a597b05f71992
branch: main
repository: MindEase
topic: "RAG / Vector-Memory for Personalized AI Across Text Chat and Voice Avatar"
tags: [research, rag, pgvector, embeddings, memory, chat, avatar, voice, gemini-live, ollama, personalization, mood, assessments, resources, groups]
status: complete
last_updated: 2026-05-12
last_updated_by: anatoli
---

# Research: RAG / Vector-Memory for Personalized AI Across Text Chat and Voice Avatar

**Date**: 2026-05-12T01:30:00+03:00
**Researcher**: anatoli
**Git Commit**: `7886ba0130c85babd7cbb2c5187a597b05f71992`
**Branch**: `main`
**Repository**: MindEase

---

## Research Question

> "Right now when we talk with the AI, both in voice chat and actual chatting, no context is saved for that person's chat. Read the SDS to understand the project first. Now I want to add a vector database (RAG) to better help this person, remember him across stuff and generally make him better UX, help him better — so for all the things that are implemented, think and research about how we can use RAG technology to enhance the AI assisting him."

Two deliverables:
1. **Document, as-is**, every place in the codebase where the AI talks to the user and what context (if any) it currently sees.
2. **Map every user-data-producing feature already in the app to concrete RAG opportunities**, with file-level insertion points.

---

## Summary

The MindEase AI assistant today is **memory-less**:

- **Text chat** (`/chat/[id]`) feeds the AI a **fixed sliding window of the last 15 messages of the current conversation only** — plus one hard-coded system prompt. Nothing from prior conversations, mood entries, assessment results, favorited/viewed resources, or group activity is ever injected (`backend/app/services/chat_service.py:170-187`).
- **Voice chat** is two separate, parallel implementations:
  - `app/(main)/avatar/page.tsx` in the main frontend opens a Gemini Live WebSocket **directly from the browser to Google**, with only a static "stay in character as `{name, blurb}`" persona prompt — no user identity, no history, no MindEase backend involvement (`frontend/src/lib/gemini-avatar.ts:17-25, 131`).
  - `try-3d-avatar/` is a fully standalone Vite experiment, also talking directly to Gemini, with no persistence (`try-3d-avatar/src/gemini.ts`, `try-3d-avatar/src/AvatarScene.tsx`).
- The AI microservice (`ai-service/`) is **stateless**; it receives the full message list per request and forwards it to Ollama (`llama3.1:8b`). It does no vector retrieval (`ai-service/app/routes/generate.py:54-138`).
- The SDS at line 273 says "PostgreSQL with pgvector extension" but **pgvector is not installed, enabled, or referenced anywhere in code** — `docker-compose.yml:3` uses vanilla `postgres:16-alpine`, zero migrations run `CREATE EXTENSION vector`, zero matches for `embedding`/`vector`/`pgvector` in any source file (the only hit is in the SDS markdown). Redis is configured (`REDIS_URL` env + `redis:7-alpine` container) but **no Python code imports it**.

Rich user-data that *could* feed a RAG/memory layer is already being captured but never used to personalize the AI:

| Domain | Storage | Free-text? | Used in chat prompt? |
|---|---|---|---|
| Conversations + Messages | `conversations`, `messages` | yes (`content`) | **partially**: only last 15 of current convo |
| Mood entries (1–5 + 280-char note) | `mood_entries` | yes (`note`) | no |
| Self-assessments (PHQ-9, GAD-7, PSS — score + severity + JSONB responses) | `user_assessments` | structured | no |
| Resource library views/favorites | `user_resources` | no | no (but already drives a keyword-based recommender) |
| Peer-group messages | `group_messages` | yes (`content`) | only inside the same group, last 10 messages |
| Badges | `user_badges` | no | no |
| User profile (only `display_name`, `email`, `notification_preferences` JSON unused) | `users` | minimal | no |
| Crisis flags | `Conversation.crisis_detected`, `Message.is_crisis_flagged`, `GroupMessage.is_crisis_flagged` | boolean | no (only as an event during the current message) |

A journaling feature **does not exist**; the system prompt mentions "journaling prompts" as a coping suggestion (`chat_service.py:62`) but the only free-text user authorship in the DB is the mood `note` field (≤280 chars) and chat/group `content`.

The detailed RAG-opportunity section below maps every one of these surfaces to a concrete insertion point with file/line references for both retrieval (what to embed and query) and injection (where the prompt is assembled today).

---

## Detailed Findings

### A. Backend — text chat flow (current state)

#### A.1 The chat module is concentrated in three files

- REST + WebSocket router: `backend/app/api/v1/chat.py`
- Orchestration service: `backend/app/services/chat_service.py`
- AI microservice HTTP client: `backend/app/services/ai_client.py`

There is no dedicated `chat/`, `memory/`, or `retrieval/` subpackage.

#### A.2 REST endpoints (`backend/app/api/v1/chat.py`)

| Method | Path | Function | Lines |
|---|---|---|---|
| POST | `/api/v1/chat/conversations` | `create_conversation` | `chat.py:23-37` |
| GET | `/api/v1/chat/conversations` | `list_conversations` | `chat.py:40-52` |
| GET | `/api/v1/chat/conversations/{conversation_id}` | `get_conversation` | `chat.py:55-68` |
| PATCH | `/api/v1/chat/conversations/{conversation_id}` | `update_conversation` | `chat.py:71-85` |
| DELETE | `/api/v1/chat/conversations/{conversation_id}` | `archive_conversation` (soft-delete) | `chat.py:88-100` |
| WS | `/ws/chat/{conversation_id}?token=…` | `websocket_chat` | `chat.py:105-167` (registered `backend/app/main.py:66`) |

The WebSocket envelope is intentionally tiny: `{type:"message", content, locale?: "en"|"am"}` (`backend/app/api/v1/chat.py:141-157`). The client never attaches user history, mood, or any external metadata.

#### A.3 Message processing pipeline

`ChatService.process_message_stream` (`backend/app/services/chat_service.py:120-242`) is the single funnel:

1. Persist user `Message(sender_type="user")` (lines 147-155).
2. `ai_client.check_crisis(content)` — substring check against an English keyword list, see §B.4 (line 158).
3. **Build the prompt** (lines 170-187):
   ```python
   stmt = (
       select(Message)
       .where(Message.conversation_id == conversation_id)
       .order_by(Message.timestamp.desc())
       .limit(15)
   )
   # … reverse to oldest-first …
   context = [
       {"role": "system", "content": self.SYSTEM_PROMPT},
       *[{"role": "user" if m.sender_type == "user" else "assistant",
          "content": m.content} for m in last_messages],
   ]
   ```
   - Window: **fixed 15 messages**, no summarization, no overflow handling.
   - System prompt: static, loaded once at `__init__` from `chat_service.py:53-69` (mirrors `ai-service/prompts/system.txt`).
   - **No personalization at all**: not the user's `display_name`, not recent mood, not last assessment score, not preferred resource categories, not prior conversations, not language (Amharic is handled outside the message list, as a separate `user_lang` body field — `ai_client.py:51-53`).
4. Stream tokens via `AIClient.generate_response_stream` → POST `{AI_SERVICE_URL}/generate` SSE (`ai_client.py:44-71`).
5. Persist `Message(sender_type="ai")` (lines 195-205).
6. Auto-title the first exchange (line 213) and auto-log a `MoodEntry(entry_source="automatic")` when the conversation crosses 10 messages (lines 211-235).

#### A.4 Conversations are strictly user-scoped, never cross-referenced

- Every endpoint and the WS handler verify `conversation.user_id == current_user.user_id` (`chat_service.py:81-91, 93-118, 133-145`; `chat.py:128-137`).
- `process_message_stream` queries messages **only for the current `conversation_id`** (`chat_service.py:170-176`). There is no code path that loads other conversations belonging to the same user, no per-user summary, no "lifetime" memory blob.

#### A.5 Repo-wide grep confirms no existing memory/retrieval layer

Searched `backend/` for `memory`, `embedding`, `vector`, `pgvector`, `rag`, `summary`, `summarize`:
- `memory`, `embedding`, `vector`, `pgvector`, `rag`: **0 matches**.
- `summary`/`summarize`: only group unread counts (`schemas/group.py:90` `GroupUnreadSummary`, etc.) and `seed_mood_data.py:283`. No conversation summaries.
- `context`: only the literal Python variable in `chat_service.py:178, 191` and the system-prompt line "Remember context from the conversation" (`chat_service.py:66`).

---

### B. AI microservice — current state (`ai-service/`)

#### B.1 Layout

- `ai-service/app/main.py:19-22` — registers four routes.
- `ai-service/app/routes/health.py:6-9` — `GET /health` → `{status, model}`.
- `ai-service/app/routes/generate.py:54-138` — `POST /generate`.
- `ai-service/app/routes/translate.py:9-27` — `POST /translate`.
- `ai-service/app/routes/crisis.py:14-21` — `POST /check-crisis`.
- `ai-service/app/services/inference.py:1-59` — Ollama HTTP wrapper.
- `ai-service/app/services/translator.py:1-194` — Gemini EN↔AM translator.
- `ai-service/app/services/crisis_detector.py:1-53` — keyword crisis matcher.
- `ai-service/prompts/system.txt` — the **only** prompt file.

#### B.2 The static system prompt

`ai-service/prompts/system.txt` (22 lines) defines the "MindEase compassionate AI mental health support companion" persona, ending with "users may be from Ethiopia" (line 21). Loaded by `_load_system_prompt()` at `generate.py:23-26` and prepended only if the incoming `messages` array does not already include a `system` role (`generate.py:68-74`). The **backend always supplies its own system prompt first** (`chat_service.py:53-69`, identical wording), so the ai-service path 68-74 is effectively a fallback.

#### B.3 `/generate` is stateless and Amharic-aware

- Model: Ollama `llama3.1:8b` (`config.py:10`), HTTP target `{OLLAMA_URL}/api/chat`.
- Language pipeline (`generate.py:77-103`):
  - Autodetect Ethiopic Unicode block if `user_lang` missing (`translator.py:80-84`).
  - Append `"Always respond in Amharic"` or `"Always respond in English"` to the system message (`generate.py:84-97`).
  - For `am` requests, translate the *last user message only* to English via Gemini before sending to Ollama, then translate the English response back to Amharic (`generate.py:100-103`, non-stream branch 105-109; streaming-Amharic branch simulates streaming by word-splitting the translated answer 112-126).
- **No caching, no embeddings, no DB, no Redis, no per-user state** anywhere in the service. `requirements.txt` is 7 lines and contains no vector/embedding library (`fastapi`, `uvicorn`, `httpx`, `python-dotenv`, `pydantic`, `pydantic-settings`, `google-genai`).

#### B.4 `/check-crisis` is pure substring matching

Hard-coded English keyword list at `ai-service/app/services/crisis_detector.py:2-19` (`"suicide"`, `"kill myself"`, `"want to die"`, `"end it all"`, etc.). No Amharic keywords, no ML, no embeddings. The response is `{is_crisis, detected_keywords, resources}` with a static `CRISIS_RESOURCES` dict (Ethiopia helpline 251-111-234-567, IASP URL, Crisis Text Line).

---

### C. Frontend — text chat (`/chat/[id]`)

#### C.1 Components

- Route: `frontend/src/app/(main)/chat/[conversationId]/page.tsx:13-28` — renders `<ChatContainer conversationId/>`.
- Orchestrator: `frontend/src/components/chat/ChatContainer.tsx:24` — holds `messages, streamingContent, isStreaming, crisisResources, title`.
- WebSocket client: `frontend/src/hooks/useWebSocket.ts:9` → `frontend/src/lib/websocket.ts:30-94`.
- Sidebar: `frontend/src/components/chat/ChatSidebar.tsx:29` + `ConversationList.tsx:25` + `ConversationItem.tsx:25`.
- Starter prompts: `frontend/src/components/chat/StarterPrompts.tsx:16` — four hard-coded keys (`anxious`, `stress`, `talk`, `breathing`).

#### C.2 The WS payload is minimal

`ChatWebSocket.send` (`frontend/src/lib/websocket.ts:88-94`) sends only `{type:"message", content, locale?}`. The component never attaches mood, assessment scores, or anything else — even though the dashboard does pull this data via REST (`frontend/src/app/(main)/dashboard/page.tsx:70-84`, `useMoodData` at `frontend/src/hooks/useMoodData.ts:17`).

#### C.3 Cross-conversation surfacing today

- The only inter-page data passed into chat is a one-shot starter prompt stashed in `sessionStorage["mindease-initial-message"]` by `app/(main)/chat/page.tsx:34-47` and read once in `ChatContainer.tsx:138`.
- No "remember when I told you …" UI affordance exists anywhere.

#### C.4 No global store, no React Query

There is **no Redux, Zustand, TanStack Query, Jotai, or SWR** in `frontend/package.json`. State is per-page `useState` plus one app-wide `ConversationsContext` (`frontend/src/contexts/ConversationsContext.tsx:10-23`) scoped to the `(main)/chat` subtree.

---

### D. Frontend — voice avatar (`/avatar`)

#### D.1 Architecture

- Route: `frontend/src/app/(main)/avatar/page.tsx` (dynamic-imports the scene).
- Scene: `frontend/src/components/avatar/AvatarScene.tsx:652`.
- Voice/TTS client: `frontend/src/lib/gemini-avatar.ts` (uses `@google/genai`).
- 3D renderer: `@met4citizen/talkinghead` (`AvatarScene.tsx:4-5`, types in `frontend/src/types/talkinghead.d.ts`).
- Five hard-coded `AvatarOption` personas at `AvatarScene.tsx:38-85`, each `{name, blurb, intro, url, body, geminiVoice}` where `geminiVoice ∈ {Kore, Aoede, Charon, Fenrir, Puck}` (`frontend/src/lib/gemini-avatar.ts:44-50`).

#### D.2 The conversation is browser-direct-to-Gemini

`VoiceSession.open` (`frontend/src/lib/gemini-avatar.ts:119-171`) opens `ai.live.connect` to model `models/gemini-2.5-flash-native-audio-latest` with:
- `responseModalities: [Modality.AUDIO]`
- `systemInstruction` = `buildSystemPrompt(persona)` (`gemini-avatar.ts:17-25`) — a fixed instruction "stay in character as {name, blurb}, use CBT/mindfulness language" with the persona's `name` and `blurb` only. **No `display_name`, no mood history, no assessment results, no user identity** flows in.
- `outputAudioTranscription: {}` so the model returns a transcript alongside audio.
- `realtimeInputConfig.automaticActivityDetection.disabled = true` (push-to-talk).
- API key is `NEXT_PUBLIC_GEMINI_API_KEY` — i.e. the browser holds the key.

#### D.3 What is NOT happening

- No backend involvement at all — the voice path does not hit `/api/v1/*`, does not have a JWT, does not emit a `Message` row, does not consult `Conversation`s. Closing the session discards everything (`AvatarScene.tsx:181-186, 364-371`; `gemini-avatar.ts:183-190`).
- No transcripts persisted. The Gemini-side transcript at `gemini-avatar.ts:198-199` is rendered as a UI bubble and then lost.

---

### E. try-3d-avatar — standalone experiment

`try-3d-avatar/` is **not wired into MindEase** at all. It is a Vite+React+TypeScript app that talks directly to Gemini (`https://generativelanguage.googleapis.com/v1beta/models/...` and Gemini Live WebSocket) using a `VITE_GEMINI_API_KEY` from its own `.env`. It uses the same `@met4citizen/talkinghead` library (`try-3d-avatar/src/AvatarScene.tsx:48-81`) and Gemini Live model (`try-3d-avatar/src/gemini.ts:101-145`) as the production `/avatar` page. No localStorage, no sessionStorage, no IndexedDB, no backend calls. The `*.wav` files in `public/` (Karen, Daniel, Tessa, etc., macOS system-voice names) are not referenced from source; they're loose audition artifacts. `test_gemini_live_amharic.py` is a CLI smoke test that opens a Live session, sends one English wellness message, writes the PCM out to `gemini_live_amharic.wav`, and calls `open` on macOS.

This folder is effectively dead weight from a personalization perspective — any RAG work lives in the production backend / frontend `/avatar` page.

---

### F. Auxiliary user-data features (what the AI *could* remember)

#### F.1 Mood entries

- Model: `backend/app/models/mood_entry.py:12-35` — `MoodEntry(entry_id, user_id, mood_level: 1-5, note: Text≤280 chars, entry_source: "manual"|"automatic", created_at)`.
- Endpoints: `backend/app/api/v1/mood.py:27-115` — POST `/entries`, GET `/entries`, `/entries/today`, `/stats`, `/history`, `/trends`, `/calendar/{y}/{m}`, DELETE `/entries/{id}`, GET `/badges`.
- Frontend: `frontend/src/app/(main)/mood/page.tsx:1-127`, `frontend/src/components/mood/MoodCheckIn.tsx:26-46`.
- Note: chat already auto-inserts `MoodEntry(entry_source="automatic", note="Auto-logged from chat session")` at 10 messages (`chat_service.py:222-235`), so the system is already producing mood signals it never reads back.

#### F.2 Self-assessments (PHQ-9 / GAD-7 / PSS)

- Models: `backend/app/models/assessment.py` — `Assessment(questions: JSONB, scoring_logic: JSONB)` (lines 20-42) and `UserAssessment(responses: JSONB, score, feedback_level, feedback_text, completed_at)` (lines 45-73).
- Endpoints: `backend/app/api/v1/assessments.py:22-81`.
- Service: `backend/app/services/assessment_service.py:126-326` computes score, severity bucket, recommended resources, crisis flag.
- Three seeded assessments (`backend/app/seeds/seed_assessments.py:14-237`): Anxiety (GAD-7, 7Q, 21 max), Depression (PHQ-9, 9Q, 27 max — `crisis_question_id=9, crisis_threshold=1`), Stress (PSS, 7Q, 28 max). Each scoring-range entry already carries a `recommended_avatar` hint.
- Frontend: `frontend/src/app/(main)/assessments/{page,[id]/page,[id]/results/[rid]/page}.tsx`.

#### F.3 Resource library

- Models: `backend/app/models/resource.py:20-74` — `Resource(category, resource_type, url, …)` and `UserResource(viewed_at, is_favorite)` unique on `(user_id, resource_id)`.
- **A keyword-based, hand-rolled "recommender" already exists**: `backend/app/services/resource_service.py:158-288` (`get_recommendations`) inspects the user's last 7-day mood entries and last-3-conversation user messages, maps them through a static keyword map `_CHAT_TOPIC_MAP` (lines 21-50) to categories, and round-robins un-viewed resources. This is the closest thing in the codebase to "use user history to personalize" — a perfect candidate for RAG replacement.
- Endpoint hit from frontend: `GET /api/v1/resources/recommendations?limit=N` rendered by `frontend/src/components/resources/RecommendationCard.tsx`.

#### F.4 Peer-support groups

- Models: `backend/app/models/group.py:21-144` — `Group`, `GroupMember(role, last_read_at, is_muted)`, `GroupMessage(sender_type: "user"|"system"|"ai_moderator", content, is_crisis_flagged, is_deleted, timestamp)`.
- Group WebSocket: `/ws/group/{group_id}` (`backend/app/main.py:67`), handler at `backend/app/api/v1/groups.py:327-504`.
- **Groups already use a tiny context window**: `_build_ai_context` at `backend/app/services/group_service.py:853-864` queries the last `AI_CONTEXT_LIMIT=10` group messages (line 35) for AI auto-moderation and `@mention` replies (calls at lines 745, 749, 811, 815). Auto-mod triggers: "negative spiral" (≥3 negative-keyword hits in last 5 user messages, keyword list at lines 46-65) and "periodic check-in" every 30 user messages (lines 765-836).
- Rate limit: in-process 5 msg / 10 s per `(user, group)` (lines 27-29, 465-481) — comment at line 471 notes "multi-worker production would need Redis".

#### F.5 Badges / gamification

- `backend/app/models/badge.py:12-58` — `Badge(criteria_type: mood_count|mood_streak|chat_count|resource_view|assessment, criteria_value)` and `UserBadge(user_id, badge_id, earned_at)` unique on pair.
- `backend/app/services/badge_service.py:17-69` awarded from `MoodService.create_entry`, `ResourceService.track_view`, `AssessmentService.submit`.

#### F.6 User profile (sparse)

- `backend/app/models/user.py:12-30`: `user_id, email, password_hash, display_name, oauth_provider, oauth_id, is_verified, account_status, notification_preferences (JSON, never written), created_at, updated_at, last_login`.
- **No goals, triggers, language preference, age, gender, or therapy history** columns. Settings menu item in `frontend/src/components/layout/UserMenu.tsx:66-72` is `disabled` "coming soon".

#### F.7 Crisis events

- No dedicated `crisis_events` table. State is split across `Conversation.crisis_detected` (`backend/app/models/conversation.py:39-41`), `Message.is_crisis_flagged` (`backend/app/models/message.py:32-34`), `GroupMessage.is_crisis_flagged` (`backend/app/models/group.py:133-135`), and an in-memory `AssessmentResultResponse.crisis_detected` recomputed on each fetch (`backend/app/services/assessment_service.py:132-141, 256-264`).

#### F.8 Journaling

- **Does not exist as a feature**. Only matches for "journal" are mockup HTML (`frontend/design_handoff_mindease/mockups/{Landing,Dashboard}.html`) and the AI's system prompt suggesting "journaling prompts" as a coping technique (`chat_service.py:62`, `ai-service/prompts/system.txt:8-10`).

---

### G. Database, infra, and the pgvector gap

- 7 Alembic migrations in `backend/alembic/versions/` form a linear graph `None → 2c95fb6be872 → e1f3f93be43d → d31cbd36eac0 → a7c2f9d4e1b5 → b8d3fa2c5e7a → f56bf0ef7c81 → 3624aaa18a82 (head)`.
- All schemas use SQLAlchemy 2.0 + asyncpg. `Base = DeclarativeBase` at `backend/app/database.py:22`. UUID PKs use `gen_random_uuid()` (Postgres `pgcrypto`, implicitly available; not explicitly `CREATE EXTENSION`-ed in migrations but works on `postgres:16-alpine`).
- **pgvector is mentioned only once in the entire repo**: the SDS line at `MindEase Software Design Specification.md:273`. Zero matches for `pgvector`, `pg_vector`, `vector`, `VECTOR`, `embedding`, `Embedding`, `cosine` anywhere in code, migrations, Dockerfiles, compose files, requirements files, or env example.
- `docker-compose.yml:3` uses vanilla `postgres:16-alpine`, which does **not** ship pgvector.
- Neither `backend/requirements.txt` (15 lines) nor `ai-service/requirements.txt` (7 lines) contains any embedding library (no `sentence-transformers`, `pgvector`, `chromadb`, `faiss`, `qdrant-client`, `weaviate-client`, `langchain`, `llama-index`, `openai`).
- Redis status: `REDIS_URL` declared in `backend/app/config.py:14`, `redis:7-alpine` container started at `docker-compose.yml:18-21`, `REDIS_URL` passed to backend at `docker-compose.yml:61`, but **no Python file in `backend/` imports `redis` or `aioredis`**. The Redis container runs unused.
- Env example (`.env.example`) has no embedding/vector-related variables.

So: any RAG layer starts from a clean slate. Nothing to undo, nothing to migrate off.

---

## How RAG Can Plug Into Each Existing Feature

> The user explicitly asked for RAG enhancement opportunities, so this section lists insertion points rather than abstract recommendations. Each item names the concrete file/line where the current behavior lives.

### Layer 0 — Foundation (one-time)

1. **Enable pgvector on the existing Postgres**.
   - Switch the docker-compose image at `docker-compose.yml:3` from `postgres:16-alpine` → `pgvector/pgvector:pg16` (drop-in image maintained by the pgvector authors).
   - Add a new Alembic migration that runs `op.execute("CREATE EXTENSION IF NOT EXISTS vector")` and creates one or more `embeddings` tables (see below).
   - Add `pgvector>=0.3.0` (Python binding) to `backend/requirements.txt`.

2. **Pick an embedding model**. Two options that fit the existing stack:
   - **Ollama-hosted** — Ollama (`docker-compose.yml:23`) can serve `nomic-embed-text` (768-d) or `mxbai-embed-large` (1024-d) over the same `OLLAMA_URL`. Add an `EMBED_MODEL_NAME` env, expose a new `POST /embed` endpoint in `ai-service/app/routes/` mirroring `/generate` (`ai-service/app/routes/generate.py:54`).
   - **Gemini-hosted** — the project already uses `google-genai` for Amharic translation (`ai-service/app/services/translator.py:106-111`). Reuse the same `GEMINI_API_KEY` to call `text-embedding-004` (768-d) for free-tier-friendly multilingual embeddings (including Amharic) — important because users may write notes/messages in Amharic which Ollama embeddings handle less well.

3. **Embedding schema (suggested unified store)**. One row per chunk lets you mix sources in a single retrieval call:
   ```sql
   CREATE TABLE memory_chunks (
       chunk_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
       user_id         UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
       source_kind     VARCHAR(32) NOT NULL,    -- 'message' | 'mood_note' | 'assessment_result' | 'resource_view' | 'group_message' | 'profile_fact' | 'summary'
       source_id       UUID,                    -- FK to whichever table the chunk came from (nullable for summaries)
       conversation_id UUID,                    -- optional grouping
       text            TEXT NOT NULL,
       embedding       vector(768) NOT NULL,
       metadata        JSONB,                   -- {mood_level, severity, category, language, crisis, timestamp_iso, ...}
       created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
   );
   CREATE INDEX ON memory_chunks USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
   CREATE INDEX ON memory_chunks (user_id, source_kind, created_at DESC);
   ```
   Why one table: the retrieval prompt-builder filters by `WHERE user_id = $1 ORDER BY embedding <=> $2 LIMIT k`, optionally restricted by `source_kind`. Migrations for this go alongside an Alembic head bump.

4. **Indexing service** (a tiny new module, e.g. `backend/app/services/memory_service.py`) with:
   - `index(user_id, source_kind, source_id, text, metadata)` — embed + insert + upsert.
   - `retrieve(user_id, query_text, k=8, kinds=None, since=None) -> list[Chunk]` — cosine search.
   - `summarize_conversation(conversation_id)` — periodic background job that calls the LLM to compress old messages into a few sentences once a conversation exceeds N messages (replaces the brittle fixed-15 window).

### Layer 1 — Text chat (`/chat/[id]`) personalization

The exact insertion point is `backend/app/services/chat_service.py:170-187` (the prompt builder). Today it appends only the last 15 messages of the current conversation. Replace it with a layered context:

| Layer | What | Source | k or window |
|---|---|---|---|
| 1 | **System prompt** | static (`chat_service.py:53-69`), optionally extended with per-user facts | n/a |
| 2 | **Per-user "profile card"** | derived from `User.display_name`, latest `UserAssessment` per type, mood stats from `MoodService.get_user_stats` | always |
| 3 | **Short-term window** | last 8-10 messages of the current conversation (replaces the 15 cap) | recency |
| 4 | **Long-term retrieval** | `memory_service.retrieve(user_id, latest_user_message, k=6, kinds=["message","mood_note","summary"])` filtered to messages **older than** the short-term window — explicitly select messages **from other conversations** to give cross-session memory | top-k cosine |
| 5 | **Recent affective state** | last 3-5 mood entries (latest 7 days) injected as structured facts ("user logged 2/5 on May 9 with note: …") | last N |
| 6 | **Latest assessment severity** | `feedback_level` from the most recent `UserAssessment` per `assessment_type` (Anxiety / Depression / Stress) | always |
| 7 | **Crisis history flag** | true if any of `Conversation.crisis_detected`, `Message.is_crisis_flagged` in the last 30 days | always, used to tighten safety phrasing |

Concretely, change `process_message_stream` to:
```python
# replace lines 170-187 with:
profile_facts = await profile_service.build_profile_block(db, user_id)            # new
mood_facts    = await mood_service.recent_summary(db, user_id, days=7)            # exists (get_user_stats) — reuse
assessment_facts = await assessment_service.latest_per_type(db, user_id)          # new lightweight helper
retrieved     = await memory_service.retrieve(db, user_id, content, k=6,
                                              exclude_conversation=conversation_id)
short_term    = last_messages_of(db, conversation_id, n=10)                       # existing pattern

system_block = self.SYSTEM_PROMPT + "\n\n## What we know about this user\n" + \
               profile_facts + "\n\n## Recent mood\n" + mood_facts + \
               "\n\n## Latest screenings\n" + assessment_facts + \
               "\n\n## Relevant past moments (retrieved)\n" + format_chunks(retrieved)
context = [{"role": "system", "content": system_block}, *short_term_as_roles]
```
Then call `memory_service.index(...)` after persisting the user message **and** after persisting the AI message (lines 155 and 205). This means every chat turn is both consumed and produced by the memory store.

### Layer 2 — Voice avatar (`/avatar` page) personalization

The voice path today bypasses the backend entirely (`frontend/src/lib/gemini-avatar.ts:131`). Two compatible paths to add memory:

**Option A — keep direct-to-Gemini Live, enrich `systemInstruction` from the backend.**
- Before opening the Live session, the frontend hits a new backend endpoint `GET /api/v1/avatar/context?persona={name}` that returns a pre-built system instruction string composed of (a) the persona's `name/blurb`, (b) the same profile/mood/assessment/retrieved-chunks blocks as in Layer 1, but truncated to fit Live's `systemInstruction` budget. Inject the returned string into `buildSystemPrompt` (`frontend/src/lib/gemini-avatar.ts:17-25`).
- Pro: minimal change, voice still streams audio directly from Google.
- Con: no incremental memory writes — what the user says during a voice call is lost unless you also stream the transcript back.

**Option B — proxy Gemini Live through the backend.**
- Add a backend WebSocket route `/ws/voice/{conversation_id}` that forwards client audio frames to Gemini Live (the Python `google-genai` SDK supports `client.aio.live.connect` — see `try-3d-avatar/test_gemini_live_amharic.py:38-49` for the exact pattern) and forwards Gemini's PCM + transcript back to the browser. Persist each turn (user transcript + AI transcript) as `Message` rows on a "voice" conversation, then call `memory_service.index(...)` on each. This makes voice and text share one memory store and lets you reuse the same retrieval block.
- Pro: complete memory parity with text chat, hides the API key, allows crisis interception on voice transcripts via the existing `ai_client.check_crisis` path.
- Con: more code; latency from extra hop (mitigated by streaming).

Either way, the persona prompt in `frontend/src/components/avatar/AvatarScene.tsx:38-85` should also receive the user's `display_name` so the avatar can address them by name from the first second of the call.

### Layer 3 — Replace the keyword recommender with semantic retrieval

`backend/app/services/resource_service.py:158-288` is already attempting personalization with the static `_CHAT_TOPIC_MAP` keyword table at lines 21-50. Replace it with:

- Index every `Resource` row (`title + description`, `title_am + description_am`) into `memory_chunks` with `source_kind="resource"` and `metadata={category, resource_type, url, language}`. Backfill at seed time (`backend/app/seeds/seed_resources.py`).
- On `GET /api/v1/resources/recommendations`, build a *user-intent query* from recent mood notes + recent chat messages + latest assessment severities, embed it, then `WHERE source_kind="resource" ORDER BY embedding <=> q LIMIT N`. Optionally re-rank with `is_favorite` and `viewed_at` from `user_resources`.

This is the lowest-risk, highest-visibility win — the recommender already exists and is used by the dashboard.

### Layer 4 — Group AI moderator memory

`backend/app/services/group_service.py:853-864` (`_build_ai_context`) limits group AI replies to the last 10 group messages. Layer in retrieval over **older** messages in the same group (and optionally the user's own DM messages on the same topic — privacy-gated) so the AI moderator can say "two weeks ago, three of you discussed sleep hygiene" instead of restarting from scratch each time.

### Layer 5 — Crisis detection upgrade (semantic, multilingual)

`ai-service/app/services/crisis_detector.py:2-19` is English-only substring matching. The same `memory_chunks` infrastructure can hold a small set of canonical crisis phrases (English + Amharic) and compute cosine similarity for soft matching. This catches paraphrases like "I don't see a way forward" and Amharic equivalents that the keyword list misses. Keep the keyword path as a fast-path for the known phrases and use embeddings as the safety net.

### Layer 6 — Conversation summarization

The fixed 15-message window in `chat_service.py:170-187` will eventually drop important context for any user who chats more than 10 minutes. Add a background job (or run it inline when `Conversation.total_messages` crosses thresholds like 20, 50, 100) that calls the AI to produce a 3-sentence summary and stores it in `memory_chunks` with `source_kind="summary"` and `conversation_id=…`. The retrieval at Layer 1 then naturally surfaces the relevant summary instead of the raw messages.

### Layer 7 — User-extracted "facts" (long-term memory)

A second background pass over each new message can extract durable facts ("user is a 20-year-old engineering student in Addis Ababa", "user's mom is in poor health", "user dislikes guided breathing exercises") via a structured-output LLM call, store them in `memory_chunks` with `source_kind="profile_fact"`, and inject them into every system prompt. This is what gives the AI the "remember me across sessions" feeling. Add a `/api/v1/me/memory` REST endpoint with list/delete so users can audit and forget facts (also useful for the disabled-but-planned Settings page at `frontend/src/components/layout/UserMenu.tsx:66-72`).

---

## Code References (canonical insertion points)

- `backend/app/services/chat_service.py:53-69` — static system prompt (extend with user facts).
- `backend/app/services/chat_service.py:120-242` — `process_message_stream`; lines `155, 205` are where `memory_service.index()` calls would live; lines `170-187` are the prompt-builder to rewrite.
- `backend/app/services/ai_client.py:44-71` — `/generate` SSE consumption (unchanged).
- `backend/app/services/resource_service.py:158-288` and `:21-50` — keyword recommender to replace with semantic search.
- `backend/app/services/group_service.py:853-864` — group AI context window to augment with retrieval.
- `backend/app/api/v1/chat.py:105-167` — WebSocket handler (unchanged unless adding `/ws/voice`).
- `backend/app/main.py:66-67` — WebSocket registration site for a future `/ws/voice/{conversation_id}`.
- `frontend/src/lib/gemini-avatar.ts:17-25, 119-145` — `buildSystemPrompt` and `VoiceSession.open` are the points where the enriched per-user instruction would be injected.
- `frontend/src/components/avatar/AvatarScene.tsx:38-85, 471-488` — avatar personas and `startCall` entry.
- `docker-compose.yml:3` — swap image to `pgvector/pgvector:pg16`.
- `backend/requirements.txt` — add `pgvector`.
- `ai-service/requirements.txt` — optionally add `google-genai` already present; nothing else needed if using Ollama for embeddings.
- New files to create:
  - `backend/alembic/versions/<rev>_enable_pgvector_and_memory_chunks.py`
  - `backend/app/models/memory_chunk.py`
  - `backend/app/services/memory_service.py`
  - `ai-service/app/routes/embed.py` (if using Ollama embeddings)

---

## Architecture Documentation (Current vs. Augmented)

**Today**

```
Frontend (Next.js)  ──WS──▶  Backend (FastAPI)  ──HTTP──▶  AI service  ──HTTP──▶  Ollama (llama3.1:8b)
       │                      │                            │
   chat UI, /avatar         /api/v1/* + /ws/chat,          /generate (stateless)
   (Gemini Live direct)     /ws/group                      /check-crisis (keyword)
                              │                            /translate (Gemini)
                              └──PostgreSQL (no pgvector)
                              └──Redis (declared, unused)
```

**With RAG layer added (proposed shape)**

```
Frontend ──WS──▶ Backend ──HTTP──▶ AI service ──▶ Ollama (chat) / Ollama (embed) / Gemini (translate)
                     │
                     ├──▶ memory_service.index(...)  after every persisted message / mood note / assessment
                     ├──▶ memory_service.retrieve(...)  before every AI turn (chat + voice + recs)
                     │
                     └──PostgreSQL + pgvector  (memory_chunks table)
                         conversations, messages, mood_entries, user_assessments, user_resources,
                         groups, group_messages, badges, users  (unchanged)
```

---

## Historical Context (from docs/research/)

- `docs/research/2026-04-21-therapist-avatar-session-approaches.md` — surveys voice-avatar implementation options (Rive, three.js, D-ID, HeyGen, Anam, Live2D), confirms Redis is configured-but-unused and that no pgvector / embedding code exists. Aligns with the findings here.
- `docs/research/2026-03-16-sds-implementation-status.md` — earlier SDS implementation audit.

---

## Open Questions

1. **Embedding model choice.** Multilingual quality matters because users write notes/messages in Amharic. `text-embedding-004` (Gemini, 768d) handles Amharic; `nomic-embed-text` (Ollama) handles it less well. Stack cost / latency comparison needed.
2. **Privacy boundary for cross-conversation retrieval.** Should the AI ever surface content from one conversation in another? Default yes (user wants "remember him"), but a per-user "forget" / audit UI is needed (Settings page is currently disabled).
3. **Voice memory parity.** Option A (enriched system instruction only) vs. Option B (proxied through backend) — a near-term spike on Option B's latency is needed before committing.
4. **Summarization cadence.** Trigger summaries on message-count thresholds, time decay, or both? Tied to the eventual ivfflat `lists` tuning.
5. **Where does an "extracted user facts" memory live in the UI?** Probably the still-disabled Settings page — needs design.
6. **Should pgvector embeddings be encrypted at rest?** The SDS calls out encryption for sensitive data. Mood notes and chat messages are already plaintext in `Text` columns, so embeddings of the same content carry no additional sensitivity, but worth confirming before adding the table.

---

## Related Research

- `docs/research/2026-04-21-therapist-avatar-session-approaches.md` — avatar/voice approaches; complements §D and §E above.
- `docs/research/2026-03-16-sds-implementation-status.md` — broader SDS implementation-status reference.
