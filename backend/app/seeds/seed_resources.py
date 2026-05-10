from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.resource import Resource, UserResource
from app.models.user import User


TEST_USER_EMAIL = "tekleyohannes101@gmail.com"


RESOURCES = [
    # --- ARTICLES (6) ---
    {
        "title": "Understanding Anxiety: What It Is and How to Cope",
        "title_am": "ጭንቀትን መረዳት፡ ምንድን ነው እና እንዴት መቋቋም ይቻላል",
        "description": "A comprehensive guide to understanding anxiety disorders, their symptoms, and practical coping strategies you can start using today.",
        "description_am": "የጭንቀት ችግሮችን፣ ምልክቶቻቸውን እና ዛሬ መጠቀም የሚጀምሩ ተግባራዊ የመቋቋም ስልቶችን ለመረዳት አጠቃላይ መመሪያ።",
        "resource_type": "article",
        "url": "https://www.helpguide.org/mental-health/anxiety/anxiety-disorders-and-anxiety-attacks",
        "thumbnail_url": "https://www.helpguide.org/wp-content/uploads/2023/02/Anxiety-Disorders-and-Anxiety-Attacks-760x428.jpeg",
        "category": "anxiety",
        "duration": "12 min read",
    },
    {
        "title": "Depression: Recognizing the Signs and Finding Help",
        "title_am": "ድብርት፡ ምልክቶችን መለየት እና እርዳታ ማግኘት",
        "description": "Learn to recognize the signs of depression, understand the difference between sadness and clinical depression, and discover paths to recovery.",
        "description_am": "የድብርት ምልክቶችን ለመለየት፣ በሀዘንና በክሊኒካዊ ድብርት መካከል ያለውን ልዩነት ለመረዳት እና ወደ ማገገም መንገዶችን ያግኙ።",
        "resource_type": "article",
        "url": "https://www.helpguide.org/mental-health/depression/depression-symptoms-and-warning-signs",
        "thumbnail_url": "https://www.helpguide.org/wp-content/uploads/2023/02/Depression-Symptoms-and-Warning-Signs-760x428.jpeg",
        "category": "depression",
        "duration": "10 min read",
    },
    {
        "title": "Stress Management: Techniques That Actually Work",
        "title_am": "የጭንቀት አያያዝ፡ በእርግጥ የሚሠሩ ዘዴዎች",
        "description": "Evidence-based stress management techniques including time management, relaxation exercises, and lifestyle changes for lasting relief.",
        "description_am": "በማስረጃ ላይ የተመሰረቱ የጭንቀት አያያዝ ዘዴዎች ጊዜ አያያዝን፣ የመዝናኛ ልምምዶችን እና ለዘላቂ እፎይታ የአኗኗር ዘይቤ ለውጦችን ይጨምራል።",
        "resource_type": "article",
        "url": "https://www.helpguide.org/mental-health/stress/stress-management",
        "thumbnail_url": "https://www.helpguide.org/wp-content/uploads/2023/02/Stress-Management-760x428.jpeg",
        "category": "stress",
        "duration": "15 min read",
    },
    {
        "title": "Building Self-Esteem: A Practical Guide",
        "title_am": "ለራስ ክብር መገንባት፡ ተግባራዊ መመሪያ",
        "description": "Practical steps to build healthy self-esteem, overcome negative self-talk, and develop a more compassionate relationship with yourself.",
        "description_am": "ጤናማ ለራስ ክብር ለመገንባት፣ አሉታዊ ለራስ ንግግርን ለማሸነፍ እና ከራስዎ ጋር የበለጠ ርህራሄ ያለው ግንኙነት ለማዳበር ተግባራዊ እርምጃዎች።",
        "resource_type": "article",
        "url": "https://www.mind.org.uk/information-support/types-of-mental-health-problems/self-esteem/tips-to-improve-your-self-esteem/",
        "thumbnail_url": None,
        "category": "self_esteem",
        "duration": "8 min read",
    },
    {
        "title": "Sleep Hygiene: Your Guide to Better Sleep",
        "title_am": "የእንቅልፍ ንጽህና፡ ለተሻለ እንቅልፍ መመሪያዎ",
        "description": "Improve your sleep quality with proven sleep hygiene practices, bedtime routines, and tips for managing insomnia naturally.",
        "description_am": "በተረጋገጡ የእንቅልፍ ንጽህና ልምዶች፣ የመኝታ ጊዜ ልምዶች እና የእንቅልፍ ማጣትን በተፈጥሮ ለመቆጣጠር ምክሮች የእንቅልፍ ጥራትዎን ያሻሽሉ።",
        "resource_type": "article",
        "url": "https://www.sleepfoundation.org/sleep-hygiene",
        "thumbnail_url": None,
        "category": "sleep",
        "duration": "10 min read",
    },
    {
        "title": "The 5-4-3-2-1 Grounding Technique Explained",
        "title_am": "የ5-4-3-2-1 የመረጋጋት ዘዴ ማብራሪያ",
        "description": "A step-by-step guide to the 5-4-3-2-1 grounding technique — a simple but powerful tool for managing anxiety and panic attacks in the moment.",
        "description_am": "ለ5-4-3-2-1 የመረጋጋት ዘዴ ደረጃ በደረጃ መመሪያ — ጭንቀትን እና የድንጋጤ ጥቃቶችን ለመቆጣጠር ቀላል ግን ኃይለኛ መሣሪያ።",
        "resource_type": "article",
        "url": "https://www.choosingtherapy.com/5-4-3-2-1-coping-technique/",
        "thumbnail_url": None,
        "category": "anxiety",
        "duration": "5 min read",
    },
    # --- VIDEOS (7) ---
    {
        "title": "How to Cope with Anxiety",
        "title_am": "ጭንቀትን እንዴት መቋቋም ይቻላል",
        "description": "Therapist Kati Morton explains practical strategies for coping with anxiety in daily life, including grounding techniques and thought challenging.",
        "description_am": "ቴራፒስት ካቲ ሞርተን የመረጋጋት ቴክኒኮችን እና የአስተሳሰብ ፈተናን ጨምሮ በዕለት ተዕለት ሕይወት ውስጥ ጭንቀትን ለመቋቋም ተግባራዊ ስልቶችን ያብራራሉ።",
        "resource_type": "video",
        "url": "https://www.youtube.com/embed/WWloIAQpMcQ",
        "thumbnail_url": "https://img.youtube.com/vi/WWloIAQpMcQ/maxresdefault.jpg",
        "category": "anxiety",
        "duration": "11:42",
    },
    {
        "title": "10-Minute Guided Meditation for Beginners",
        "title_am": "ለጀማሪዎች 10 ደቂቃ የሚመራ ማሰላሰል",
        "description": "A gentle 10-minute guided meditation perfect for beginners. Focus on breathing, body awareness, and finding calm in the present moment.",
        "description_am": "ለጀማሪዎች ፍጹም የሆነ ለስለስ ያለ 10 ደቂቃ የሚመራ ማሰላሰል። በመተንፈስ፣ በሰውነት ግንዛቤ እና በአሁኑ ጊዜ መረጋጋት ማግኘት ላይ ያተኩሩ።",
        "resource_type": "video",
        "url": "https://www.youtube.com/embed/U9YKY7fdwyg",
        "thumbnail_url": "https://img.youtube.com/vi/U9YKY7fdwyg/maxresdefault.jpg",
        "category": "mindfulness",
        "duration": "10:13",
    },
    {
        "title": "Understanding Depression — What You Need to Know",
        "title_am": "ድብርትን መረዳት — ማወቅ ያለብዎት",
        "description": "A clear and compassionate explanation of what depression is, what causes it, and what treatments and self-help strategies are available.",
        "description_am": "ድብርት ምን እንደሆነ፣ ምን እንደሚያመጣው እና ምን ዓይነት ሕክምናዎች እና የራስ-እርዳታ ስልቶች እንደሚገኙ ግልጽ እና ርህራሄ ያለው ማብራሪያ።",
        "resource_type": "video",
        "url": "https://www.youtube.com/embed/z-IR48Mb3W0",
        "thumbnail_url": "https://img.youtube.com/vi/z-IR48Mb3W0/maxresdefault.jpg",
        "category": "depression",
        "duration": "5:47",
    },
    {
        "title": "Box Breathing Technique — Navy SEAL Stress Relief",
        "title_am": "የሳጥን መተንፈስ ዘዴ — የባህር ኃይል ሲል የጭንቀት ማስታገሻ",
        "description": "Learn the box breathing technique used by Navy SEALs to stay calm under pressure. A 4-4-4-4 breathing pattern for instant stress relief.",
        "description_am": "በግፊት ውስጥ ረጋ ለማለት የባህር ኃይል ሲሎች የሚጠቀሙትን የሳጥን መተንፈስ ዘዴ ይማሩ። ለፈጣን ጭንቀት ማስታገሻ 4-4-4-4 የመተንፈስ ዘይቤ።",
        "resource_type": "video",
        "url": "https://www.youtube.com/embed/tEmt1Znux58",
        "thumbnail_url": "https://img.youtube.com/vi/tEmt1Znux58/maxresdefault.jpg",
        "category": "stress",
        "duration": "5:31",
    },
    {
        "title": "Cognitive Behavioral Therapy (CBT) Explained Simply",
        "title_am": "የግንዛቤ ባህሪ ቴራፒ (CBT) በቀላሉ ተብራርቷል",
        "description": "A friendly explanation of what CBT is and how it works, with examples of common cognitive distortions and how to challenge them.",
        "description_am": "CBT ምን እንደሆነ እና እንዴት እንደሚሠራ ተግባቢ ማብራሪያ፣ ከተለመዱ የግንዛቤ ማዛባቶች ምሳሌዎች ጋር እና እንዴት ለመፈታተን እንደሚቻል።",
        "resource_type": "video",
        "url": "https://www.youtube.com/embed/9c_Bv_FBE-c",
        "thumbnail_url": "https://img.youtube.com/vi/9c_Bv_FBE-c/maxresdefault.jpg",
        "category": "anxiety",
        "duration": "6:04",
    },
    {
        "title": "How to Stop Overthinking Everything",
        "title_am": "ሁሉንም ነገር ከመጠን በላይ ማሰብ እንዴት ማቆም ይቻላል",
        "description": "Practical tips for breaking the cycle of overthinking, rumination, and worry — from a licensed therapist.",
        "description_am": "ከመጠን በላይ ማሰብን፣ ማሰላሰልን እና ጭንቀትን ዑደት ለማፍረስ ተግባራዊ ምክሮች — ከፈቃድ ያለው ቴራፒስት።",
        "resource_type": "video",
        "url": "https://www.youtube.com/embed/4GN0N2HSOYM",
        "thumbnail_url": "https://img.youtube.com/vi/4GN0N2HSOYM/maxresdefault.jpg",
        "category": "stress",
        "duration": "12:07",
    },
    {
        "title": "Body Scan Meditation for Stress Relief",
        "title_am": "ለጭንቀት ማስታገሻ የሰውነት ቅኝት ማሰላሰል",
        "description": "A calming 15-minute body scan meditation that helps you release tension, connect with your body, and find deep relaxation.",
        "description_am": "ውጥረትን ለመልቀቅ፣ ከሰውነትዎ ጋር ለመገናኘት እና ጥልቅ መዝናናት ለማግኘት የሚረዳ የ15 ደቂቃ የሰውነት ቅኝት ማሰላሰል።",
        "resource_type": "video",
        "url": "https://www.youtube.com/embed/QS2yDmWk0vs",
        "thumbnail_url": "https://img.youtube.com/vi/QS2yDmWk0vs/maxresdefault.jpg",
        "category": "mindfulness",
        "duration": "15:22",
    },
    # --- AUDIO GUIDES (5) ---
    {
        "title": "Progressive Muscle Relaxation — Guided Audio",
        "title_am": "ተራማጅ የጡንቻ መዝናናት — የሚመራ ድምጽ",
        "description": "A guided progressive muscle relaxation exercise that systematically tenses and releases muscle groups to relieve physical tension from stress.",
        "description_am": "ከጭንቀት የሚመጣውን አካላዊ ውጥረት ለማስታገስ የጡንቻ ቡድኖችን በስርዓት የሚያወጥር እና የሚለቅ የሚመራ ተራማጅ የጡንቻ መዝናናት ልምምድ።",
        "resource_type": "audio",
        "url": "https://www.youtube.com/embed/1nZEdqcGVzo",
        "thumbnail_url": "https://img.youtube.com/vi/1nZEdqcGVzo/maxresdefault.jpg",
        "category": "stress",
        "duration": "12:00",
    },
    {
        "title": "Guided Sleep Meditation — Fall Asleep in Minutes",
        "title_am": "የሚመራ የእንቅልፍ ማሰላሰል — በደቂቃዎች ውስጥ ይተኛሉ",
        "description": "A soothing guided meditation designed to help you fall asleep quickly. Combines deep breathing, visualization, and progressive relaxation.",
        "description_am": "በፍጥነት እንዲተኙ ለመርዳት የተዘጋጀ የሚያረጋጋ የሚመራ ማሰላሰል። ጥልቅ መተንፈስን፣ ምስላዊን እና ተራማጅ መዝናናትን ያጣምራል።",
        "resource_type": "audio",
        "url": "https://www.youtube.com/embed/aEqlQvczMJQ",
        "thumbnail_url": "https://img.youtube.com/vi/aEqlQvczMJQ/maxresdefault.jpg",
        "category": "sleep",
        "duration": "20:00",
    },
    {
        "title": "Morning Mindfulness — Start Your Day with Calm",
        "title_am": "የጠዋት ማሰላሰል — ቀንዎን በእርጋታ ይጀምሩ",
        "description": "A gentle 5-minute morning mindfulness practice to set a positive, calm tone for your day. Perfect for beginners.",
        "description_am": "ለቀንዎ አዎንታዊ፣ የተረጋጋ ድምጽ ለማዘጋጀት ለስለስ ያለ 5 ደቂቃ የጠዋት ማሰላሰል ልምምድ። ለጀማሪዎች ፍጹም።",
        "resource_type": "audio",
        "url": "https://www.youtube.com/embed/inpok4MKVLM",
        "thumbnail_url": "https://img.youtube.com/vi/inpok4MKVLM/maxresdefault.jpg",
        "category": "mindfulness",
        "duration": "5:22",
    },
    {
        "title": "Self-Compassion Meditation",
        "title_am": "ለራስ ርህራሄ ማሰላሰል",
        "description": "A loving-kindness meditation focused on developing self-compassion. Learn to treat yourself with the same kindness you'd give a friend.",
        "description_am": "ለራስ ርህራሄ ማዳበር ላይ ያተኮረ ደግነት-ሞገስ ማሰላሰል። ለጓደኛ የሚሰጡትን ተመሳሳይ ደግነት ለራስዎ ለመስጠት ይማሩ።",
        "resource_type": "audio",
        "url": "https://www.youtube.com/embed/sz7cpV7ERsM",
        "thumbnail_url": "https://img.youtube.com/vi/sz7cpV7ERsM/maxresdefault.jpg",
        "category": "self_esteem",
        "duration": "10:45",
    },
    {
        "title": "Breathing Exercise for Anxiety — 4-7-8 Technique",
        "title_am": "ለጭንቀት የመተንፈስ ልምምድ — 4-7-8 ዘዴ",
        "description": "Follow along with this guided 4-7-8 breathing exercise. Inhale for 4 seconds, hold for 7, exhale for 8. Proven to reduce anxiety fast.",
        "description_am": "ይህን የሚመራ 4-7-8 የመተንፈስ ልምምድ ይከተሉ። ለ4 ሰከንድ ይተንፍሱ፣ ለ7 ይያዙ፣ ለ8 ይተንፍሱ። ጭንቀትን በፍጥነት ለመቀነስ የተረጋገጠ።",
        "resource_type": "audio",
        "url": "https://www.youtube.com/embed/YRPh_GaiL8s",
        "thumbnail_url": "https://img.youtube.com/vi/YRPh_GaiL8s/maxresdefault.jpg",
        "category": "anxiety",
        "duration": "7:15",
    },
]


