---
date: 2026-05-12
author: anatoli
status: draft
topic: "RAG / Vector-Memory for Personalized AI Across Text Chat and Voice Avatar"
research: docs/research/2026-05-12-rag-personalization-research.md
---

# RAG Personalization — Implementation Plan

## Overview

Make the MindEase AI assistant remember the user across sessions and surfaces. Today the AI is memory-less: text chat sees only the last 15 messages of the current conversation, the voice avatar talks browser-direct to Gemini with no user context at all, and the SDS-promised pgvector infrastructure does not exist. This plan installs pgvector on the existing Postgres, builds a single `memory_chunks` store fed by every user-produced signal (messages, mood notes, assessment results, group messages, voice transcripts, extracted facts, conversation summaries), and threads retrieval into every place the AI talks back — text chat, voice avatar, group moderator, resource recommender, crisis detection.

Decisions locked in by the user before drafting:

- **Embeddings**: Gemini `text-embedding-004` (768-d, multilingual including Amharic). Served by the ai-service so the Gemini key stays out of the backend.
- **Voice memory path**: Option B — proxy Gemini Live through the backend. The browser opens `/ws/voice/{conversation_id}` and the backend relays audio + persists transcripts as `Message` rows so voice and text share one memory store.
- **Scope**: all seven layers from the research (Foundation → Text → Recommender → Voice → Group → Crisis → Summarization → Facts/UI).
- **Memory UI**: enable the disabled Settings link and ship a `/settings/memory` page that lists/deletes chunks.
- **Privacy default for cross-conversation retrieval**: always on (no per-user opt-out in v1; user can delete individual chunks).

## Current State Analysis

| Area | File:line | State today |
|---|---|---|
| Postgres image | `docker-compose.yml:3` | `postgres:16-alpine` — no pgvector |
| Backend deps | `backend/requirements.txt` | no `pgvector`, no embedding lib |
| ai-service deps | `ai-service/requirements.txt` | has `google-genai`; no embedding route |
| Text-chat prompt builder | `backend/app/services/chat_service.py:170-187` | fixed 15-msg window, static system prompt, zero personalization |
| AI client | `backend/app/services/ai_client.py:44-71` | streams `/generate` SSE; no embed call |
| Crisis check | `ai-service/app/services/crisis_detector.py:2-19` | English-only substring match |
| Resource recommender | `backend/app/services/resource_service.py:21-50, 158-288` | static keyword map → category round-robin |
| Group AI context | `backend/app/services/group_service.py:853-864` | last 10 group messages only |
| Voice avatar | `frontend/src/lib/gemini-avatar.ts:17-25, 119-145` | browser-direct-to-Gemini; persona-only system prompt; no backend hit |
| Settings entry | `frontend/src/components/layout/UserMenu.tsx:66-72` | disabled placeholder |
| Redis | `docker-compose.yml:18-21` | configured, container running, no Python imports it |

Rich data already exists but is invisible to the AI: `mood_entries.note`, `user_assessments.feedback_level`/`feedback_text`/`responses`, `user_resources.viewed_at`/`is_favorite`, `group_messages.content`, `Conversation.crisis_detected`, `Message.is_crisis_flagged`.

## Desired End State

After all seven phases:

- A `memory_chunks` table exists with pgvector cosine indexes, holding embeddings of every user message, AI message, mood note, assessment summary, group message, voice transcript, extracted profile fact, and conversation summary.
- `ChatService.process_message_stream` builds a layered prompt with: static system prompt + per-user profile facts + recent mood + latest assessment severities + top-k retrieved chunks (cross-conversation) + last 10-message rolling window. Both the user turn and the AI turn are indexed before the next turn.
- A new backend WebSocket `/ws/voice/{conversation_id}` proxies Gemini Live audio in both directions, persists every voice turn as `Message` rows, and indexes them — voice avatar gains identical memory to text chat.
- `GET /api/v1/resources/recommendations` runs a semantic search over embedded resources instead of the keyword map.
- Group AI moderator `_build_ai_context` augments its last-10 window with top-k retrieval over older messages from the same group.
- Crisis detection runs both substring-fast-path and semantic similarity against canonical crisis phrases (English + Amharic).
- Conversations crossing 20 / 50 / 100 messages get auto-summarized in the background; summaries are indexed for retrieval.
- Durable facts are extracted from each user message and indexed under `source_kind="profile_fact"`. They appear in every system prompt.
- A new `/settings/memory` page lets users browse and delete their stored chunks.

### Verification

- `docker compose up` brings up `pgvector/pgvector:pg16`; `\dx` shows `vector` extension installed.
- `select count(*) from memory_chunks` grows monotonically as the user chats / logs mood / submits assessments.
- New chat in a fresh conversation references content from older conversations of the same user.
- Voice avatar greets the user by `display_name` and refers to recent mood/assessment context.
- Resource recommendations change appropriately when the user's recent moods or messages change.
- `/settings/memory` lists items and "Delete" removes them from `memory_chunks`.

### Key Discoveries from research

