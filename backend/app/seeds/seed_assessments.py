import random
from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.assessment import Assessment, UserAssessment
from app.models.user import User


TEST_USER_EMAIL = "tekleyohannes101@gmail.com"


ASSESSMENTS = [
    {
        "name": "Anxiety Assessment",
        "name_am": "የጭንቀት ግምገማ",
        "description": "Based on the GAD-7 scale. A quick screening tool for generalized anxiety disorder. Answer based on how you've felt over the last 2 weeks.",
        "description_am": "በ GAD-7 ልኬት ላይ የተመሰረተ። ላለፉት 2 ሳምንታት እንዴት እንደተሰማዎት በመመስረት ይመልሱ።",
        "assessment_type": "anxiety",
        "icon": "😰",
        "estimated_time": "2-3 minutes",
        "questions": [
            {"id": 1, "text": "Feeling nervous, anxious, or on edge", "text_am": "መረበሽ፣ መጨነቅ ወይም መወጠር ይሰማዎታል"},
            {"id": 2, "text": "Not being able to stop or control worrying", "text_am": "መጨነቅን ማቆም ወይም መቆጣጠር አለመቻል"},
            {"id": 3, "text": "Worrying too much about different things", "text_am": "ስለ ልዩ ልዩ ነገሮች ከመጠን በላይ መጨነቅ"},
            {"id": 4, "text": "Trouble relaxing", "text_am": "ለመዝናናት መቸገር"},
            {"id": 5, "text": "Being so restless that it's hard to sit still", "text_am": "ዝም ብሎ መቀመጥ እስኪያስቸግር ድረስ መቅበጥበጥ"},
            {"id": 6, "text": "Becoming easily annoyed or irritable", "text_am": "በቀላሉ መናደድ ወይም መበሳጨት"},
            {"id": 7, "text": "Feeling afraid, as if something awful might happen", "text_am": "መጥፎ ነገር ሊከሰት እንደሚችል መፍራት"},
        ],
        "scoring_logic": {
            "options": [
                {"value": 0, "label": "Not at all", "label_am": "በጭራሽ"},
                {"value": 1, "label": "Several days", "label_am": "ለብዙ ቀናት"},
                {"value": 2, "label": "More than half the days", "label_am": "ከግማሽ ቀናት በላይ"},
                {"value": 3, "label": "Nearly every day", "label_am": "ከሞላ ጎደል በየቀኑ"},
            ],
            "max_score": 21,
            "ranges": [
                {
                    "min": 0, "max": 4,
                    "level": "minimal",
                    "label": "Minimal Anxiety",
                    "label_am": "አነስተኛ ጭንቀት",
                    "feedback": "Your responses suggest minimal anxiety. This is a positive sign! Continue maintaining your well-being with regular self-care practices.",
                    "feedback_am": "ምላሾችዎ አነስተኛ ጭንቀት ያሳያሉ። ይህ አዎንታዊ ምልክት ነው! በመደበኛ ራስን መንከባከብ ልምዶች ደህንነትዎን ማስቀጠል ይቀጥሉ።",
                    "color": "#22C55E",
                    "recommended_avatar": "sage",
                },
                {
                    "min": 5, "max": 9,
                    "level": "mild",
                    "label": "Mild Anxiety",
                    "label_am": "ቀላል ጭንቀት",
                    "feedback": "Your responses suggest mild anxiety. This is common and manageable. Consider trying relaxation techniques, mindfulness, or talking about your concerns.",
                    "feedback_am": "ምላሾችዎ ቀላል ጭንቀት ያሳያሉ። ይህ የተለመደ እና ሊቆጣጠሩት የሚችሉት ነው። የመዝናናት ዘዴዎችን፣ ማሰላሰልን ወይም ስለ ጭንቀቶችዎ ማውራት ያስቡ።",
                    "color": "#EAB308",
                    "recommended_avatar": "sage",
                },
                {
                    "min": 10, "max": 14,
                    "level": "moderate",
                    "label": "Moderate Anxiety",
                    "label_am": "መካከለኛ ጭንቀት",
                    "feedback": "Your responses suggest moderate anxiety. It might be helpful to explore coping strategies more actively. Consider speaking with our CBT Guide or a mental health professional.",
                    "feedback_am": "ምላሾችዎ መካከለኛ ጭንቀት ያሳያሉ። የመቋቋም ስልቶችን በንቃት ማሰስ ጠቃሚ ሊሆን ይችላል። ከ CBT መመሪያችን ወይም ከአእምሮ ጤና ባለሙያ ጋር ማውራት ያስቡ።",
                    "color": "#F97316",
                    "recommended_avatar": "dr_chen",
                },
                {
                    "min": 15, "max": 21,
                    "level": "severe",
                    "label": "Severe Anxiety",
                    "label_am": "ከባድ ጭንቀት",
                    "feedback": "Your responses suggest severe anxiety. We strongly encourage you to reach out to a mental health professional. In the meantime, our AI companions are here to support you, and please don't hesitate to use crisis resources if needed.",
                    "feedback_am": "ምላሾችዎ ከባድ ጭንቀት ያሳያሉ። የአእምሮ ጤና ባለሙያን እንዲያገኙ በጥብቅ እናበረታታለን። በዚህ መሃል፣ የ AI ጓደኞቻችን ለመደገፍ እዚህ ናቸው።",
                    "color": "#EF4444",
                    "recommended_avatar": "kira",
                },
            ],
        },
    },
    {
        "name": "Depression Screening",
        "name_am": "የድብርት ምርመራ",
        "description": "Based on the PHQ-9 scale. A widely-used screening tool for depression. Answer based on how you've felt over the last 2 weeks.",
        "description_am": "በ PHQ-9 ልኬት ላይ የተመሰረተ። ላለፉት 2 ሳምንታት እንዴት እንደተሰማዎት በመመስረት ይመልሱ።",
        "assessment_type": "depression",
        "icon": "😔",
        "estimated_time": "3-4 minutes",
        "questions": [
            {"id": 1, "text": "Little interest or pleasure in doing things", "text_am": "ነገሮችን ለማድረግ ትንሽ ፍላጎት ወይም ደስታ"},
            {"id": 2, "text": "Feeling down, depressed, or hopeless", "text_am": "ማዘን፣ ድብርት ወይም ተስፋ መቁረጥ"},
            {"id": 3, "text": "Trouble falling or staying asleep, or sleeping too much", "text_am": "ለመተኛት ወይም ለመቆየት መቸገር፣ ወይም ከመጠን በላይ መተኛት"},
            {"id": 4, "text": "Feeling tired or having little energy", "text_am": "ድካም ወይም ትንሽ ጉልበት ማግኘት"},
            {"id": 5, "text": "Poor appetite or overeating", "text_am": "ደካማ የምግብ ፍላጎት ወይም ከመጠን በላይ መብላት"},
            {"id": 6, "text": "Feeling bad about yourself — or that you are a failure or have let yourself or your family down", "text_am": "ስለ ራስዎ መጥፎ ስሜት — ወይም ውድቀት እንደሆኑ ወይም ራስዎን ወይም ቤተሰብዎን እንዳሳዘኑ"},
            {"id": 7, "text": "Trouble concentrating on things, such as reading or watching TV", "text_am": "ማንበብ ወይም ቴሌቪዥን ማየት ባሉ ነገሮች ላይ ማተኮር መቸገር"},
            {"id": 8, "text": "Moving or speaking so slowly that other people could have noticed — or the opposite, being fidgety or restless", "text_am": "ሌሎች ሰዎች እስከሚያስተውሉ ድረስ ቀስ ብሎ መንቀሳቀስ ወይም መናገር — ወይም በተቃራኒው መቅበጥበጥ"},
            {"id": 9, "text": "Thoughts that you would be better off dead, or thoughts of hurting yourself in some way", "text_am": "ብሞቱ ይሻላል ብለው ማሰብ፣ ወይም ራስዎን በሆነ መንገድ ለመጉዳት ማሰብ"},
        ],
        "scoring_logic": {
            "options": [
                {"value": 0, "label": "Not at all", "label_am": "በጭራሽ"},
                {"value": 1, "label": "Several days", "label_am": "ለብዙ ቀናት"},
                {"value": 2, "label": "More than half the days", "label_am": "ከግማሽ ቀናት በላይ"},
                {"value": 3, "label": "Nearly every day", "label_am": "ከሞላ ጎደል በየቀኑ"},
            ],
            "max_score": 27,
            "ranges": [
                {
                    "min": 0, "max": 4,
                    "level": "minimal",
                    "label": "Minimal Depression",
                    "label_am": "አነስተኛ ድብርት",
                    "feedback": "Your responses suggest minimal depression. Keep taking care of yourself and maintaining healthy habits.",
                    "feedback_am": "ምላሾችዎ አነስተኛ ድብርት ያሳያሉ። ራስዎን መንከባከብ እና ጤናማ ልምዶችን ማስቀጠል ይቀጥሉ።",
                    "color": "#22C55E",
                    "recommended_avatar": "marcus",
                },
                {
                    "min": 5, "max": 9,
                    "level": "mild",
                    "label": "Mild Depression",
                    "label_am": "ቀላል ድብርት",
                    "feedback": "Your responses suggest mild depression. Staying active, connecting with others, and practicing self-care can help. Consider talking to our Motivational Coach.",
                    "feedback_am": "ምላሾችዎ ቀላል ድብርት ያሳያሉ። ንቁ መሆን፣ ከሌሎች ጋር መገናኘት እና ራስን መንከባከብ ሊረዳ ይችላል።",
                    "color": "#EAB308",
                    "recommended_avatar": "marcus",
                },
                {
                    "min": 10, "max": 14,
                    "level": "moderate",
                    "label": "Moderate Depression",
                    "label_am": "መካከለኛ ድብርት",
                    "feedback": "Your responses suggest moderate depression. We recommend exploring support options, including talking with a mental health professional. Our Empathetic Listener is here for you.",
                    "feedback_am": "ምላሾችዎ መካከለኛ ድብርት ያሳያሉ። ከአእምሮ ጤና ባለሙያ ጋር ማውራትን ጨምሮ የድጋፍ አማራጮችን እንዲያሰሱ እንመክራለን።",
                    "color": "#F97316",
                    "recommended_avatar": "kira",
                },
                {
                    "min": 15, "max": 19,
                    "level": "moderately_severe",
                    "label": "Moderately Severe Depression",
                    "label_am": "መካከለኛ-ከባድ ድብርት",
                    "feedback": "Your responses suggest moderately severe depression. We strongly encourage you to speak with a mental health professional. You deserve support, and help is available.",
                    "feedback_am": "ምላሾችዎ መካከለኛ-ከባድ ድብርት ያሳያሉ። ከአእምሮ ጤና ባለሙያ ጋር እንዲነጋገሩ በጥብቅ እናበረታታለን።",
                    "color": "#EF4444",
                    "recommended_avatar": "kira",
                },
                {
                    "min": 20, "max": 27,
                    "level": "severe",
                    "label": "Severe Depression",
                    "label_am": "ከባድ ድብርት",
                    "feedback": "Your responses suggest severe depression. Please reach out to a mental health professional as soon as possible. You are not alone, and effective treatments are available. If you're in crisis, please use the emergency resources below.",
                    "feedback_am": "ምላሾችዎ ከባድ ድብርት ያሳያሉ። እባክዎ በተቻለ ፍጥነት የአእምሮ ጤና ባለሙያን ያግኙ። ብቻዎን አይደሉም፣ ውጤታማ ሕክምናዎች አሉ።",
                    "color": "#DC2626",
                    "recommended_avatar": "kira",
                },
            ],
            "crisis_question_id": 9,
            "crisis_threshold": 1,
        },
    },
    {
        "name": "Stress Level Check",
        "name_am": "የጫና ደረጃ ምርመራ",
        "description": "A quick assessment to understand your current stress levels. Based on the Perceived Stress Scale (PSS). Answer based on the last month.",
        "description_am": "የአሁኑን የጫና ደረጃዎ ለመረዳት ፈጣን ግምገማ። ባለፈው ወር ላይ ተመስርተው ይመልሱ።",
        "assessment_type": "stress",
        "icon": "😤",
        "estimated_time": "2-3 minutes",
        "questions": [
            {"id": 1, "text": "Been upset because of something that happened unexpectedly", "text_am": "ባልተጠበቀ ነገር ምክንያት መበሳጨት"},
            {"id": 2, "text": "Felt that you were unable to control the important things in your life", "text_am": "በሕይወትዎ ውስጥ ያሉ አስፈላጊ ነገሮችን መቆጣጠር እንዳልቻሉ መሰማት"},
            {"id": 3, "text": "Felt nervous and stressed", "text_am": "መረበሽ እና ጫና መሰማት"},
            {"id": 4, "text": "Felt that you could not cope with all the things you had to do", "text_am": "ማድረግ ያለብዎትን ሁሉንም ነገሮች መቋቋም እንደማይችሉ መሰማት"},
            {"id": 5, "text": "Found that you could not cope with all the things that you had to do", "text_am": "በሕይወትዎ ውስጥ ያሉ ብስጭቶችን መቆጣጠር እንዳልቻሉ ማግኘት"},
            {"id": 6, "text": "Felt difficulties were piling up so high that you could not overcome them", "text_am": "ችግሮች ሊያሸንፏቸው እስኪያቅቶት ድረስ እየተከማቹ እንደሆነ መሰማት"},
            {"id": 7, "text": "Been angered because of things that were outside of your control", "text_am": "ከቁጥጥርዎ ውጭ በሆኑ ነገሮች ምክንያት መናደድ"},
        ],
        "scoring_logic": {
            "options": [
                {"value": 0, "label": "Never", "label_am": "በጭራሽ"},
                {"value": 1, "label": "Almost never", "label_am": "ከሞላ ጎደል በጭራሽ"},
                {"value": 2, "label": "Sometimes", "label_am": "አንዳንድ ጊዜ"},
                {"value": 3, "label": "Fairly often", "label_am": "በመጠኑ ብዙ ጊዜ"},
                {"value": 4, "label": "Very often", "label_am": "በጣም ብዙ ጊዜ"},
            ],
            "max_score": 28,
            "ranges": [
                {
                    "min": 0, "max": 7,
                    "level": "low",
                    "label": "Low Stress",
                    "label_am": "ዝቅተኛ ጫና",
                    "feedback": "Your stress levels appear to be low. You seem to be managing well! Keep up your healthy coping strategies.",
                    "feedback_am": "የጫና ደረጃዎ ዝቅተኛ ይመስላል። በጥሩ ሁኔታ እየተቆጣጠሩ ይመስላል! ጤናማ የመቋቋም ስልቶችዎን ይቀጥሉ።",
                    "color": "#22C55E",
                    "recommended_avatar": "sage",
                },
                {
                    "min": 8, "max": 14,
                    "level": "moderate",
                    "label": "Moderate Stress",
                    "label_am": "መካከለኛ ጫና",
                    "feedback": "You're experiencing moderate stress. This is common, especially during busy periods. Consider incorporating more relaxation techniques into your routine.",
                    "feedback_am": "መካከለኛ ጫና እያጋጠሞት ነው። ይህ የተለመደ ነው። ተጨማሪ የመዝናናት ዘዴዎችን በልምዱዎ ውስጥ ማካተት ያስቡ።",
                    "color": "#EAB308",
                    "recommended_avatar": "sage",
                },
                {
                    "min": 15, "max": 21,
                    "level": "high",
                    "label": "High Stress",
                    "label_am": "ከፍተኛ ጫና",
                    "feedback": "Your stress levels are high. It's important to prioritize stress management. Try our breathing exercises, talk to our Mindfulness Companion, or consider professional support.",
                    "feedback_am": "የጫና ደረጃዎ ከፍተኛ ነው። የጫና አያያዝን ቅድሚያ መስጠት አስፈላጊ ነው። የመተንፈስ ልምምዶቻችንን ይሞክሩ ወይም ባለሙያ ድጋፍ ያስቡ።",
                    "color": "#F97316",
                    "recommended_avatar": "dr_chen",
                },
                {
                    "min": 22, "max": 28,
                    "level": "very_high",
                    "label": "Very High Stress",
                    "label_am": "በጣም ከፍተኛ ጫና",
                    "feedback": "Your stress levels are very high. Please consider reaching out to a mental health professional. Chronic high stress can impact your physical and mental health. You deserve support.",
                    "feedback_am": "የጫና ደረጃዎ በጣም ከፍተኛ ነው። እባክዎ የአእምሮ ጤና ባለሙያን ለማግኘት ያስቡ። ሥር የሰደደ ከፍተኛ ጫና አካላዊ እና አእምሮ ጤናዎ ላይ ተጽዕኖ ሊያሳድር ይችላል።",
                    "color": "#EF4444",
                    "recommended_avatar": "kira",
                },
            ],
        },
    },
]


