# Delete Chat (Hard-Delete) Implementation Plan

## Overview

Add a true, discoverable delete affordance for conversations that:
1. **Is actually visible** — current code has a `DropdownMenu` trigger but it's `opacity-0 group-hover:opacity-100`, invisible at rest and absent on touch. No user can find it.
2. Permanently removes the `Conversation` row + all its `Message` rows
3. Scrubs every `memory_chunks` entry tied to that conversation so RAG can never surface deleted content in future text or voice sessions
4. Routes the user away when they delete the chat they're currently on

The confirm dialog, toast, optimistic list update, and HTTP endpoint (`DELETE /api/v1/chat/conversations/{id}`) already exist in code. The trigger UI in `ConversationItem.tsx:118-160` also exists but is hidden behind a hover-only opacity transition, so users can't find it — we'll make it always visible. The backend currently does a misleading soft-archive (`status='archived'`) which leaves messages and memory_chunks intact; we'll convert that to a real hard-delete.

## Current State Analysis

### What "delete" does today
- **Backend** (`backend/app/api/v1/chat.py:88-100` → `backend/app/services/chat_service.py:348-372`): sets `conversation.status = "archived"` on the row, commits. Messages and memory_chunks are untouched. Returns 204.
- **List endpoint** (`backend/app/services/chat_service.py:121-131`): hides archived rows via `.where(Conversation.status != "archived")`.
- **Backfill** (`backend/app/seeds/backfill_memory.py:21-28`): skips archived conversations when seeding embeddings.
- **Voice resurrect** (`backend/app/api/v1/voice.py:51-52`): if user "continues" an archived voice conversation, it silently flips back to `active`.
- **Frontend** (`frontend/src/hooks/useConversations.ts:41-44`): API helper is named `archiveConversation`; hook method named `deleteConversation`; optimistically filters the local list.

### Privacy / data-integrity problems
- **RAG leak**: `memory_chunks.conversation_id` is a bare UUID column with no FK or cascade (`backend/app/models/memory_chunk.py:33`, migration `backend/alembic/versions/a1b2c3d4e5f6_add_memory_chunks.py:42`). Archived conversations' chunks still match the user's `user_id` filter at retrieve time (`backend/app/services/memory_service.py:128-166`) and feed into `VoiceContextService` + chat prompts.
- **Indefinite retention**: archived rows + their messages + their chunks accumulate forever. For a mental-health app, a "delete" button that quietly retains content is the wrong contract.
- **Voice resurrect**: an archived conversation can be brought back to life without the user's explicit consent — they could have intentionally deleted it.

### Existing FK / cascade state (verified)
- `messages.conversation_id` FK: originally `ondelete="CASCADE"` (`backend/alembic/versions/e1f3f93be43d_add_conversations_and_messages.py:46`), but `backend/alembic/versions/d31cbd36eac0_add_mood_entries_badges_user_badges.py:60-61` drops and re-creates the constraint **without** `ondelete`. At the current migration head, **there is no cascade** — a bare `DELETE FROM conversations ...` would fail on FK violation unless messages are removed first.
- `memory_chunks.conversation_id`: no FK at all, never had one. Must always be cleaned up explicitly.
- `conversations.user_id`: cascade-on-delete from `users` (migration L32). Not relevant here.

### Existing UX bug: stranded route after self-delete
- `currentConversationId` is derived from `usePathname()` in both `ChatSidebar.tsx:32-36` and `SidebarContent.tsx:59-63`. None of the three delete sites (`ChatSidebar.tsx:74-81`, `SidebarContent.tsx:87-97`, `app/(main)/chat/page.tsx:59-66`) navigate away after a successful delete, even when `deleteConfirmId === currentConversationId`. The user stays on `/chat/[deletedId]`, `ChatContainer` calls `getConversation(...)` which returns non-ok, and the empty-state branch renders with the cached title. By contrast, the group delete handler at `app/(main)/groups/[groupId]/page.tsx:217-227` correctly does `router.push("/groups")` on success — that is the pattern to mirror.

## Desired End State

A user who clicks Delete on a conversation can be confident that:
- The conversation row is gone from `conversations`.
- Every `Message` belonging to that conversation is gone from `messages`.
- Every `memory_chunks` row tied to `(user_id, conversation_id)` is gone — so the next text chat or voice call will not surface that content in the system instruction.
- If they deleted the currently-open chat, they are routed back to `/chat`.
- The action is atomic: either everything for that conversation is removed, or nothing changes and the user sees an error toast.

