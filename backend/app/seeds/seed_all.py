"""
Demo seed orchestrator.

Usage:
    docker compose exec backend python -m app.seeds.seed_all
    docker compose exec backend python -m app.seeds.seed_all --reset
    docker compose exec backend python -m app.seeds.seed_all --reset --with-memory

What it does:
    1. Ensures the catalog seeds (badges, resources, assessments) have run.
    2. Creates the demo users (idempotent unless --reset).
    3. Fans out per-user activity (moods, chats, assessments, resources, badges).
    4. Creates support groups with memberships and messages.
    5. Optionally calls the memory backfill to populate `memory_chunks`
       (slow — hits the AI service for embeddings).

The demo dataset is identified by the ``@mindease.demo`` email domain;
``--reset`` deletes only rows attached to those users (and the groups they
created), so it never touches real accounts.
"""
from __future__ import annotations

import argparse
import asyncio
import random
import sys

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import async_session_maker
from app.models.assessment import UserAssessment
from app.models.badge import UserBadge
from app.models.conversation import Conversation
from app.models.group import Group, GroupMember, GroupMessage
from app.models.memory_chunk import MemoryChunk
from app.models.message import Message
from app.models.mood_entry import MoodEntry
from app.models.resource import UserResource
from app.models.user import User

from app.seeds.badges import seed_badges
from app.seeds.seed_activity import load_catalogs, seed_activity_for_user
from app.seeds.seed_assessments import seed_assessments
from app.seeds.seed_groups import seed_groups
from app.seeds.seed_resources import seed_resources
from app.seeds.seed_users import DEMO_DOMAIN, DEMO_PASSWORD, seed_users


async def _reset_demo_data(db: AsyncSession) -> None:
    """Delete all rows belonging to @mindease.demo users plus their groups."""
    user_ids_q = select(User.user_id).where(User.email.like(f"%@{DEMO_DOMAIN}"))
    user_ids = [row[0] for row in (await db.execute(user_ids_q)).all()]
    if not user_ids:
        return

    # Groups created by demo users — delete by ondelete cascade on members/messages
    # for cascade-enabled FKs, plus explicit deletes for the rest.
    demo_group_ids = [
        g.group_id
        for g in (
            await db.execute(select(Group).where(Group.created_by.in_(user_ids)))
        ).scalars().all()
    ]

    # Order matters because of FKs.
    await db.execute(delete(MemoryChunk).where(MemoryChunk.user_id.in_(user_ids)))
    await db.execute(delete(UserBadge).where(UserBadge.user_id.in_(user_ids)))
    await db.execute(delete(UserResource).where(UserResource.user_id.in_(user_ids)))
    await db.execute(delete(UserAssessment).where(UserAssessment.user_id.in_(user_ids)))
    await db.execute(delete(MoodEntry).where(MoodEntry.user_id.in_(user_ids)))
    # Messages cascade with conversation delete (per migration c3d4e5f6a7b8) but
    # be explicit to keep this script self-contained.
    convo_ids = [
        c[0]
        for c in (
            await db.execute(
                select(Conversation.conversation_id).where(
                    Conversation.user_id.in_(user_ids)
                )
            )
        ).all()
    ]
    if convo_ids:
        await db.execute(delete(Message).where(Message.conversation_id.in_(convo_ids)))
        await db.execute(delete(Conversation).where(Conversation.conversation_id.in_(convo_ids)))

    if demo_group_ids:
        # group_messages and group_members cascade via FK; redundant but explicit.
        await db.execute(delete(GroupMessage).where(GroupMessage.group_id.in_(demo_group_ids)))
        await db.execute(delete(GroupMember).where(GroupMember.group_id.in_(demo_group_ids)))
        await db.execute(delete(Group).where(Group.group_id.in_(demo_group_ids)))
    # Memberships in groups owned by real users (if any) — drop them too.
    await db.execute(delete(GroupMember).where(GroupMember.user_id.in_(user_ids)))
    await db.execute(delete(GroupMessage).where(GroupMessage.user_id.in_(user_ids)))

    await db.execute(delete(User).where(User.user_id.in_(user_ids)))
    await db.commit()


async def _run(reset: bool, with_memory: bool, extra_generated: int) -> None:
    async with async_session_maker() as db:
        if reset:
            print("• Resetting existing demo data …")
            await _reset_demo_data(db)

        print("• Ensuring catalog seeds (badges, resources, assessments) …")
        await seed_badges(db)
        await seed_resources(db)
        await seed_assessments(db)

        print(f"• Seeding demo users (5 personas + {extra_generated} generated) …")
        demo_users = await seed_users(db, extra_generated=extra_generated)
        print(f"  → {len(demo_users)} users present")

        print("• Loading catalogs into memory …")
        assessments_by_type, badges_by_name, resources = await load_catalogs(db)

        print("• Generating per-user activity …")
        totals = {"moods": 0, "conversations": 0, "messages": 0,
                  "assessments": 0, "resources": 0, "badges": 0, "skipped": 0}
        # Stable per-user RNG so re-runs produce identical data.
        for user, spec in demo_users:
            rng = random.Random(hash(spec.email) & 0xFFFFFFFF)
            counts = await seed_activity_for_user(
                db, user, spec, assessments_by_type, badges_by_name, resources, rng
            )
            for k, v in counts.items():
                totals[k] = totals.get(k, 0) + v

        print("• Seeding support groups …")
        rng = random.Random(99)
        group_counts = await seed_groups(db, demo_users, rng)

    print()
    print("✅ Seed complete")
    print(f"   Users:          {len(demo_users)}")
    print(f"   Mood entries:   {totals['moods']}")
    print(f"   Conversations:  {totals['conversations']}")
    print(f"   Chat messages:  {totals['messages']}")
    print(f"   Assessments:    {totals['assessments']}")
    print(f"   Resource views: {totals['resources']}")
    print(f"   Badges earned:  {totals['badges']}")
    print(f"   Groups:         {group_counts['groups']}")
    print(f"   Memberships:    {group_counts['memberships']}")
    print(f"   Group messages: {group_counts['messages']}")
    print()
    print(f"   Login with any @{DEMO_DOMAIN} email, password: {DEMO_PASSWORD!r}")
    print( "   Try alice@mindease.demo (recovering), sara@mindease.demo (struggling),")
    print( "       marcus@mindease.demo (thriving), or hana@mindease.demo (new user).")

    if with_memory:
        print()
        print("• Running memory backfill (this may take a few minutes) …")
        from app.seeds.backfill_memory import main as backfill_main
        await backfill_main()


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Seed MindEase demo data")
    parser.add_argument(
        "--reset",
        action="store_true",
        help=f"Delete all rows owned by @{DEMO_DOMAIN} users before seeding.",
    )
    parser.add_argument(
        "--with-memory",
        action="store_true",
        help="Run memory_chunks backfill after seeding (slow; needs AI service).",
    )
    parser.add_argument(
        "--generated",
        type=int,
        default=25,
        help="Number of generated users in addition to the 5 personas.",
    )
    args = parser.parse_args(argv)
    asyncio.run(_run(args.reset, args.with_memory, args.generated))
    return 0


if __name__ == "__main__":
    sys.exit(main())
