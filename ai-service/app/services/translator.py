import logging
import re

from google import genai
from google.genai import types

from app.config import get_settings

logger = logging.getLogger(__name__)

_MODEL_NAME = "gemini-3-flash-preview"

_PROMPT_EN_TO_AM = """\
You are a professional English to Amharic translator specializing in mental health and emotional support content.

TASK: Translate the following English text into natural, fluent Ethiopian Amharic (አማርኛ).

RULES:
- Write in warm, colloquial Amharic as spoken in everyday Ethiopian conversation — NOT formal or clinical register
- Use correct Amharic grammar, sentence structure, and word order
- Do NOT transliterate English words into Amharic script — actually translate the meaning
- For technical terms or proper nouns with no Amharic equivalent, keep them in English
- Preserve the emotional tone — this is a mental health support conversation, so warmth, empathy, and gentleness must come through
- Do NOT add any explanation, notes, commentary, or parenthetical English
- Return ONLY the Amharic translation, nothing else
- Do NOT wrap in quotes or add prefixes like "Translation:" or "አማርኛ:"

English text:
{text}

Amharic translation:
"""

_PROMPT_AM_TO_EN = """\
You are a professional Amharic to English translator specializing in mental health and emotional support content.

TASK: Translate the following Amharic (አማርኛ) text into natural, fluent English.

RULES:
- Produce natural, conversational English that captures the full meaning and emotional weight
- Preserve the emotional tone and intent — this person may be expressing feelings, distress, or asking for help
- Do NOT add any explanation, notes, or commentary
- Return ONLY the English translation, nothing else
- Do NOT wrap in quotes or add prefixes like "Translation:"

Amharic text:
{text}

English translation:
"""

_STRIP_PREFIXES = [
    "Translation:",
    "Amharic:",
    "አማርኛ:",
    "English:",
    "Here is the translation:",
]


def _strip_parenthetical_english(text: str) -> str:
    """Remove parenthetical segments that contain only Latin/ASCII."""
    if not text or not text.strip():
        return text

    def is_mostly_ascii(s: str) -> bool:
        if not s:
            return True
        ascii_count = sum(1 for c in s if ord(c) < 128)
        return ascii_count / len(s) >= 0.9

    def repl(m: re.Match) -> str:
        inner = m.group(1)
        return " " if is_mostly_ascii(inner) else m.group(0)

    result = re.sub(r"\s*\(([^)]*)\)\s*", repl, text)
    return re.sub(r"\s+", " ", result).strip()


def _is_ethiopic(c: str) -> bool:
    if not c:
        return False
    code = ord(c[0])
    return 0x1200 <= code <= 0x137F


def _strip_markdown(text: str) -> str:
    text = text.replace("**", "")
    text = text.replace("*", "")
    return text


def _clean_result(result: str) -> str:
    result = result.strip()
    if result.startswith('"') and result.endswith('"'):
        result = result[1:-1]
    if result.startswith("'") and result.endswith("'"):
        result = result[1:-1]
    for prefix in _STRIP_PREFIXES:
        if result.startswith(prefix):
            result = result[len(prefix):].strip()
    return result


class TranslationService:
    def __init__(self):
        settings = get_settings()
        if settings.GEMINI_API_KEY:
            self._client = genai.Client(api_key=settings.GEMINI_API_KEY)
        else:
            self._client = None

    def _contains_amharic(self, text: str) -> bool:
        return any('\u1200' <= char <= '\u137f' for char in text)

    def detect_language(self, text: str) -> str:
        if not (text or text.strip()):
            return "en"
        for c in text:
            if _is_ethiopic(c):
                return "am"
        return "en"

    async def _call_model(self, prompt: str) -> str | None:
        if not self._client:
            return None
        try:
            response = await self._client.aio.models.generate_content(
                model=_MODEL_NAME,
                contents=prompt,
                config=types.GenerateContentConfig(
                    temperature=0.1,
                    top_p=0.95,
                    max_output_tokens=2048,
                ),
            )
            if response and response.text:
                return response.text
        except Exception as e:
            logger.error(f"Gemini call failed: {e}")
        return None

    async def translate(self, text: str, source_lang: str, target_lang: str) -> str:
        if not text or not text.strip():
            return text
        if not self._client:
            return text

        clean_text = _strip_markdown(text)
        prompt = _PROMPT_EN_TO_AM.format(text=clean_text) if target_lang == "am" else _PROMPT_AM_TO_EN.format(text=clean_text)

        logger.info(f"Translating [{source_lang}→{target_lang}]: {clean_text[:100]}")

        try:
            raw = await self._call_model(prompt)
            if raw is None:
                return text

            result = _clean_result(raw)
            if target_lang == "am":
                result = _strip_parenthetical_english(result)

            if target_lang == "am" and not self._contains_amharic(result):
                logger.warning("Translation produced no Amharic — retrying once")
                raw2 = await self._call_model(prompt)
                if raw2 is not None:
                    result2 = _clean_result(raw2)
                    result2 = _strip_parenthetical_english(result2)
                    if self._contains_amharic(result2):
                        result = result2
                    else:
                        logger.error("Retry also produced no Amharic — falling back")
                        return f"{text} (translation unavailable)"
                else:
                    return f"{text} (translation unavailable)"

            logger.info(f"Result: {result[:100]}")
            return result

        except Exception as error:
            logger.error(f"Translation failed: {error}")
            return text

    async def translate_to_english(self, text: str) -> dict:
        lang = self.detect_language(text)
        if lang == "en":
            return {"original": text, "translated": text, "source_lang": "en", "was_translated": False}
        translated = await self.translate(text, "am", "en")
        return {"original": text, "translated": translated, "source_lang": "am", "was_translated": True}

    async def translate_from_english(self, text: str, target_lang: str) -> str:
        if target_lang == "en" or not (text or text.strip()):
            return text
        return await self.translate(text, "en", target_lang)