- Chat prompt is assembled in exactly one place (`chat_service.py:170-187`), so the entire Layer-1 rewrite is a single function.
- The keyword recommender (`resource_service.py:158-288`) already pulls the right signals — recent moods + recent chat content — so swapping its scoring is a drop-in replacement.
- Python `google-genai` SDK supports `client.aio.live.connect` (see `try-3d-avatar/test_gemini_live_amharic.py:38-49`); proxying voice is feasible without rewriting the audio pipeline.
- The static system prompt is duplicated in `chat_service.py:53-69` and `ai-service/prompts/system.txt`; the backend's copy wins because it's added before the ai-service fallback runs (`ai-service/app/routes/generate.py:68-74`). Phase 1 only needs to touch the backend copy.
- No existing crisis-events table — `Conversation.crisis_detected` and `Message.is_crisis_flagged` booleans are the only crisis state, so semantic crisis upgrade requires no schema change.

## What We're NOT Doing

- Not migrating the embedding store to a dedicated vector DB (Chroma/Qdrant/Weaviate). pgvector lives in the existing Postgres; one schema, one backup story.
- Not generating embeddings on the backend directly — all embeddings go through ai-service so the Gemini key stays in one place.
- Not adding Redis usage in this plan. Redis is currently dead; if the group rate-limit ever needs multi-worker support (`group_service.py:471` comment), that's a separate effort.
- Not reworking the `try-3d-avatar/` standalone experiment. It stays as-is, not wired into production.
- Not adding fine-grained sharing controls or per-domain memory toggles. v1 is global on/off via "delete this chunk" / "delete all".
- Not encrypting embeddings at rest beyond Postgres-level encryption already in scope per SDS. The chunks store the same plaintext that already sits in `messages.content` etc.
- Not implementing the broader Settings page features (notification preferences, language toggle, account deletion) — only the new "Memory" tab.
- Not changing the Amharic translation pipeline (`ai-service/app/services/translator.py`). It continues to translate the last user message to English before Ollama; embeddings are computed on the original (Amharic) text via Gemini which handles it natively.

## Implementation Approach

Eight phases, each independently testable and shippable. Phases 0–1 are prerequisites for everything else; 2–7 are largely independent and could be reordered if pressure shifts.

Per phase: schema → backend service → wire-in at the call site → frontend (where applicable) → tests → manual verification.

---

## Phase 0: Foundation — pgvector, memory_chunks, embedding client

### Overview

Install pgvector on Postgres, create the unified `memory_chunks` table, expose a `/embed` endpoint on ai-service, and build the `MemoryService` that the rest of the plan uses.

### Changes Required

#### 1. Switch Postgres image to pgvector
**File**: `docker-compose.yml`
**Change**: line 3 `image: postgres:16-alpine` → `image: pgvector/pgvector:pg16` (same Postgres 16, drop-in maintained by pgvector authors; same env vars, same volume).

#### 2. Add pgvector Python binding
**File**: `backend/requirements.txt`
**Change**: append `pgvector>=0.3.0`.

#### 3. Alembic migration: enable extension + create table
**File**: `backend/alembic/versions/<rev>_enable_pgvector_and_memory_chunks.py` (new)

```python
def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS vector")
    op.create_table(
        "memory_chunks",
        sa.Column("chunk_id", postgresql.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text("gen_random_uuid()")),
        sa.Column("user_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("users.user_id", ondelete="CASCADE"), nullable=False),
        sa.Column("source_kind", sa.String(32), nullable=False),
        sa.Column("source_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("conversation_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("group_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("text", sa.Text, nullable=False),
        sa.Column("embedding", Vector(768), nullable=False),
        sa.Column("metadata", postgresql.JSONB, nullable=True),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True),
                  server_default=sa.text("now()"), nullable=False),
    )
    op.execute(
        "CREATE INDEX memory_chunks_embedding_idx ON memory_chunks "
        "USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100)"
    )
    op.create_index("memory_chunks_user_kind_created_idx", "memory_chunks",
                    ["user_id", "source_kind", sa.text("created_at DESC")])
    op.create_index("memory_chunks_user_conv_idx", "memory_chunks",
                    ["user_id", "conversation_id"])
    op.create_index("memory_chunks_user_group_idx", "memory_chunks",
                    ["user_id", "group_id"])
```

Down: drop indexes, drop table, leave the extension installed (cheap to keep).

#### 4. SQLAlchemy model
**File**: `backend/app/models/memory_chunk.py` (new)
**Content**: standard mapped class using `from pgvector.sqlalchemy import Vector`. `source_kind` literal type: `"message" | "mood_note" | "assessment_result" | "resource" | "group_message" | "voice_transcript" | "profile_fact" | "summary" | "crisis_phrase"`. Also export from `backend/app/models/__init__.py`.

#### 5. Embedding endpoint on ai-service
**File**: `ai-service/app/services/embedder.py` (new)
**Content**: small async class calling `google.genai` `text-embedding-004` model with `output_dimensionality=768`. Cache the client at module level like `translator.py:106-111` does.

**File**: `ai-service/app/routes/embed.py` (new)
```python
@router.post("")
async def embed(body: dict) -> dict:
    """POST /embed — body: {"texts": [str]} → {"embeddings": [[float]*768]}.
    Batches up to 100 inputs per Gemini call.
    """
    texts = body.get("texts") or []
    if not texts:
        return {"embeddings": []}
    vectors = await embedder.embed_batch(texts)
    return {"embeddings": vectors}
```

**File**: `ai-service/app/main.py`
**Change**: register the new router alongside the existing `generate/translate/crisis/health` routers (current registration site lines 19-22).