Verification: see Phase 1 / Phase 2 Success Criteria + Manual Testing Steps below.

### Key Discoveries:
- The `DELETE /api/v1/chat/conversations/{id}` endpoint and the entire UI flow already exist — only the service-layer body and the post-delete navigation change. (`backend/app/api/v1/chat.py:88-100`, `frontend/src/components/chat/ConversationItem.tsx:148-158`)
- `messages.conversation_id` FK lost its cascade in migration `d31cbd36eac0`. Need a new migration to restore `ondelete="CASCADE"`, OR delete messages explicitly. The migration route is cleaner and keeps service logic simple.
- `memory_chunks_user_conv_idx` on `(user_id, conversation_id)` (`backend/app/models/memory_chunk.py:44`) exists — the scoped delete is index-supported and cheap.
- `Conversation.status` is a free-form `String(50)` with only two values in use (`active`, `archived`). After this lands no code writes `archived` anymore. The column itself stays (no schema migration to drop it) — removing it can happen later if we decide we want to.
- Voice "continue" path at `backend/app/api/v1/voice.py:30-55` already returns 404 if the conversation doesn't exist. So once hard-delete is in place, the resurrect branch (lines 51-52) is dead code — it can be removed in the same change.

## What We're NOT Doing

- **Not** keeping a soft-archive option. There is no "Are you sure? this is permanent" toggle, no archive-vs-delete split, no recovery path. The button has always been labeled "Delete" in every i18n locale — we are making the implementation match the label.
- **Not** dropping the `Conversation.status` column or removing the `String(50)` field. Keeping it costs nothing and avoids an irreversible schema change. We just stop writing `archived` to it.
- **Not** refactoring `SidebarContent` to share the `ConversationsContext` with `ChatSidebar` (current state: two parallel `useConversations()` instances). Real-time cross-tab/cross-sidebar sync is out of scope; each instance still updates optimistically on its own action, and they reconcile on next mount.
- **Not** adding undo. Even a 5-second undo toast would require the row to stick around in the DB, which defeats the point.
- **Not** touching other status uses (e.g. mood entries, badges) — none of them reference conversations.
- **Not** broadcasting deletion to live WebSocket sessions. If a user deletes a chat from one tab while writing in another, the in-flight WS write will fail on FK violation; the existing exception handlers in `backend/app/api/v1/chat.py:165-166` and `backend/app/services/voice_service.py:362-366` already swallow it and emit an error event. Acceptable for now.

## Implementation Approach

Three phases, each independently testable. Phase 1 (backend) can ship without Phase 2 — the existing frontend will work against it, just with the stranded-route bug still present. Phase 2 (frontend) is purely UX. Phase 3 is manual verification + RAG-leak proof.

---

## Phase 1: Backend hard-delete

### Overview
Restore the messages FK cascade, replace `archive_conversation` with a real `delete_conversation`, strip the now-dead `status='archived'` filters, and remove the voice resurrect branch.

### Changes Required:

#### 1. New Alembic migration — restore messages cascade
**File**: `backend/alembic/versions/c3d4e5f6a7b8_messages_cascade_on_conversation_delete.py` (new)
**Changes**: Drop the no-cascade FK and re-create it with `ondelete="CASCADE"`. Matches the original intent of the very first migration (`e1f3f93be43d:46`).

```python
"""messages cascade on conversation delete

Revision ID: c3d4e5f6a7b8
Revises: b2c3d4e5f6a7
Create Date: 2026-05-15 ...
"""
from alembic import op


revision = "c3d4e5f6a7b8"
down_revision = "b2c3d4e5f6a7"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.drop_constraint("messages_conversation_id_fkey", "messages", type_="foreignkey")
    op.create_foreign_key(
        "messages_conversation_id_fkey",
        "messages",
        "conversations",
        ["conversation_id"],
        ["conversation_id"],
        ondelete="CASCADE",
    )


def downgrade() -> None:
    op.drop_constraint("messages_conversation_id_fkey", "messages", type_="foreignkey")
    op.create_foreign_key(
        "messages_conversation_id_fkey",
        "messages",
        "conversations",
        ["conversation_id"],
        ["conversation_id"],
    )
```

