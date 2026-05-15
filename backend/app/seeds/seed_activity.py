"""
Per-user activity seeding.

For each demo user, fan out mood entries, AI conversations + messages,
assessment results, resource views, and earned badges across the user's
``joined_days_ago`` window. The shape of the data is driven by the
``PersonaSpec.arc`` so each user tells a distinct, plausible story.
"""
from __future__ import annotations

import random
from datetime import datetime, timedelta, timezone
from uuid import uuid4

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.assessment import Assessment, UserAssessment
from app.models.badge import Badge, UserBadge
from app.models.conversation import Conversation
from app.models.message import Message
from app.models.mood_entry import MoodEntry
from app.models.resource import Resource, UserResource
from app.models.user import User
from app.seeds.seed_users import PersonaSpec

# Reuse the response-shaping helpers from the assessment seed.
from app.seeds.seed_assessments import _build_responses_for_score, _classify


# ---------------------------------------------------------------------------
# Mood distributions per arc
# ---------------------------------------------------------------------------

# Each arc defines (weights_by_phase, skip_chance, note_chance).
# Phases split the user window into thirds: early / middle / late.
ARC_MOOD: dict[str, dict] = {
    "recovering": {
        "phases": [
            ([1, 2, 3, 2, 2], [15, 35, 30, 15, 5]),   # early: low
            ([2, 3, 3, 4, 2], [10, 25, 30, 25, 10]),  # middle: turning
            ([3, 4, 4, 5, 5], [5, 25, 30, 25, 15]),   # late: good
        ],
        "skip_chance": (0.25, 0.10, 0.05),
        "note_chance": 0.40,
    },
    "thriving": {
        "phases": [
            ([3, 4, 4, 5, 5], [10, 25, 30, 25, 10]),
            ([2, 3, 4, 4, 5], [5, 15, 35, 30, 15]),
            ([3, 4, 4, 5, 5], [5, 20, 30, 30, 15]),
        ],
        "skip_chance": (0.15, 0.10, 0.08),
        "note_chance": 0.30,
    },
    "struggling": {
        "phases": [
            ([1, 2, 2, 3, 2], [25, 35, 20, 15, 5]),
            ([1, 2, 2, 3, 3], [20, 30, 25, 15, 10]),
            ([1, 2, 3, 2, 2], [25, 30, 25, 15, 5]),
        ],
        "skip_chance": (0.30, 0.20, 0.20),
        "note_chance": 0.55,
    },
    "consistent": {
        "phases": [
            ([2, 3, 3, 4, 3], [10, 25, 35, 20, 10]),
            ([2, 3, 4, 3, 4], [10, 25, 35, 20, 10]),
            ([3, 3, 4, 4, 3], [10, 25, 35, 20, 10]),
        ],
        "skip_chance": (0.05, 0.05, 0.05),
        "note_chance": 0.35,
    },
    "new_user": {
        "phases": [
            ([2, 3, 3, 4, 2], [10, 30, 30, 20, 10]),
            ([2, 3, 4, 4, 3], [10, 25, 35, 20, 10]),
            ([3, 3, 4, 4, 5], [5, 25, 35, 25, 10]),
        ],
        "skip_chance": (0.10, 0.10, 0.10),
        "note_chance": 0.45,
    },
}

# Mood note pools keyed by mood level. Kept small and reusable across users.
_MOOD_NOTES: dict[int, list[str]] = {
    1: [
        "Terrible day. Couldn't get out of bed.",
        "Everything feels overwhelming right now.",
        "Had a panic attack at work.",
        "Feeling completely drained.",
        "Can't focus on anything today.",
    ],
    2: [
        "Not great. Struggling with motivation.",
        "Anxious about the upcoming deadline.",
        "Feeling lonely today.",
        "Low energy, just going through the motions.",
        "Skipped class, couldn't face people.",
    ],
    3: [
        "Okay day. Nothing special.",
        "Getting by. Some ups and downs.",
        "Used the breathing exercise from MindEase.",
        "Coffee with a classmate, that was nice.",
        "Some anxiety but managed it.",
    ],
    4: [
        "Good day! Went for a walk and felt better.",
        "Had a productive study session.",
        "Slept well for the first time in a while.",
        "The CBT technique actually helped today.",
        "Feeling more hopeful than last week.",
    ],
    5: [
        "Amazing day! Feel genuinely happy.",
        "Aced my exam! Hard work paid off.",
        "Spent time with friends, laughed a lot.",
        "Beautiful weather, went to the park.",
        "Best I've felt in weeks!",
    ],
}