**File**: `ai-service/app/config.py`
**Change**: add `EMBED_MODEL_NAME: str = "text-embedding-004"` and `EMBED_DIM: int = 768`.

#### 6. Backend client wrapper
**File**: `backend/app/services/ai_client.py`
**Change**: add `async def embed(self, texts: list[str]) -> list[list[float]]` that POSTs to `{base_url}/embed`. Same `httpx.AsyncClient` pattern as `check_crisis` (lines 16-28).

#### 7. MemoryService
**File**: `backend/app/services/memory_service.py` (new)

Public API:
```python
class MemoryService:
    async def index(
        self,
        db: AsyncSession,
        *,
        user_id: UUID,
        source_kind: str,
        text: str,
        source_id: UUID | None = None,
        conversation_id: UUID | None = None,
        group_id: UUID | None = None,
        metadata: dict | None = None,
    ) -> MemoryChunk: ...

    async def index_many(
        self,
        db: AsyncSession,
        items: list[IndexItem],  # one embed call, N inserts
    ) -> list[MemoryChunk]: ...

    async def retrieve(
        self,
        db: AsyncSession,
        *,
        user_id: UUID,
        query_text: str,
        k: int = 6,
        kinds: list[str] | None = None,
        exclude_conversation_id: UUID | None = None,
        since: datetime | None = None,
        group_id: UUID | None = None,
    ) -> list[MemoryChunk]: ...

    async def delete(self, db: AsyncSession, *, user_id: UUID, chunk_id: UUID) -> bool: ...
    async def list_for_user(
        self, db: AsyncSession, *, user_id: UUID, kinds: list[str] | None = None,
        limit: int = 100, offset: int = 0,
    ) -> list[MemoryChunk]: ...
    async def delete_all_for_user(self, db: AsyncSession, *, user_id: UUID) -> int: ...
```

`retrieve` uses `Vector` `<=>` (cosine distance) ordering:
```python
stmt = (
    select(MemoryChunk)
    .where(MemoryChunk.user_id == user_id)
    .order_by(MemoryChunk.embedding.cosine_distance(query_vec))
    .limit(k)
)
```
Filters appended as `.where(...)` chains for `kinds`, `since`, `exclude_conversation_id`, `group_id`. All embedding traffic goes through `AIClient.embed`.

#### 8. Env wiring
**Files**: `.env.example`, `backend/app/config.py`, `ai-service/app/config.py`
**Change**: no new keys for backend (it already speaks to ai-service via `AI_SERVICE_URL`). ai-service reuses the existing `GEMINI_API_KEY`. Add `EMBED_MODEL_NAME` to `.env.example` documented as optional.

### Success Criteria

#### Automated Verification:
- [ ] `docker compose build` and `docker compose up -d db` succeeds with new image.
- [ ] `docker compose exec db psql -U mindease -d mindease -c "\dx"` lists `vector` extension.
- [ ] `alembic upgrade head` applies without error.
- [ ] `docker compose exec db psql -U mindease -d mindease -c "\d memory_chunks"` shows the table with `embedding vector(768)`.
- [ ] `curl -X POST http://localhost:8001/embed -H 'Content-Type: application/json' -d '{"texts":["hello","ሰላም"]}'` returns two 768-length float arrays.
- [ ] Unit test `backend/tests/unit/test_memory_service.py` — index 3 chunks, retrieve top-1 for a related query, assert ordering.
- [ ] `make lint` / `ruff` clean for new files.

#### Manual Verification:
- [ ] Existing chat still works (no regression — Phase 0 adds infrastructure only, no call-site changes yet).
- [ ] Round-trip an English and an Amharic string through `/embed` and confirm both succeed.
- [ ] Confirm Gemini cost dashboard shows embedding calls.

---

## Phase 1: Text-chat personalization

### Overview

Replace `ChatService.process_message_stream`'s fixed 15-message window with a layered context, and index every persisted message (both user and AI) into `memory_chunks`. Also backfill: re-index existing `messages` rows the first time the new code runs.

### Changes Required

#### 1. Context-building helpers

**File**: `backend/app/services/profile_service.py` (new)
- `async def build_profile_block(db, user_id) -> str` returns a 3-6 line block: greeting name, latest assessment per type with severity, mood-stats snapshot. Pulls from `User.display_name` (`backend/app/models/user.py:17`), `MoodService.get_user_stats` (existing), and `assessment_service.latest_per_type`.

**File**: `backend/app/services/assessment_service.py`
- Add `async def latest_per_type(db, user_id) -> dict[str, UserAssessment]` — one query, `DISTINCT ON (assessment_type) … ORDER BY completed_at DESC`.

**File**: `backend/app/services/mood_service.py`
- Add `async def recent_summary(db, user_id, days=7) -> str` — average mood + bullet list of last ≤3 entries with notes. Reuse `get_user_stats` internally.

#### 2. Rewrite the prompt builder

**File**: `backend/app/services/chat_service.py`, lines 170-187 (current `# 5. Build conversation context` block).

