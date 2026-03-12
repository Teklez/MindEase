import asyncio
import logging
import re
import google.generativeai as genai

from app.config import get_settings

logger = logging.getLogger(__name__)

_LANG_NAMES = {"en": "English", "am": "Amharic"}

_PROMPT_EN_TO_AM = """\
You are a professional English to Amharic translator.

TASK: Translate the following English text into natural, fluent Ethiopian Amharic (አማርኛ).

RULES:
- Write in proper standard Amharic as spoken in Ethiopia
- Use correct Amharic grammar, sentence structure, and word order
- Do NOT transliterate English words into Amharic script — actually translate the meaning
- For technical terms or names that have no Amharic equivalent, keep them in English
- Preserve the emotional tone — this is a mental health support conversation, \
so the translation must feel warm, caring, and natural
- Do NOT add any explanation, notes, or commentary
- Return ONLY the Amharic translation, nothing else
- Do NOT wrap in quotes or add prefixes like "Translation:"

English text to translate:
{text}

Amharic translation:
"""

_PROMPT_AM_TO_EN = """\
You are a professional Amharic to English translator.

TASK: Translate the following Amharic (አማርኛ) text into natural, fluent English.

RULES:
- Produce natural English that captures the full meaning
- Preserve the emotional tone and intent of the speaker
- This is from a mental health support conversation — the person may be \
expressing feelings, distress, or asking for help
- Do NOT add any explanation, notes, or commentary
- Return ONLY the English translation, nothing else
- Do NOT wrap in quotes or add prefixes like "Translation:"

Amharic text to translate:
{text}

English translation:
"""

_GENERATION_CONFIG = genai.GenerationConfig(
    temperature=0.1,
    top_p=0.95,
    max_output_tokens=2048,
)

_STRIP_PREFIXES = [
    "Translation:",
    "Amharic:",
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
    """True if character is in Ethiopic Unicode range (U+1200–U+137F)."""
    if not c:
        return False
    code = ord(c[0])
    return 0x1200 <= code <= 0x137F


def _strip_markdown(text: str) -> str:
    """Remove bold/italic markdown markers before translation."""
    text = text.replace("**", "")
    text = text.replace("*", "")
    return text


def _clean_result(result: str) -> str:
    """Strip quotes and common prefixes Gemini adds."""
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
            genai.configure(api_key=settings.GEMINI_API_KEY)
            self._model = genai.GenerativeModel(
                "gemini-2.0-flash",
                generation_config=_GENERATION_CONFIG,
            )
        else:
            self._model = None

    def _contains_amharic(self, text: str) -> bool:
        return any('\u1200' <= char <= '\u137f' for char in text)

    def detect_language(self, text: str) -> str:
        """Detect if text is Amharic or English.
        Simple heuristic: check for Ethiopic Unicode chars (U+1200 to U+137F).
        If any found → "am", otherwise → "en".
        """
        if not (text or text.strip()):
            return "en"
        for c in text:
            if _is_ethiopic(c):
                return "am"
        return "en"

    async def _call_model(self, prompt: str) -> str | None:
        """Call the Gemini model and return response text, or None on failure."""
        if hasattr(self._model, "generate_content_async"):
            response = await asyncio.wait_for(
                self._model.generate_content_async(prompt),
                timeout=10.0,
            )
        else:
            response = await asyncio.wait_for(
                asyncio.to_thread(self._model.generate_content, prompt),
                timeout=10.0,
            )
        if response and getattr(response, "text", None):
            return response.text
        return None

    async def translate(
        self, text: str, source_lang: str, target_lang: str
    ) -> str:
        """Translate text between English and Amharic using Gemini."""
        if not text or not text.strip():
            return text
        if not self._model:
            return text

        clean_text = _strip_markdown(text)

        if target_lang == "am":
            prompt = _PROMPT_EN_TO_AM.format(text=clean_text)
        else:
            prompt = _PROMPT_AM_TO_EN.format(text=clean_text)

        logger.info(f"Translating [{source_lang}→{target_lang}]: {clean_text[:100]}")

        try:
            raw = await self._call_model(prompt)
            if raw is None:
                return text

            result = _clean_result(raw)
            if target_lang == "am":
                result = _strip_parenthetical_english(result)

            # Quality check: Amharic output must contain Amharic characters
            if target_lang == "am" and not self._contains_amharic(result):
                logger.warning("Translation produced no Amharic characters — retrying once")
                raw2 = await self._call_model(prompt)
                if raw2 is not None:
                    result2 = _clean_result(raw2)
                    result2 = _strip_parenthetical_english(result2)
                    if self._contains_amharic(result2):
                        result = result2
                    else:
                        logger.error("Retry also produced no Amharic — falling back to original")
                        return f"{text} (translation unavailable)"
                else:
                    return f"{text} (translation unavailable)"

            logger.info(f"Result: {result[:100]}")
            return result

        except Exception as error:
            logger.error(f"Translation failed: {error}")
            return text

    async def translate_to_english(self, text: str) -> dict:
        """Returns: {original, translated, source_lang, was_translated}"""
        lang = self.detect_language(text)
        if lang == "en":
            return {
                "original": text,
                "translated": text,
                "source_lang": "en",
                "was_translated": False,
            }
        translated = await self.translate(text, "am", "en")
        return {
            "original": text,
            "translated": translated,
            "source_lang": "am",
            "was_translated": True,
        }

    async def translate_from_english(self, text: str, target_lang: str) -> str:
        """Translate AI response from English to target language."""
        if target_lang == "en" or not (text or text.strip()):
            return text
        return await self.translate(text, "en", target_lang)