def _generate_mood_entries(spec: PersonaSpec, rng: random.Random) -> list[dict]:
    """Generate mood entries for one user according to their arc."""
    arc = ARC_MOOD.get(spec.arc, ARC_MOOD["consistent"])
    days = spec.joined_days_ago
    now = datetime.now(timezone.utc)
    entries: list[dict] = []

    for day_offset in range(days, 0, -1):
        entry_date = now - timedelta(days=day_offset)
        # Pick phase: 0 (early), 1 (middle), 2 (late).
        progress = (days - day_offset) / max(days, 1)
        phase_idx = 0 if progress < 0.33 else (1 if progress < 0.66 else 2)

        moods, weights = arc["phases"][phase_idx]
        skip_chance = arc["skip_chance"][phase_idx]
        if rng.random() < skip_chance:
            continue

        mood = rng.choices(moods, weights=weights, k=1)[0]
        # Weekend lift, Monday dip.
        if entry_date.weekday() in (5, 6):
            mood = min(5, mood + rng.choice([0, 0, 1]))
        elif entry_date.weekday() == 0:
            mood = max(1, mood - rng.choice([0, 0, 1]))

        # Time of day: morning bias.
        hour = rng.choice([8, 9, 10, 11, 19, 20, 21])
        minute = rng.randint(0, 59)
        ts = entry_date.replace(hour=hour, minute=minute, second=0, microsecond=0)

        note = (
            rng.choice(_MOOD_NOTES[mood])
            if rng.random() < arc["note_chance"]
            else None
        )

        entries.append(
            {
                "mood_level": mood,
                "note": note,
                "entry_source": "manual",
                "created_at": ts,
            }
        )
    return entries


# ---------------------------------------------------------------------------
# Conversation templates
# ---------------------------------------------------------------------------

# Topic templates: (title, user lines, ai lines). All English.
_CONVO_TEMPLATES: list[tuple[str, list[str], list[str]]] = [
    (
        "Trouble sleeping again",
        [
            "I've barely slept the past few nights.",
            "My mind just won't shut off. I keep replaying tomorrow's meeting.",
            "I've tried meditation but I get more frustrated when it doesn't work.",
            "Maybe I'll try the breathing exercise tonight.",
        ],
        [
            "That sounds exhausting. When did the trouble start?",
            "Pre-meeting anxiety is so common. What part of the meeting feels heaviest?",
            "It's normal for the mind to resist at first — would you like to try a slow 4-7-8 pattern together?",
            "Great. Be gentle with yourself if it doesn't work the first night.",
        ],
    ),
    (
        "Feeling behind at work",
        [
            "I'm drowning in tasks and falling behind on everything.",
            "My manager hasn't said anything but I feel like she's noticed.",
            "I want to ask for help but I feel like I should be able to handle it.",
        ],
        [
            "That feeling of being underwater is really painful. Can we list out what's actually on your plate?",
            "Often what we imagine others think is harsher than reality. What's the evidence she's noticed?",
            "Asking for help is a strength, not a failure. What's the smallest ask you could make this week?",
        ],
    ),
    (
        "An argument with a friend",
        [
            "I had a big argument with my best friend last night.",
            "She said I've been distant. She's not wrong, but I don't know how to explain.",
            "I think I owe her an honest conversation.",
        ],
        [
            "I'm sorry — that's painful, especially with someone close. What was the argument about?",
            "Sometimes when we're struggling we pull away without realizing. What's been on your plate?",
            "That sounds like a brave next step. Would it help to draft what you want to say?",
        ],
    ),
    (
        "Practicing gratitude",
        [
            "I want to start a gratitude practice but it feels cheesy.",
            "I keep coming up with the same three things — family, health, coffee.",
            "Maybe I'll try writing one specific moment each day instead.",
        ],
        [
            "That skepticism is fair. Lots of people feel that way at first. What draws you to it?",
            "That's a strong starting point. The repetition isn't a bug — it's worth noticing what consistently matters.",
            "I love that. Specificity is where the practice deepens. Let me know how it feels after a week.",
        ],
    ),
    (
        "Procrastination spiral",
        [
            "I've been procrastinating on a project all week.",
            "Now it's Friday and I feel terrible. The longer I wait the worse it gets.",
            "I keep telling myself I'll start tomorrow morning.",
        ],
        [
            "That spiral is exhausting. What's the project, and what's the next concrete step?",
            "Procrastination is usually about feeling — not laziness. What does starting feel like?",
            "Tomorrow-thinking can be a comfort but also a trap. Would 10 minutes today feel possible?",
        ],
    ),
    (
        "Homesick",
        [
            "I miss my family a lot today.",
            "It's been six months since I moved. I thought it would be easier by now.",
            "Tonight I'll call my mom — that always helps.",
        ],
        [
            "Homesickness can hit in waves. Is there something specific bringing it up today?",
            "There's no fixed timeline for adjustment. What parts have gotten easier? What hasn't?",
            "That sounds like exactly the right thing. Connection is one of the strongest antidotes.",
        ],
    ),
    (
        "Trying a new coping skill",
        [
            "I tried journaling for the first time this morning.",
            "I wrote for 15 minutes and felt lighter. But I don't know what to do with it.",
            "Maybe I'll do it three times this week and see.",
        ],
        [
            "That's a great first step. What did you write about?",
            "You don't need to do anything with it — the writing itself is the work. The 'lighter' feeling is the signal.",
            "Lovely plan. Treat it like an experiment, not a commitment.",
        ],
    ),
    (
        "Setting a boundary",
        [
            "A coworker keeps dumping their work on me and I never say no.",
            "I'm scared of being seen as difficult.",
            "I'll try saying 'I can't take that on this week' next time.",
        ],
        [
            "That pattern is so common, and so draining. What stops you from saying no?",
            "What would it mean about you if you were seen as 'difficult'? Often the fear is bigger than the reality.",
            "That's a clean, professional boundary. The first time is the hardest — you've got this.",
        ],
    ),
]


