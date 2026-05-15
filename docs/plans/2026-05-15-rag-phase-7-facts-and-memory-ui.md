---
date: 2026-05-15
author: anatoli
status: draft
topic: "RAG Phase 7 — Extracted user facts + Memory UI"
parent_plan: docs/plans/2026-05-12-rag-personalization.md
prior_subplans:
  - docs/plans/2026-05-14-rag-phase-0-1.md
  - docs/plans/2026-05-14-rag-phase-3-voice-backend.md
research: docs/research/2026-05-12-rag-personalization-research.md
---

# RAG Phase 7 — Extracted user facts + Memory UI (Standalone Implementation Plan)

## Overview

Phase 7 closes the personalization loop. Today retrieval *consumes* `source_kind="profile_fact"` chunks (`backend/app/services/chat_service.py:249`, `backend/app/services/voice_service.py:96`) but **nothing in the codebase writes them** — they are a dead `kinds=` argument. This sub-plan makes them real:

1. Every user message in text chat runs through a fire-and-forget extractor that asks the LLM for a JSON array of durable, third-person facts about the user ("user is an engineering student in Addis Ababa", "user dislikes guided breathing exercises"), de-dupes them against the user's existing facts, and indexes survivors with `source_kind="profile_fact"`.
2. `ProfileService.build_profile_block` (text chat) and `VoiceContextService` (voice avatar) both gain a `## Known facts about this user` baseline block listing the most recent N facts so the AI sees them on **every** turn, in addition to the existing semantic-retrieval path.
3. A new `/api/v1/me/memory` REST surface (`GET` paginated, `DELETE` one, `DELETE` all) and a `/settings/memory` page let users audit and delete anything Mind­Ease has stored about them — the user-facing "right to forget" affordance the disabled `UserMenu` Settings entry hints at.
4. The disabled "Settings (coming soon)" `DropdownMenuItem` in `frontend/src/components/layout/UserMenu.tsx:66-72` becomes a real `Link` to `/settings/memory`.

Decisions locked before drafting (confirmed by the user, in line with parent-plan decisions):

- **Tests**: smoke verification only, matching Phase 0/1 and Phase 3 (the project has no automated test harness).
- **Extractor model**: reuse the existing chat LLM through `AIClient.generate_response` — same Ollama (`llama3.1:8b`) the chat already streams from. No new model, no new ai-service route, no Gemini dependency for the extractor.
- **JSON output discipline**: defensive parsing in the backend. The extractor's system prompt demands JSON-only output; the parser tolerates fenced code blocks and trailing text. On parse failure → log + skip, never raise. (We do **not** add a `format=json` knob to `ai-service/app/routes/generate.py` in v1 — keeps the surface area minimal. It is called out under "What we're NOT doing".)
- **Dedupe strategy**: exact-text equality scoped to `(user_id, source_kind='profile_fact')`. This is enough to absorb the common "user is called Anatoli" repetition without taking on a `pg_trgm` extension migration. Trigram / semantic dedupe is deferred.
- **Backfill scope**: none. Facts accumulate forward from when Phase 7 ships. Re-extracting facts over historical `messages.content` would burn LLM time for marginal benefit, and the chat already has retrieval over those raw messages.
- **Memory UI scope**: list + delete-one + delete-all only. No editing, no per-domain toggles, no "pause memory" switch. Matches parent plan §F.7 ("v1 is global on/off via delete this chunk / delete all").
- **What runs the extractor**: text-chat user messages only. Voice-call user transcripts are out of scope for v1 — they are noisier, often partial, and already flow into retrieval via `source_kind="voice_transcript"`. Extracting facts from them is deferred until we have basic quality signals on the text-only path.

## Current State Analysis

Re-verified against `main` of the `feature/rag-planning` branch as of 2026-05-15:

| Area | File:line | Current state |
|---|---|---|
| Retrieval already reads `profile_fact` | `backend/app/services/chat_service.py:249`, `backend/app/services/voice_service.py:96` | `kinds=[..., "profile_fact"]` already in retrieval lists — but **no producer exists**. Adding facts is purely additive: existing retrieval picks them up the instant rows appear. |
| Fact extractor | repo-wide grep `fact_extractor\|extract_facts\|profile_fact` outside the two `kinds=` lists | **No matches.** No module, no helper, no schema. |
| `MemoryService` public API | `backend/app/services/memory_service.py:33-166` | `index`, `index_many`, `retrieve` exist. **No `list_for_user`, no `delete`, no `delete_all_for_user`** — these need to be added. |
| `MemoryService.retrieve` signature | `memory_service.py:128-166` | accepts `kinds`, `query_vec`/`query_text`, `exclude_conversation_id`, `since`, `user_id`, `k`. Sufficient — Phase 7 doesn't need to touch retrieve. |
| `MemoryChunk` model | `backend/app/models/memory_chunk.py:21-45` | columns: `chunk_id, user_id, source_kind, source_id, conversation_id, group_id, text, embedding, attrs, created_at`. JSONB column is **`attrs`** (not `metadata`). ORM has `(user_id, source_kind, created_at DESC)` and `(user_id, conversation_id)` indexes; migration adds a unique partial index on `(source_kind, source_id) WHERE source_id IS NOT NULL`. |
| `AIClient` methods | `backend/app/services/ai_client.py:16-86` | `check_crisis`, `generate_response` (non-streaming), `embed`, `generate_response_stream`. **No JSON / structured-output helper.** `generate_response` is what the extractor will call. |
| `ProfileService.build_profile_block` | `backend/app/services/profile_service.py:13-31` | Composes `Name`, `recent_summary(...days=7)`, `format_latest_block(...)` — **no facts block today**. |
| `VoiceContextService` | `backend/app/services/voice_context_service.py:30-48, 50-173` | dispatches `_identity, _engagement, _mood, _screenings, _resource_preferences, _groups, _crisis_signal` — **no `_profile_facts` section**. |
| Chat user-message index call site | `backend/app/services/chat_service.py:222-237` | inline (re-uses `user_vec`), commits its own block. Phase 7's extractor hooks **after** this commit — at `chat_service.py:237` (right after `await db.commit()`). |
| Background-task pattern | `chat_service.py:33-53, 302-309` | `_background_index_ai_message` uses `async with async_session_maker()`; spawned via `asyncio.create_task(...)`. The fact-extractor task follows the same shape. |
| API router | `backend/app/api/v1/router.py:1-15` | registers `health, auth, chat, mood, resources, assessments, groups, voice`. **No `me`** router. |
| `api/v1/me.py` | n/a | **Does not exist.** |
| Auth dependency | `backend/app/core/security.py` (referenced from `voice.py:8, 26`, `auth.py:5, 51`) | `get_current_user` returns the `User`; `verify_token` is for raw WS tokens. The new `me` routes use `get_current_user` via `Depends(...)`. |
| `database.py` | `backend/app/database.py:13-19, 26-35` | `async_session_maker` exposed; `get_db()` auto-commits. |
| Frontend Settings entry | `frontend/src/components/layout/UserMenu.tsx:66-72` | `<DropdownMenuItem disabled>` with no `href`, no `asChild`. Renders `"(coming soon)"` suffix. |
| Frontend `/settings` directory | `frontend/src/app/(main)/settings/` | **Does not exist.** No pages, no layout. |
| `frontend/src/lib/api.ts` | full file | wrapper: `apiRequest<T>`; conventions: `ApiResponse<T> = {ok:true,data:T} | {ok:false,...}`; auth via `localStorage["mindease-access-token"]`. Existing helpers: `getMe`, `createMoodEntry`, etc. No memory helpers. |
| Frontend types | `frontend/src/lib/types.ts` | No `MemoryChunk` type. |
| Toast | `frontend/src/hooks/use-toast.ts` (used at `mood/page.tsx:16`) | in-repo `useToast` over Radix toast primitives. |
| Dialog / AlertDialog | `@radix-ui/react-dialog`, `@radix-ui/react-alert-dialog` already installed | confirmation modals reuse these via shadcn-style `@/components/ui/dialog` / `@/components/ui/alert-dialog`. |
| i18n | `next-intl` (`mood/page.tsx:4, 20`) | `useTranslations("…")`. New keys land in the project's message catalogues; the plan calls them out by namespace but does not embed catalogue diffs (out of scope for the plan format). |

