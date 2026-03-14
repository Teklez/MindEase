"""
Mood Tracker Seed Data Script
Run: docker-compose exec backend python -m app.seeds.seed_mood_data

Creates 90 days of realistic mood data for testing charts, streaks,
calendar heatmap, and badges.
"""

import asyncio
import random
from datetime import datetime, timedelta
from uuid import uuid4

from sqlalchemy import select
from app.database import async_session_maker as AsyncSessionLocal
from app.models.user import User
from app.models.mood_entry import MoodEntry
from app.models.badge import Badge, UserBadge


# ============================================================
# CONFIG — change this to your test account email
# ============================================================
TEST_USER_EMAIL = "tekleyohannes101@gmail.com"


# ============================================================
# 90 days of realistic mood data
# Pattern: starts rough (week 1-2), gradually improves (week 3-8),
# has a dip around week 6, then recovers. Mimics a real user's
# mental health journey using MindEase.
# ============================================================

def generate_mood_entries(user_id: str, days: int = 90):
    """Generate realistic mood entries over the past N days."""

    entries = []
    now = datetime.utcnow()

    for day_offset in range(days, 0, -1):
        entry_date = now - timedelta(days=day_offset)

        # Determine the "phase" of the journey
        week = (days - day_offset) // 7

        if week < 2:
            # Week 1-2: User just started, feeling low/anxious
            base_mood = random.choices([1, 2, 3, 2, 2], weights=[15, 35, 30, 15, 5])[0]
        elif week < 4:
            # Week 3-4: Starting to feel slightly better
            base_mood = random.choices([2, 3, 3, 4, 2], weights=[10, 30, 30, 20, 10])[0]
        elif week < 6:
            # Week 5-6: Good improvement phase
            base_mood = random.choices([2, 3, 4, 4, 5], weights=[5, 20, 35, 25, 15])[0]
        elif week < 8:
            # Week 7-8: A dip — life happens, stressful period
            base_mood = random.choices([1, 2, 3, 3, 2], weights=[10, 30, 30, 20, 10])[0]
        elif week < 10:
            # Week 9-10: Recovery, getting better again
            base_mood = random.choices([2, 3, 4, 4, 5], weights=[5, 15, 35, 30, 15])[0]
        else:
            # Week 11+: Stable good period
            base_mood = random.choices([3, 4, 4, 5, 5], weights=[10, 25, 30, 25, 10])[0]

        # Weekend boost — people often feel slightly better on weekends
        if entry_date.weekday() in [5, 6]:  # Saturday, Sunday
            base_mood = min(5, base_mood + random.choice([0, 0, 1]))

        # Monday dip
        if entry_date.weekday() == 0:
            base_mood = max(1, base_mood - random.choice([0, 0, 1]))

        # Skip some days randomly (realistic — nobody logs every single day)
        # But skip fewer days as the user gets more engaged
        skip_chance = 0.25 if week < 4 else 0.10 if week < 8 else 0.05
        if random.random() < skip_chance:
            continue

        # Sometimes log multiple entries per day
        num_entries = random.choices([1, 1, 1, 2], weights=[60, 20, 10, 10])[0]

        for i in range(num_entries):
            # Vary the time of day
            if i == 0:
                # Morning entry (7am - 11am)
                hour = random.randint(7, 11)
            else:
                # Evening entry (6pm - 10pm)
                hour = random.randint(18, 22)

            minute = random.randint(0, 59)
            entry_time = entry_date.replace(hour=hour, minute=minute, second=0)

            # Slightly vary mood for multiple entries (evening might be different)
            mood = base_mood
            if i > 0:
                mood = max(1, min(5, mood + random.choice([-1, 0, 0, 1])))

            # Generate contextual notes (not every entry has one)
            note = _generate_note(mood, week, entry_date) if random.random() < 0.4 else None

            entries.append({
                "user_id": user_id,
                "mood_level": mood,
                "note": note,
                "entry_source": "manual",
                "created_at": entry_time,
            })

    return entries


def _generate_note(mood: int, week: int, date: datetime) -> str:
    """Generate realistic notes based on mood level and phase."""

    notes_by_mood = {
        1: [
            "Terrible day. Couldn't get out of bed.",
            "Everything feels overwhelming right now.",
            "Had a panic attack at work.",
            "Feeling completely drained and hopeless.",
            "Cried for no reason today.",
            "Can't focus on anything.",
            "Didn't sleep at all last night.",
            "Feel like I'm failing at everything.",
        ],
        2: [
            "Not great. Struggling with motivation.",
            "Anxious about upcoming deadline.",
            "Had an argument with a friend.",
            "Feeling lonely today.",
            "Stress levels are really high.",
            "Headache from all the tension.",
            "Overthinking everything as usual.",
            "Skipped class, couldn't face people.",
            "Low energy, just going through the motions.",
        ],
        3: [
            "Okay day. Nothing special.",
            "Getting by. Some ups and downs.",
            "Managed to finish some assignments.",
            "Neutral. Just a regular day.",
            "Had coffee with a classmate, that was nice.",
            "Some anxiety but managed it.",
            "Used the breathing exercise from MindEase.",
            "Not bad, not great. Surviving.",
        ],
        4: [
            "Good day! Went for a walk and felt better.",
            "Had a productive study session.",
            "Called my family back home, felt happy.",
            "The CBT technique actually helped today.",
            "Slept well for the first time in a while.",
            "Enjoyed cooking dinner with friends.",
            "Feeling more hopeful than last week.",
            "Exercise really boosted my mood.",
            "Got positive feedback on my project!",
        ],
        5: [
            "Amazing day! Feel genuinely happy.",
            "Everything clicked today. Grateful.",
            "Aced my exam! Hard work paid off.",
            "Spent time with friends, laughed a lot.",
            "Beautiful weather, went to the park.",
            "Feel like I'm making real progress.",
            "Meditation this morning was incredible.",
            "Feeling strong and confident today!",
            "Best I've felt in weeks!",
        ],
    }

    return random.choice(notes_by_mood.get(mood, notes_by_mood[3]))