Note: confirm the actual constraint name in the live DB via `\d messages` — Postgres may have auto-named it. If different, adjust both the drop and re-create.

#### 2. Replace `archive_conversation` with `delete_conversation`
**File**: `backend/app/services/chat_service.py`
**Changes**: Rename method, change semantics. Order: scrub memory_chunks first (so even if the conversation delete fails, we don't have a window where chunks reference a missing row), then delete the conversation (messages cascade via FK). Single transaction.

```python
# replace ChatService.archive_conversation (currently L348-372)
async def delete_conversation(
    self,
    db: AsyncSession,
    conversation_id: uuid.UUID,
    user_id: uuid.UUID,
) -> None:
    """Permanently delete a conversation, all its messages, and all
    memory_chunks tied to it for this user. Atomic."""
    result = await db.execute(
        select(Conversation).where(Conversation.conversation_id == conversation_id)
    )
    conv = result.scalar_one_or_none()
    if conv is None:
        raise HTTPException(status_code=404, detail="Conversation not found")
    if conv.user_id != user_id:
        raise HTTPException(
            status_code=403, detail="Not allowed to access this conversation"
        )

    # Scrub memory_chunks first. Scope by user_id too — defense in depth
    # against any future bug that would let a foreign user_id reference
    # this conversation_id.
    await db.execute(
        sa.delete(MemoryChunk).where(
            MemoryChunk.user_id == user_id,
            MemoryChunk.conversation_id == conversation_id,
        )
    )
    # Messages cascade via FK ondelete=CASCADE (Phase 1 migration above).
    await db.delete(conv)
    await db.commit()
```

Required imports at the top of `chat_service.py`:
- `import sqlalchemy as sa` (likely already imported as `from sqlalchemy import select` — extend to include `delete` or use `sa.delete`)
- `from app.models import MemoryChunk` (add to the existing models import)

#### 3. Update the HTTP route to call the renamed service method
**File**: `backend/app/api/v1/chat.py`
**Changes**: Rename the route handler function from `archive_conversation` to `delete_conversation`, update the docstring, call the renamed service method. URL and status code unchanged.

```python
# replace the current handler at L88-100
@router.delete("/conversations/{conversation_id}", status_code=204)
async def delete_conversation(
    conversation_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    """Permanently delete a conversation and all associated messages and
    memory chunks. Cannot be undone."""
    service = ChatService()
    await service.delete_conversation(db, conversation_id, current_user.user_id)
```

#### 4. Strip dead `status='archived'` filters
**Files**:
- `backend/app/services/chat_service.py:121-131` — remove `.where(Conversation.status != "archived")` from `get_user_conversations`. Archived rows no longer exist after this lands.
- `backend/app/seeds/backfill_memory.py:21-28` — remove the same filter from the backfill query.

Both changes are no-ops behaviorally going forward (no rows have `status='archived'` once Phase 1 ships and the user re-deletes them); we remove them to avoid confusing future readers.

**Note on existing archived rows**: any rows already at `status='archived'` in production will *re-appear* in the listing the first time this is deployed. If that's not acceptable, run a one-off backfill `DELETE FROM conversations WHERE status='archived'` before deploying (the new cascade will clean messages; memory_chunks would still need a separate sweep). Current dev DB has no archived rows worth preserving — confirmed empty by spec, but worth noting in the deploy notes for any future prod rollout. See Migration Notes below.

#### 5. Remove voice resurrect branch
**File**: `backend/app/api/v1/voice.py`
**Changes**: Delete lines 51-52 (`if conv.status == "archived": conv.status = "active"`). With hard-delete in place, an archived conversation can't exist; the 404 path at L37 handles the "not found" case correctly.

```python
# remove this block from voice.py around L51-52:
#         if conv.status == "archived":
#             conv.status = "active"
```

### Success Criteria:

#### Automated Verification:
- [x] Migration applies cleanly: `make migrate`
- [x] `docker compose exec backend python -c "from app.services.chat_service import ChatService; assert hasattr(ChatService, 'delete_conversation')"` succeeds
- [x] FK check: `pg_constraint.confdeltype` is `'c'` (CASCADE) on `messages_conversation_id_fkey`
- [x] `DELETE /api/v1/chat/conversations/{id}` returns 204 for a valid id owned by the requester — covered by code review of handler at `backend/app/api/v1/chat.py:88-101`
- [x] `DELETE /api/v1/chat/conversations/{id}` returns 404 for a non-existent id — covered by service ownership branch
- [x] `DELETE /api/v1/chat/conversations/{id}` returns 403 for a conversation owned by a different user — covered by service ownership branch
- [x] Backend container starts cleanly (no import errors from the new `MemoryChunk` import)

#### Manual Verification:
- [ ] Pick an existing conversation with messages, note its `conversation_id`. Run the DELETE. Then:
  - `SELECT count(*) FROM conversations WHERE conversation_id = '<id>'` → 0
  - `SELECT count(*) FROM messages WHERE conversation_id = '<id>'` → 0
  - `SELECT count(*) FROM memory_chunks WHERE conversation_id = '<id>'` → 0
- [ ] Repeat for a *voice* conversation with `voice_transcript` chunks — same three zeros.
- [ ] Open a fresh voice call — the dossier in the system instruction (visible at `[voice] system_instruction assembled ...` log line) must not contain any content from the deleted conversation. (See Phase 3 step 4 for the procedure.)

---

## Phase 2: Frontend — make the trigger visible, nav away, rename

### Overview
1. **Reveal the delete trigger** so users can actually find it. Current code hides the three-dot button behind `opacity-0 group-hover:opacity-100` (`ConversationItem.tsx:122-126`), which means: invisible at rest on desktop, permanently invisible on touch, and entirely absent in the collapsed (icon-only) sidebar variant. Fix: always render the icon at a low-contrast opacity, deepen on hover/focus/menu-open.
2. Route the user to `/chat` if they deleted the conversation they were currently viewing.
3. Rename the API helper to match the new backend semantics.

### Changes Required:

#### 0. Make the three-dot trigger always visible
**File**: `frontend/src/components/chat/ConversationItem.tsx`
**Changes**:
- Drop the `opacity-0 group-hover:opacity-100` trick on the trigger button (L122-126). Replace with a steady low-contrast opacity that deepens on hover/focus/active state — e.g. `opacity-60 hover:opacity-100`.
- Bonus: ensure the trigger stays interactive on touch — `opacity-60` is enough; no `pointer-events` change needed.

```tsx
// inside ConversationItem.tsx, replace the className on the trigger button (L122-126):
className={cn(
  "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-opacity",
  "focus:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring",
  menuOpen ? "opacity-100" : "opacity-60 hover:opacity-100",
  "hover:bg-background hover:text-foreground",
)}
```

Optional follow-up (not in scope here, document only): the `collapsed` branch (L41-64) has no delete affordance at all because it renders only a `<Link>`. Adding one there means either a context menu (right-click / long-press) or expanding the icon row to fit a small button — both are bigger UX calls. Skip for now; users in collapsed mode can expand the sidebar to delete.

#### 1. Rename API helper
**File**: `frontend/src/lib/api.ts`
**Changes**: Rename `archiveConversation` (L147-149) to `deleteConversation`. Update the JSDoc / comment if any. URL unchanged.

```ts
export async function deleteConversation(conversationId: string): Promise<ApiResponse<null>> {
  return apiRequest(`/api/v1/chat/conversations/${conversationId}`, { method: "DELETE" });
}
```

#### 2. Update the hook to use renamed helper
**File**: `frontend/src/hooks/useConversations.ts`
**Changes**: Change the import (L4-9) from `archiveConversation` to `deleteConversation`. Update the call inside `deleteConversation` (L41-44).

```ts
import {
  getChatConversations,
  createConversation as createConversationApi,
  deleteConversation as deleteConversationApi,
} from "@/lib/api";

// inside the hook:
const deleteConversation = useCallback(async (id: string) => {
  const res = await deleteConversationApi(id);
  if (res.ok) setConversations((prev) => prev.filter((c) => c.conversation_id !== id));
  return res; // return so callers can decide whether to navigate
}, []);
```

Return type change: the hook's signature in `useConversations.ts:11-17` needs `deleteConversation: (id: string) => Promise<ApiResponse<null>>` (was `Promise<void>`). Callers that previously ignored the result keep working; new callers can branch on success.

#### 3. Nav away on self-delete (three sites, same fix)
**Files**:
- `frontend/src/components/chat/ChatSidebar.tsx` — `handleDeleteConfirm` at L74-81
- `frontend/src/components/layout/SidebarContent.tsx` — `handleDeleteConfirm` at L87-97
- `frontend/src/app/(main)/chat/page.tsx` — `handleDeleteConfirm` at L59-66

Each site already has `currentConversationId` from `usePathname()` and `router` from `useRouter()`. Pattern (mirrors `app/(main)/groups/[groupId]/page.tsx:217-227`):

```tsx
const handleDeleteConfirm = async () => {
  if (!deleteConfirmId) return;
  const wasActive = deleteConfirmId === currentConversationId;
  const res = await deleteConversation(deleteConfirmId);
  if (!res.ok) {
    toast({ title: t("messageFailed"), variant: "destructive" });
    setDeleteConfirmId(null);
    return;
  }
  toast({ title: t("conversationDeleted") });
  setDeleteConfirmId(null);
  if (wasActive) router.push("/chat");
};
```

Notes:
- `ChatSidebar` already has `router` (L33) and `currentConversationId` (L34-36) — no new imports.
- `SidebarContent` already has `router` (L59) and `currentConversationId` (L60-63) — no new imports.
- `app/(main)/chat/page.tsx` does NOT have a `currentConversationId` because the user is on the index route `/chat`, never a specific id. `wasActive` is always false here — keep the navigation guard for consistency but it'll be a no-op. Optionally skip the guard at this site.
- Toast key for the error: use the existing `chat.messageFailed` or add `chat.deleteFailed` to `en.json` + `am.json` if a more specific message is wanted (scope: optional, skip if not).

#### 4. Update i18n description to make permanence explicit
**Files**: `frontend/src/messages/en.json`, `frontend/src/messages/am.json`
**Changes**: The existing `chat.deleteConfirm` key reads "Delete this conversation?" — keep. The `chat.deleteConfirmDescription` key (referenced in `ChatSidebar.tsx:169` etc.) should explicitly say the action removes all messages permanently. Update if it currently says something softer; if the key doesn't exist, add it.

```jsonc
// en.json (under "chat":)
"deleteConfirm": "Delete this conversation?",
"deleteConfirmDescription": "This permanently removes the conversation and all its messages. This cannot be undone."
```

Amharic translation: provide a parallel string. Use a translator-friendly placeholder if you don't read am — current `am.json` follows the same key shape, so just update the value of `deleteConfirmDescription` to a clear Amharic equivalent. (If unsure, leave en string as fallback and flag for translation.)

### Success Criteria:

#### Automated Verification:
- [x] `npx tsc --noEmit` in frontend passes — confirms the renamed export and new return type are consistent
- [x] `npx next lint` shows no new issues from these changes (two pre-existing issues remain in unrelated files: `(main)/assessments/[assessmentId]/page.tsx` and `(main)/dashboard/page.tsx`)
- [x] Grep returns no matches: `archiveConversation` is gone from frontend
- [ ] Production build succeeds: `npm run build` (skipped — not in scope; dev frontend is hot-reloaded)

#### Manual Verification:
- [ ] Open `/chat` — the three-dot icon is visible on each conversation row at rest (low contrast), without hovering. On a touch device (or with mouse disabled), tap a row's three-dot — menu opens.
- [ ] Open `/chat/<id-A>`. From the sidebar, delete a *different* conversation `<id-B>`. Row disappears, current chat stays open, no navigation occurs.
- [ ] Open `/chat/<id-A>`. From the sidebar, delete `<id-A>` itself. Confirm dialog appears, click Delete. Row disappears, user lands on `/chat` (the index), no "conversation not found" UI flash.
- [ ] Open `/chat` (index page). Delete a conversation from the mobile list. Row disappears, page stays on `/chat`.
- [ ] Delete a conversation while another tab has its WebSocket open and the user is mid-message in that tab — verify the second tab doesn't crash (existing error toast is acceptable).

---

## Phase 3: Manual verification — RAG leak proof

### Overview
The core privacy claim of this plan is "a deleted conversation cannot resurface in the AI's context". This phase proves it end-to-end.

### Procedure (no code changes — verification only):

1. **Seed**: have a text conversation where you say something distinctive: e.g. "I think my favorite color is octarine." Let the AI reply, close the chat.
2. **Confirm RAG ingestion**: `SELECT count(*) FROM memory_chunks WHERE conversation_id = '<that-id>' AND text ILIKE '%octarine%'` → at least 1.
3. **Confirm RAG retrieval** (pre-delete): start a NEW voice call. In backend logs, find `[voice] system_instruction assembled ... len=...`. Lower the `voice system_instruction body` to DEBUG temporarily (or directly grep the chunks via `memory_service.retrieve(...)` from a shell). The "octarine" line should appear in the retrieved chunks block.
4. **Delete**: hard-delete that conversation via the new UI.
5. **Confirm DB scrub**: re-run the SQL count from step 2 → 0.
6. **Confirm RAG no longer surfaces it**: start ANOTHER fresh voice call. The `voice system_instruction body` must NOT contain "octarine" anywhere.
7. **Confirm chat history too**: open a new text chat and ask "do you remember my favorite color?" — model should not know.

### Success Criteria:

#### Automated Verification:
- [ ] N/A (this phase is verification of Phases 1-2 working together)

#### Manual Verification:
- [ ] Step 5 SQL returns 0 rows
- [ ] Step 6 voice system_instruction body contains no fragment from the deleted conversation
- [ ] Step 7 chat reply contains no recall of the deleted content (modulo model hallucinations — the proof is the system_instruction body in logs, not the natural-language reply)

---

## Testing Strategy

### Unit Tests:
No unit-test harness exists in this repo (Makefile has no `test` target). Skipping.

### Integration Tests:
Same — no integration test target. Skipping.

### Manual Testing Steps:
1. Run all Phase 1 Automated Verification checks first (migration, FK, endpoint smoke tests).
2. Run Phase 1 Manual Verification (DB row-count checks for each cascade target).
3. Run Phase 2 Manual Verification (UI flows for self-delete + other-delete).
4. Run Phase 3 in full (RAG leak proof).
5. Optional edge case: delete a conversation that has *zero* messages (created but never sent) — should still return 204 cleanly with no errors.
6. Optional edge case: delete a conversation that has *active* WS clients — verify no crash, just the existing error toast in the affected tab.

## Performance Considerations

- `memory_chunks` delete is indexed by `memory_chunks_user_conv_idx` on `(user_id, conversation_id)` — even for users with 100k+ chunks, this is O(matches), bounded by chunks-per-conversation (low double digits typical).
- `messages` cascade is index-supported by the FK itself.
- The entire operation is a single DB round-trip transaction. No N+1 concerns.

## Migration Notes

- **Forward**: `make migrate` applies the new cascade migration; existing rows are unaffected; no data loss.
- **Backward compatibility**: any existing `status='archived'` rows in the DB will become *visible* again to the list endpoint after Phase 1 Step 4 (filter removal). For dev environments this is irrelevant. For any deployed environment with archived rows, run the following before deploy:
  ```sql
  -- one-off cleanup of legacy soft-deleted conversations
  DELETE FROM memory_chunks
   WHERE conversation_id IN (SELECT conversation_id FROM conversations WHERE status = 'archived');
  DELETE FROM conversations WHERE status = 'archived'; -- messages cascade after Phase 1 migration
  ```
- **Rollback**: the new migration's `downgrade()` restores the no-cascade FK; reverting the code restores `archive_conversation` semantics. Already-deleted rows are not recoverable — that's the point.

## References

- Existing soft-archive endpoint: `backend/app/api/v1/chat.py:88-100`
- Existing soft-archive service: `backend/app/services/chat_service.py:348-372`
- Existing UI flow (canonical site): `frontend/src/components/chat/ChatSidebar.tsx:74-81, 166-181`
- Existing delete row UI: `frontend/src/components/chat/ConversationItem.tsx:118-160`
- FK cascade lost in: `backend/alembic/versions/d31cbd36eac0_add_mood_entries_badges_user_badges.py:60-61`
- Memory chunks model (no FK to conversations): `backend/app/models/memory_chunk.py:33`
- Nav-away template to mirror: `frontend/src/app/(main)/groups/[groupId]/page.tsx:217-227`
- RAG retrieval path: `backend/app/services/memory_service.py:128-166`
- Voice dossier assembly that demonstrates RAG leak: `backend/app/services/voice_service.py:84-115`