def _make_conversation(
    user_id,
    spec: PersonaSpec,
    rng: random.Random,
    template_idx: int,
    days_ago: int,
) -> tuple[Conversation, list[Message]]:
    """Build one Conversation with its messages, dated `days_ago` from now."""
    title, user_lines, ai_lines = _CONVO_TEMPLATES[template_idx % len(_CONVO_TEMPLATES)]
    persona_id = rng.choice(spec.preferred_personas)
    persona_names = {
        "sage": "Sage",
        "marcus": "Marcus",
        "kira": "Kira",
        "dr_chen": "Dr. Chen",
    }

    now = datetime.now(timezone.utc)
    start = (now - timedelta(days=days_ago)).replace(
        hour=rng.randint(8, 21),
        minute=rng.randint(0, 59),
        second=0,
        microsecond=0,
    )

    conv = Conversation(
        conversation_id=uuid4(),
        user_id=user_id,
        title=title,
        started_at=start,
        last_message_at=start,
        status="active",
        total_messages=0,
        crisis_detected=False,
        conversation_type="text",
        attrs={
            "persona_id": persona_id,
            "persona_name": persona_names.get(persona_id, persona_id.title()),
        },
    )

    messages: list[Message] = []
    cursor = start
    for u_line, ai_line in zip(user_lines, ai_lines):
        cursor = cursor + timedelta(seconds=rng.randint(30, 240))
        messages.append(
            Message(
                message_id=uuid4(),
                conversation_id=conv.conversation_id,
                sender_type="user",
                content=u_line,
                detected_emotion=rng.choice(
                    ["anxious", "sad", "neutral", "hopeful", "frustrated"]
                ),
                timestamp=cursor,
                is_crisis_flagged=False,
            )
        )
        cursor = cursor + timedelta(seconds=rng.randint(15, 60))
        messages.append(
            Message(
                message_id=uuid4(),
                conversation_id=conv.conversation_id,
                sender_type="ai",
                content=ai_line,
                detected_emotion=None,
                timestamp=cursor,
                is_crisis_flagged=False,
            )
        )

    conv.total_messages = len(messages)
    conv.last_message_at = cursor
    return conv, messages


def _convo_count_for_arc(arc: str, rng: random.Random) -> int:
    if arc == "new_user":
        return rng.randint(1, 2)
    if arc == "thriving":
        return rng.randint(2, 4)
    if arc == "consistent":
        return rng.randint(3, 5)
    if arc == "struggling":
        return rng.randint(3, 6)
    return rng.randint(3, 5)  # recovering


# ---------------------------------------------------------------------------
# Assessments
# ---------------------------------------------------------------------------

