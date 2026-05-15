"""
Support-group seeding.

Creates one curated group per allowed category, then populates each with
a roster pulled from the demo users and a thread of realistic, English-only
messages spread over the user's window. The first persona user is used as
``created_by`` for each group so ownership is deterministic.
"""
from __future__ import annotations

import random
from datetime import datetime, timedelta, timezone
from uuid import uuid4

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.group import Group, GroupMember, GroupMessage
from app.models.user import User
from app.seeds.seed_users import PersonaSpec


# (category, name, name_am, description, icon, cover_color, rules)
_GROUPS: list[dict] = [
    {
        "category": "anxiety",
        "name": "Calm Together",
        "name_am": "በአንድነት ሰላም",
        "description": "A safe space to share strategies for managing anxiety, panic, and worry. We're all in this together.",
        "description_am": "ጭንቀትን፣ ድንጋጤንና ጥርጣሬን ለመቆጣጠር ስልቶችን ለመጋራት ደህንነቱ የተጠበቀ ቦታ።",
        "icon": "🌿",
        "cover_color": "#4F7263",
        "rules": "Be kind. No diagnosing. No promoting products.",
    },
    {
        "category": "depression",
        "name": "Light in the Tunnel",
        "name_am": "በዋሻው ውስጥ ብርሃን",
        "description": "Support and gentle accountability for those navigating depression. Small wins welcome.",
        "description_am": "በድብርት ውስጥ ለሚገኙ ድጋፍና ቀስ ያለ ተጠያቂነት።",
        "icon": "🌅",
        "cover_color": "#6B8E7B",
        "rules": "Lead with compassion. Trigger warnings for heavy content.",
    },
    {
        "category": "student_stress",
        "name": "Student Survival Squad",
        "name_am": "የተማሪዎች ህልውና ቡድን",
        "description": "Exams, deadlines, future anxiety — share the load. Open to undergrads and grads.",
        "description_am": "ፈተናዎች፣ የመጨረሻ ቀኖችና የወደፊት ጭንቀት — ሸክሙን ይካፈሉ።",
        "icon": "📚",
        "cover_color": "#7B6B8E",
        "rules": "No homework requests. No name-and-shame of professors.",
    },
    {
        "category": "mindfulness",
        "name": "Daily Mindfulness",
        "name_am": "ዕለታዊ አስተውሎት",
        "description": "Share daily reflections, breathing practices, and mindful moments.",
        "description_am": "ዕለታዊ ሐሳቦችን፣ የመተንፈስ ልምምዶችንና አስተዋይ ጊዜዎችን ይካፈሉ።",
        "icon": "🧘",
        "cover_color": "#8E7B6B",
        "rules": "Keep it gentle. No spiritual gatekeeping.",
    },
    {
        "category": "grief",
        "name": "Walking With Grief",
        "name_am": "ከሐዘን ጋር መሄድ",
        "description": "For anyone grieving a loss — recent or old. There's no timeline for grief.",
        "description_am": "ለማንኛውም ያጡት ሰዎች — በቅርቡ ይሁን ከዓመታት በፊት።",
        "icon": "🕯️",
        "cover_color": "#4F4F73",
        "rules": "Hold space for others. No comparing losses.",
    },
    {
        "category": "general",
        "name": "MindEase Lounge",
        "name_am": "የMindEase ሳሎን",
        "description": "Open chat for anything mental-health adjacent. Introduce yourself!",
        "description_am": "ለማንኛውም የአእምሮ ጤና ተዛማጅ ጉዳዮች ክፍት ውይይት።",
        "icon": "💬",
        "cover_color": "#5A7A8E",
        "rules": "Keep it kind. No medical advice.",
    },
]


# Message templates per category. Each entry is one member message.
_GROUP_MESSAGES: dict[str, list[str]] = {
    "anxiety": [
        "Anyone else have a rough Monday? My chest was tight all morning.",
        "Tried 4-7-8 breathing on the bus today and it actually helped.",
        "What do you all do when racing thoughts hit before bed?",
        "I journal for 5 minutes. Doesn't always work but it helps me name the worry.",
        "Pro tip: name the worry like a noisy roommate. Mine is called 'Brian'.",
        "Reminder: anxiety lies. Your worth is not your productivity.",
        "I had a panic attack in the grocery store. Counted 5 things I could see.",
        "That grounding technique saved me yesterday too. Sending care.",
        "Therapist gave me homework: 10 mins of worry time in the evening. Weirdly works.",
        "Has anyone tried magnesium for sleep? Open to ideas.",
    ],
    "depression": [
        "Got out of bed today. Counting that as a win.",
        "Showering felt like climbing a mountain this morning, but I did it.",
        "The 'shoulds' are the worst — I should be doing more, I should be better.",
        "Replacing 'should' with 'could' has helped me a tiny bit. Small thing.",
        "I went for a 10-minute walk. First time in weeks. Crying a little.",
        "Proud of you. Truly.",
        "Sunlight in the morning is changing my baseline. Took two weeks to notice.",
        "I cooked one meal this week instead of skipping. Frozen pizza counts.",
        "Reminder that meds taking weeks to work is normal. Hang in there.",
        "Some days the goal is just: get to tomorrow.",
    ],
    "student_stress": [
        "Two papers due Friday. Help.",
        "Pomodoro 25/5 saved me last semester. Worth a try.",
        "My imposter syndrome is loud this week.",
        "The professor's the imposter — you got into the program, you belong.",
        "Anyone have tips for not spiraling after a bad grade?",
        "Stop thinking it's about your worth. It's data, not destiny.",
        "Quiet study spot recommendations? Library is chaotic.",
        "Coffee shop near campus on 4th — outlets, slow music, decent wifi.",
        "Finals in 3 weeks. Already feel behind.",
        "One thing at a time. Block the calendar. Don't read ahead.",
    ],
    "mindfulness": [
        "5 minutes of box breathing this morning. Coffee tasted better after.",
        "Body scan before bed has changed my sleep. Try it.",
        "Mindful walking on the way to work. I noticed the trees for the first time.",
        "Today's intention: respond, don't react.",
        "Sat with discomfort instead of distracting. Hard but useful.",
        "Loving-kindness toward someone I'm annoyed with. It softened things.",
        "Anyone use Insight Timer? Looking for short morning meditations.",
        "Tara Brach's RAIN practice is gold for stuck feelings.",
    ],
    "grief": [
        "It's been a year today. I thought I'd be further along.",
        "There's no further along. There's just where you are.",
        "I keep finding her handwriting in old notebooks. Hits like a wave.",
        "I lit a candle for my dad tonight. First Father's Day without him.",
        "Sending you both so much care.",
        "Some days I forget for a few hours, then I feel guilty for forgetting.",
        "Forgetting briefly isn't betrayal — it's your mind giving you a small break.",
    ],
    "general": [
        "Hi all — new here. Just wanted to say hello.",
        "Welcome! Glad you found us.",
        "Quick question: what's everyone's favorite calming app?",
        "MindEase, obviously 😄 But also Calm and Headspace.",
        "Anyone else find weekends harder than weekdays?",
        "Yes — structure helps me. Saturdays I feel adrift.",
        "Just venting: my landlord won't fix the heater and I'm losing it.",
        "That's a legit thing to be upset about. Sending solidarity.",
    ],
}


