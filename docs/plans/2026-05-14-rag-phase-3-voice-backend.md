---

## date: 2026-05-14
author: anatoli
status: draft
topic: "RAG Phase 3 — Route voice avatar through backend; persist + index transcripts"
parent_plan: docs/plans/2026-05-12-rag-personalization.md
prior_subplan: docs/plans/2026-05-14-rag-phase-0-1.md
research: docs/research/2026-05-12-rag-personalization-research.md

# RAG Phase 3 — Voice avatar through the backend (Standalone Implementation Plan)

## Overview

Today the `/avatar` page opens a Gemini Live WebSocket **straight from the browser to Google** using `NEXT_PUBLIC_GEMINI_API_KEY` (`frontend/src/lib/gemini-avatar.ts:3, 119-145`). The backend never sees the call, nothing is persisted, and Gemini meets the user as a stranger every single time. **The whole point of moving Live to the backend is so that every call opens with a full per-user dossier** — Gemini receives identity, engagement history, mood snapshot, latest screenings, resource preferences, peer-group activity, recent crisis signals, *and* the top-k semantic retrieval over the user's text + voice memory before the user says hello. That, plus persistence, is what makes the avatar feel like it actually knows the person.

What this plan delivers:

- New backend WebSocket `/ws/voice/{conversation_id}` proxies audio between the browser and Gemini Live using the Python `google-genai` SDK, mirroring the pattern in `try-3d-avatar/test_gemini_live_amharic.py:23-49`.
- A new `VoiceContextService` assembles the per-user dossier on session open. The Live config's `system_instruction` is `persona prompt + dossier + retrieved past moments (k=10)` — *not* just a static persona string.
- The Live config asks for **both** input and output audio transcription, so Gemini returns the user's words *and* the AI's words on every turn — no separate STT.
- Each turn is persisted as two `Message` rows (`sender_type="user"` and `sender_type="ai"`) on a Conversation marked `conversation_type="voice"`, indexed into `memory_chunks` with `source_kind="voice_transcript"` so future calls (and text chats) carry the voice memory forward.
- The Gemini key moves out of the browser entirely.
- Voice conversations appear in the chat sidebar alongside text chats with a phone-icon differentiator. Clicking a past voice conversation opens `/chat/[id]` showing the transcript as normal text bubbles, with a **Continue this call** button that opens `/avatar` re-bound to the same persona and conversation.

Decisions locked before drafting (confirmed by the user):

- **Sidebar UX**: single mixed list (voice + text) with a phone icon to distinguish voice. Clicking a voice conversation opens `/chat/[id]` (the existing chat route renders the persisted transcript as text).
- **Continue call**: past voice conversations get a "Continue this call" affordance that reopens `/avatar` with the same persona, attached to the same conversation_id. Prior turns are surfaced via the system instruction (semantic retrieval over `voice_transcript` + other kinds), not as live conversation history (each Live session is fresh).
- **Scope**: voice only. No video (the avatar is 3D-rendered, not video). No PCM audio persistence in v1 — text transcripts only.
- **Backend ↔ Gemini Live**: backend talks to Gemini directly via the `google-genai` Python SDK. `GEMINI_API_KEY` is added to the backend service env. No second hop via ai-service.
- **Audio framing**: same as today on the wire (16 kHz mono Int16 PCM from browser, 24 kHz mono Int16 PCM from Gemini); base64-encoded over JSON WS messages.
- **Tests**: smoke verification only, matching Phase 0/1.

## Current State Analysis


| Area                     | File:line                                                                                              | Current state                                                                                |
| ------------------------ | ------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------- |
| Voice path (frontend)    | `frontend/src/lib/gemini-avatar.ts:106-235`                                                            | `VoiceSession` opens `ai.live.connect` direct from browser with `NEXT_PUBLIC_GEMINI_API_KEY` |
| Frontend Live config     | `gemini-avatar.ts:120-128`                                                                             | sets `outputAudioTranscription: {}` only — never gets user transcript                        |
| Avatar UI wiring         | `frontend/src/components/avatar/AvatarScene.tsx:38-85, 471-497`                                        | five hard-coded personas; `startCall()` constructs a `VoiceSession`                          |
| Persona prompt           | `gemini-avatar.ts:17-25`                                                                               | static "stay in character as {name, blurb}" — no user identity                               |
| Backend deps             | `backend/requirements.txt`                                                                             | no `google-genai`                                                                            |
| Backend env              | `backend/app/config.py:8-15`                                                                           | no `GEMINI_API_KEY`                                                                          |
| Backend WS handlers      | `backend/app/main.py:66-67`                                                                            | only `/ws/chat/{conversation_id}` + `/ws/group/{group_id}`                                   |
| Chat WS auth pattern     | `backend/app/api/v1/chat.py:105-137`                                                                   | token via `?token=`, validates ownership, calls `websocket.accept()`                         |
| Conversation model       | `backend/app/models/conversation.py:12-52`                                                             | no `conversation_type`, no `attrs`                                                           |
| Message model            | `backend/app/models/message.py:12-37`                                                                  | `sender_type` String(20) literal `"user"`/`"ai"`                                             |
| Chat sidebar             | `frontend/src/components/chat/ConversationItem.tsx:36-105`                                             | renders `MessageCircle` icon + relative time; no concept of voice vs text                    |
| Conversation list hook   | `frontend/src/hooks/useConversations.ts:21-30`                                                         | hits `GET /api/v1/chat/conversations`                                                        |
| Memory infra (Phase 0/1) | `backend/app/services/memory_service.py:29-169`, `backend/app/services/profile_service.py:12-31`       | `MemoryService.index/retrieve` + `ProfileService.build_profile_block` ready to use           |
| Crisis check             | `backend/app/services/chat_service.py:198, 213-220`, `ai-service/app/services/crisis_detector.py:2-19` | substring match through `AIClient.check_crisis`                                              |
| Python Live reference    | `try-3d-avatar/test_gemini_live_amharic.py:23-49`                                                      | working `client.aio.live.connect` example                                                    |


## Desired End State

After this sub-plan ships:

1. `backend/app/api/v1/voice.py` exposes:
  - `POST /api/v1/voice/conversations` — creates (or reuses) a Conversation with `conversation_type="voice"` and `attrs={"persona_id","persona_name","voice"}`; returns the conversation.
  - `WebSocket /ws/voice/{conversation_id}?token=…` — bidirectional audio proxy to Gemini Live with input + output transcription.
2. The Conversation model has two new columns: `conversation_type VARCHAR(20) DEFAULT 'text'` and `attrs JSONB`. One forward Alembic migration adds them.
3. `backend/app/services/voice_service.py` orchestrates a single Live session: builds the system instruction once (persona + profile_block + retrieved memory), pumps audio in both directions, accumulates per-turn user/AI transcripts, persists them as two `Message` rows at each `turn_complete`, indexes them into `memory_chunks` (`source_kind="voice_transcript"`), and surfaces crisis events.
4. `backend/requirements.txt` has `google-genai>=1.0.0`; `backend/app/config.py` has `GEMINI_API_KEY`; the docker-compose backend service receives the key (`.env.example` + `docker-compose.yml`).
5. Frontend: `frontend/src/lib/backend-voice.ts` (new) replaces direct-to-Gemini `VoiceSession` with a backend-WS client. `VoiceSession` is removed from `gemini-avatar.ts`; `fetchTTS` + `GEMINI_VOICES` stay (used by persona-preview UI). `AvatarScene.tsx` calls `POST /api/v1/voice/conversations` before opening the WS.
6. The chat sidebar shows voice conversations with a phone icon. Past voice conversations open in `/chat/[id]` (transcripts render through the existing `MessageList`). A "Continue this call" button on those pages routes to `/avatar?conversation=<id>`, which skips the picker, re-binds to the prior persona/voice, and opens a fresh Live session attached to the same `conversation_id` (so further turns append to the same transcript and the prior turns are surfaced via system-instruction retrieval).
7. `NEXT_PUBLIC_GEMINI_API_KEY` is no longer read by `VoiceSession`. `fetchTTS` (persona previews) is the only remaining browser-side consumer; that can be migrated to a backend proxy later (out of scope here, called out in "What we're NOT doing").

### Verification (manual / smoke)