```python
# Layered context
profile_block   = await profile_service.build_profile_block(db, user_id)
mood_block      = await mood_service.recent_summary(db, user_id, days=7)
assess_block    = await assessment_service.format_latest_block(db, user_id)
retrieved       = await memory_service.retrieve(
    db, user_id=user_id, query_text=content, k=6,
    kinds=["message", "mood_note", "assessment_result", "summary", "profile_fact"],
    exclude_conversation_id=conversation_id,
)
short_term_rows = await self._last_messages(db, conversation_id, n=10)  # was 15

system_blocks = [self.SYSTEM_PROMPT]
if profile_block:   system_blocks.append("## About this user\n" + profile_block)
if mood_block:      system_blocks.append("## Recent mood\n" + mood_block)
if assess_block:    system_blocks.append("## Latest screenings\n" + assess_block)
if retrieved:       system_blocks.append("## Relevant past moments\n" + format_chunks(retrieved))

context = [{"role": "system", "content": "\n\n".join(system_blocks)}] + [
    {"role": "user" if m.sender_type == "user" else "assistant", "content": m.content}
    for m in short_term_rows
]
```

`format_chunks` (utility in `chat_service.py` or `memory_service.py`) renders each `MemoryChunk` as `[YYYY-MM-DD, kind] text` so the LLM can cite times.

#### 3. Index every persisted message

**File**: `backend/app/services/chat_service.py`
- After `db.refresh(user_message)` at line 155, call `await memory_service.index(db, user_id=user_id, source_kind="message", source_id=user_message.message_id, conversation_id=conversation_id, text=content, metadata={"sender": "user", "lang": user_lang})`.
- After `db.refresh(ai_message)` at line 205, call the same with `source_kind="message", metadata={"sender": "ai"}`.

Indexing failures must not break the chat turn — wrap in `try/except` and log.

#### 4. Backfill old data on first run

**File**: `backend/app/seeds/backfill_memory.py` (new), invoked once via `python -m app.seeds.backfill_memory` or auto-run on app boot if `memory_chunks` is empty.
- Streams `messages` (skip empty content), `mood_entries` (only those with `note`), and `user_assessments` (`feedback_text` per row) in batches of 100; one `embed_batch` call per batch; bulk insert into `memory_chunks`.

#### 5. Mood + assessment indexing on creation

**File**: `backend/app/services/mood_service.py` — in `create_entry`, after commit, if `note` non-empty: `memory_service.index(source_kind="mood_note", source_id=entry.entry_id, text=note, metadata={"mood_level": entry.mood_level, "entry_source": entry.entry_source})`.

**File**: `backend/app/services/assessment_service.py` — in `submit` (`assessment_service.py:126-326`), after persisting `UserAssessment`, index `feedback_text` with `source_kind="assessment_result"`, `metadata={"assessment_type", "feedback_level", "score"}`.

### Success Criteria

#### Automated Verification:
- [ ] `pytest backend/tests/unit/test_chat_service.py::test_prompt_includes_retrieved_chunks` passes — mock `memory_service.retrieve` returns 2 chunks, assert system message contains them.
- [ ] `pytest backend/tests/integration/test_chat_flow.py::test_cross_conversation_memory` passes — convo A: user says "I'm allergic to peanuts". Convo B: user says "what should I avoid eating?". Assert retrieved chunks contains the convo-A line.
- [ ] `pytest backend/tests/unit/test_backfill_memory.py` passes — runs against a populated test DB and produces the expected row counts.
- [ ] `mypy backend/app/services/chat_service.py` clean.

#### Manual Verification:
- [ ] In a real chat, mention a specific personal detail in conversation 1; in a brand-new conversation 2 ask about it — the AI surfaces it.
- [ ] Confirm latency on the first turn of a new conversation is within ~200 ms of the pre-change baseline (one extra round-trip for retrieval + one for embedding the user query).
- [ ] After running the backfill on a copy of prod data, confirm chunk count ≈ (messages with content) + (mood notes) + (assessment results).

---

## Phase 2: Replace keyword recommender with semantic retrieval

### Overview

Index every active `Resource` once and replace `ResourceService.get_recommendations` keyword logic with cosine search built from the user's recent moods + chat + assessments.

### Changes Required

#### 1. Index resources at seed time and on insert

**File**: `backend/app/seeds/seed_resources.py`
- After seeding, embed `f"{title}\n\n{description}"` (+ Amharic variant when present) and insert one chunk per language with `source_kind="resource"`, `source_id=resource.resource_id`, `user_id=…` — **but resources are global, not per-user**.

To keep the schema clean: extend `memory_chunks` to allow `user_id IS NULL` for global content. **Schema update** to Phase 0 migration: change `user_id` to `nullable=True` (or add a follow-up migration in Phase 2 that does `ALTER COLUMN user_id DROP NOT NULL`). Add CHECK constraint: `user_id IS NOT NULL OR source_kind = 'resource' OR source_kind = 'crisis_phrase'`.

**Decision**: handle this in Phase 2's own migration so Phase 0 stays minimal:
- `backend/alembic/versions/<rev>_allow_global_memory_chunks.py` (new) — `ALTER COLUMN user_id DROP NOT NULL` + add CHECK constraint above.

**File**: `backend/app/services/resource_service.py`
- Add `async def index_resource(self, db, resource)` and call it from any insert/update path. Idempotent: `DELETE FROM memory_chunks WHERE source_kind='resource' AND source_id=:rid` then re-insert.

#### 2. Rewrite `get_recommendations`

**File**: `backend/app/services/resource_service.py:158-288`

Build the query string:
- Pull last 7 days of mood notes (`MoodEntry.note` non-null) and average mood.
- Pull last 3 conversations' user messages (already done, lines 204-218).
- Pull latest assessment severity per type (use new helper from Phase 1).
- Concatenate into a single `query_text`.