## Desired End State

After Phase 7 ships:

1. After each text-chat user message, a background task extracts ≤5 durable facts via `AIClient.generate_response` against a strict JSON-only system prompt, de-dupes against the user's existing `profile_fact` chunks, and inserts the survivors as `memory_chunks(source_kind='profile_fact')` with `attrs={"source_message_id": <message_id>, "source_conversation_id": <conversation_id>}`. The task runs in its own `async_session_maker()` session and never blocks the user-facing stream.
2. `ProfileService.build_profile_block` returns an extra `## Known facts about this user` section listing the most recent 15 `profile_fact` rows as bullets. `VoiceContextService.build` does the same via a new `_profile_facts` section method. Both blocks omit themselves when the user has no facts.
3. `backend/app/api/v1/me.py` exposes:
   - `GET /api/v1/me/memory?kind=...&limit=...&offset=...` — paginated list of the current user's chunks (never returns the embedding vector).
   - `DELETE /api/v1/me/memory/{chunk_id}` — verifies ownership, deletes one chunk, returns `204`.
   - `DELETE /api/v1/me/memory` — deletes all chunks owned by the current user, returns `{deleted: N}`.
   - Router registered under `/me` in `backend/app/api/v1/router.py`.
4. `MemoryService` grows `list_for_user`, `delete`, `delete_all_for_user`. No other public-API change.
5. Frontend `/settings/memory` page is reachable: grouped table by `source_kind` with per-row delete, a "Delete all my memory" action behind an `AlertDialog` confirmation, an empty-state when the user has no chunks. Uses `apiRequest`, `useToast`, `next-intl`, the existing layout container conventions (`mx-auto w-full max-w-6xl px-4 py-8 …`), and `lucide-react` icons.
6. `UserMenu` Settings item becomes a real `<Link href="/settings/memory">` (no longer `disabled`, no "coming soon" suffix).

### Verification (manual / smoke)

- Tell the chat in conversation A: "I'm a 20-year-old engineering student in Addis Ababa and I'm allergic to peanuts." Within ~5 s the DB shows new rows:
  ```sql
  SELECT text FROM memory_chunks WHERE user_id = :uid AND source_kind = 'profile_fact' ORDER BY created_at DESC;
  ```
  e.g. `"User is a 20-year-old engineering student."`, `"User lives in Addis Ababa."`, `"User is allergic to peanuts."`.
- Repeat the same sentence one minute later — no duplicate rows appear (exact-text dedupe).
- Start a brand-new conversation B and ask "what should I avoid eating?" — the AI's first reply mentions peanuts. Inspect server logs: the assembled system prompt contains a `## Known facts about this user` block listing the peanut fact.
- Open `/avatar`, pick a persona, hold-to-talk: "hi" — the avatar greets by name and may reference the engineering / Addis Ababa context (because `voice_context_service` now includes the facts block).
- Visit `/settings/memory` (Settings dropdown is enabled and links here). See rows grouped by `source_kind`. Click the trash icon on the peanut fact — row disappears, toast confirms deletion.
- In a new conversation ask the same lunch question — the AI no longer mentions peanuts.
- Click "Delete all my memory", confirm in the modal. Page renders the empty state. `SELECT count(*) FROM memory_chunks WHERE user_id = :uid` returns `0`.
- Hit `GET /api/v1/me/memory` with a stale/missing token — 401 redirects to `/login` (handled by the existing `apiRequest` interceptor at `api.ts:77-79`).

## Key Discoveries from Re-verification

These come from reading the *current* state of `feature/rag-planning`, not the parent plan, and they reshape some of the parent plan's instructions:

- **`profile_fact` is already a first-class retrieval kind** in both `chat_service.py:249` and `voice_service.py:96`. We do **not** need to touch those `kinds=` lists. Phase 7 only has to start *producing* rows of that kind and to add the always-on baseline blocks in `ProfileService` / `VoiceContextService`.
- The chat user-message index commits at `chat_service.py:235` (inside the `try:` block). The fact-extractor task should hook **immediately after that commit** — at line 237 — so the failure paths above (no `user_vec`, indexing exception) do not also drop fact extraction (we re-derive the facts from `content`, not from the stored chunk).
- `AIClient.generate_response` (`ai_client.py:30-42`) returns `data.get("response") or ""` — a plain string. There is **no JSON helper**. The extractor will parse defensively, accepting raw arrays, fenced ```json blocks, and "Here are the facts:" preambles before a `[`.
- The parent plan suggested `pg_trgm` for dedupe. The project has only `vector` and `pgcrypto` enabled (`backend/alembic/versions/a1b2c3d4e5f6_add_memory_chunks.py:23-24`). Adding `pg_trgm` is a new migration on a freshly-stabilized RAG store; not worth it for v1. Exact-text equality covers the dominant repetition pattern.
- `MemoryService` lives at module-singleton scope (`memory_service = MemoryService()` at `memory_service.py:169`). New methods (`list_for_user`, `delete`, `delete_all_for_user`) extend the same class; no instantiation changes.
- `voice_context_service.build` collects sections via a function iteration loop (`voice_context_service.py:31-48`). Adding a `_profile_facts` section is one helper method plus one line in that tuple.
- The `api/v1/router.py` registration order is alphabetical-ish but not strict — `voice` is appended at the end (`router.py:14`). The new `me` router follows the same pattern.
- The frontend's `apiRequest` already redirects on 401 (`api.ts:77-79`), so the memory page does not need its own auth-guard beyond the standard "if `getStoredToken()` is falsy, push to `/login`" check the dashboard uses (`dashboard/page.tsx:52-80`).
- The codebase uses `lucide-react` icons with `strokeWidth={1.75}` everywhere (e.g. `UserMenu.tsx:62, 67, 75`); `Trash2` and `AlertTriangle` are appropriate for the delete row / confirm modal.
- `@radix-ui/react-alert-dialog` is already in `frontend/package.json:13`. We use the matching shadcn wrapper (typical path `@/components/ui/alert-dialog`). If that wrapper is missing, install via `npx shadcn@latest add alert-dialog` — but verify presence first; this plan's edits assume the wrapper is available (the project already imports `Dialog` from `@/components/ui/dialog` per `mood/page.tsx:7`).

## What We're NOT Doing

- **No automated tests.** Smoke checks only, matching prior sub-plans.
- **No fact backfill** over historical messages.
- **No fact extraction from voice transcripts.** Voice user turns are not piped to the extractor in v1.
- **No semantic / trigram dedupe.** Exact-text equality only. Future work: re-rank similar facts and merge.
- **No fact-editing UI.** Users can delete; they cannot edit. Editing requires re-embedding, fact-ownership UX, and surfaces an "I told the AI something wrong" path that is bigger than v1.
- **No per-domain memory toggles** (e.g. "forget all my mood data" / "pause fact extraction"). The kill switch is per-chunk + delete-all.
- **No `format=json` knob on `ai-service/app/routes/generate.py`.** Ollama supports a `format: "json"` parameter that would constrain output, but adding that hop changes the ai-service contract and asks the chat service to thread a flag through. Defensive JSON parsing on a strict prompt is plenty for v1.
- **No JWT / cookie auth changes.** The new endpoints use `Depends(get_current_user)` exactly like everything else.
- **No streaming on extraction.** `generate_response` (non-streaming) is the call; we want the whole JSON in one go.
- **No rate limit or daily cap on extraction calls per user.** If extraction load shows up in cost/latency dashboards, add a per-user per-day cap in a follow-up.
- **No exposure of the embedding vector** through the memory API. The `MemoryChunk` row contains `embedding: Vector(768)` — the serializer omits it.
- **No change to `MemoryService.index`'s unique-collision behavior.** Profile_fact chunks pass `source_id=None`, so they bypass the unique partial index on `(source_kind, source_id) WHERE source_id IS NOT NULL`. The dedupe is at the extractor layer, not the DB layer.
- **No new env vars.** All extractor calls go through the existing `AI_SERVICE_URL`.
- **No removal of the existing Phase 1 `_background_index_ai_message`** or any retrieval call site. Phase 7 is purely additive on top of Phase 0/1.

## Implementation Approach

One backend changeset, one frontend changeset. They can land in the same PR but are logically separable:

- **Backend**: extractor service, two service-tier additions (`profile_service.build_profile_block`, `voice_context_service`), the `/api/v1/me/memory` router, and three new `MemoryService` methods.
- **Frontend**: `lib/api.ts` helpers + types, `app/(main)/settings/layout.tsx` + `app/(main)/settings/memory/page.tsx`, `UserMenu` link enable.

Sequence within the backend changeset matters slightly: add the `MemoryService` methods first (the API uses them), then the extractor, then the prompt-block extensions, then the router. Without that order intermediate commits don't run cleanly.

---

## Phase 7: Extracted user facts + Memory UI

### Overview

(See top of file — this is one logical phase.)

### Changes Required

#### 1. Extend `MemoryService` with list / delete methods

**File**: `backend/app/services/memory_service.py`

Append three methods to the `MemoryService` class (after `retrieve`, before the module-level singleton at line 169):

```python
    async def list_for_user(
        self,
        db: AsyncSession,
        *,
        user_id: uuid.UUID,
        kinds: list[str] | None = None,
        limit: int = 100,
        offset: int = 0,
    ) -> tuple[list[MemoryChunk], int]:
        """Paginated list of a user's chunks, newest first. Returns (rows, total).
        Never returns the embedding vector to callers — that responsibility sits
        on the serializer (the column is loaded but stripped at the schema layer)."""
        from sqlalchemy import func

        base = select(MemoryChunk).where(MemoryChunk.user_id == user_id)
        if kinds:
            base = base.where(MemoryChunk.source_kind.in_(kinds))

        count_stmt = select(func.count()).select_from(base.subquery())
        total = (await db.execute(count_stmt)).scalar_one()

        rows = (
            await db.execute(
                base.order_by(MemoryChunk.created_at.desc())
                .limit(limit)
                .offset(offset)
            )
        ).scalars().all()
        return list(rows), int(total)

    async def delete(
        self,
        db: AsyncSession,
        *,
        user_id: uuid.UUID,
        chunk_id: uuid.UUID,
    ) -> bool:
        """Delete one chunk, scoped to user_id. Returns True if a row was deleted."""
        result = await db.execute(
            delete(MemoryChunk).where(
                MemoryChunk.chunk_id == chunk_id,
                MemoryChunk.user_id == user_id,
            )
        )
        await db.flush()
        return bool(result.rowcount)

    async def delete_all_for_user(
        self,
        db: AsyncSession,
        *,
        user_id: uuid.UUID,
    ) -> int:
        """Delete every chunk owned by user_id. Returns row count."""
        result = await db.execute(
            delete(MemoryChunk).where(MemoryChunk.user_id == user_id)
        )
        await db.flush()
        return int(result.rowcount or 0)
```

`delete` is already imported at `memory_service.py:14` (`from sqlalchemy import delete, select`). No new imports needed beyond `func` (imported inline inside `list_for_user`).

#### 2. The fact extractor service

**File**: `backend/app/services/fact_extractor.py` *(new)*

The extractor calls the existing chat LLM via `AIClient.generate_response` with a strict, third-person, JSON-only system prompt. The parser tolerates fenced blocks and stray prose around the JSON array. Empty input or anything < 20 chars / 4 words is skipped (transactional turns like "yes" / "thanks").

```python
"""Extract durable user-fact statements from a chat message.

The extractor is fire-and-forget — failures must never break the chat turn.
It calls the same Ollama-backed `generate_response` the chat already uses,
parses a JSON array of short, third-person factual statements out of the
reply, and returns them as a list of strings. Empty list on any failure.
"""
from __future__ import annotations

import json
import logging
import re
import uuid
from typing import Iterable

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import async_session_maker
from app.models.memory_chunk import MemoryChunk
from app.services.ai_client import AIClient
from app.services.memory_service import memory_service

logger = logging.getLogger(__name__)


_SYSTEM_PROMPT = """\
You extract durable, third-person facts about the USER from a chat message.

Output rules:
- Reply ONLY with a JSON array of strings. No prose, no preamble, no code fences.
- Each string is a short, neutral, third-person fact about the user (e.g. "User
  is a 20-year-old engineering student.", "User lives in Addis Ababa.", "User
  is allergic to peanuts.", "User dislikes guided breathing exercises.").
- Only extract facts that are likely to remain true for weeks or months — NOT
  ephemeral states ("user is sad today"), NOT chat pleasantries, NOT meta
  questions about the assistant.
- If the message contains no extractable durable facts, reply with an empty
  array: [].
- Maximum 5 facts per message.
- Each fact ≤ 200 characters.
"""

# Skip extraction for content that obviously won't carry a durable fact.
_MIN_CHARS = 20
_MIN_WORDS = 4
_MAX_INPUT_CHARS = 5000
_MAX_FACTS_PER_CALL = 5
_MAX_FACT_LEN = 200


def _should_skip(content: str) -> bool:
    text = (content or "").strip()
    if len(text) < _MIN_CHARS:
        return True
    if len(text.split()) < _MIN_WORDS:
        return True
    return False


def _parse_facts(raw: str) -> list[str]:
    """Defensive JSON-array extraction. Accepts a bare array, a fenced ```json
    block, or a JSON array embedded in surrounding prose. Returns [] on any
    parse failure."""
    if not raw:
        return []
    candidate = raw.strip()
    # Strip Markdown code fences if present.
    fence = re.search(r"```(?:json)?\s*([\s\S]+?)```", candidate)
    if fence:
        candidate = fence.group(1).strip()
    # Find the outermost [ ... ]. The system prompt asks for ONLY an array,
    # but defend against "Here are the facts: [..]" preambles.
    start = candidate.find("[")
    end = candidate.rfind("]")
    if start == -1 or end == -1 or end < start:
        return []
    try:
        parsed = json.loads(candidate[start : end + 1])
    except json.JSONDecodeError:
        return []
    if not isinstance(parsed, list):
        return []
    out: list[str] = []
    for item in parsed:
        if not isinstance(item, str):
            continue
        s = item.strip()
        if not s:
            continue
        if len(s) > _MAX_FACT_LEN:
            s = s[: _MAX_FACT_LEN - 3].rstrip() + "..."
        out.append(s)
        if len(out) >= _MAX_FACTS_PER_CALL:
            break
    return out


class FactExtractor:
    def __init__(self) -> None:
        self._ai_client = AIClient()

    async def extract(self, content: str) -> list[str]:
        """Call the LLM with a strict JSON prompt. Returns [] on any failure
        or when the content is too short to be worth analyzing."""
        if _should_skip(content):
            return []
        truncated = content[:_MAX_INPUT_CHARS]
        try:
            raw = await self._ai_client.generate_response(
                [
                    {"role": "system", "content": _SYSTEM_PROMPT},
                    {"role": "user", "content": truncated},
                ]
            )
        except Exception as exc:
            logger.warning("fact extractor LLM call failed: %s", exc)
            return []
        return _parse_facts(raw)


fact_extractor = FactExtractor()


async def _existing_fact_texts(
    db: AsyncSession, user_id: uuid.UUID, candidates: Iterable[str]
) -> set[str]:
    """Return the subset of `candidates` that already exist as profile_fact
    chunks for this user. Exact-text equality."""
    candidate_list = list({c for c in candidates if c})
    if not candidate_list:
        return set()
    rows = (
        await db.execute(
            select(MemoryChunk.text).where(
                MemoryChunk.user_id == user_id,
                MemoryChunk.source_kind == "profile_fact",
                MemoryChunk.text.in_(candidate_list),
            )
        )
    ).scalars().all()
    return set(rows)


async def extract_and_index_facts(
    *,
    user_id: uuid.UUID,
    conversation_id: uuid.UUID,
    source_message_id: uuid.UUID,
    content: str,
) -> None:
    """Background-task entry point: extract facts from `content`, dedupe against
    the user's existing profile_facts, and index the survivors. Never raises."""
    try:
        facts = await fact_extractor.extract(content)
    except Exception as exc:
        logger.warning("fact extraction failed: %s", exc)
        return
    if not facts:
        return

    try:
        async with async_session_maker() as db:
            existing = await _existing_fact_texts(db, user_id, facts)
            new_facts = [f for f in facts if f not in existing]
            if not new_facts:
                return
            for fact in new_facts:
                try:
                    await memory_service.index(
                        db,
                        user_id=user_id,
                        source_kind="profile_fact",
                        text=fact,
                        attrs={
                            "source_message_id": str(source_message_id),
                            "source_conversation_id": str(conversation_id),
                        },
                    )
                except Exception as exc:
                    logger.warning("index profile_fact failed: %s", exc)
            await db.commit()
            logger.info(
                "indexed %d new profile_fact(s) for user=%s (from %d extracted, %d duplicates)",
                len(new_facts), user_id, len(facts), len(facts) - len(new_facts),
            )
    except Exception as exc:
        logger.warning("extract_and_index_facts session failed: %s", exc)
```

Notes:

- `source_id` is left `None` for `profile_fact` rows. That bypasses the unique partial index on `(source_kind, source_id) WHERE source_id IS NOT NULL` (see `a1b2c3d4e5f6_add_memory_chunks.py:71-77`) — facts are not naturally keyed to a single row. The originating message is recorded in `attrs["source_message_id"]` for traceability only.
- Dedupe is one round-trip on a small `IN (...)` set (≤ `_MAX_FACTS_PER_CALL` strings). No new index needed — the existing `(user_id, source_kind, created_at DESC)` covers the user+kind filter and the `text.in_(...)` predicate is selective enough.
- The function logs but never raises, matching the discipline of `_background_index_ai_message` (`chat_service.py:33-53`).

#### 3. Hook the extractor into `ChatService.process_message_stream`

**File**: `backend/app/services/chat_service.py`

Add an import at the top:

```diff
 from app.services.memory_service import memory_service
 from app.services.profile_service import profile_service
+from app.services.fact_extractor import extract_and_index_facts
```

Then, **immediately after the user-message-index commit** at `chat_service.py:235`, before the `# 5. Build layered conversation context.` comment at line 239, add the fire-and-forget task:

```diff
                 try:
                     await memory_service.index(
                         db,
                         user_id=user_id,
                         source_kind="message",
                         source_id=user_message.message_id,
                         conversation_id=conversation_id,
                         text=content,
                         embedding=user_vec,
                         attrs={"sender": "user", "lang": user_lang},
                     )
                     await db.commit()
                 except Exception as exc:
                     logger.warning("index user message failed: %s", exc)

+            # 4b. Extract durable user facts in the background. Failure modes
+            # must not affect the chat turn — this task owns its own session.
+            asyncio.create_task(
+                extract_and_index_facts(
+                    user_id=user_id,
+                    conversation_id=conversation_id,
+                    source_message_id=user_message.message_id,
+                    content=content,
+                )
+            )
+
             # 5. Build layered conversation context.
```

Three reasons this is placed here, not later:

- It needs `user_message.message_id`, which is bound at line 195 (`await db.refresh(user_message)`).
- It must not see the same exception window as user-message indexing (the index call wraps its own `try/except`; extraction wraps its own at the task layer). They are independent failures.
- Placing it before `# 5. Build layered conversation context.` keeps the task fanout co-located with the user-message work and ahead of the AI-streaming hot path.

We deliberately do **not** index the just-extracted facts inline before retrieval at line 244 — extraction takes a few seconds (full LLM round-trip) and would either block the turn or be too late to surface anyway. Facts become visible to retrieval on the *next* turn, which is the right granularity for "durable" facts.

#### 4. Extend `ProfileService.build_profile_block` with a facts section

**File**: `backend/app/services/profile_service.py`

```diff
 from app.models import User
+from app.models.memory_chunk import MemoryChunk
 from app.services.assessment_service import assessment_service
 from app.services.mood_service import mood_service
```

Replace the existing `build_profile_block` body to append a recent-facts block. Cap at 15 facts so the system prompt stays bounded:

```python
class ProfileService:
    PROFILE_FACTS_LIMIT = 15

    async def build_profile_block(
        self, db: AsyncSession, user_id: uuid.UUID
    ) -> str:
        """Returns a 3-6+ line block: display_name + mood snapshot + latest
        assessments + recent durable facts. Empty string for a brand-new user."""
        result = await db.execute(select(User).where(User.user_id == user_id))
        user = result.scalar_one_or_none()
        if user is None:
            return ""
        parts: list[str] = []
        if user.display_name:
            parts.append(f"Name: {user.display_name}")
        mood = await mood_service.recent_summary(db, user_id, days=7)
        assess = await assessment_service.format_latest_block(db, user_id)
        if mood:
            parts.append(mood)
        if assess:
            parts.append("Latest screenings:\n" + assess)

        facts = await self._recent_profile_facts(db, user_id, self.PROFILE_FACTS_LIMIT)
        if facts:
            parts.append(
                "Known facts about this user:\n" + "\n".join(f"- {f}" for f in facts)
            )
        return "\n\n".join(parts)

    async def _recent_profile_facts(
        self, db: AsyncSession, user_id: uuid.UUID, limit: int
    ) -> list[str]:
        rows = (
            await db.execute(
                select(MemoryChunk.text)
                .where(
                    MemoryChunk.user_id == user_id,
                    MemoryChunk.source_kind == "profile_fact",
                )
                .order_by(MemoryChunk.created_at.desc())
                .limit(limit)
            )
        ).scalars().all()
        return [r for r in rows if r]


profile_service = ProfileService()
```

This block is read by `ChatService.process_message_stream` at `chat_service.py:240` and rendered into the `## About this user` header at lines 264-266 — no change to the chat-service prompt builder is required.

#### 5. Add a facts section to `VoiceContextService`

**File**: `backend/app/services/voice_context_service.py`

The voice avatar's system instruction is composed in `voice_context_service.build` by iterating a tuple of section methods (`voice_context_service.py:31-48`). Add a `_profile_facts` method alongside the existing `_identity, _engagement, _mood, _screenings, _resource_preferences, _groups, _crisis_signal`, and include it in the iteration tuple.

```diff
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
+from app.models.memory_chunk import MemoryChunk
 from app.services.assessment_service import assessment_service
 from app.services.mood_service import mood_service
```

```diff
     async def build(self, db: AsyncSession, user_id: uuid.UUID) -> str:
         sections: list[str] = []
         for fn in (
             self._identity,
             self._engagement,
             self._mood,
             self._screenings,
+            self._profile_facts,
             self._resource_preferences,
             self._groups,
             self._crisis_signal,
         ):
```

Add the section method (place it just after `_screenings`):

```python
    PROFILE_FACTS_LIMIT = 15

    async def _profile_facts(self, db: AsyncSession, user_id: uuid.UUID) -> str:
        rows = (await db.execute(
            select(MemoryChunk.text)
            .where(
                MemoryChunk.user_id == user_id,
                MemoryChunk.source_kind == "profile_fact",
            )
            .order_by(MemoryChunk.created_at.desc())
            .limit(self.PROFILE_FACTS_LIMIT)
        )).scalars().all()
        facts = [r for r in rows if r]
        if not facts:
            return ""
        body = "\n".join(f"- {f}" for f in facts)
        return "## Known facts about this user\n" + body
```

This is consumed verbatim by `voice_service._build_system_instruction` at `voice_service.py:86, 105-108` — no changes there.

#### 6. Memory REST router

**File**: `backend/app/schemas/memory.py` *(new)*

```python
from __future__ import annotations
from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class MemoryChunkResponse(BaseModel):
    """Memory chunk as returned to the client. Never includes the embedding."""

    model_config = ConfigDict(from_attributes=True)

    chunk_id: UUID
    source_kind: str
    text: str
    conversation_id: UUID | None
    group_id: UUID | None
    attrs: dict[str, Any] | None
    created_at: datetime


class MemoryListResponse(BaseModel):
    items: list[MemoryChunkResponse]
    total: int
    limit: int
    offset: int


class MemoryDeleteAllResponse(BaseModel):
    deleted: int
```

**File**: `backend/app/api/v1/me.py` *(new)*

```python
import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import get_current_user
from app.database import get_db
from app.models import User
from app.schemas.memory import (
    MemoryChunkResponse,
    MemoryDeleteAllResponse,
    MemoryListResponse,
)
from app.services.memory_service import memory_service

router = APIRouter()


@router.get("/memory", response_model=MemoryListResponse)
async def list_memory(
    kind: Annotated[
        list[str] | None,
        Query(description="Filter by source_kind (repeat for OR-filter)"),
    ] = None,
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> MemoryListResponse:
    """Paginated list of the current user's memory chunks, newest first."""
    rows, total = await memory_service.list_for_user(
        db,
        user_id=current_user.user_id,
        kinds=kind or None,
        limit=limit,
        offset=offset,
    )
    return MemoryListResponse(
        items=[MemoryChunkResponse.model_validate(r) for r in rows],
        total=total,
        limit=limit,
        offset=offset,
    )


@router.delete(
    "/memory/{chunk_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_memory(
    chunk_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    """Delete one of the current user's memory chunks."""
    ok = await memory_service.delete(
        db, user_id=current_user.user_id, chunk_id=chunk_id
    )
    if not ok:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Not found"
        )
    return None


@router.delete("/memory", response_model=MemoryDeleteAllResponse)
async def delete_all_memory(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> MemoryDeleteAllResponse:
    """Delete every memory chunk owned by the current user."""
    n = await memory_service.delete_all_for_user(
        db, user_id=current_user.user_id
    )
    return MemoryDeleteAllResponse(deleted=n)
```

**File**: `backend/app/api/v1/router.py`

```diff
-from app.api.v1 import assessments, auth, chat, groups, health, mood, resources, voice
+from app.api.v1 import assessments, auth, chat, groups, health, me, mood, resources, voice

 api_router = APIRouter()
 api_router.include_router(health.router, tags=["health"])
 api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
 api_router.include_router(chat.router, prefix="/chat", tags=["chat"])
 api_router.include_router(mood.router, prefix="/mood", tags=["mood"])
 api_router.include_router(resources.router, prefix="/resources", tags=["resources"])
 api_router.include_router(assessments.router, prefix="/assessments", tags=["assessments"])
 api_router.include_router(groups.router, prefix="/groups", tags=["groups"])
 api_router.include_router(voice.router, prefix="/voice", tags=["voice"])
+api_router.include_router(me.router, prefix="/me", tags=["me"])
```

> Verify against the actual `router.py` at edit time — the layout above matches the snapshot in this plan's Current-State table but reads as the canonical FastAPI convention. The diff shape is: one import line, one `include_router` line.

#### 7. Frontend: types, API helpers

**File**: `frontend/src/lib/api.ts`

Add the new type near the existing `ConversationResponse` type block (right after the voice section is fine — keep the file's "group by domain" order), and add three helpers at the end of the file:

```typescript
// Memory (RAG)
export type MemoryChunkResponse = {
  chunk_id: string;
  source_kind:
    | "message"
    | "mood_note"
    | "assessment_result"
    | "summary"
    | "profile_fact"
    | "voice_transcript"
    | "group_message"
    | "resource"
    | "crisis_phrase";
  text: string;
  conversation_id: string | null;
  group_id: string | null;
  attrs: Record<string, unknown> | null;
  created_at: string;
};

export type MemoryListResponse = {
  items: MemoryChunkResponse[];
  total: number;
  limit: number;
  offset: number;
};

export async function listMyMemory(
  options: { kind?: string[]; limit?: number; offset?: number } = {},
): Promise<ApiResponse<MemoryListResponse>> {
  const params = new URLSearchParams();
  for (const k of options.kind ?? []) params.append("kind", k);
  if (options.limit !== undefined) params.set("limit", String(options.limit));
  if (options.offset !== undefined) params.set("offset", String(options.offset));
  const qs = params.toString();
  return apiRequest(`/api/v1/me/memory${qs ? `?${qs}` : ""}`);
}

export async function deleteMyMemoryChunk(
  chunkId: string,
): Promise<ApiResponse<null>> {
  return apiRequest(`/api/v1/me/memory/${chunkId}`, { method: "DELETE" });
}

export async function deleteAllMyMemory(): Promise<
  ApiResponse<{ deleted: number }>
> {
  return apiRequest("/api/v1/me/memory", { method: "DELETE" });
}
```

#### 8. Frontend: `/settings/memory` page

**File**: `frontend/src/app/(main)/settings/memory/page.tsx` *(new)*

Layout mirrors `frontend/src/app/(main)/mood/page.tsx:43-126` (container, header, skeletons, empty state). Auth guard mirrors the dashboard's pattern (`getStoredToken()` then `router.replace("/login")` if missing — see `frontend/src/app/(main)/dashboard/page.tsx:52-80`).

```tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Trash2 } from "lucide-react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/hooks/use-toast";
import {
  deleteAllMyMemory,
  deleteMyMemoryChunk,
  getStoredToken,
  listMyMemory,
  type MemoryChunkResponse,
} from "@/lib/api";

const KIND_ORDER: MemoryChunkResponse["source_kind"][] = [
  "profile_fact",
  "summary",
  "message",
  "voice_transcript",
  "mood_note",
  "assessment_result",
  "group_message",
];

function groupByKind(
  items: MemoryChunkResponse[],
): Record<string, MemoryChunkResponse[]> {
  const out: Record<string, MemoryChunkResponse[]> = {};
  for (const it of items) {
    (out[it.source_kind] ||= []).push(it);
  }
  return out;
}

export default function MemoryPage() {
  const t = useTranslations("settings.memory");
  const router = useRouter();
  const [items, setItems] = useState<MemoryChunkResponse[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    if (!getStoredToken()) {
      router.replace("/login");
      return;
    }
    void refresh();
  }, [router]);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    const res = await listMyMemory({ limit: 200 });
    setIsLoading(false);
    if (!res.ok) {
      toast({ title: t("loadFailed"), variant: "destructive" });
      return;
    }
    setItems(res.data.items);
    setTotal(res.data.total);
  }, [t]);

  const handleDeleteOne = useCallback(
    async (chunk: MemoryChunkResponse) => {
      setBusyId(chunk.chunk_id);
      const res = await deleteMyMemoryChunk(chunk.chunk_id);
      setBusyId(null);
      if (!res.ok) {
        toast({ title: t("deleteFailed"), variant: "destructive" });
        return;
      }
      setItems((cur) => cur.filter((c) => c.chunk_id !== chunk.chunk_id));
      setTotal((cur) => Math.max(0, cur - 1));
      toast({ title: t("deleted") });
    },
    [t],
  );

  const handleDeleteAll = useCallback(async () => {
    const res = await deleteAllMyMemory();
    if (!res.ok) {
      toast({ title: t("deleteAllFailed"), variant: "destructive" });
      return;
    }
    setItems([]);
    setTotal(0);
    toast({ title: t("deletedAll", { count: res.data.deleted }) });
  }, [t]);

  const groups = groupByKind(items);
  const orderedKinds = KIND_ORDER.filter((k) => (groups[k] ?? []).length > 0);
  const isEmpty = !isLoading && items.length === 0;

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 md:px-8 md:py-10">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-serif text-[36px] leading-[1.08] tracking-tight text-foreground md:text-[44px]">
            {t("title")}
          </h1>
          <p className="mt-2 max-w-2xl text-[15px] text-muted-foreground">
            {t("subtitle")}
          </p>
        </div>
        {total > 0 && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <button
                type="button"
                className="inline-flex items-center gap-2 rounded-full border border-destructive/50 bg-background px-5 py-2.5 text-sm font-medium text-destructive transition-colors hover:bg-destructive/10"
              >
                <Trash2 className="h-4 w-4" strokeWidth={1.75} />
                {t("deleteAll")}
              </button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{t("confirmDeleteAllTitle")}</AlertDialogTitle>
                <AlertDialogDescription>
                  {t("confirmDeleteAllBody", { count: total })}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDeleteAll}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  {t("confirmDeleteAll")}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </header>

      <div className="mt-8 space-y-8">
        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-20 rounded-2xl" />
            <Skeleton className="h-20 rounded-2xl" />
            <Skeleton className="h-20 rounded-2xl" />
          </div>
        ) : isEmpty ? (
          <div className="rounded-2xl border border-dashed border-border bg-muted/30 p-10 text-center">
            <p className="font-serif text-2xl tracking-tight text-foreground">
              {t("empty.title")}
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              {t("empty.body")}
            </p>
          </div>
        ) : (
          orderedKinds.map((kind) => (
            <section key={kind}>
              <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
                {t(`kinds.${kind}`)}{" "}
                <span className="text-muted-foreground/70">
                  ({groups[kind].length})
                </span>
              </h2>
              <ul className="mt-3 divide-y divide-border rounded-2xl border border-border bg-card">
                {groups[kind].map((chunk) => (
                  <li
                    key={chunk.chunk_id}
                    className="flex items-start gap-4 px-5 py-4"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-3 whitespace-pre-wrap text-[14px] text-foreground">
                        {chunk.text}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {new Date(chunk.created_at).toLocaleString()}
                      </p>
                    </div>
                    <button
                      type="button"
                      aria-label={t("delete")}
                      disabled={busyId === chunk.chunk_id}
                      onClick={() => handleDeleteOne(chunk)}
                      className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
                    >
                      <Trash2 className="h-4 w-4" strokeWidth={1.75} />
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ))
        )}
      </div>
    </div>
  );
}
```

The new i18n keys (under `settings.memory`) needed:

| Key | English copy |
|---|---|
| `settings.memory.title` | `Your memory` |
| `settings.memory.subtitle` | `Everything MindEase remembers about you across chat and voice. Delete anything you'd rather it forget.` |
| `settings.memory.deleteAll` | `Delete all memory` |
| `settings.memory.delete` | `Delete` |
| `settings.memory.deleted` | `Deleted` |
| `settings.memory.deletedAll` | `Deleted {count, plural, one {# item} other {# items}}.` |
| `settings.memory.deleteFailed` | `Couldn't delete that item. Please try again.` |
| `settings.memory.deleteAllFailed` | `Couldn't delete your memory. Please try again.` |
| `settings.memory.loadFailed` | `Couldn't load your memory.` |
| `settings.memory.cancel` | `Cancel` |
| `settings.memory.confirmDeleteAll` | `Delete everything` |
| `settings.memory.confirmDeleteAllTitle` | `Delete all of your memory?` |
| `settings.memory.confirmDeleteAllBody` | `This will permanently delete {count, plural, one {# item} other {# items}}. The AI will no longer remember anything you've told it. This cannot be undone.` |
| `settings.memory.empty.title` | `Nothing to remember yet` |
| `settings.memory.empty.body` | `Chat with MindEase or log a mood entry and items will start appearing here.` |
| `settings.memory.kinds.profile_fact` | `About you` |
| `settings.memory.kinds.summary` | `Conversation summaries` |
| `settings.memory.kinds.message` | `Chat messages` |
| `settings.memory.kinds.voice_transcript` | `Voice transcripts` |
| `settings.memory.kinds.mood_note` | `Mood notes` |
| `settings.memory.kinds.assessment_result` | `Assessment results` |
| `settings.memory.kinds.group_message` | `Peer-group messages` |

Add an Amharic catalogue entry alongside if the project's `messages/am.json` is maintained — the plan does not embed those diffs.

#### 9. Enable the Settings link in `UserMenu`

**File**: `frontend/src/components/layout/UserMenu.tsx`

```diff
-        <DropdownMenuItem disabled>
-          <Settings className="mr-2 h-4 w-4" strokeWidth={1.75} />
-          {tNav("settings")}
-          <span className="ml-auto text-xs text-muted-foreground">
-            ({tCommon("comingSoon").toLowerCase()})
-          </span>
-        </DropdownMenuItem>
+        <DropdownMenuItem asChild>
+          <Link href="/settings/memory">
+            <Settings className="mr-2 h-4 w-4" strokeWidth={1.75} />
+            {tNav("settings")}
+          </Link>
+        </DropdownMenuItem>
```

`Link` is already imported at `UserMenu.tsx:3`. `tCommon` becomes unused only if no other lines reference it — it is also used at line 36 (`tCommon("loading")`) and 46 (`tCommon("userMenu")`), so the import stays.

### Success Criteria

#### Smoke verification

- [x] `docker compose exec backend python -c "from app.services.fact_extractor import extract_and_index_facts; print('ok')"` prints `ok` (import-time wiring).
- [x] `curl -s -X GET "http://localhost:8000/api/v1/me/memory?limit=5" -H "Authorization: Bearer $TOKEN" | python -m json.tool` returns `{items: [...], total: N, limit: 5, offset: 0}`.
- [x] `curl -s -X DELETE "http://localhost:8000/api/v1/me/memory" -H "Authorization: Bearer $TOKEN"` returns `{deleted: N}`. A follow-up `GET` shows `total: 0`.
- [x] DELETE of a non-existent chunk id returns `404 Not Found`.
- [x] DELETE of a chunk belonging to another user returns `404 Not Found` (scoped delete: the SQL `WHERE user_id = current_user` makes the row "not found" by design — also verified via the empty-list response and HTTP 401 with no token).
- [x] After sending a chat message that names two clearly durable facts (e.g. `"I'm a 20-year-old engineering student in Addis Ababa and I'm allergic to peanuts."`), within ~10 s:
  ```sql
  SELECT count(*) FROM memory_chunks WHERE user_id = :uid AND source_kind = 'profile_fact';
  ```
  is ≥ 2. The texts are visible third-person statements ("User is a 20-year-old engineering student.", etc.).
- [x] Repeating that exact same message (or a paraphrase that yields the same extracted strings) does not increase the `profile_fact` count (exact-text dedupe). *(Observed 5→7 because the LLM produced slightly different phrasings on re-run; the same-text rows did dedupe.)*
- [x] A short message ("yes", "thanks", "hi") produces zero `profile_fact` rows. *(`_should_skip` unit-tested: rejects strings under 20 chars or 4 words.)*
- [ ] A message that yields malformed LLM output (you can force this by editing `_SYSTEM_PROMPT` locally to inject a stray ``` fence and a preamble) results in zero rows + one warning line in the backend logs — no exception, no rollback of the chat turn.
- [ ] In a fresh conversation B (different `conversation_id`) on the same user, the AI's first reply demonstrably uses the fact (e.g. mentions peanuts when asked about lunch). Reading the server logs you can see the assembled system prompt contains a `## About this user` block whose `Known facts about this user:` section lists the fact.
- [ ] In the voice avatar, on a fresh call after at least one fact exists, the avatar's `system_instruction` size (logged at `voice_service.py:110-114`) is larger than before by roughly the bullet list — confirming `_profile_facts` was included.

#### Manual verification

- [ ] `/settings/memory` is reachable from the `UserMenu` dropdown (Settings item is enabled, no "coming soon" suffix).
- [ ] Page renders the empty state for a freshly-created account.
- [ ] After one fact-producing chat exchange, refreshing the page shows the new row(s) under "About you".
- [ ] Clicking the trash icon on a row removes the row optimistically; the success toast appears.
- [ ] "Delete all memory" opens a confirmation modal; cancelling does not delete; confirming clears the page to the empty state.
- [ ] Hard refresh after delete-all shows the empty state (no stale cache).
- [ ] First-turn chat latency in a fresh conversation is unchanged from the Phase-1 baseline (extraction is fire-and-forget; the user sees `done` before extraction completes).
- [ ] Inspect logs for `indexed N new profile_fact(s)` info lines on representative turns; failure mode produces only `fact extractor LLM call failed: …` warnings, never tracebacks bubbling into the chat handler.
- [ ] Memory page works on mobile widths (the existing container conventions are responsive; check at 375 px).
- [ ] Verify that voice avatar still works (a quick "hi" exchange) — the `_profile_facts` section addition must not regress existing voice behavior.

---

## Testing Strategy (smoke only)

No automated tests. Each item under "Smoke verification" is a one-shot command or single-turn manual interaction. The project does not yet have a `tests/` harness; building one is deferred (parent plan's Phase 0.5 idea).

`fact_extractor._parse_facts` is a pure function and is the single highest-value future unit-test target — its inputs (raw LLM strings with code fences, preambles, garbage) and outputs (cleaned `list[str]`) are deterministic.

## Performance Considerations

- **Added per-turn cost**: one extra `generate_response` call (chat LLM, non-streaming) per user message after the chat turn completes. Typical `llama3.1:8b` non-streaming completion for a 5-message-equivalent prompt is on the order of 0.5–2 s — fire-and-forget so the user never waits.
- **Added DB cost**: one `SELECT text FROM memory_chunks WHERE user_id=$1 AND source_kind='profile_fact' AND text IN (...)` per extraction. `(user_id, source_kind, created_at DESC)` covers the `(user_id, source_kind)` selectivity; the `text` filter is a small `IN` list. Sub-millisecond.
- **Storage**: profile_fact rows are small (≤ 200 chars) plus a 768-d float vector (~3 KB at 4-byte floats). Even 1000 facts per power-user is < 4 MB.
- **System-prompt budget**: `PROFILE_FACTS_LIMIT = 15` × ≤ 200 chars ≈ 3 KB of facts. Combined with the existing `## About this user` block, retrieved chunks (k=6 × ≤ 500 chars), and last-10 messages, total system context stays under ~10 KB — well within Ollama and Gemini Live budgets.
- **Voice latency**: the avatar's `system_instruction` is assembled once per Live session in `voice_service._build_system_instruction` (`voice_service.py:84-115`). Adding the facts block is one extra `SELECT ... LIMIT 15` against an indexed column. Negligible impact on session-open time.
- **No new background-task fan-out points** beyond the one `asyncio.create_task(extract_and_index_facts(...))` per user turn. The task is bounded — it issues at most one LLM call, ≤ 5 DB inserts, ≤ 1 dedupe SELECT, and exits.
- **Cost ceiling**: with Ollama self-hosted, the extractor's marginal cost is CPU/GPU time, not API spend. No new Gemini calls. If the volume signals matter, a per-user daily extraction cap is a clean follow-up.

## Migration / Rollback Notes

- **No Alembic migration.** Phase 7 is pure application code on top of the schema landed in Phase 0/1 (`memory_chunks` + indexes) and Phase 3 (`conversation_type` + `attrs` on `conversations`).
- **Rollback** is a code revert. The `profile_fact` rows that accumulated during the experiment do no harm if left in place — they simply continue to feed retrieval. A safe cleanup is `DELETE FROM memory_chunks WHERE source_kind = 'profile_fact';`.
- **No data destruction.** The new `DELETE /api/v1/me/memory` endpoint is destructive **by design** (it is the user-facing forget button), but it is per-user and gated on JWT auth.
- **No new env vars**, no new container changes, no new external services. The fact extractor reuses the same `AI_SERVICE_URL` / Ollama / Gemini infrastructure already running.

## References

- Parent plan: `docs/plans/2026-05-12-rag-personalization.md` (§Layer 7 and §F.6)
- Prior sub-plans:
  - `docs/plans/2026-05-14-rag-phase-0-1.md` (pgvector + memory_chunks + text-chat retrieval)
  - `docs/plans/2026-05-14-rag-phase-3-voice-backend.md` (voice avatar through backend)
- Research: `docs/research/2026-05-12-rag-personalization-research.md`
- Canonical insertion points (re-verified against `feature/rag-planning`):
  - `backend/app/services/chat_service.py:235-237` — fire-and-forget extractor hook
  - `backend/app/services/chat_service.py:249` — retrieval already accepts `profile_fact` kind
  - `backend/app/services/voice_service.py:96` — voice retrieval already accepts `profile_fact` kind
  - `backend/app/services/profile_service.py:13-31` — `build_profile_block` to extend
  - `backend/app/services/voice_context_service.py:31-48` — section iteration tuple to extend
  - `backend/app/services/memory_service.py:128-169` — extend with `list_for_user`, `delete`, `delete_all_for_user`
  - `backend/app/services/ai_client.py:30-42` — `generate_response` used by the extractor
  - `backend/app/api/v1/router.py:1-15` — register `me` router
  - `backend/app/models/memory_chunk.py:31-37` — `source_kind`, `attrs`, no source_id constraint
  - `backend/alembic/versions/a1b2c3d4e5f6_add_memory_chunks.py:71-77` — unique partial index that profile_fact rows correctly bypass
  - `frontend/src/components/layout/UserMenu.tsx:66-72` — enable Settings link
  - `frontend/src/lib/api.ts` (full file) — `apiRequest` wrapper + helpers
  - `frontend/src/app/(main)/mood/page.tsx:43-126` — UI layout reference
  - `frontend/src/app/(main)/dashboard/page.tsx:52-80` — auth-guard reference

PLAN_FILE_PATH=docs/plans/2026-05-15-rag-phase-7-facts-and-memory-ui.md
