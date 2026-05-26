from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.badge import Badge

DEFAULT_BADGES = [
    {
        "name": "First Step",
        "name_am": "የመጀመሪያ እርምጃ",
        "description": "Complete your first mood entry",
        "description_am": "የመጀመሪያ የስሜት ማስታወሻዎን ያጠናቅቁ",
        "icon": "🌱",
        "criteria_type": "mood_count",
        "criteria_value": 1,
    },
    {
        "name": "7-Day Streak",
        "name_am": "የ7 ቀን ተከታታይ",
        "description": "Log your mood for 7 consecutive days",
        "description_am": "ለ7 ተከታታይ ቀናት ስሜትዎን ይመዝግቡ",
        "icon": "🔥",
        "criteria_type": "mood_streak",
        "criteria_value": 7,
    },
    {
        "name": "30-Day Streak",
        "name_am": "የ30 ቀን ተከታታይ",
        "description": "Log your mood for 30 consecutive days",
        "description_am": "ለ30 ተከታታይ ቀናት ስሜትዎን ይመዝግቡ",
        "icon": "⭐",
        "criteria_type": "mood_streak",
        "criteria_value": 30,
    },
    {
        "name": "Consistent",
        "name_am": "ቋሚ",
        "description": "Log your mood 50 times",
        "description_am": "ስሜትዎን 50 ጊዜ ይመዝግቡ",
        "icon": "💪",
        "criteria_type": "mood_count",
        "criteria_value": 50,
    },
    {
        "name": "5 Sessions",
        "name_am": "5 ውይይቶች",
        "description": "Complete 5 chat sessions",
        "description_am": "5 የውይይት ክፍለ ጊዜዎችን ያጠናቅቁ",
        "icon": "💬",
        "criteria_type": "chat_count",
        "criteria_value": 5,
    },
    {
        "name": "10 Sessions",
        "name_am": "10 ውይይቶች",
        "description": "Complete 10 chat sessions",
        "description_am": "10 የውይይት ክፍለ ጊዜዎችን ያጠናቅቁ",
        "icon": "🏆",
        "criteria_type": "chat_count",
        "criteria_value": 10,
    },
    {
        "name": "Self-Aware",
        "name_am": "ራስን ማወቅ",
        "description": "Complete your first self-assessment",
        "description_am": "የመጀመሪያ ራስን መገምገሚያዎን ያጠናቅቁ",
        "icon": "🧠",
        "criteria_type": "assessment",
        "criteria_value": 1,
    },
    {
        "name": "Resource Explorer",
        "name_am": "የግብዓት አሳሽ",
        "description": "View 5 resources from the library",
        "description_am": "ከቤተ-መጻሕፍት 5 ግብዓቶችን ይመልከቱ",
        "icon": "📚",
        "criteria_type": "resource_view",
        "criteria_value": 5,
    },
]


async def seed_badges(db: AsyncSession) -> None:
    for data in DEFAULT_BADGES:
        result = await db.execute(select(Badge).where(Badge.name == data["name"]))
        if result.scalar_one_or_none() is None:
            db.add(Badge(**data))
    await db.commit()


if __name__ == "__main__":
    import asyncio
    from app.database import async_session_maker

    async def _main():
        async with async_session_maker() as db:
            await seed_badges(db)

    asyncio.run(_main())