Search:
```python
chunks = await memory_service.retrieve(
    db, user_id=user_id, query_text=query_text, k=limit*3,
    kinds=["resource"],
)
# dedupe, prefer un-viewed (LEFT JOIN user_resources), return ResourceRecommendation list
```

Keep the old keyword map (`_CHAT_TOPIC_MAP`) and average-mood logic as a fallback when `query_text` is empty (e.g. brand-new user). Drive fallback through a single `if not query_text:` branch — do not maintain both paths in parallel.

Reason strings (`reason_en` / `reason_am`) come from the chunk's metadata — store `{"reason_key": "anxiety"}` etc. at index time so retrieval can map back to a human reason.

### Success Criteria

#### Automated Verification:
- [ ] Backfill embeds every active resource: `SELECT count(*) FROM memory_chunks WHERE source_kind='resource'` matches `SELECT count(*) FROM resources WHERE is_active`.
- [ ] `pytest backend/tests/unit/test_resource_recommender.py::test_semantic_match` — seed two resources (one on sleep, one on stress); user says "I haven't been sleeping well" → top-1 is the sleep one.
- [ ] Fallback path tested: empty user history → returns mindfulness resources (no error).
- [ ] No regression in `GET /api/v1/resources/categories` (unaffected).

#### Manual Verification:
- [ ] On the dashboard, after a mood entry of 2/5 with note "feeling overwhelmed", new recommendation appears within one refresh and is on-topic.
- [ ] After favoriting/dismissing a resource it does not reappear at top for the same query.

---

## Phase 3: Voice avatar — proxy through backend + persist transcripts

### Overview

Add a backend WebSocket `/ws/voice/{conversation_id}` that opens a server-side Gemini Live session, relays audio in both directions, and persists every turn as `Message` rows (then indexes them like Phase 1). The frontend `gemini-avatar.ts` is split: keep `fetchTTS` (used by persona previews), replace `VoiceSession` with a backend-WebSocket client.

### Changes Required

#### 1. Backend voice service
**File**: `backend/app/services/voice_service.py` (new)

Per session:
- Resolve the same context blocks as Phase 1 (profile + mood + assessment + retrieval) — call into the helpers from Phase 1.
- Open `genai.Client().aio.live.connect(model="models/gemini-2.5-flash-native-audio-latest", config=LiveConnectConfig(response_modalities=[Modality.AUDIO], system_instruction=context_blocks, output_audio_transcription={}, speech_config=…))` — the pattern matches `try-3d-avatar/test_gemini_live_amharic.py:38-49` (referenced as a working example).
- Pump browser audio frames → Gemini.
- Stream Gemini PCM + transcript → browser.
- On `turnComplete`, persist `Message(sender_type="user", content=user_transcript)` and `Message(sender_type="ai", content=ai_transcript)` and call `memory_service.index(...)` for each with `source_kind="voice_transcript"`, metadata `{"persona": …, "voice": …}`.

#### 2. WebSocket route
**File**: `backend/app/api/v1/voice.py` (new)
**File**: `backend/app/main.py` — register `app.add_api_websocket_route("/ws/voice/{conversation_id}", websocket_voice)` alongside the existing chat/group WS registrations at lines 66-67.

Auth pattern mirrors `chat.py:105-167` (token via query string, validate via `get_user_from_token`).

Wire envelope (small, audio-friendly):
- Browser → server: `{type:"audio", data: base64-pcm-16k, mime:"audio/pcm;rate=16000"}`, `{type:"activity_start"}`, `{type:"activity_end"}`.
- Server → browser: `{type:"ready"}`, `{type:"audio", data: base64, sample_rate}`, `{type:"transcript", role: "user"|"ai", text}`, `{type:"turn_complete"}`, `{type:"error", message}`.

#### 3. Frontend rewrite
**File**: `frontend/src/lib/backend-voice.ts` (new)
- Mirror the `VoiceSession` class in `frontend/src/lib/gemini-avatar.ts:106-235` but point at `ws://…/ws/voice/{id}?token=…`. Same `onEvent` shape so `AvatarScene.tsx` doesn't change much.

**File**: `frontend/src/components/avatar/AvatarScene.tsx`
- Before opening the session, create (or reuse) a Conversation via `POST /api/v1/chat/conversations` (already exists, `chat.py:23-37`). Pass that `conversation_id` to `BackendVoiceSession.open`.
- Replace `import { VoiceSession } from "@/lib/gemini-avatar"` with `import { BackendVoiceSession } from "@/lib/backend-voice"`.

**File**: `frontend/src/lib/gemini-avatar.ts`
- Drop `VoiceSession`, keep `fetchTTS` + `GEMINI_VOICES` (still used by persona-preview UI).