def _classify(score: int, scoring_logic: dict) -> dict:
    """Find the range entry matching this score."""
    for r in scoring_logic["ranges"]:
        if r["min"] <= score <= r["max"]:
            return r
    return scoring_logic["ranges"][-1]


def _build_responses_for_score(target_score: int, questions: list, max_per: int) -> list:
    """Distribute target_score across question responses, capped at max_per per question."""
    n = len(questions)
    base = min(target_score // n, max_per)
    remainder = target_score - base * n
    responses = []
    for i, q in enumerate(questions):
        value = base
        if remainder > 0 and value < max_per:
            bump = min(max_per - value, remainder)
            value += bump
            remainder -= bump
        responses.append({"question_id": q["id"], "value": value})
    return responses


# Test-user history: 6 entries spread over the last 60 days, varying scores per type.
# (assessment_type, days_ago, score) — scores chosen to span minimal/mild/moderate/severe.
TEST_USER_HISTORY: list[tuple[str, int, int]] = [
    ("anxiety", 55, 14),     # moderate
    ("depression", 47, 11),  # moderate
    ("stress", 38, 18),      # high
    ("anxiety", 25, 8),      # mild — improving
    ("depression", 14, 6),   # mild — improving
    ("stress", 4, 9),        # moderate — improving
]


async def seed_assessments(db: AsyncSession) -> None:
    """Insert the 3 assessments (idempotent by name) and seed user history if test
    user exists and hasn't taken any yet."""

    # 1. Catalog
    for data in ASSESSMENTS:
        result = await db.execute(select(Assessment).where(Assessment.name == data["name"]))
        if result.scalar_one_or_none() is None:
            db.add(Assessment(**data))
    await db.commit()

    # 2. Test-user history
    user_result = await db.execute(select(User).where(User.email == TEST_USER_EMAIL))
    user = user_result.scalar_one_or_none()
    if user is None:
        return

    existing = await db.execute(
        select(UserAssessment).where(UserAssessment.user_id == user.user_id).limit(1)
    )
    if existing.scalar_one_or_none() is not None:
        return

    by_type: dict[str, Assessment] = {}
    rows = await db.execute(select(Assessment))
    for a in rows.scalars().all():
        by_type[a.assessment_type] = a

    rng = random.Random(42)
    now = datetime.now(timezone.utc)

    for assessment_type, days_ago, score in TEST_USER_HISTORY:
        assessment = by_type.get(assessment_type)
        if assessment is None:
            continue
        scoring = assessment.scoring_logic
        max_per = max(opt["value"] for opt in scoring["options"])
        responses = _build_responses_for_score(score, assessment.questions, max_per)
        # Shuffle a bit so the responses look natural rather than uniform
        rng.shuffle(responses)
        actual_score = sum(r["value"] for r in responses)
        bucket = _classify(actual_score, scoring)
        completed_at = now - timedelta(days=days_ago, hours=rng.randint(0, 12))

        db.add(
            UserAssessment(
                user_id=user.user_id,
                assessment_id=assessment.assessment_id,
                responses=responses,
                score=actual_score,
                feedback_level=bucket["level"],
                feedback_text=bucket["feedback"],
                completed_at=completed_at,
            )
        )

    await db.commit()
