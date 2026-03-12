class CrisisDetector:
    CRISIS_KEYWORDS = [
        "suicide",
        "suicidal",
        "kill myself",
        "end my life",
        "self-harm",
        "self harm",
        "hurt myself",
        "cutting myself",
        "no reason to live",
        "want to die",
        "wanna die",
        "don't want to live",
        "better off dead",
        "end it all",
        "not worth living",
        "take my life",
    ]

    CRISIS_RESOURCES = {
        "ethiopia": [
            {"name": "Ethiopian Mental Health Support", "phone": "251-111-234-567"},
            {"name": "Emergency Services (Ethiopia)", "phone": "911"},
        ],
        "international": [
            {"name": "Crisis Text Line", "info": "Text HOME to 741741"},
            {
                "name": "International Association for Suicide Prevention",
                "url": "https://www.iasp.info/resources/Crisis_Centres/",
            },
        ],
    }

    def check_message(self, text: str) -> dict:
        """Check if message contains crisis keywords.
        Returns {"is_crisis": bool, "detected_keywords": list[str], "resources": dict}
        Case-insensitive. Check for substring matches.
        """
        if not text or not isinstance(text, str):
            return {
                "is_crisis": False,
                "detected_keywords": [],
                "resources": self.CRISIS_RESOURCES,
            }
        lower = text.lower()
        detected = [kw for kw in self.CRISIS_KEYWORDS if kw in lower]
        is_crisis = len(detected) > 0
        return {
            "is_crisis": is_crisis,
            "detected_keywords": detected,
            "resources": self.CRISIS_RESOURCES,
        }