# ============================================================
# Seed badges earned based on the generated data
# ============================================================

def determine_earned_badges(entries: list, user_id: str) -> list:
    """Figure out which badges the user should have earned."""

    earned = []

    # First Step — has at least 1 entry
    if len(entries) >= 1:
        earned.append({
            "badge_name": "First Step",
            "earned_at": entries[0]["created_at"]
        })

    # Consistent — 50+ entries
    if len(entries) >= 50:
        earned.append({
            "badge_name": "Consistent",
            "earned_at": entries[49]["created_at"]
        })

    # Calculate streaks from entries to determine streak badges
    dates_with_entries = sorted(set(e["created_at"].date() for e in entries))

    max_streak = 1
    current_streak = 1
    seven_day_earned_at = None
    thirty_day_earned_at = None

    for i in range(1, len(dates_with_entries)):
        if dates_with_entries[i] - dates_with_entries[i - 1] == timedelta(days=1):
            current_streak += 1
            max_streak = max(max_streak, current_streak)

            if current_streak == 7 and seven_day_earned_at is None:
                seven_day_earned_at = dates_with_entries[i]
            if current_streak == 30 and thirty_day_earned_at is None:
                thirty_day_earned_at = dates_with_entries[i]
        else:
            current_streak = 1

    if seven_day_earned_at:
        earned.append({
            "badge_name": "7-Day Streak",
            "earned_at": datetime.combine(seven_day_earned_at, datetime.min.time().replace(hour=12))
        })

    if thirty_day_earned_at:
        earned.append({
            "badge_name": "30-Day Streak",
            "earned_at": datetime.combine(thirty_day_earned_at, datetime.min.time().replace(hour=12))
        })

    return earned


# ============================================================
# Main seed function
# ============================================================

async def seed_mood_data():
    """Seed the database with test mood data."""

    async with AsyncSessionLocal() as db:
        # 1. Find the test user
        result = await db.execute(
            select(User).where(User.email == TEST_USER_EMAIL)
        )
        user = result.scalar_one_or_none()

        if not user:
            print(f"❌ User not found: {TEST_USER_EMAIL}")
            print("   Make sure you've registered this account first.")
            return

        user_id = str(user.user_id)
        print(f"✅ Found user: {user.display_name} ({user.email})")

        # 2. Clear existing mood entries for this user (fresh seed)
        from sqlalchemy import delete as sql_delete
        await db.execute(
            sql_delete(MoodEntry).where(MoodEntry.user_id == user.user_id)
        )
        await db.execute(
            sql_delete(UserBadge).where(UserBadge.user_id == user.user_id)
        )
        await db.commit()
        print("🗑️  Cleared existing mood entries and badges")

        # 3. Generate mood entries
        entries_data = generate_mood_entries(user_id, days=90)

        for data in entries_data:
            entry = MoodEntry(
                entry_id=uuid4(),
                user_id=user.user_id,
                mood_level=data["mood_level"],
                note=data["note"],
                entry_source=data["entry_source"],
                created_at=data["created_at"],
            )
            db.add(entry)

        await db.commit()
        print(f"📊 Created {len(entries_data)} mood entries over 90 days")

        # 4. Print summary
        mood_counts = {1: 0, 2: 0, 3: 0, 4: 0, 5: 0}
        for e in entries_data:
            mood_counts[e["mood_level"]] += 1

        print(f"\n   Mood distribution:")
        emojis = {1: "😢", 2: "😕", 3: "😐", 4: "🙂", 5: "😄"}
        for level, count in mood_counts.items():
            bar = "█" * (count // 2)
            print(f"   {emojis[level]} ({level}): {count:3d} {bar}")

        dates = sorted(set(e["created_at"].date() for e in entries_data))
        print(f"\n   Days with entries: {len(dates)} / 90")
        notes_count = sum(1 for e in entries_data if e["note"])
        print(f"   Entries with notes: {notes_count} / {len(entries_data)}")

        # 5. Award earned badges
        earned_badges = determine_earned_badges(entries_data, user_id)

        for badge_data in earned_badges:
            badge_result = await db.execute(
                select(Badge).where(Badge.name == badge_data["badge_name"])
            )
            badge = badge_result.scalar_one_or_none()
            if badge:
                user_badge = UserBadge(
                    id=uuid4(),
                    user_id=user.user_id,
                    badge_id=badge.badge_id,
                    earned_at=badge_data["earned_at"],
                )
                db.add(user_badge)

        await db.commit()

        print(f"\n🏆 Badges earned: {len(earned_badges)}")
        for b in earned_badges:
            print(f"   • {b['badge_name']} (earned {b['earned_at'].strftime('%b %d')})")

        print(f"\n✅ Seed complete! Login as {TEST_USER_EMAIL} to see the data.")


# ============================================================
# Entry point
# ============================================================

if __name__ == "__main__":
    asyncio.run(seed_mood_data())