- Open `/avatar`, pick Serenity, hold-to-talk, say "Hi". After the response: a row appears in `conversations` with `conversation_type='voice'`; two `messages` rows (user + ai) appear; two `memory_chunks` rows appear with `source_kind='voice_transcript'`.
- Refresh — the voice conversation appears in the chat sidebar with a phone icon.
- Click it — `/chat/[id]` shows the user turn + AI turn as text bubbles. A "Continue this call" button is visible.
- Click "Continue this call" — `/avatar` opens, picker is skipped, persona is reattached, hold-to-talk and have another exchange. Two more `messages` rows append to the same conversation.
- Ask the AI in the **next** call: "what did we talk about last time?" — the AI's first reply references the earlier exchange (because retrieval surfaces the prior `voice_transcript` chunks in the system instruction).
- `grep -r NEXT_PUBLIC_GEMINI_API_KEY frontend/src` shows only references inside `fetchTTS` (or none if the key was removed entirely for previews).

## Key Discoveries from Re-verification

Things to call out so the implementation stays aligned with the actual codebase:

- The backend currently has **no** Gemini key. ai-service does (`ai-service/app/config.py`). Phase 3 adds the key to the backend container env so the backend can speak Live directly.
- `Message.sender_type` is `String(20)` storing literal `"user"`/`"ai"`. Voice turns reuse those exact values — no new sender_type. The fact that the message came from a voice call is captured at the **Conversation** level via `conversation_type='voice'` and on each chunk via `attrs={"channel": "voice", "persona_id": …}`.
- `Conversation` is soft-deleted via `status='archived'`, not a `deleted_at` timestamp. The new endpoints respect that.
- `MemoryService.index` already supports `source_kind="voice_transcript"` — the model has no DB-level check on source_kind values (`backend/app/models/memory_chunk.py:270-274` notes the kinds as a comment only). No schema change needed for the new kind.
- `AIClient.check_crisis` (`backend/app/services/ai_client.py:16-28`) is reused as-is for voice; it operates on a plain string regardless of channel.
- `MoodEntry`, `UserAssessment`, and the `_simple_emotion_to_mood` auto-mood path in `chat_service.py:312-339` are **not** triggered for voice in v1. The parent plan's "auto-log mood at 10 messages" is text-chat-only; replicating it for voice would compound noise and is deferred.
- The Live session lifecycle is bound to a single async-context `async with client.aio.live.connect(...) as session:` block. The voice WS handler must spawn a task that owns that context for the duration of the call and tears it down in `finally`.
- The `outputTranscription`/`inputTranscription` fields in `google-genai` Python come as `response.server_content.output_transcription.text` and `response.server_content.input_transcription.text`. They are streamed token-by-token across multiple messages within a turn; we accumulate per-turn buffers and flush on `server_content.turn_complete`.
- The browser today sends audio at 16 kHz and resamples Gemini's 24 kHz output to 22050 Hz for TalkingHead playback (`gemini-avatar.ts:147-167, 222-224`). Phase 3 preserves both rates — the backend simply relays base64 frames; resampling stays in the browser.
- The Gemini Live "session" itself **cannot resume**: a new Live `connect()` is required for each call. "Continue this call" simply rebinds the same `conversation_id` and persona, and relies on `memory_service.retrieve(kinds=["voice_transcript", ...])` to fold the prior turns into the new session's system instruction. This is the same retrieval mechanism Phase 1 already uses for text chat.

## What We're NOT Doing

- No PCM audio storage. Transcripts only.
- No migration of `fetchTTS` (persona-preview audio in `gemini-avatar.ts:62-99`) to a backend proxy. It still calls Gemini TTS directly from the browser using `NEXT_PUBLIC_GEMINI_API_KEY`. Removing it would break preview playback; doing it cleanly requires a small backend TTS-proxy endpoint and is a separate effort. The `VoiceSession` (full Live call) **is** moved; `fetchTTS` (one-shot preview) is not.
- No multi-user / co-listener voice sessions. One user per call.
- No simultaneous voice + text edits to the same conversation. The conversation_type field is set at creation and is immutable.
- No automatic mood auto-logging from voice chat turn count. Text-chat behaviour unchanged.
- No automated tests. Smoke verification only — same posture as Phase 0/1.
- No change to ai-service. All voice logic lives in the backend.
- No semantic crisis upgrade (parent plan Phase 5) — voice uses the same substring-keyword `check_crisis` text-chat uses today.
- No support for browsers without `MediaStream`/`AudioContext` (already a requirement of the existing avatar feature).

## Implementation Approach

Five steps, all in one branch. The DB migration is forward-only; all other changes are revertable by deleting the new files and reverting the touched ones.

1. Conversation schema additions (one Alembic revision) + Conversation/api response updates.
2. Backend voice service + WS route + REST endpoint.
3. Frontend backend-voice client + AvatarScene rewrite.
4. Sidebar phone-icon + Continue-this-call button in chat conversation view.
5. Env wiring + smoke verification.

Phase boundary: the existing `/avatar` flow continues to work right up until step 3 lands. If we have to revert, step 1 (migration) is the only thing that needs `alembic downgrade -1`; everything else is code-level.

---

## Step 1: Conversation schema — add `conversation_type` and `attrs`

### Overview

Add two columns to `conversations`. Both nullable / defaulted so existing rows backfill to text-chat semantics with no manual migration.

### Changes Required

#### 1.1 Alembic migration

**File**: `backend/alembic/versions/b2c3d4e5f6a7_add_conversation_type_attrs.py` *(new — pick any unused 12-hex revision; `alembic revision -m "add conversation_type attrs"` will generate one)*

```python
"""add conversation_type and attrs to conversations

Revision ID: b2c3d4e5f6a7
Revises: a1b2c3d4e5f6
Create Date: 2026-05-14 …
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "b2c3d4e5f6a7"
down_revision: Union[str, None] = "a1b2c3d4e5f6"  # current head from Phase 0
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "conversations",
        sa.Column(
            "conversation_type",
            sa.String(20),
            nullable=False,
            server_default=sa.text("'text'"),
        ),
    )
    op.add_column(
        "conversations",
        sa.Column("attrs", postgresql.JSONB, nullable=True),
    )
    op.create_index(
        "conversations_user_type_last_msg_idx",
        "conversations",
        ["user_id", "conversation_type", sa.text("last_message_at DESC")],
    )


def downgrade() -> None:
    op.drop_index("conversations_user_type_last_msg_idx", table_name="conversations")
    op.drop_column("conversations", "attrs")
    op.drop_column("conversations", "conversation_type")
```

The index supports the sidebar query "list this user's conversations newest first, optionally filtered by type".

#### 1.2 Model

**File**: `backend/app/models/conversation.py`

Add two mapped columns alongside the existing ones (`backend/app/models/conversation.py:12-44`):

```python
from sqlalchemy.dialects.postgresql import JSONB
from typing import Any

# inside class Conversation, near `status`:
    conversation_type: Mapped[str] = mapped_column(
        String(20), default="text", server_default=text("'text'"), nullable=False,
    )
    attrs: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)
```

#### 1.3 Pydantic schema

**File**: `backend/app/schemas/chat.py`

Update `ConversationResponse` (currently lines 31-41) and `ConversationWithMessages`:

```python
class ConversationResponse(BaseModel):
    conversation_id: uuid.UUID
    user_id: uuid.UUID
    title: str | None
    started_at: datetime
    last_message_at: datetime
    status: str
    total_messages: int
    crisis_detected: bool
    conversation_type: str = "text"            # new
    attrs: dict | None = None                  # new

    model_config = ConfigDict(from_attributes=True)
```

#### 1.4 Frontend types

**File**: `frontend/src/lib/types.ts`

Extend `Conversation` (currently lines 9-18) and `ConversationResponse` in `frontend/src/lib/api.ts:90-99`:

```ts
export interface Conversation {
  conversation_id: string;
  user_id: string;
  title: string | null;
  started_at: string;
  last_message_at: string;
  status: string;
  total_messages: number;
  crisis_detected: boolean;
  conversation_type: "text" | "voice";                 // new
  attrs: {                                             // new
    persona_id?: string;
    persona_name?: string;
    voice?: string;
  } | null;
}
```

Mirror the change in the `ConversationResponse` type in `frontend/src/lib/api.ts`.

### Success Criteria — Step 1

#### Smoke verification:

- `docker compose exec backend alembic upgrade head` succeeds.
- `docker compose exec db psql -U mindease -d mindease -c "\d conversations"` shows both new columns with the right defaults.
- `SELECT count(*) FROM conversations WHERE conversation_type IS NULL;` returns 0 (all existing rows defaulted to `'text'`).
- Existing chat continues to work — `GET /api/v1/chat/conversations` returns the same list, every row now carrying `"conversation_type": "text"` and `"attrs": null` in JSON.

---

## Step 2: Backend voice service + REST/WS routes

### Overview

Add `google-genai` to the backend, wire `GEMINI_API_KEY` into config, build `VoiceService` (one-call lifecycle), expose `POST /api/v1/voice/conversations` to create or reuse a voice conversation, and register `WebSocket /ws/voice/{conversation_id}`.