def _pick_days(rng: random.Random, low_frac: float, high_frac: float, window_days: int) -> int:
    """Pick a day-offset within [low_frac, high_frac] of the user's window.

    Always safe: clamps to [1, window_days - 1] and ensures low <= high so it
    works for short windows (e.g. new users with a 14-day window).
    """
    if window_days <= 2:
        return 1
    low = max(1, int(window_days * low_frac))
    high = min(window_days - 1, int(window_days * high_frac))
    if low > high:
        low = high = max(1, min(low, window_days - 1))
    return rng.randint(low, high)


def _assessment_history_for_arc(
    arc: str, rng: random.Random, window_days: int
) -> list[tuple[str, int, int]]:
    """Return list of (assessment_type, days_ago, score). Day offsets are
    computed as fractions of the user's window so it works for any joined_days_ago."""
    if arc == "new_user":
        return [("anxiety", _pick_days(rng, 0.1, 0.7, window_days), rng.randint(7, 12))]

    if arc == "thriving":
        return [
            ("anxiety", _pick_days(rng, 0.5, 0.95, window_days), rng.randint(8, 14)),
            ("stress", _pick_days(rng, 0.1, 0.4, window_days), rng.randint(6, 12)),
        ]

    if arc == "struggling":
        return [
            ("depression", _pick_days(rng, 0.5, 0.95, window_days), rng.randint(15, 22)),
            ("anxiety", _pick_days(rng, 0.25, 0.5, window_days), rng.randint(14, 19)),
            ("stress", _pick_days(rng, 0.02, 0.2, window_days), rng.randint(20, 26)),
        ]

    if arc == "consistent":
        return [
            ("anxiety", _pick_days(rng, 0.6, 0.95, window_days), rng.randint(10, 14)),
            ("stress", _pick_days(rng, 0.25, 0.55, window_days), rng.randint(12, 18)),
            ("anxiety", _pick_days(rng, 0.02, 0.2, window_days), rng.randint(5, 10)),
        ]

    # recovering: starts severe → improves
    return [
        ("anxiety", _pick_days(rng, 0.6, 0.95, window_days), rng.randint(14, 20)),
        ("depression", _pick_days(rng, 0.4, 0.6, window_days), rng.randint(11, 16)),
        ("anxiety", _pick_days(rng, 0.05, 0.3, window_days), rng.randint(5, 10)),
    ]


# ---------------------------------------------------------------------------
# Badges
# ---------------------------------------------------------------------------

def _earned_badge_names(
    mood_entries: list[dict],
    conv_count: int,
    assessment_count: int,
    resource_view_count: int,
) -> list[tuple[str, datetime]]:
    earned: list[tuple[str, datetime]] = []
    if not mood_entries:
        return earned

    first_ts = mood_entries[0]["created_at"]
    earned.append(("First Step", first_ts))

    if len(mood_entries) >= 50:
        earned.append(("Consistent", mood_entries[49]["created_at"]))

    # Streaks
    dates = sorted({e["created_at"].date() for e in mood_entries})
    cur, mx = 1, 1
    streak7_at: datetime | None = None
    streak30_at: datetime | None = None
    for i in range(1, len(dates)):
        if dates[i] - dates[i - 1] == timedelta(days=1):
            cur += 1
            mx = max(mx, cur)
            if cur == 7 and streak7_at is None:
                streak7_at = datetime.combine(
                    dates[i], datetime.min.time().replace(hour=12), tzinfo=timezone.utc
                )
            if cur == 30 and streak30_at is None:
                streak30_at = datetime.combine(
                    dates[i], datetime.min.time().replace(hour=12), tzinfo=timezone.utc
                )
        else:
            cur = 1
    if streak7_at is not None:
        earned.append(("7-Day Streak", streak7_at))
    if streak30_at is not None:
        earned.append(("30-Day Streak", streak30_at))

    last_mood_ts = mood_entries[-1]["created_at"]
    if conv_count >= 5:
        earned.append(("5 Sessions", last_mood_ts))
    if conv_count >= 10:
        earned.append(("10 Sessions", last_mood_ts))
    if assessment_count >= 1:
        earned.append(("Self-Aware", last_mood_ts))
    if resource_view_count >= 5:
        earned.append(("Resource Explorer", last_mood_ts))
    return earned


# ---------------------------------------------------------------------------
# Orchestrator (called by seed_all)
# ---------------------------------------------------------------------------