#### 4. Voice-friendly indexing
- Voice transcripts can be short and noisy. Skip empty-string transcripts. Trim to ≤2000 chars per turn before embed (Gemini's per-call budget is generous; this is to keep tokens predictable).

### Success Criteria

#### Automated Verification:
- [ ] `pytest backend/tests/integration/test_voice_ws.py::test_handshake_and_transcript_persist` — opens WS with a valid token, sends a small audio frame, asserts one `Message(sender_type="user")` and one `Message(sender_type="ai")` row are created, asserts two `memory_chunks` rows with `source_kind="voice_transcript"`.
- [ ] `npx tsc --noEmit` clean after frontend refactor.
- [ ] `frontend/src/lib/backend-voice.ts` is the only file importing `WebSocket` for voice (no remaining `ai.live.connect` calls in `src/`).

#### Manual Verification:
- [ ] Open `/avatar`, pick Serenity, hold-to-talk: "Hi". Hear an audio reply, see captions update, refresh — the conversation appears in the chat sidebar with the voice transcript as `Message` rows.
- [ ] In a follow-up text chat, ask "what did we talk about on the call?" — retrieval surfaces the voice transcript.
- [ ] Latency: time from end of user speech to first audio chunk back is ≤1.5 s on a normal connection.
- [ ] Closing the browser mid-call does not leak a Gemini Live session (server cleans up in `finally`).

---

## Phase 4: Group AI moderator — retrieval over older group history

### Overview

Index every `GroupMessage` and augment `_build_ai_context` so the moderator can pull semantically relevant older messages from the *same group* — not just the last 10.

### Changes Required

#### 1. Index group messages
**File**: `backend/app/services/group_service.py`
- In `send_message` (the path that creates `GroupMessage`), after commit, call `memory_service.index(user_id=sender.user_id, source_kind="group_message", source_id=message.message_id, group_id=group_id, text=content, metadata={"sender_name": …, "is_crisis_flagged": …})`.
- Note `user_id` here is the *sender's* user_id; retrieval filtered by `group_id` (not `user_id`) is what we want for moderator context.

#### 2. Augment `_build_ai_context`
**File**: `backend/app/services/group_service.py:853-864`

```python
async def _build_ai_context(self, db, group_id) -> str:
    recent = await self._recent_messages(db, group_id, limit=10)  # current behavior
    # NEW: top-k semantic retrieval over older messages in this group
    query = "\n".join(m.content for m in recent[-3:])  # last 3 as query
    older = await memory_service.retrieve(
        db, user_id=None,  # group-scoped retrieval
        query_text=query, k=5,
        kinds=["group_message"],
        group_id=group_id,
        since=None,
    )
    # de-dupe against `recent` by message_id (chunk.source_id)
    ...
    return recent_block + "\n\n## Earlier in this group\n" + older_block
```

This requires `MemoryService.retrieve` to accept `user_id=None` when `group_id` is provided. Add that branch in Phase 4's MemoryService changes.

### Success Criteria

#### Automated Verification:
- [ ] `pytest backend/tests/unit/test_group_ai_context.py::test_retrieves_older_group_msgs` — seed a group with 30 messages spanning two topics; ask AI mod about topic A; assert older-block contains topic-A messages from beyond the last 10.
- [ ] Sending a group message creates exactly one `memory_chunks` row with `source_kind="group_message"`.

#### Manual Verification:
- [ ] In a long-running group, mention a thread from a week ago via `@MindEase` — moderator references it.
- [ ] Rate limit still works (5 msgs / 10 s per user-group, `group_service.py:471` — unchanged by this phase).

---

## Phase 5: Semantic crisis detection (multilingual)

### Overview

Add a curated list of canonical crisis phrases (English + Amharic) into `memory_chunks` with `source_kind="crisis_phrase"`. On every user message, run both the existing substring check (fast-path) and a cosine-distance threshold against the crisis-phrase chunks. Flag if either fires.

### Changes Required

#### 1. Seed canonical phrases
**File**: `backend/app/seeds/seed_crisis_phrases.py` (new)
- ~30 English phrases (the existing keyword list expanded to full sentences) + ~30 Amharic equivalents.
- Indexed with `user_id=NULL`, `source_kind="crisis_phrase"`, metadata `{"lang", "severity"}`.
- Idempotent: delete existing `crisis_phrase` rows first.

#### 2. Crisis check moves to backend
**File**: `backend/app/services/crisis_service.py` (new)
- `async def check(db, text, lang_hint=None) -> dict` returns the same shape as the existing ai-service response: `{is_crisis, detected_keywords, similar_phrases, resources}`.
- Fast path: substring match against the same keyword list currently in `ai-service/app/services/crisis_detector.py:2-19` (copy or import).
- Slow path: `memory_service.retrieve(user_id=None, query_text=text, k=3, kinds=["crisis_phrase"])`. Compute cosine similarity (`1 - distance`); if max similarity ≥ `CRISIS_SIM_THRESHOLD = 0.85` and the matched phrase metadata.severity is "high", flag.
- Resources block returned from a single `CRISIS_RESOURCES` constant (mirror `ai-service/app/services/crisis_detector.py:22-40`).

**File**: `backend/app/services/chat_service.py`
**Change**: replace `crisis_result = await self.ai_client.check_crisis(content)` at line 158 with `crisis_result = await crisis_service.check(db, content, lang_hint=user_lang)`.

The ai-service `/check-crisis` endpoint stays (used by nothing else in-tree, but keep for back-compat / external callers).

### Success Criteria

#### Automated Verification:
- [ ] `pytest backend/tests/unit/test_crisis_service.py::test_paraphrase_detection` — "I don't see a way forward" returns `is_crisis=True` via semantic path, even though no keyword matches.
- [ ] Amharic equivalents of "I want to die" trigger crisis detection.
- [ ] No false-positives on tier-3 mood entries (assert a sample of 10 normal sad messages do not trigger).

#### Manual Verification:
- [ ] Type a paraphrase in chat: "I feel like everyone would be better off without me" → crisis banner appears with Ethiopia helpline.
- [ ] Type the Amharic equivalent → same outcome.

---

## Phase 6: Conversation summarization

### Overview

When a conversation crosses 20 / 50 / 100 messages, run a background summarization that compresses messages older than the rolling window into a 3-sentence summary, stored in `memory_chunks` with `source_kind="summary"`. Retrieval at Phase 1 surfaces these summaries instead of forcing the LLM to re-read raw history.

### Changes Required

#### 1. Summary service
**File**: `backend/app/services/summary_service.py` (new)
- `async def maybe_summarize(db, conversation_id) -> None`:
  - Pull `Conversation.total_messages`. If not in {20, 50, 100} (or the next threshold after the last stored summary), return.
  - Pull all messages for the conversation older than the rolling 10-message window.
  - Build a `messages` array with a `system` prompt: "Summarize this conversation in 3 sentences, focusing on the user's situation, key emotional states, and recurring themes."
  - Call `ai_client.generate_response(messages)` (non-streaming).
  - Insert into `memory_chunks` with `source_kind="summary"`, `conversation_id=…`, `source_id=conversation_id`, `metadata={"upto_total_messages": N}`.
  - Optional: also overwrite the previous summary for the same conversation (`DELETE` then insert) to keep one summary per conversation.

#### 2. Trigger
**File**: `backend/app/services/chat_service.py`
- After updating `conversation.total_messages` (~line 210), schedule a fire-and-forget task: `asyncio.create_task(summary_service.maybe_summarize(db_factory(), conversation_id))`. Use a separate session because the request's session is closing.

#### 3. DB session factory for background tasks
**File**: `backend/app/database.py`
- Expose `async_session_maker` (already exists for `get_db`); the summary service opens its own session via `async with async_session_maker() as db: …`.

### Success Criteria

#### Automated Verification:
- [ ] `pytest backend/tests/integration/test_summary.py::test_creates_summary_at_threshold` — seed a 20-message conversation; call `maybe_summarize`; assert one `memory_chunks` row with `source_kind="summary"`.
- [ ] Re-running `maybe_summarize` at total=50 replaces the upto=20 summary with an upto=50 summary (not duplicate).

#### Manual Verification:
- [ ] Manually chat through 20+ turns; check DB for the summary row; in a 21st turn the retrieved chunks include the summary.

---

## Phase 7: Extracted user facts + Memory UI

### Overview

After each user message, extract durable structured facts via an LLM call ("user is X", "user's job is Y", "user dislikes guided breathing"). Index with `source_kind="profile_fact"`. Inject all current profile_facts into every system prompt (in addition to the existing per-user profile block from Phase 1). Build `/settings/memory` so users can audit and delete.

### Changes Required

#### 1. Fact extractor
**File**: `backend/app/services/fact_extractor.py` (new)
- `async def extract(content: str) -> list[str]` — calls `ai_client.generate_response` with a strict system prompt that asks for a JSON array of short fact statements; returns `[]` if nothing notable.
- Skip when content is < 20 chars or looks transactional ("yes", "thanks").

**File**: `backend/app/services/chat_service.py`
- After indexing the user message (~line 155), fire-and-forget `asyncio.create_task(_extract_and_index_facts(user_id, content))`.
- The helper de-dupes by trigram similarity (`pg_trgm`) or by exact text match before inserting — to avoid storing "user's name is Anatoli" 50 times.

#### 2. Profile-fact retrieval
**File**: `backend/app/services/profile_service.py`
- Extend `build_profile_block` to append the top N profile-facts (`source_kind="profile_fact"`, ordered by `created_at DESC`, capped at e.g. 15) as a bullet list. These are *always* in the system prompt; semantic retrieval still surfaces additional ones when relevant.

#### 3. Memory REST API
**File**: `backend/app/api/v1/me.py` (new)
- `GET /api/v1/me/memory?kind=…&limit=…&offset=…` → paginated list of the user's chunks, redacted: returns `{chunk_id, source_kind, text, created_at, metadata, conversation_id?}`. Never returns the embedding vector.
- `DELETE /api/v1/me/memory/{chunk_id}` → delete one chunk (verify ownership).
- `DELETE /api/v1/me/memory` → delete all of the user's chunks.

**File**: `backend/app/api/v1/router.py` — register the new router.

#### 4. Frontend Settings page
**File**: `frontend/src/app/(main)/settings/memory/page.tsx` (new)
- Table grouped by `source_kind`; each row has text preview, date, "Delete" button.
- "Delete all my memory" action with a confirmation modal.
- Uses existing fetch util / pattern (`frontend/src/lib/api.ts` or wherever fetches live).

**File**: `frontend/src/components/layout/UserMenu.tsx`
**Change**: lines 66-72 — remove `disabled`, point href to `/settings/memory`.

### Success Criteria

#### Automated Verification:
- [ ] `pytest backend/tests/integration/test_fact_extraction.py::test_extracts_durable_fact` — user says "I'm a 20-year-old engineering student in Addis Ababa." → exactly one `profile_fact` chunk inserted.
- [ ] Dedupe: repeating the same statement does not create a second chunk.
- [ ] `pytest backend/tests/integration/test_memory_api.py::test_delete_chunk` — user deletes a chunk; subsequent retrieval no longer returns it.
- [ ] Frontend Playwright test: navigate to `/settings/memory`, see ≥1 row, click delete, row disappears.

#### Manual Verification:
- [ ] Tell the AI in chat: "I'm allergic to peanuts." Start a fresh conversation hours later: "What should I avoid for lunch?" — AI references peanuts without being told again.
- [ ] In `/settings/memory`, delete the peanut fact; ask the same question — AI no longer mentions peanuts.
- [ ] UserMenu's "Settings" link is enabled and routes to the memory page.

---

## Testing Strategy

### Unit tests
- `MemoryService.index/retrieve` — mock `AIClient.embed`, assert SQL filtering by `user_id`, `kinds`, `since`, `group_id`, `exclude_conversation_id`.
- Prompt-builder — assert each layered block appears with the right header when its source is non-empty, and is *omitted* when empty.
- `crisis_service.check` — table of (input, expected) pairs covering English, Amharic, fast-path, semantic-only, and clear non-crisis cases.
- `fact_extractor.extract` — mock the LLM with stub responses; assert JSON parsing and dedupe.
- Resource recommender — semantic path returns expected top-k; fallback path engages when history is empty.

### Integration tests
- End-to-end chat WS: user message → retrieval injected → AI stream → both messages persisted and indexed → second conversation surfaces the first.
- Voice WS: token auth → handshake → fake audio in → transcript persisted → indexed → visible via REST.
- Group WS: send 30 messages on two topics, ask moderator about topic A, assert it cites an older message.
- Memory API: list / delete-one / delete-all; verify ownership errors return 403.
- Backfill: run against a populated test DB, assert chunk counts.

### Manual testing checklist (all phases shipped)
1. Brand-new user signs up, talks to chat about anxiety. Logs a 2/5 mood with note. Closes browser.
2. Returns next day; new conversation — AI greets by name, references the anxiety theme.
3. Opens `/avatar`, has a 30 s voice call about sleep. Closes.
4. In text chat: "what did we talk about earlier?" — AI references sleep.
5. Dashboard recommendations now lean toward sleep + anxiety resources.
6. In a peer group, posts a similar concern; AI moderator references the user's pattern (within group, not across DMs).
7. Says something matching a paraphrased crisis phrase → crisis banner appears with Ethiopia helpline.
8. Reaches 20+ messages in one conversation → background summary appears in DB.
9. Visits `/settings/memory`, sees the extracted facts, deletes one, verifies AI no longer references it.

## Performance Considerations

- Embedding round-trip dominates added latency. Mitigation: batch (Phase 0 `index_many` + ai-service `/embed` accepts arrays); embed in parallel with `check_crisis` (`chat_service.py:158`) when possible.
- ivfflat with `lists=100` is fine up to ~100k chunks per user. Tune `probes` (default 10) via `SET LOCAL ivfflat.probes = X` per query if recall is too low; rebuild with more lists at >1M total rows.
- Retrieval cap: every layer uses `k ≤ 8` chunks, each ≤ ~500 chars, so the system prompt remains comfortably under context budgets for both Ollama (`llama3.1:8b`, 128k) and Gemini Live.
- Voice latency budget: end-of-speech → first audio chunk ≤ 1.5 s. Backend proxy adds ~50-100 ms; acceptable.
- Background tasks (summarization, fact extraction) must not hold the request session — they open their own `async_session_maker` session.

## Migration Notes

- Two Alembic migrations land: Phase 0 (`CREATE EXTENSION vector` + `memory_chunks` table) and Phase 2 (`ALTER COLUMN user_id DROP NOT NULL` + check constraint). Both forward-only in this plan; downgrades drop the indexes and table.
- Backfill is a one-shot script (`python -m app.seeds.backfill_memory`) — idempotent, safe to re-run; uses `INSERT … ON CONFLICT DO NOTHING` on `(source_kind, source_id)` (add a partial unique index in the same migration for that pair where `source_id IS NOT NULL`).
- No data destruction. Existing tables untouched.
- Gemini API cost: `text-embedding-004` is free up to the standard tier limits. Worth wiring usage alerts but no architectural impact.

## References

- Research: `docs/research/2026-05-12-rag-personalization-research.md`
- Related: `docs/research/2026-04-21-therapist-avatar-session-approaches.md`, `docs/research/2026-03-16-sds-implementation-status.md`
- pgvector image: https://hub.docker.com/r/pgvector/pgvector
- Gemini Live working example in-repo: `try-3d-avatar/test_gemini_live_amharic.py:38-49`
- Canonical insertion points (verified during planning):
  - `backend/app/services/chat_service.py:170-187` (prompt builder)
  - `backend/app/services/chat_service.py:148-155, 198-205` (user/AI message persist)
  - `backend/app/services/resource_service.py:158-288` (recommender)
  - `backend/app/services/group_service.py:853-864` (`_build_ai_context`)
  - `frontend/src/lib/gemini-avatar.ts:17-25, 119-145` (replaced by backend-voice in Phase 3)
  - `frontend/src/components/layout/UserMenu.tsx:66-72` (Settings entry, enabled in Phase 7)
  - `docker-compose.yml:3` (image swap, Phase 0)
  - `backend/app/main.py:66-67` (WS registration site for `/ws/voice`)