# Test-user view/favorite seeding: 8 viewed (by title), 3 favorited.
# These are a subset of the 8 viewed.
TEST_USER_VIEWED_TITLES = [
    "The 5-4-3-2-1 Grounding Technique Explained",
    "Box Breathing Technique — Navy SEAL Stress Relief",
    "10-Minute Guided Meditation for Beginners",
    "How to Cope with Anxiety",
    "Sleep Hygiene: Your Guide to Better Sleep",
    "Stress Management: Techniques That Actually Work",
    "Breathing Exercise for Anxiety — 4-7-8 Technique",
    "Cognitive Behavioral Therapy (CBT) Explained Simply",
]

TEST_USER_FAVORITE_TITLES = {
    "The 5-4-3-2-1 Grounding Technique Explained",
    "Box Breathing Technique — Navy SEAL Stress Relief",
    "Breathing Exercise for Anxiety — 4-7-8 Technique",
}


async def seed_resources(db: AsyncSession) -> None:
    """Insert the resource catalog (idempotent by title) and seed view/favorite
    records for the test user if they exist and have no UserResource rows yet."""

    # 1. Catalog — insert any resources missing by title.
    for data in RESOURCES:
        result = await db.execute(select(Resource).where(Resource.title == data["title"]))
        if result.scalar_one_or_none() is None:
            db.add(Resource(**data))
    await db.commit()

    # 2. Test-user view/favorite seed.
    user_result = await db.execute(select(User).where(User.email == TEST_USER_EMAIL))
    user = user_result.scalar_one_or_none()
    if user is None:
        return

    existing = await db.execute(
        select(UserResource).where(UserResource.user_id == user.user_id).limit(1)
    )
    if existing.scalar_one_or_none() is not None:
        return

    titles_to_load = list(set(TEST_USER_VIEWED_TITLES) | TEST_USER_FAVORITE_TITLES)
    rows = await db.execute(select(Resource).where(Resource.title.in_(titles_to_load)))
    by_title = {r.title: r for r in rows.scalars().all()}

    for title in TEST_USER_VIEWED_TITLES:
        resource = by_title.get(title)
        if resource is None:
            continue
        db.add(
            UserResource(
                user_id=user.user_id,
                resource_id=resource.resource_id,
                is_favorite=title in TEST_USER_FAVORITE_TITLES,
            )
        )
    await db.commit()