### Changes Required

#### 2.1 Backend deps + config

**File**: `backend/requirements.txt`
**Change**: append one line.

```
google-genai>=1.0.0
```

**File**: `backend/app/config.py`
**Change**: add one optional field (lines 8-19 today).

```diff
 class Settings(BaseSettings):
     DATABASE_URL: str = "postgresql+asyncpg://mindease:mindease_dev@localhost:5432/mindease"
     SECRET_KEY: str = "dev-secret-change-me"
     GOOGLE_CLIENT_ID: str | None = None
     GOOGLE_CLIENT_SECRET: str | None = None
     FRONTEND_URL: str = "http://localhost:3000"
     REDIS_URL: str = "redis://localhost:6379/0"
     AI_SERVICE_URL: str = "http://ai-service:8001"
+    GEMINI_API_KEY: str = ""
+    GEMINI_LIVE_MODEL: str = "models/gemini-2.5-flash-native-audio-latest"
```

**File**: `.env.example`
**Change**: add a line documenting `GEMINI_API_KEY` for the backend (it already exists for ai-service).

**File**: `docker-compose.yml`
**Change**: extend the `backend` service env block so it inherits the same `GEMINI_API_KEY` value used by ai-service. The pattern follows existing entries in the file (no exact line cited since the section is small — add `GEMINI_API_KEY: ${GEMINI_API_KEY}` next to `AI_SERVICE_URL`).

#### 2.2 Voice schemas

**File**: `backend/app/schemas/voice.py` *(new)*

```python
import uuid
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class VoiceConversationCreate(BaseModel):
    persona_id: str = Field(..., min_length=1, max_length=64)
    persona_name: str = Field(..., min_length=1, max_length=64)
    persona_blurb: str = Field("", max_length=512)
    voice: str = Field(..., min_length=1, max_length=32)
    conversation_id: uuid.UUID | None = None  # set when continuing an existing voice call


class VoiceConversationResponse(BaseModel):
    conversation_id: uuid.UUID
    persona_id: str
    persona_name: str
    voice: str
    started_at: str
    is_continuation: bool

    model_config = ConfigDict(from_attributes=False)
```

#### 2.3 Voice context service (per-user dossier)

**File**: `backend/app/services/voice_context_service.py` *(new)*

`VoiceContextService.build(db, user_id)` returns a single composed string that the voice service hands to Gemini Live as part of `system_instruction`. It assembles:

- **`_identity`** — `display_name`, account-age in days (from `User.created_at`).
- **`_engagement`** — total text conversations, total voice conversations so far, days since last interaction (max `last_message_at` across the user's conversations).
- **`_mood`** — reuse `mood_service.recent_summary(days=7)` for the snapshot + a one-liner `Current mood streak: N day(s)` from `mood_service.get_stats(...).current_streak`.
- **`_screenings`** — reuse `assessment_service.format_latest_block(...)`.
- **`_resource_preferences`** — top 3 resource categories from `UserResource` joined with `Resource`, ordered by view count desc; favorites surfaced as `"(favorited)"`.
- **`_groups`** — list of peer groups the user has joined (`GroupMember` → `Group.name` / `Group.category`).
- **`_crisis_signal`** — if `Message.is_crisis_flagged` count > 0 in the last 30 days for any conversation owned by this user, emit a one-liner: `"⚠ User has shown distress signals in the last 30 days — be extra attentive, validate first, surface safety resources gently if relevant."`

Each helper returns `""` when there is nothing to say; `build()` joins the non-empty blocks with `"\n\n"`. No language hint in v1 (Gemini Live auto-detects from the user's audio).

```python
from __future__ import annotations
import logging
import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import (
    Conversation,
    Group,
    GroupMember,
    Message,
    Resource,
    User,
    UserResource,
)
from app.services.assessment_service import assessment_service
from app.services.mood_service import mood_service

logger = logging.getLogger(__name__)


class VoiceContextService:
    async def build(self, db: AsyncSession, user_id: uuid.UUID) -> str:
        sections: list[str] = []
        for fn in (
            self._identity,
            self._engagement,
            self._mood,
            self._screenings,
            self._resource_preferences,
            self._groups,
            self._crisis_signal,
        ):
            try:
                s = await fn(db, user_id)
            except Exception as exc:
                logger.warning("voice context section %s failed: %s", fn.__name__, exc)
                s = ""
            if s:
                sections.append(s)
        return "\n\n".join(sections)

    async def _identity(self, db: AsyncSession, user_id: uuid.UUID) -> str:
        user = (await db.execute(
            select(User).where(User.user_id == user_id)
        )).scalar_one_or_none()
        if user is None:
            return ""
        lines = ["## About this user"]
        if user.display_name:
            lines.append(f"Name: {user.display_name}")
        if user.created_at:
            age_days = (datetime.now(timezone.utc) - user.created_at).days
            lines.append(f"Member for: {age_days} day(s)")
        return "\n".join(lines)

    async def _engagement(self, db: AsyncSession, user_id: uuid.UUID) -> str:
        rows = (await db.execute(
            select(Conversation.conversation_type, func.count(), func.max(Conversation.last_message_at))
            .where(Conversation.user_id == user_id)
            .group_by(Conversation.conversation_type)
        )).all()
        if not rows:
            return ""
        text_count = 0
        voice_count = 0
        last_seen: datetime | None = None
        for ctype, count, last in rows:
            if ctype == "voice":
                voice_count = count
            else:
                text_count = count
            if last is not None and (last_seen is None or last > last_seen):
                last_seen = last
        lines = ["## Engagement history"]
        lines.append(f"Text conversations so far: {text_count}")
        lines.append(f"Voice calls so far: {voice_count}")
        if last_seen is not None:
            delta = datetime.now(timezone.utc) - last_seen
            if delta < timedelta(hours=24):
                lines.append("Last interaction: today")
            elif delta < timedelta(days=2):
                lines.append("Last interaction: yesterday")
            else:
                lines.append(f"Last interaction: {delta.days} day(s) ago")
        return "\n".join(lines)

    async def _mood(self, db: AsyncSession, user_id: uuid.UUID) -> str:
        snapshot = await mood_service.recent_summary(db, user_id, days=7)
        if not snapshot:
            return ""
        try:
            stats = await mood_service.get_stats(db, user_id)
            streak_line = f"Current mood-tracking streak: {stats.current_streak} day(s)."
        except Exception:
            streak_line = ""
        body = snapshot if not streak_line else f"{snapshot}\n{streak_line}"
        return "## Mood snapshot\n" + body

    async def _screenings(self, db: AsyncSession, user_id: uuid.UUID) -> str:
        block = await assessment_service.format_latest_block(db, user_id)
        if not block:
            return ""
        return "## Latest screenings\n" + block

    async def _resource_preferences(self, db: AsyncSession, user_id: uuid.UUID) -> str:
        rows = (await db.execute(
            select(
                Resource.category,
                func.count(UserResource.id),
                func.bool_or(UserResource.is_favorite),
            )
            .join(UserResource, UserResource.resource_id == Resource.resource_id)
            .where(UserResource.user_id == user_id)
            .group_by(Resource.category)
            .order_by(func.count(UserResource.id).desc())
            .limit(3)
        )).all()
        if not rows:
            return ""
        lines = ["## Resource preferences (top categories viewed)"]
        for category, count, any_fav in rows:
            tag = " (favorited)" if any_fav else ""
            lines.append(f"- {category}: {count} view(s){tag}")
        return "\n".join(lines)

    async def _groups(self, db: AsyncSession, user_id: uuid.UUID) -> str:
        rows = (await db.execute(
            select(Group.name, Group.category)
            .join(GroupMember, GroupMember.group_id == Group.group_id)
            .where(GroupMember.user_id == user_id)
            .where(Group.is_active.is_(True))
        )).all()
        if not rows:
            return ""
        lines = ["## Peer-support groups joined"]
        for name, category in rows:
            lines.append(f"- {name} ({category})")
        return "\n".join(lines)

    async def _crisis_signal(self, db: AsyncSession, user_id: uuid.UUID) -> str:
        since = datetime.now(timezone.utc) - timedelta(days=30)
        count = (await db.execute(
            select(func.count(Message.message_id))
            .join(Conversation, Conversation.conversation_id == Message.conversation_id)
            .where(
                and_(
                    Conversation.user_id == user_id,
                    Message.is_crisis_flagged.is_(True),
                    Message.timestamp >= since,
                )
            )
        )).scalar_one()
        if not count:
            return ""
        return (
            "## Safety note\n"
            f"⚠ User has shown distress signals in the last 30 days ({count} flagged message(s)). "
            "Be extra attentive, validate feelings first, and surface safety resources gently if relevant."
        )


voice_context_service = VoiceContextService()
```

#### 2.4 Voice service

**File**: `backend/app/services/voice_service.py` *(new)*

`VoiceService` runs **per WS connection**. It owns a single Gemini Live `session`, accumulates per-turn user/AI transcript buffers, persists messages on `turn_complete`, indexes both, and pushes events back to the browser.

```python
from __future__ import annotations
import asyncio
import base64
import logging
import uuid
from typing import Any, Callable, Awaitable

from google import genai
from google.genai import types
from sqlalchemy import select

from app.config import get_settings
from app.database import async_session_maker
from app.models import Conversation, Message
from app.services.ai_client import AIClient
from app.services.memory_service import memory_service
from app.services.voice_context_service import voice_context_service

logger = logging.getLogger(__name__)


# ---------- helpers ----------

def _build_persona_prompt(persona_name: str, persona_blurb: str) -> str:
    return (
        f"You are {persona_name}, a warm and empathetic AI wellness companion. "
        f"Your style: {persona_blurb or 'warm, attentive, easy to talk to.'} "
        f"Stay in character as {persona_name} throughout — if asked your name, "
        f"you are {persona_name}, never another assistant. "
        "You help people explore feelings, offer emotional support, and use "
        "CBT/mindfulness-style guidance. Keep responses conversational, under "
        "3 sentences unless more detail is truly needed. Never diagnose. "
        "Validate feelings first."
    )


def _format_chunks(chunks: list) -> str:
    """Same format as chat_service._format_chunks but kept local to avoid coupling."""
    lines: list[str] = []
    for c in chunks:
        d = c.created_at.date().isoformat()
        text = (c.text or "").strip().replace("\n", " ")
        if len(text) > 500:
            text = text[:497] + "..."
        lines.append(f"[{d}, {c.source_kind}] {text}")
    return "\n".join(lines)


# ---------- service ----------

class VoiceService:
    """One instance per WS connection. Not a singleton."""

    def __init__(
        self,
        *,
        user_id: uuid.UUID,
        conversation_id: uuid.UUID,
        persona_name: str,
        persona_blurb: str,
        persona_id: str,
        voice: str,
        send_event: Callable[[dict], Awaitable[None]],
    ) -> None:
        self.user_id = user_id
        self.conversation_id = conversation_id
        self.persona_id = persona_id
        self.persona_name = persona_name
        self.persona_blurb = persona_blurb
        self.voice = voice
        self.send_event = send_event

        self._settings = get_settings()
        self._ai_client = AIClient()
        self._client: genai.Client | None = None
        self._session: Any | None = None  # Gemini live session
        self._receive_task: asyncio.Task | None = None

        # Per-turn transcript buffers (text from Gemini's transcription streams).
        self._user_buf: list[str] = []
        self._ai_buf: list[str] = []

    async def _build_system_instruction(self) -> str:
        async with async_session_maker() as db:
            dossier = await voice_context_service.build(db, self.user_id)
            # Retrieval seed: combine persona+blurb so the first turn surfaces
            # memory relevant to the user's situation rather than to a literal name.
            seed_query = f"voice conversation with {self.persona_name}: {self.persona_blurb}"
            try:
                retrieved = await memory_service.retrieve(
                    db,
                    user_id=self.user_id,
                    query_text=seed_query,
                    k=10,
                    kinds=[
                        "message", "mood_note", "assessment_result",
                        "summary", "profile_fact", "voice_transcript",
                    ],
                    # Do not exclude this conversation — for continuation calls we
                    # want prior voice turns from THIS conversation surfaced too.
                    exclude_conversation_id=None,
                )
            except Exception as exc:
                logger.warning("voice retrieve failed: %s", exc)
                retrieved = []

        blocks: list[str] = [_build_persona_prompt(self.persona_name, self.persona_blurb)]
        if dossier:
            blocks.append(dossier)
        if retrieved:
            blocks.append("## Relevant past moments\n" + _format_chunks(retrieved))
        assembled = "\n\n".join(blocks)
        # One-shot log at session open so we can visually verify the dossier
        # came together correctly (per Step 5 verification).
        logger.info(
            "voice system_instruction assembled for user=%s persona=%s len=%d",
            self.user_id, self.persona_name, len(assembled),
        )
        logger.debug("voice system_instruction body:\n%s", assembled)
        return assembled

    async def open(self) -> None:
        """Open the Live session, send `ready`, and start the receive pump."""
        if not self._settings.GEMINI_API_KEY:
            await self.send_event({"type": "error", "message": "Voice unavailable (server missing key)"})
            raise RuntimeError("GEMINI_API_KEY not set")

        system_instruction = await self._build_system_instruction()
        self._client = genai.Client(api_key=self._settings.GEMINI_API_KEY)
        config = types.LiveConnectConfig(
            response_modalities=["AUDIO"],
            system_instruction=system_instruction,
            input_audio_transcription=types.AudioTranscriptionConfig(),
            output_audio_transcription=types.AudioTranscriptionConfig(),
            realtime_input_config=types.RealtimeInputConfig(
                automatic_activity_detection=types.AutomaticActivityDetection(disabled=True),
            ),
            speech_config=types.SpeechConfig(
                voice_config=types.VoiceConfig(
                    prebuilt_voice_config=types.PrebuiltVoiceConfig(voice_name=self.voice),
                ),
            ),
        )

        # Note: live.connect returns an async-context manager; we deliberately
        # __aenter__ it manually so the session outlives a function call.
        self._session_ctx = self._client.aio.live.connect(
            model=self._settings.GEMINI_LIVE_MODEL,
            config=config,
        )
        self._session = await self._session_ctx.__aenter__()
        await self.send_event({"type": "ready"})
        self._receive_task = asyncio.create_task(self._receive_loop())

    async def close(self) -> None:
        if self._receive_task is not None:
            self._receive_task.cancel()
            try:
                await self._receive_task
            except (asyncio.CancelledError, Exception):
                pass
            self._receive_task = None
        if self._session is not None:
            try:
                await self._session_ctx.__aexit__(None, None, None)
            except Exception as exc:
                logger.warning("voice session __aexit__ failed: %s", exc)
            self._session = None

    # ----- inbound from browser -----

    async def push_audio(self, pcm_b64: str, mime: str = "audio/pcm;rate=16000") -> None:
        if self._session is None:
            return
        try:
            await self._session.send_realtime_input(
                audio=types.Blob(data=base64.b64decode(pcm_b64), mime_type=mime),
            )
        except Exception as exc:
            logger.warning("send_realtime_input failed: %s", exc)
            await self.send_event({"type": "error", "message": "audio relay failed"})

    async def activity_start(self) -> None:
        if self._session is not None:
            await self._session.send_realtime_input(activity_start=types.ActivityStart())

    async def activity_end(self) -> None:
        if self._session is not None:
            await self._session.send_realtime_input(activity_end=types.ActivityEnd())

    # ----- outbound to browser -----

    async def _receive_loop(self) -> None:
        try:
            async for response in self._session.receive():
                # Audio bytes -> base64 -> browser
                if getattr(response, "data", None):
                    pcm_b64 = base64.b64encode(response.data).decode("ascii")
                    await self.send_event({
                        "type": "audio",
                        "data": pcm_b64,
                        "sample_rate": 24000,
                    })

                sc = getattr(response, "server_content", None)
                if sc is None:
                    continue

                in_t = getattr(sc, "input_transcription", None)
                if in_t is not None and getattr(in_t, "text", None):
                    self._user_buf.append(in_t.text)
                    await self.send_event({
                        "type": "transcript",
                        "role": "user",
                        "text": in_t.text,
                    })

                out_t = getattr(sc, "output_transcription", None)
                if out_t is not None and getattr(out_t, "text", None):
                    self._ai_buf.append(out_t.text)
                    await self.send_event({
                        "type": "transcript",
                        "role": "ai",
                        "text": out_t.text,
                    })

                if getattr(sc, "turn_complete", False):
                    await self._flush_turn()
        except asyncio.CancelledError:
            raise
        except Exception as exc:
            logger.exception("voice receive loop failed: %s", exc)
            await self.send_event({"type": "error", "message": "voice receive failed"})

    async def _flush_turn(self) -> None:
        user_text = "".join(self._user_buf).strip()
        ai_text = "".join(self._ai_buf).strip()
        self._user_buf.clear()
        self._ai_buf.clear()

        if not user_text and not ai_text:
            await self.send_event({"type": "turn_complete"})
            return

        try:
            async with async_session_maker() as db:
                # Crisis check on user transcript (best effort, never blocks the turn).
                if user_text:
                    try:
                        crisis = await self._ai_client.check_crisis(user_text)
                    except Exception:
                        crisis = {"is_crisis": False}
                else:
                    crisis = {"is_crisis": False}

                user_msg_id: uuid.UUID | None = None
                ai_msg_id: uuid.UUID | None = None
                if user_text:
                    user_msg = Message(
                        conversation_id=self.conversation_id,
                        sender_type="user",
                        content=user_text[:5000],
                        is_crisis_flagged=bool(crisis.get("is_crisis")),
                    )
                    db.add(user_msg)
                    await db.flush()
                    user_msg_id = user_msg.message_id

                if ai_text:
                    ai_msg = Message(
                        conversation_id=self.conversation_id,
                        sender_type="ai",
                        content=ai_text[:5000],
                    )
                    db.add(ai_msg)
                    await db.flush()
                    ai_msg_id = ai_msg.message_id

                # Update conversation bookkeeping.
                conv_res = await db.execute(
                    select(Conversation).where(
                        Conversation.conversation_id == self.conversation_id
                    )
                )
                conv = conv_res.scalar_one_or_none()
                if conv is not None:
                    if user_msg_id is not None:
                        conv.last_message_at = user_msg.timestamp
                    if ai_msg_id is not None:
                        conv.last_message_at = ai_msg.timestamp
                    conv.total_messages = (conv.total_messages or 0) + int(bool(user_msg_id)) + int(bool(ai_msg_id))
                    if crisis.get("is_crisis"):
                        conv.crisis_detected = True
                    if not conv.title and user_text:
                        conv.title = (user_text[:50] + "…") if len(user_text) > 50 else user_text

                await db.commit()

                # Indexing: best-effort, don't break the turn on failure.
                if user_msg_id is not None:
                    try:
                        await memory_service.index(
                            db,
                            user_id=self.user_id,
                            source_kind="voice_transcript",
                            source_id=user_msg_id,
                            conversation_id=self.conversation_id,
                            text=user_text[:5000],
                            attrs={"sender": "user", "channel": "voice",
                                   "persona_id": self.persona_id, "voice": self.voice},
                        )
                        await db.commit()
                    except Exception as exc:
                        logger.warning("index voice user turn failed: %s", exc)

                if ai_msg_id is not None:
                    try:
                        await memory_service.index(
                            db,
                            user_id=self.user_id,
                            source_kind="voice_transcript",
                            source_id=ai_msg_id,
                            conversation_id=self.conversation_id,
                            text=ai_text[:5000],
                            attrs={"sender": "ai", "channel": "voice",
                                   "persona_id": self.persona_id, "voice": self.voice},
                        )
                        await db.commit()
                    except Exception as exc:
                        logger.warning("index voice ai turn failed: %s", exc)
        except Exception as exc:
            logger.exception("voice _flush_turn DB write failed: %s", exc)

        if crisis.get("is_crisis"):
            await self.send_event({
                "type": "crisis_alert",
                "resources": crisis.get("resources", {}),
            })

        await self.send_event({"type": "turn_complete"})
```

#### 2.5 Voice REST + WS route

**File**: `backend/app/api/v1/voice.py` *(new)*

```python
import uuid

from fastapi import APIRouter, Depends, HTTPException, WebSocket, status
from fastapi.websockets import WebSocketDisconnect
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import get_current_user, verify_token
from app.database import async_session_maker, get_db
from app.models import Conversation, User
from app.schemas.chat import ConversationResponse
from app.schemas.voice import VoiceConversationCreate
from app.services.voice_service import VoiceService

router = APIRouter()


@router.post(
    "/conversations",
    response_model=ConversationResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_or_reuse_voice_conversation(
    body: VoiceConversationCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a new voice conversation, OR reuse an existing one when `conversation_id`
    is provided (the "Continue this call" path).

    Either way the response carries the conversation we'll bind the WS to.
    """
    if body.conversation_id is not None:
        result = await db.execute(
            select(Conversation).where(
                Conversation.conversation_id == body.conversation_id,
            )
        )
        conv = result.scalar_one_or_none()
        if conv is None or conv.user_id != current_user.user_id:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
        if conv.conversation_type != "voice":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Conversation is not a voice conversation",
            )
        # Allow persona change on continuation (user may pick a different avatar);
        # write the latest persona into attrs.
        conv.attrs = {
            **(conv.attrs or {}),
            "persona_id": body.persona_id,
            "persona_name": body.persona_name,
            "voice": body.voice,
        }
        if conv.status == "archived":
            conv.status = "active"
        await db.commit()
        await db.refresh(conv)
        return ConversationResponse.model_validate(conv)

    conv = Conversation(
        user_id=current_user.user_id,
        title=None,
        conversation_type="voice",
        attrs={
            "persona_id": body.persona_id,
            "persona_name": body.persona_name,
            "voice": body.voice,
        },
    )
    db.add(conv)
    await db.commit()
    await db.refresh(conv)
    return ConversationResponse.model_validate(conv)


# --- WebSocket: /ws/voice/{conversation_id}?token=... ---

async def websocket_voice(websocket: WebSocket, conversation_id: uuid.UUID):
    # Auth (mirrors chat.py:107-137)
    token = websocket.query_params.get("token")
    if not token:
        await websocket.close(code=4001)
        return
    try:
        payload = verify_token(token)
    except Exception:
        await websocket.close(code=4001)
        return
    sub = payload.get("sub")
    if not sub:
        await websocket.close(code=4001)
        return
    try:
        user_id = uuid.UUID(sub)
    except ValueError:
        await websocket.close(code=4001)
        return

    async with async_session_maker() as db:
        result = await db.execute(
            select(Conversation).where(
                Conversation.conversation_id == conversation_id
            )
        )
        conv = result.scalar_one_or_none()
        if conv is None or conv.user_id != user_id or conv.conversation_type != "voice":
            await websocket.close(code=4001)
            return
        persona_id = (conv.attrs or {}).get("persona_id") or ""
        persona_name = (conv.attrs or {}).get("persona_name") or "Serenity"
        persona_blurb = (conv.attrs or {}).get("persona_blurb") or ""
        voice = (conv.attrs or {}).get("voice") or "Kore"

    await websocket.accept()

    async def send_event(payload: dict) -> None:
        try:
            await websocket.send_json(payload)
        except Exception:
            # browser closed; receive loop below will catch and we'll tear down.
            pass

    service = VoiceService(
        user_id=user_id,
        conversation_id=conversation_id,
        persona_id=persona_id,
        persona_name=persona_name,
        persona_blurb=persona_blurb,
        voice=voice,
        send_event=send_event,
    )

    try:
        await service.open()
    except Exception:
        await websocket.close(code=1011)
        return

    try:
        while True:
            try:
                msg = await websocket.receive_json()
            except WebSocketDisconnect:
                break
            except Exception:
                continue

            mtype = msg.get("type")
            if mtype == "audio":
                data = msg.get("data")
                mime = msg.get("mime") or "audio/pcm;rate=16000"
                if isinstance(data, str):
                    await service.push_audio(data, mime=mime)
            elif mtype == "activity_start":
                await service.activity_start()
            elif mtype == "activity_end":
                await service.activity_end()
            # ignore unknown types
    finally:
        await service.close()
```

#### 2.6 Register routes

**File**: `backend/app/api/v1/router.py`
**Change**: import + register the new REST router.

```diff
-from app.api.v1 import assessments, auth, chat, groups, health, mood, resources
+from app.api.v1 import assessments, auth, chat, groups, health, mood, resources, voice
@@
 api_router.include_router(groups.router, prefix="/groups", tags=["Groups"])
+api_router.include_router(voice.router, prefix="/voice", tags=["Voice"])
```

**File**: `backend/app/main.py`
**Change**: register the WS handler next to the existing chat/group ones (currently lines 66-67).

```diff
 from app.api.v1.chat import websocket_chat
 from app.api.v1.groups import websocket_group
+from app.api.v1.voice import websocket_voice
@@
 app.websocket("/ws/chat/{conversation_id}")(websocket_chat)
 app.websocket("/ws/group/{group_id}")(websocket_group)
+app.websocket("/ws/voice/{conversation_id}")(websocket_voice)
```

### Success Criteria — Step 2

#### Smoke verification:

- `docker compose build backend` succeeds with `google-genai` installed.
- `docker compose up -d backend` starts cleanly; `docker compose logs backend` shows no import errors.
- `curl -s http://localhost:8000/api/v1/voice/conversations -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"persona_id":"serenity","persona_name":"Serenity","persona_blurb":"Warm","voice":"Kore"}'` returns a JSON conversation with `conversation_type:"voice"` and a non-null `attrs`.
- The same `conversation_id` re-submitted with `conversation_id=<id>` updates `attrs` and returns 201.
- WS handshake check from a small script:
  ```bash
  python -c "
  import asyncio, json, websockets
  async def main():
      uri = 'ws://localhost:8000/ws/voice/<id>?token=<jwt>'
      async with websockets.connect(uri) as ws:
          print(await asyncio.wait_for(ws.recv(), timeout=10))  # expect {\"type\":\"ready\"}
  asyncio.run(main())"
  ```

---

## Step 3: Frontend — backend-voice client + AvatarScene rewrite

### Overview

Add `frontend/src/lib/backend-voice.ts` (mirrors today's `VoiceSession` shape but talks to the backend WS). `AvatarScene.tsx` calls `POST /api/v1/voice/conversations` before opening the WS, then uses the returned `conversation_id` for the WS URL. `VoiceSession` and the direct-to-Gemini Live `ai.live.connect` import in `gemini-avatar.ts` are removed.

### Changes Required

#### 3.1 New backend-voice client

**File**: `frontend/src/lib/backend-voice.ts` *(new)*

```ts
import { getStoredToken } from "@/lib/api";

export type VoiceSessionEvent =
  | { type: "ready" }
  | { type: "audio"; pcm: ArrayBuffer; sampleRate: number }
  | { type: "transcript"; role: "user" | "ai"; text: string }
  | { type: "turn_complete" }
  | { type: "crisis_alert"; resources: unknown }
  | { type: "error"; message: string };

function getWsBaseUrl(): string {
  if (typeof window === "undefined") return "";
  const wsUrl = process.env.NEXT_PUBLIC_WS_URL ?? "";
  if (wsUrl) return wsUrl.replace(/^http/, "ws");
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "";
  if (apiUrl) return apiUrl.replace(/^http/, "ws");
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${window.location.host}`;
}

function b64ToArrayBuffer(b64: string): ArrayBuffer {
  const bin = atob(b64);
  const buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  return buf.buffer;
}

function arrayBufferToB64(ab: ArrayBuffer): string {
  const u8 = new Uint8Array(ab);
  let bin = "";
  for (let i = 0; i < u8.length; i++) bin += String.fromCharCode(u8[i]);
  return btoa(bin);
}

export class BackendVoiceSession {
  private ws: WebSocket | null = null;
  private audioCtx: AudioContext | null = null;
  private micStream: MediaStream | null = null;
  private processor: ScriptProcessorNode | null = null;
  private recording = false;
  private closed = false;
  // Per-turn AI audio assembly (server streams base64 chunks).
  private rxChunks: Uint8Array[] = [];
  private rxRate = 24000;
  private rxTextUser = "";
  private rxTextAi = "";

  onEvent: (e: VoiceSessionEvent) => void = () => {};

  async open(conversationId: string): Promise<void> {
    const token = getStoredToken();
    if (!token) throw new Error("Not authenticated");
    const base = getWsBaseUrl();
    const sep = base.includes("?") ? "&" : "?";
    const url = `${base}/ws/voice/${conversationId}${sep}token=${encodeURIComponent(token)}`;

    await new Promise<void>((resolve, reject) => {
      const ws = new WebSocket(url);
      this.ws = ws;
      ws.onopen = () => resolve();
      ws.onerror = () => reject(new Error("WS connection failed"));
      ws.onclose = (e) => {
        if (!this.closed) this.onEvent({ type: "error", message: `Closed: ${e.reason || e.code}` });
      };
      ws.onmessage = (ev) => this._handleMessage(ev);
    });

    this.micStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    this.audioCtx = new AudioContext({ sampleRate: 16000 });
    const src = this.audioCtx.createMediaStreamSource(this.micStream);
    this.processor = this.audioCtx.createScriptProcessor(4096, 1, 1);

    this.processor.onaudioprocess = (e) => {
      if (!this.recording || !this.ws || this.ws.readyState !== WebSocket.OPEN) return;
      const f32 = e.inputBuffer.getChannelData(0);
      const i16 = new Int16Array(f32.length);
      for (let i = 0; i < f32.length; i++) {
        i16[i] = Math.max(-32768, Math.min(32767, f32[i] * 32768));
      }
      this.ws.send(
        JSON.stringify({
          type: "audio",
          data: arrayBufferToB64(i16.buffer),
          mime: "audio/pcm;rate=16000",
        }),
      );
    };

    src.connect(this.processor);
    this.processor.connect(this.audioCtx.destination);
  }

  startRecording(): void {
    this.recording = true;
    this.ws?.send(JSON.stringify({ type: "activity_start" }));
  }

  stopRecording(): void {
    this.recording = false;
    this.ws?.send(JSON.stringify({ type: "activity_end" }));
  }

  close(): void {
    this.closed = true;
    this.recording = false;
    this.processor?.disconnect();
    this.micStream?.getTracks().forEach((t) => t.stop());
    this.audioCtx?.close();
    this.ws?.close();
    this.ws = null;
  }

  private _handleMessage(ev: MessageEvent): void {
    let msg: Record<string, unknown>;
    try {
      msg = JSON.parse(ev.data as string) as Record<string, unknown>;
    } catch {
      return;
    }
    const t = msg.type as string;
    if (t === "ready") {
      this.onEvent({ type: "ready" });
      return;
    }
    if (t === "audio" && typeof msg.data === "string") {
      const rate = typeof msg.sample_rate === "number" ? msg.sample_rate : 24000;
      this.rxRate = rate;
      const ab = b64ToArrayBuffer(msg.data);
      this.rxChunks.push(new Uint8Array(ab));
      return;
    }
    if (t === "transcript") {
      const role = msg.role as "user" | "ai";
      const text = (msg.text as string) || "";
      if (role === "user") this.rxTextUser += text;
      else this.rxTextAi += text;
      this.onEvent({ type: "transcript", role, text });
      return;
    }
    if (t === "turn_complete") {
      const total = this.rxChunks.reduce((s, c) => s + c.byteLength, 0);
      if (total > 0) {
        const combined = new Uint8Array(total);
        let off = 0;
        for (const c of this.rxChunks) {
          combined.set(c, off);
          off += c.byteLength;
        }
        this.onEvent({
          type: "audio",
          pcm: combined.buffer as ArrayBuffer,
          sampleRate: this.rxRate,
        });
      }
      this.rxChunks = [];
      this.rxTextUser = "";
      this.rxTextAi = "";
      this.onEvent({ type: "turn_complete" });
      return;
    }
    if (t === "crisis_alert") {
      this.onEvent({ type: "crisis_alert", resources: msg.resources });
      return;
    }
    if (t === "error") {
      this.onEvent({ type: "error", message: String(msg.message ?? "voice error") });
    }
  }
}
```

Note the event shape change vs the old `VoiceSession`:

- old: single `"response"` event carries `{pcm, durationMs, text}` at turn end.
- new: `"transcript"` events stream as text arrives, `"audio"` event fires at `turn_complete` with the assembled PCM, plus a separate `"turn_complete"` event.

This is closer to how `AvatarScene.tsx`'s `speakResponse` actually needs the data (it wants both text and PCM at turn end, which is what we deliver — just by combining the buffered `transcript`+`audio` events; see Step 3.2).

#### 3.2 AvatarScene rewrite

**File**: `frontend/src/components/avatar/AvatarScene.tsx`

Changes (call sites currently around lines 16-23, 292, 471-497, 364-371):

```diff
 import {
   fetchTTS,
-  VoiceSession,
   type GeminiVoiceId,
 } from "@/lib/gemini-avatar";
+import { BackendVoiceSession } from "@/lib/backend-voice";
+import { createVoiceConversation } from "@/lib/api";
@@
   const sessionRef = useRef<VoiceSession | null>(null);
+  const sessionRef = useRef<BackendVoiceSession | null>(null);
+  const conversationIdRef = useRef<string | null>(null);
+  const pendingTextRef = useRef<string>("");
```

Replace `startCall` (currently `AvatarScene.tsx:471-497`):

```ts
async function startCall() {
  if (status !== "ready") return;
  setCallStatus("connecting");
  setCallError(null);

  const created = await createVoiceConversation({
    persona_id: avatar.id,
    persona_name: avatar.name,
    persona_blurb: avatar.blurb,
    voice: avatar.geminiVoice,
    // continueId comes from query string when entering via "Continue this call"
    conversation_id: searchParams.get("conversation") ?? null,
  });
  if (!created.ok) {
    setCallError(created.error ?? "Failed to start call");
    setCallStatus("idle");
    return;
  }
  conversationIdRef.current = created.data.conversation_id;

  const session = new BackendVoiceSession();
  sessionRef.current = session;

  session.onEvent = (e) => {
    if (e.type === "ready") {
      setCallStatus("ready");
      return;
    }
    if (e.type === "transcript" && e.role === "ai") {
      pendingTextRef.current += e.text;
      return;
    }
    if (e.type === "audio") {
      const text = pendingTextRef.current || "…";
      pendingTextRef.current = "";
      const durationMs = (e.pcm.byteLength / 2 / e.sampleRate) * 1000;
      setCallStatus("ready");
      speakResponse(text, e.pcm, durationMs);
      return;
    }
    if (e.type === "crisis_alert") {
      // Could surface a banner here; for v1 we just log so we don't disturb the call.
      console.warn("crisis_alert on voice", e.resources);
      return;
    }
    if (e.type === "error") {
      setCallError(e.message);
      setCallStatus("idle");
    }
  };

  try {
    await session.open(conversationIdRef.current!);
  } catch (err) {
    setCallError(err instanceof Error ? err.message : String(err));
    setCallStatus("idle");
    sessionRef.current = null;
  }
}
```

`speakResponse` (`AvatarScene.tsx:373-426`) doesn't need to change: it still receives `(text, pcm, durationMs)` and resamples the PCM to 22050 Hz internally (today via `resamplePCM` in `gemini-avatar.ts:27-42` — that helper stays in `gemini-avatar.ts` because frontend code still uses it from the preview path. We import it explicitly here.).

Actually — `resamplePCM` is currently a non-exported helper. Mark it `export`:

**File**: `frontend/src/lib/gemini-avatar.ts`
**Change**: at line 27, change `function resamplePCM` → `export function resamplePCM`. Drop `VoiceSession`, `VoiceSessionEvent`, and the unused `GoogleGenAI`/`Modality`/`LiveConnectConfig`/`Session` imports at line 1. The remaining file is: `Persona`, `DEFAULT_PERSONA`, `buildSystemPrompt` (still used by preview persona context if we want, optionally drop too), `resamplePCM`, `GEMINI_VOICES`, `GeminiVoiceId`, `TTSResult`, `fetchTTS`.

`speakResponse` then uses the exported `resamplePCM` on `e.pcm` before handing PCM to TalkingHead. Today it doesn't actually call `resamplePCM` itself — `VoiceSession._handleMessage` did the resampling before emitting. With the new flow, **we keep the same shape**: the backend delivers 24 kHz PCM; we resample to 22050 Hz inside `speakResponse` before `headRef.current?.speakAudio({...})`. Add the resample step at the top of `speakResponse`:

```ts
const speakResponse = useCallback(
  async (text: string, pcm: ArrayBuffer | null, durationMs: number) => {
    setStatus("speaking");
    // ... (rest unchanged, except:)
    const hasRealAudio = !!pcm && pcm.byteLength > 0;
    let resampled: ArrayBuffer | null = pcm;
    if (hasRealAudio) {
      const src16 = new Int16Array(pcm!);
      const dst16 = resamplePCM(src16, 24000, 22050);
      resampled = dst16.buffer as ArrayBuffer;
    }
    const actualPcm = hasRealAudio ? resampled : makeSilentPcm(safeDurationMs);
    // ... use actualPcm as before
  },
  [],
);
```

Also update the `useEffect` cleanup at `AvatarScene.tsx:364-371` to call `sessionRef.current?.close()` — the API surface is the same (`close()` exists on `BackendVoiceSession`).

#### 3.3 `createVoiceConversation` in api.ts

**File**: `frontend/src/lib/api.ts`
**Change**: append.

```ts
export async function createVoiceConversation(body: {
  persona_id: string;
  persona_name: string;
  persona_blurb: string;
  voice: string;
  conversation_id?: string | null;
}): Promise<ApiResponse<ConversationResponse>> {
  return apiRequest("/api/v1/voice/conversations", {
    method: "POST",
    body: JSON.stringify(body),
  });
}
```

#### 3.4 AvatarScene picker bypass for continuations

**File**: `frontend/src/app/(main)/avatar/page.tsx` *(or wherever AvatarScene is mounted)*

Read `?conversation=<id>` from the URL. If present, fetch that conversation, pre-select the persona matching `attrs.persona_id` from `AVATARS`, and skip the picker. Add a small wrapper:

```tsx
"use client";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import { getConversation } from "@/lib/api";
import type { Conversation } from "@/lib/types";

const AvatarScene = dynamic(
  () => import("@/components/avatar/AvatarScene").then((m) => m.AvatarScene),
  { ssr: false },
);

export default function AvatarPage() {
  const params = useSearchParams();
  const continueId = params.get("conversation");
  const [preselectPersonaId, setPreselectPersonaId] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(!continueId);

  useEffect(() => {
    if (!continueId) return;
    (async () => {
      const res = await getConversation(continueId);
      if (res.ok && (res.data as Conversation).attrs?.persona_id) {
        setPreselectPersonaId(((res.data as Conversation).attrs as { persona_id: string }).persona_id);
      }
      setLoaded(true);
    })();
  }, [continueId]);

  if (!loaded) return null;
  return <AvatarScene preselectPersonaId={preselectPersonaId ?? undefined} continueConversationId={continueId ?? undefined} />;
}
```

And `AvatarScene` accepts the two props, auto-selects the persona by id, and passes `continueConversationId` into `startCall` (which uses it as the `conversation_id` field of the `POST /api/v1/voice/conversations` body — already wired above).

### Success Criteria — Step 3

#### Smoke verification:

- `cd frontend && npm run build` succeeds.
- `grep -rn "ai.live.connect\|@google/genai" frontend/src/` — the only matches are inside `gemini-avatar.ts` `fetchTTS` (HTTP REST to `generativelanguage.googleapis.com`, not Live).
- In a browser: pick Serenity, start call, hold-to-talk "Hi" — the avatar replies in audio AND a new row appears in `conversations` with `conversation_type='voice'`, two new `messages` rows (user + ai), and two new `memory_chunks` rows (`source_kind='voice_transcript'`).
- Visit `/chat/<that id>` — transcripts show as text bubbles.

---

## Step 4: Sidebar phone icon + Continue-this-call button

### Overview

Distinguish voice conversations visually in the sidebar and add a Continue button to past voice conversations.

### Changes Required

#### 4.1 Sidebar item icon

**File**: `frontend/src/components/chat/ConversationItem.tsx`
**Change**: lines 7-15 import `Phone`, and around line 55 in the collapsed-icon branch + line 92 in the expanded branch, branch on `conversation.conversation_type`:

```diff
-import { MessageCircle, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
+import { MessageCircle, MoreHorizontal, Pencil, Phone, Trash2 } from "lucide-react";
```

In the **collapsed** branch (currently uses `<MessageCircle className="h-4 w-4" />` at line 55):

```tsx
{conversation.conversation_type === "voice" ? (
  <Phone className="h-4 w-4" strokeWidth={1.75} />
) : (
  <MessageCircle className="h-4 w-4" strokeWidth={1.75} />
)}
```

In the **expanded** branch (the title block at lines 84-101), prepend a small phone glyph next to the title when voice:

```tsx
<div className="flex items-center gap-2">
  {conversation.conversation_type === "voice" && (
    <Phone className="h-3 w-3 shrink-0 text-muted-foreground" strokeWidth={1.75} aria-hidden />
  )}
  <span className={cn(...existing classes)}>{displayTitle}</span>
  {conversation.crisis_detected && (...existing dot)}
</div>
```

#### 4.2 Continue-this-call button in chat conversation view

**File**: `frontend/src/components/chat/ChatContainer.tsx` *(the orchestrator that wraps the messages view; see `frontend/src/components/chat/ChatContainer.tsx` per the parent plan reference)*

Where the conversation header is rendered (or above the message list when `conversation.conversation_type === "voice"`), add:

```tsx
{conversation?.conversation_type === "voice" && (
  <div className="border-b border-border bg-muted/40 px-4 py-2 flex items-center justify-between">
    <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
      Voice conversation · {conversation.attrs?.persona_name ?? "Avatar"}
    </p>
    <Link
      href={`/avatar?conversation=${conversation.conversation_id}`}
      className="inline-flex items-center gap-1.5 rounded-md border border-primary/60 bg-primary/10 px-2.5 py-1 text-xs text-primary hover:bg-primary/15"
    >
      <Phone className="h-3.5 w-3.5" strokeWidth={1.75} />
      Continue this call
    </Link>
  </div>
)}
```

The exact placement depends on the current `ChatContainer` shape; the rule is "show this banner when `conversation.conversation_type === 'voice'`, anywhere above the message list".

#### 4.3 Hide composer for voice conversations

In `/chat/[id]` voice transcripts are **view-only**. The text composer (`ChatInput`) at the bottom should not send into a voice conversation (the backend chat WS doesn't know how to inject a text turn mid-Live-session anyway). Hide it when `conversation.conversation_type === "voice"`:

```tsx
{conversation?.conversation_type !== "voice" && <ChatInput ... />}
```

### Success Criteria — Step 4

#### Smoke verification:

- After completing a voice call, the conversation appears in the chat sidebar with a phone icon (both collapsed and expanded views).
- Opening the voice conversation in `/chat/<id>` shows the banner "Voice conversation · Serenity" with a "Continue this call" link, and the text input is hidden.
- Clicking "Continue this call" navigates to `/avatar?conversation=<id>`, picker is skipped, persona is re-bound, holding-to-talk adds further turns to the same conversation.

---

## Step 5: Env + smoke verification end-to-end

### Overview

Wire `GEMINI_API_KEY` into the backend container, then run the full path manually.

### Changes Required

- `.env.example` — add a comment line clarifying that `GEMINI_API_KEY` is shared between ai-service and backend.
- `docker-compose.yml` — under the `backend` service env block, add `GEMINI_API_KEY: ${GEMINI_API_KEY}`.
- (Optional) `frontend/.env.example` — note that `NEXT_PUBLIC_GEMINI_API_KEY` is now only used for persona previews; production deployment can scope it to a separate restricted key.

### Success Criteria — Step 5 (golden-path smoke)

#### Manual verification:

1. **First call, fresh user**:
  - Sign up. Visit `/avatar`. Pick Serenity. Click Start conversation. Press-and-hold Space, say "Hi, I'm new here." Release.
  - Expect: avatar replies in audio + captions; one new conversation row with `conversation_type='voice'`, two new messages (user + ai), two new `memory_chunks` rows with `source_kind='voice_transcript'`.
2. **End call**:
  - Click the end-call button. No errors in server logs. Browser cleans up mic / WS.
3. **Sidebar visibility**:
  - Refresh app. The voice conversation appears in the sidebar with a phone icon, next to past text chats.
4. **View past transcript**:
  - Click the voice conversation in the sidebar. `/chat/<id>` opens, banner shows persona name, transcript bubbles render in order, text composer is hidden.
5. **Continue this call**:
  - Click "Continue this call". `/avatar` opens with picker skipped and Serenity pre-bound. Hold-to-talk: "What did we just talk about?" Expect the AI to reference the prior exchange (because retrieval surfaces the prior `voice_transcript` chunks in the system instruction).
6. **Cross-channel memory**:
  - Open a brand-new **text** chat. Send "What did I tell you about myself on our call?" Expect the AI to surface content from the voice transcripts (Phase 1's `memory_service.retrieve` already includes `voice_transcript` in the default kinds set for chat — confirm by inspecting the assembled system prompt or simply observing the reply).
7. **Crisis on voice**:
  - In a voice call, say a phrase that hits the keyword crisis list (e.g. "I want to end it all"). Confirm `Message.is_crisis_flagged = true` for that turn and `Conversation.crisis_detected = true` for the conversation row. The WS emits a `crisis_alert` event (logged to the browser console in v1 — UI surfacing is out of scope; see "What we're NOT doing").
8. **Failure-mode — bad GEMINI_API_KEY**:
  - Temporarily set `GEMINI_API_KEY=""` in the backend container, restart, try to start a call. Expect: WS opens, then immediately closes with `{type:"error","message":"Voice unavailable (server missing key)"}`. The browser surfaces `callError`.
9. **Key not in browser anymore**:
  - In the running app, open devtools → Network. Start a call. Verify there are **no** outbound requests to `generativelanguage.googleapis.com` from the page during the Live exchange (only `fetchTTS` previews use that origin, and only when the user explicitly hits play on the picker).
10. **Dossier visible in logs**:
  - Tail backend logs (`docker compose logs -f backend`). Start a voice call. Confirm exactly one `voice system_instruction assembled for user=... persona=... len=N` line per call, and (with `LOG_LEVEL=DEBUG`) one full body dump containing the sections `## About this user`, `## Engagement history`, `## Mood snapshot` (if the user has mood entries), `## Latest screenings` (if any), `## Resource preferences ...` (if any), `## Peer-support groups joined` (if any), `## Safety note` (only if recent flags exist), and `## Relevant past moments` (if memory chunks matched).

---

## Testing Strategy (smoke only)

No automated tests. Step-by-step manual verification above is the contract.

A future testing harness (called out as a follow-up in the parent plan) would:

- Stand up a `pytest` fixture with a real Postgres + a mock `genai.Client.aio.live.connect` that yields a scripted sequence of `server_content.input_transcription` / `output_transcription` / `turn_complete` messages, and assert two `Message` rows + two `MemoryChunk` rows per turn.
- Add a Playwright test that opens `/avatar`, mocks the WS, and asserts the captions render.

The `VoiceService` is structured to support that: it injects the `send_event` callback rather than holding the WebSocket directly, and it accepts the persona/voice/conv_id at construction, so a unit test can drive it without standing up FastAPI.

## Performance Considerations

- **End-to-speech → first-audio latency**: Gemini Live adds ~300-600 ms; the backend proxy adds ~30-60 ms (one decode + JSON encode per audio frame, run on the asyncio event loop). Target ≤ 1.5 s on a normal connection.
- **Audio frame size**: 4096 samples @ 16 kHz = ~256 ms per send. Backend sends a `send_realtime_input` per frame — fine, but if frame counts become noisy, batch on the browser side (raise to 8192) before changing the backend.
- **Indexing per turn**: each `turn_complete` does 0–2 `/embed` calls (one per non-empty side). Each call is independent of the next turn (commits flushed per side). Worst-case extra latency is hidden behind the audio playback that's already underway.
- **Concurrent users**: each WS holds one Gemini Live session in the backend process. The Python `asyncio` event loop scales to hundreds of concurrent sessions per worker — well within budget for the project's scale.

## Migration Notes

- One forward Alembic migration (Step 1) — additive only; `conversation_type` defaults `'text'` so every existing row stays a text chat.
- No backfill of `memory_chunks` for voice — there are no voice transcripts to backfill (this is the first time we persist them).
- Revert: drop the WS route + REST endpoint + voice service + frontend files; revert `chat.py` is untouched; run `alembic downgrade -1`. Everything else is additive.
- The `NEXT_PUBLIC_GEMINI_API_KEY` env on the frontend can be **rotated to a TTS-only key** once `fetchTTS` is the only thing using it. Out of scope for this sub-plan.

## References

- Parent plan: `docs/plans/2026-05-12-rag-personalization.md` (Phase 3 section starts at line 395).
- Prior sub-plan (Phase 0/1, foundational infra): `docs/plans/2026-05-14-rag-phase-0-1.md`.
- Research: `docs/research/2026-05-12-rag-personalization-research.md` (§D for voice avatar today, §F for memory shape).
- Working Python Gemini Live example in-repo: `try-3d-avatar/test_gemini_live_amharic.py:23-49`.
- Canonical insertion points (re-verified for this sub-plan):
  - `backend/app/main.py:66-67` — WS registration site (new `/ws/voice/{id}` appended).
  - `backend/app/api/v1/router.py:3-14` — REST router registration site (new `voice` router appended).
  - `backend/app/api/v1/chat.py:105-137` — WS auth pattern, copied for `websocket_voice`.
  - `backend/app/models/conversation.py:12-44` — Conversation model (new `conversation_type` + `attrs` added).
  - `backend/app/services/memory_service.py:33-84` — `MemoryService.index` reused for voice chunks.
  - `backend/app/services/profile_service.py:12-31` — `ProfileService.build_profile_block` reused.
  - `backend/app/services/ai_client.py:16-28` — `AIClient.check_crisis` reused.
  - `frontend/src/lib/gemini-avatar.ts:106-235` — `VoiceSession` removed; `fetchTTS`/`GEMINI_VOICES`/`Persona`/`resamplePCM` retained.
  - `frontend/src/components/avatar/AvatarScene.tsx:471-497` — `startCall` rewritten.
  - `frontend/src/lib/api.ts:119-124` — pattern for `createVoiceConversation` mirrors `createConversation`.
  - `frontend/src/components/chat/ConversationItem.tsx:55, 84-101` — phone-icon insertion points.
  - `frontend/src/hooks/useConversations.ts:21-30` — no change required (the existing `GET /api/v1/chat/conversations` already returns voice convos once the schema columns are added).