def _msg_count_for_window(days: int, rng: random.Random) -> int:
    base = max(20, days // 2)
    return rng.randint(base, base + 30)


async def seed_groups(
    db: AsyncSession,
    demo_users: list[tuple[User, PersonaSpec]],
    rng: random.Random,
) -> dict[str, int]:
    """Create curated groups, fill with members and messages.

    Idempotent: if a group with the same name already exists, skip it entirely
    (memberships and messages too).
    """
    if not demo_users:
        return {"groups": 0, "memberships": 0, "messages": 0}

    creator_user = demo_users[0][0]  # alice@mindease.demo by convention
    counts = {"groups": 0, "memberships": 0, "messages": 0}
    now = datetime.now(timezone.utc)

    for g in _GROUPS:
        existing = await db.execute(select(Group).where(Group.name == g["name"]))
        if existing.scalar_one_or_none() is not None:
            continue

        group = Group(
            group_id=uuid4(),
            name=g["name"],
            name_am=g["name_am"],
            description=g["description"],
            description_am=g["description_am"],
            category=g["category"],
            icon=g["icon"],
            cover_color=g["cover_color"],
            created_by=creator_user.user_id,
            is_public=True,
            max_members=200,
            rules=g["rules"],
            is_active=True,
            created_at=now - timedelta(days=80),
        )
        db.add(group)
        counts["groups"] += 1

        # Membership: creator as admin, plus 40-80% of the demo pool as members.
        roster = [creator_user]
        member_pool = [u for u, _ in demo_users if u.user_id != creator_user.user_id]
        target = max(4, int(len(member_pool) * rng.uniform(0.4, 0.8)))
        roster.extend(rng.sample(member_pool, k=min(target, len(member_pool))))

        for idx, u in enumerate(roster):
            role = "admin" if u.user_id == creator_user.user_id else "member"
            db.add(
                GroupMember(
                    id=uuid4(),
                    group_id=group.group_id,
                    user_id=u.user_id,
                    role=role,
                    joined_at=group.created_at + timedelta(days=rng.randint(0, 30)),
                    is_muted=False,
                )
            )
            counts["memberships"] += 1

        # Messages: a thread spanning the group lifetime, drawn from templates
        # with occasional moderator nudges.
        templates = _GROUP_MESSAGES.get(g["category"], _GROUP_MESSAGES["general"])
        n_msgs = _msg_count_for_window(80, rng)
        cursor = group.created_at + timedelta(hours=2)
        for i in range(n_msgs):
            cursor = cursor + timedelta(
                hours=rng.choice([1, 2, 4, 8, 12, 24]),
                minutes=rng.randint(0, 59),
            )
            if cursor > now:
                break
            # Occasionally have the AI moderator chime in.
            if rng.random() < 0.06:
                db.add(
                    GroupMessage(
                        message_id=uuid4(),
                        group_id=group.group_id,
                        user_id=None,
                        sender_type="ai_moderator",
                        sender_name="MindEase",
                        content=rng.choice(
                            [
                                "Welcome new members joining this week — feel free to introduce yourself.",
                                "Gentle reminder: this space is peer support, not professional advice.",
                                "Crisis resources are always pinned at the top — please use them if you need urgent help.",
                            ]
                        ),
                        timestamp=cursor,
                    )
                )
            else:
                speaker = rng.choice(roster)
                db.add(
                    GroupMessage(
                        message_id=uuid4(),
                        group_id=group.group_id,
                        user_id=speaker.user_id,
                        sender_type="user",
                        sender_name=speaker.display_name,
                        content=rng.choice(templates),
                        timestamp=cursor,
                    )
                )
            counts["messages"] += 1

    await db.commit()
    return counts