async def seed_activity_for_user(
    db: AsyncSession,
    user: User,
    spec: PersonaSpec,
    assessments_by_type: dict[str, Assessment],
    badges_by_name: dict[str, Badge],
    resources: list[Resource],
    rng: random.Random,
) -> dict[str, int]:
    """Seed one user's full activity. Idempotent — skips if user already has moods."""
    # If this user already has mood entries, assume their data is seeded.
    existing = await db.execute(
        select(MoodEntry).where(MoodEntry.user_id == user.user_id).limit(1)
    )
    if existing.scalar_one_or_none() is not None:
        return {"skipped": 1}

    counts = {"moods": 0, "conversations": 0, "messages": 0, "assessments": 0,
              "resources": 0, "badges": 0}

    # Mood entries.
    mood_specs = _generate_mood_entries(spec, rng)
    for m in mood_specs:
        db.add(
            MoodEntry(
                entry_id=uuid4(),
                user_id=user.user_id,
                mood_level=m["mood_level"],
                note=m["note"],
                entry_source=m["entry_source"],
                created_at=m["created_at"],
            )
        )
    counts["moods"] = len(mood_specs)

    # Conversations + messages.
    n_conv = _convo_count_for_arc(spec.arc, rng)
    template_offset = rng.randint(0, len(_CONVO_TEMPLATES) - 1)
    convo_days_pool = sorted(
        rng.sample(range(2, max(spec.joined_days_ago, 3)), k=min(n_conv, max(spec.joined_days_ago - 2, 1))),
        reverse=True,
    )
    for i, days_ago in enumerate(convo_days_pool):
        conv, msgs = _make_conversation(
            user.user_id, spec, rng, template_offset + i, days_ago
        )
        db.add(conv)
        for msg in msgs:
            db.add(msg)
        counts["conversations"] += 1
        counts["messages"] += len(msgs)

    # Assessments.
    now = datetime.now(timezone.utc)
    history = _assessment_history_for_arc(spec.arc, rng, spec.joined_days_ago)
    for atype, days_ago, score in history:
        assessment = assessments_by_type.get(atype)
        if assessment is None:
            continue
        scoring = assessment.scoring_logic
        max_per = max(opt["value"] for opt in scoring["options"])
        responses = _build_responses_for_score(score, assessment.questions, max_per)
        rng.shuffle(responses)
        actual_score = sum(r["value"] for r in responses)
        bucket = _classify(actual_score, scoring)
        db.add(
            UserAssessment(
                user_assessment_id=uuid4(),
                user_id=user.user_id,
                assessment_id=assessment.assessment_id,
                responses=responses,
                score=actual_score,
                feedback_level=bucket["level"],
                feedback_text=bucket["feedback"],
                completed_at=now - timedelta(days=days_ago, hours=rng.randint(0, 12)),
            )
        )
        counts["assessments"] += 1

    # Resource views (random subset).
    if resources:
        sample_size = min(len(resources), rng.randint(3, 12))
        sampled = rng.sample(resources, k=sample_size)
        for r in sampled:
            db.add(
                UserResource(
                    id=uuid4(),
                    user_id=user.user_id,
                    resource_id=r.resource_id,
                    viewed_at=now - timedelta(
                        days=rng.randint(1, max(spec.joined_days_ago, 2)),
                        hours=rng.randint(0, 23),
                    ),
                    is_favorite=rng.random() < 0.2,
                )
            )
        counts["resources"] = len(sampled)

    # Badges.
    earned = _earned_badge_names(
        mood_specs, counts["conversations"], counts["assessments"], counts["resources"]
    )
    for name, ts in earned:
        badge = badges_by_name.get(name)
        if badge is None:
            continue
        db.add(
            UserBadge(
                id=uuid4(),
                user_id=user.user_id,
                badge_id=badge.badge_id,
                earned_at=ts,
            )
        )
        counts["badges"] += 1

    await db.commit()
    return counts


async def load_catalogs(
    db: AsyncSession,
) -> tuple[dict[str, Assessment], dict[str, Badge], list[Resource]]:
    a_rows = (await db.execute(select(Assessment))).scalars().all()
    b_rows = (await db.execute(select(Badge))).scalars().all()
    r_rows = (await db.execute(select(Resource))).scalars().all()
    return (
        {a.assessment_type: a for a in a_rows},
        {b.name: b for b in b_rows},
        list(r_rows),
    )
