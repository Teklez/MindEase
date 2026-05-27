"""On-demand CSV and PDF exports of a user's MindEase data.

Reuses MoodService / ChatService / AssessmentService for reads so the export
output stays consistent with what the user sees in the app. PDF generation
is synchronous (reportlab); endpoints wrap PDF calls in ``asyncio.to_thread``
to keep the event loop responsive.
"""

from __future__ import annotations

import asyncio
import csv
import io
import logging
import re
from datetime import datetime, timezone
from pathlib import Path
from uuid import UUID

from fastapi import HTTPException, status
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    Flowable,
    HRFlowable,
    KeepTogether,
    PageBreak,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.assessment import Assessment
from app.models.user import User
from app.services.assessment_service import AssessmentService, _classify
from app.services.chat_service import ChatService
from app.services.mood_service import MoodService

logger = logging.getLogger(__name__)


_FONT_DIR = Path(__file__).resolve().parent.parent / "assets" / "fonts"
_FONTS_REGISTERED = False
# Defaults assume registration fails — Helvetica covers Latin but not Amharic.
_BODY_FONT = "Helvetica"
_BODY_FONT_BOLD = "Helvetica-Bold"
_ETHIOPIC_FONT = "Helvetica"
_HAS_ETHIOPIC = False


# Ethiopic + Ethiopic Supplement + Ethiopic Extended + Ethiopic Extended-A.
# Used by _typeset to wrap script runs in a font tag so reportlab can pick
# the Ethiopic TTF for those codepoints only.
_ETHIOPIC_RE = re.compile(
    "[ሀ-፿ᎀ-᎟ⶀ-⷟꬀-꬯]+"
)


def _register_fonts() -> None:
    """Register Noto Sans + Noto Sans Ethiopic (Regular + Bold) once.

    Noto Sans Ethiopic only covers Ethiopic + a couple of fallback codepoints
    (space, NBSP) — it does NOT have Latin glyphs. So we use Noto Sans as the
    body font and switch to Noto Sans Ethiopic per-run for Ethiopic text via
    ``_typeset``."""
    global _FONTS_REGISTERED, _BODY_FONT, _BODY_FONT_BOLD
    global _ETHIOPIC_FONT, _HAS_ETHIOPIC
    if _FONTS_REGISTERED:
        return
    try:
        sans_reg = _FONT_DIR / "NotoSans-Regular.ttf"
        sans_bold = _FONT_DIR / "NotoSans-Bold.ttf"
        if sans_reg.is_file() and sans_bold.is_file():
            pdfmetrics.registerFont(TTFont("NotoSans", str(sans_reg)))
            pdfmetrics.registerFont(TTFont("NotoSans-Bold", str(sans_bold)))
            pdfmetrics.registerFontFamily(
                "NotoSans", normal="NotoSans", bold="NotoSans-Bold"
            )
            _BODY_FONT = "NotoSans"
            _BODY_FONT_BOLD = "NotoSans-Bold"
        else:
            logger.warning(
                "Noto Sans TTFs not found in %s; PDFs will use Helvetica.",
                _FONT_DIR,
            )

        eth_reg = _FONT_DIR / "NotoSansEthiopic-Regular.ttf"
        eth_bold = _FONT_DIR / "NotoSansEthiopic-Bold.ttf"
        if eth_reg.is_file() and eth_bold.is_file():
            pdfmetrics.registerFont(TTFont("NotoSansEthiopic", str(eth_reg)))
            pdfmetrics.registerFont(
                TTFont("NotoSansEthiopic-Bold", str(eth_bold))
            )
            pdfmetrics.registerFontFamily(
                "NotoSansEthiopic",
                normal="NotoSansEthiopic",
                bold="NotoSansEthiopic-Bold",
            )
            _ETHIOPIC_FONT = "NotoSansEthiopic"
            _HAS_ETHIOPIC = True
        else:
            logger.warning(
                "Noto Sans Ethiopic TTFs not found in %s; Amharic will "
                "render as boxes. Run backend/scripts/download_fonts.sh.",
                _FONT_DIR,
            )
    except Exception:
        logger.exception("Font registration failed; falling back to Helvetica")
    _FONTS_REGISTERED = True


def _typeset(s: str) -> str:
    """Wrap Ethiopic codepoint runs in <font name="NotoSansEthiopic"> markup
    so reportlab Paragraph renders the right glyphs. The body font (NotoSans)
    has Latin but no Ethiopic, and vice versa — neither alone suffices.

    Caller is responsible for escaping ``& < >`` first (use ``_esc``)."""
    if not _HAS_ETHIOPIC or not s:
        return s
    return _ETHIOPIC_RE.sub(
        lambda m: f'<font name="{_ETHIOPIC_FONT}">{m.group(0)}</font>',
        s,
    )


_MOOD_LABELS: dict[int, str] = {
    1: "Very Bad",
    2: "Bad",
    3: "Neutral",
    4: "Good",
    5: "Very Good",
}

# Per-level color dot in the mood table.
_MOOD_COLORS: dict[int, str] = {
    1: "#DC2626",
    2: "#F59E0B",
    3: "#94A3B8",
    4: "#14B8A6",
    5: "#16A34A",
}

# Brand teal — must match the in-app primary.
_BRAND = "#4F7263"
_BRAND_SOFT = "#ECFDF5"
_INK = "#0F1F1A"
_INK_SOFT = "#6B7280"


class _LogoMark(Flowable):
    """Inline vector copy of the MindEase leaf glyph (the same shape used in
    ``frontend/src/components/shared/Logo.tsx``). Rounded teal tile with two
    white leaf strokes — drawn with reportlab primitives so we don't carry an
    image asset."""

    def __init__(self, size_mm: float = 9.0) -> None:
        super().__init__()
        self._size = size_mm * mm
        self.width = self._size
        self.height = self._size

    def wrap(self, _available_width, _available_height):  # noqa: D401
        return self._size, self._size

    def draw(self) -> None:
        c = self.canv
        s = self._size
        c.saveState()
        c.setFillColor(colors.HexColor(_BRAND))
        c.setStrokeColor(colors.HexColor(_BRAND))
        c.roundRect(0, 0, s, s, s * 0.22, stroke=0, fill=1)

        # SVG path coords (viewBox 0..24) → reportlab space (origin bottom-left).
        unit = s / 24.0

        def pt(x: float, y: float) -> tuple[float, float]:
            return (x * unit, s - y * unit)

        c.setStrokeColor(colors.white)
        c.setLineWidth(max(1.2, s * 0.07))
        c.setLineCap(1)
        c.setLineJoin(1)
        # Right leaf: M12 21 c0-7 4-12 9-13 -1 9 -5 13 -9 13 Z
        p = c.beginPath()
        p.moveTo(*pt(12, 21))
        p.curveTo(*pt(12, 14), *pt(16, 9), *pt(21, 8))
        p.curveTo(*pt(20, 17), *pt(16, 21), *pt(12, 21))
        p.close()
        c.drawPath(p, stroke=1, fill=0)
        # Left leaf: M12 21 c0-5 -3-9 -8-10  1 7 4 10 8 10 Z
        p2 = c.beginPath()
        p2.moveTo(*pt(12, 21))
        p2.curveTo(*pt(12, 16), *pt(9, 12), *pt(4, 11))
        p2.curveTo(*pt(5, 18), *pt(8, 21), *pt(12, 21))
        p2.close()
        c.drawPath(p2, stroke=1, fill=0)
        c.restoreState()

# Level → swatch color for the assessment level chip in PDFs. Matches the
# palette used by seed_assessments.py.
_LEVEL_COLORS: dict[str, str] = {
    "minimal": "#22C55E",
    "mild": "#EAB308",
    "moderate": "#F97316",
    "severe": "#EF4444",
    "low": "#22C55E",
    "high": "#EF4444",
    "unknown": "#94A3B8",
}


def _fmt_dt(dt: datetime) -> tuple[str, str]:
    """Return (date, time) strings in ISO-ish, user-readable form (UTC)."""
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    local = dt.astimezone(timezone.utc)
    return local.strftime("%Y-%m-%d"), local.strftime("%H:%M")


def _esc(s: str | None) -> str:
    """Paragraph-safe text. reportlab Paragraph treats <, >, & as markup.

    Also runs the result through ``_typeset`` so any Ethiopic substring is
    wrapped in the Ethiopic font tag — the body font is Latin-only."""
    if not s:
        return ""
    escaped = s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
    return _typeset(escaped)


def _mood_cell(level: int, styles: dict[str, ParagraphStyle]) -> Paragraph:
    """Mood column cell: colored bullet + score + label.

    NotoSans only ships U+2022 (•) among the candidate bullet glyphs, so we
    bump its size to make it read as a colored chip."""
    color = _MOOD_COLORS.get(level, "#94A3B8")
    label = _MOOD_LABELS.get(level, "")
    return Paragraph(
        f'<font color="{color}" size="16">•</font>  <b>{level}</b> · {label}',
        styles["body"],
    )


class ExportService:
    def __init__(self) -> None:
        self.mood = MoodService()
        self.chat = ChatService()
        self.assessment = AssessmentService()

    # ----------------------------- CSV: Mood ----------------------------- #

    async def export_mood_csv(self, db: AsyncSession, user_id: UUID) -> str:
        entries = await self.mood.get_entries(db, user_id, days=36500)
        if not entries:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No data to export",
            )
        # Oldest first reads more naturally in a spreadsheet.
        entries.sort(key=lambda e: e.created_at)
        buf = io.StringIO()
        writer = csv.writer(buf)
        writer.writerow(["Date", "Time", "Mood Level", "Mood Label", "Note", "Source"])
        for e in entries:
            d, t = _fmt_dt(e.created_at)
            writer.writerow(
                [
                    d,
                    t,
                    e.mood_level,
                    _MOOD_LABELS.get(e.mood_level, ""),
                    e.note or "",
                    e.entry_source or "manual",
                ]
            )
        return "﻿" + buf.getvalue()

    # ----------------------------- CSV: Chat ----------------------------- #

    async def export_chat_csv(
        self,
        db: AsyncSession,
        user_id: UUID,
        conversation_id: UUID | None = None,
    ) -> str:
        conversations = await self._load_conversations(db, user_id, conversation_id)
        buf = io.StringIO()
        writer = csv.writer(buf)
        writer.writerow(["Conversation Title", "Date", "Time", "Sender", "Message"])
        any_row = False
        for conv in conversations:
            messages = sorted(conv.messages, key=lambda m: m.timestamp)
            title = conv.title or f"Conversation {str(conv.conversation_id)[:8]}"
            for m in messages:
                d, t = _fmt_dt(m.timestamp)
                sender = "MindEase" if m.sender_type == "ai" else "User"
                writer.writerow([title, d, t, sender, m.content])
                any_row = True
        if not any_row:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No data to export",
            )
        return "﻿" + buf.getvalue()

    # --------------------------- CSV: Assessments ------------------------ #

    async def export_assessments_csv(
        self,
        db: AsyncSession,
        user_id: UUID,
        user_assessment_id: UUID | None = None,
    ) -> str:
        history = await self.assessment.get_history(db, user_id)
        items = history.history
        if user_assessment_id is not None:
            items = [i for i in items if i.user_assessment_id == user_assessment_id]
        if not items:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No data to export",
            )
        items.sort(key=lambda i: i.completed_at)
        buf = io.StringIO()
        writer = csv.writer(buf)
        writer.writerow(
            ["Assessment Name", "Date", "Score", "Max Score", "Level", "Feedback"]
        )
        # The history response doesn't carry feedback_text — fetch it per
        # row from get_result for accuracy. This is N+1 but personal-scale.
        for it in items:
            result = await self.assessment.get_result(db, it.user_assessment_id, user_id)
            feedback = result.feedback_text if result else ""
            d, _ = _fmt_dt(it.completed_at)
            writer.writerow(
                [
                    it.assessment_name,
                    d,
                    it.score,
                    it.max_score,
                    it.feedback_level,
                    feedback,
                ]
            )
        return "﻿" + buf.getvalue()

    # ------------------------------ PDF: Mood ---------------------------- #

    async def export_mood_pdf(
        self, db: AsyncSession, user_id: UUID, user: User
    ) -> bytes:
        entries = await self.mood.get_entries(db, user_id, days=36500)
        if not entries:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No data to export",
            )
        stats = await self.mood.get_stats(db, user_id)
        entries.sort(key=lambda e: e.created_at)

        def build() -> bytes:
            buf = io.BytesIO()
            doc, story, styles = self._new_doc(buf, "Mood History Report", user)

            summary_lines = [
                f"<b>Total entries:</b> {stats.total_entries}",
                f"<b>Average mood:</b> {stats.average_mood if stats.average_mood is not None else '—'} / 5",
                f"<b>Current streak:</b> {stats.current_streak} days",
                f"<b>Date range:</b> {entries[0].created_at.date()} → {entries[-1].created_at.date()}",
            ]
            for line in summary_lines:
                story.append(Paragraph(line, styles["body"]))
            story.append(Spacer(1, 6 * mm))

            header_row = ["Date", "Time", "Mood", "Note", "Source"]
            rows: list[list] = [header_row]
            for e in entries:
                d, t = _fmt_dt(e.created_at)
                rows.append(
                    [
                        d,
                        t,
                        _mood_cell(e.mood_level, styles),
                        Paragraph(_esc(e.note or ""), styles["body"]),
                        e.entry_source or "manual",
                    ]
                )
            table = Table(rows, repeatRows=1, colWidths=[24 * mm, 18 * mm, 32 * mm, 80 * mm, 22 * mm])
            table.setStyle(self._table_style(len(rows)))
            story.append(table)

            doc.build(story, onFirstPage=self._draw_footer, onLaterPages=self._draw_footer)
            return buf.getvalue()

        return await asyncio.to_thread(build)

    # ------------------------------ PDF: Chat ---------------------------- #

    async def export_chat_pdf(
        self,
        db: AsyncSession,
        user_id: UUID,
        user: User,
        conversation_id: UUID | None = None,
    ) -> bytes:
        conversations = await self._load_conversations(db, user_id, conversation_id)
        # Filter out conversations with zero messages; otherwise we'd render
        # empty section headers. If everything's empty we 404.
        conversations = [c for c in conversations if c.messages]
        if not conversations:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No data to export",
            )

        def build() -> bytes:
            buf = io.BytesIO()
            doc, story, styles = self._new_doc(buf, "Chat Logs", user)

            for idx, conv in enumerate(conversations):
                if idx > 0:
                    # Section divider — keeps related conversations on the
                    # same page when they fit, instead of forcing a break.
                    story.append(Spacer(1, 6 * mm))
                    story.append(
                        HRFlowable(
                            width="100%",
                            thickness=0.6,
                            color=colors.HexColor("#E5E7EB"),
                            spaceBefore=0,
                            spaceAfter=4,
                        )
                    )
                title = conv.title or f"Conversation {str(conv.conversation_id)[:8]}"
                started = conv.started_at.date() if conv.started_at else ""
                messages = sorted(conv.messages, key=lambda m: m.timestamp)

                # Keep the conversation heading with at least the first
                # message so a header never dangles alone at page bottom.
                head_block: list = [
                    Paragraph(_esc(title), styles["h2"]),
                    Paragraph(f"Started: {started}", styles["meta"]),
                    Spacer(1, 3 * mm),
                ]
                if messages:
                    first = messages[0]
                    d, t = _fmt_dt(first.timestamp)
                    sender = "MindEase" if first.sender_type == "ai" else "User"
                    style = (
                        styles["ai"] if first.sender_type == "ai" else styles["user"]
                    )
                    head_block.append(
                        Paragraph(
                            f"<b>[{d} {t}] {sender}:</b> {_esc(first.content)}",
                            style,
                        )
                    )
                story.append(KeepTogether(head_block))

                for m in messages[1:]:
                    d, t = _fmt_dt(m.timestamp)
                    sender = "MindEase" if m.sender_type == "ai" else "User"
                    line = f"<b>[{d} {t}] {sender}:</b> {_esc(m.content)}"
                    style = styles["ai"] if m.sender_type == "ai" else styles["user"]
                    story.append(Spacer(1, 2.5 * mm))
                    story.append(Paragraph(line, style))

            doc.build(story, onFirstPage=self._draw_footer, onLaterPages=self._draw_footer)
            return buf.getvalue()

        return await asyncio.to_thread(build)

    # -------------------------- PDF: Assessments ------------------------- #

    async def export_assessments_pdf(
        self,
        db: AsyncSession,
        user_id: UUID,
        user: User,
        user_assessment_id: UUID | None = None,
    ) -> bytes:
        history = await self.assessment.get_history(db, user_id)
        items = history.history
        if user_assessment_id is not None:
            items = [i for i in items if i.user_assessment_id == user_assessment_id]
        if not items:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No data to export",
            )
        # Render newest first to match how results are typically reviewed.
        items.sort(key=lambda i: i.completed_at, reverse=True)

        # Pre-load each result + the source Assessment for question text.
        from sqlalchemy import select  # local import keeps top-level lean

        details = []
        for it in items:
            result = await self.assessment.get_result(db, it.user_assessment_id, user_id)
            if result is None:
                continue
            assessment = (
                await db.execute(
                    select(Assessment).where(
                        Assessment.assessment_id
                        == (await self._assessment_id_for(db, it.user_assessment_id))
                    )
                )
            ).scalar_one_or_none()
            details.append((it, result, assessment))

        def build() -> bytes:
            buf = io.BytesIO()
            doc, story, styles = self._new_doc(buf, "Assessment Results", user)
            for idx, (it, result, assessment) in enumerate(details):
                if idx > 0:
                    story.append(PageBreak())
                story.append(Paragraph(_esc(it.assessment_name), styles["h2"]))
                d, _ = _fmt_dt(it.completed_at)
                story.append(
                    Paragraph(
                        f"Type: {it.assessment_type} · Completed: {d}",
                        styles["meta"],
                    )
                )
                story.append(Spacer(1, 3 * mm))
                story.append(
                    Paragraph(
                        f"<b>Score:</b> {it.score} / {it.max_score}",
                        styles["body"],
                    )
                )
                level_color = _LEVEL_COLORS.get(it.feedback_level, "#94A3B8")
                story.append(
                    Paragraph(
                        f"<b>Level:</b> <font color='{level_color}'>"
                        f"{_esc(it.feedback_level)}</font>",
                        styles["body"],
                    )
                )
                story.append(Spacer(1, 3 * mm))
                story.append(Paragraph(_esc(result.feedback_text), styles["body"]))
                story.append(Spacer(1, 5 * mm))

                # Question-by-question table
                questions = (assessment.questions if assessment else []) or []
                q_by_id = {int(q.get("id", -1)): q for q in questions}
                rows: list[list] = [["Question", "Answer"]]
                for resp in result.responses or []:
                    qid = int(resp.get("question_id", -1))
                    q = q_by_id.get(qid)
                    q_text = (q.get("text") if q else f"Question {qid}") or ""
                    rows.append(
                        [
                            Paragraph(_esc(q_text), styles["body"]),
                            str(resp.get("value", "")),
                        ]
                    )
                if len(rows) > 1:
                    table = Table(rows, repeatRows=1, colWidths=[130 * mm, 30 * mm])
                    table.setStyle(self._table_style(len(rows)))
                    story.append(table)

            doc.build(story, onFirstPage=self._draw_footer, onLaterPages=self._draw_footer)
            return buf.getvalue()

        return await asyncio.to_thread(build)

    # ----------------------------- PDF: All ------------------------------ #

    async def export_all_pdf(
        self, db: AsyncSession, user_id: UUID, user: User
    ) -> bytes:
        # Each child raises 404 if its section is empty. For the combined
        # export we want at least one non-empty section, not all-or-nothing.
        sections: list[tuple[str, callable]] = []
        try:
            mood_entries = await self.mood.get_entries(db, user_id, days=36500)
            mood_stats = await self.mood.get_stats(db, user_id)
            if mood_entries:
                sections.append(("mood", lambda s: self._render_mood_section(s, mood_entries, mood_stats)))
        except HTTPException:
            pass
        try:
            conversations = await self._load_conversations(db, user_id, None)
            conversations = [c for c in conversations if c.messages]
            if conversations:
                sections.append(("chat", lambda s: self._render_chat_section(s, conversations)))
        except HTTPException:
            pass
        try:
            history = await self.assessment.get_history(db, user_id)
            assessment_items = list(history.history)
            assessment_items.sort(key=lambda i: i.completed_at, reverse=True)
            detail_rows: list = []
            from sqlalchemy import select

            for it in assessment_items:
                result = await self.assessment.get_result(db, it.user_assessment_id, user_id)
                if result is None:
                    continue
                aid = await self._assessment_id_for(db, it.user_assessment_id)
                assessment = (
                    await db.execute(select(Assessment).where(Assessment.assessment_id == aid))
                ).scalar_one_or_none()
                detail_rows.append((it, result, assessment))
            if detail_rows:
                sections.append(
                    ("assessments", lambda s: self._render_assessment_section(s, detail_rows))
                )
        except HTTPException:
            pass

        if not sections:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No data to export",
            )

        def build() -> bytes:
            buf = io.BytesIO()
            doc, story, styles = self._new_doc(buf, "Full Data Export", user)
            for idx, (_kind, renderer) in enumerate(sections):
                if idx > 0:
                    story.append(PageBreak())
                renderer({"styles": styles, "story": story})
            doc.build(story, onFirstPage=self._draw_footer, onLaterPages=self._draw_footer)
            return buf.getvalue()

        return await asyncio.to_thread(build)

    # ----------------------------- helpers ------------------------------- #

    async def _load_conversations(
        self,
        db: AsyncSession,
        user_id: UUID,
        conversation_id: UUID | None,
    ):
        if conversation_id is not None:
            conv = await self.chat.get_conversation_with_messages(db, conversation_id, user_id)
            return [conv]
        conversations = await self.chat.get_user_conversations(db, user_id)
        if not conversations:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No data to export",
            )
        full = []
        for c in conversations:
            full.append(
                await self.chat.get_conversation_with_messages(db, c.conversation_id, user_id)
            )
        return full

    async def _assessment_id_for(self, db: AsyncSession, user_assessment_id: UUID) -> UUID:
        from sqlalchemy import select
        from app.models.assessment import UserAssessment

        row = (
            await db.execute(
                select(UserAssessment.assessment_id).where(
                    UserAssessment.user_assessment_id == user_assessment_id
                )
            )
        ).first()
        return row[0] if row else None

    def _new_doc(self, buf: io.BytesIO, title: str, user: User):
        _register_fonts()
        doc = SimpleDocTemplate(
            buf,
            pagesize=A4,
            leftMargin=18 * mm,
            rightMargin=18 * mm,
            topMargin=22 * mm,
            bottomMargin=18 * mm,
            title=title,
            author=user.display_name,
        )
        styles = self._styles()
        generated = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")

        # Logo + wordmark inline, then title + thin accent rule.
        brand_row = Table(
            [[_LogoMark(size_mm=9), Paragraph("MindEase", styles["brand"])]],
            colWidths=[11 * mm, None],
        )
        brand_row.setStyle(
            TableStyle(
                [
                    ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                    ("LEFTPADDING", (0, 0), (-1, -1), 0),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 0),
                    ("TOPPADDING", (0, 0), (-1, -1), 0),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
                ]
            )
        )

        story = [
            brand_row,
            Spacer(1, 3 * mm),
            Paragraph(title, styles["h1"]),
            Paragraph(f"Generated on: {generated}", styles["meta"]),
            Paragraph(f"User: {_esc(user.display_name)}", styles["meta"]),
            Spacer(1, 3 * mm),
            Paragraph(
                "This report is generated from MindEase, an AI companion. "
                "It is not a clinical document.",
                styles["disclaimer"],
            ),
            Spacer(1, 6 * mm),
        ]
        return doc, story, styles

    def _styles(self) -> dict[str, ParagraphStyle]:
        base = getSampleStyleSheet()["BodyText"]
        body = ParagraphStyle(
            "Body",
            parent=base,
            fontName=_BODY_FONT,
            fontSize=10,
            leading=13,
        )
        return {
            "brand": ParagraphStyle(
                "Brand",
                parent=base,
                fontName=_BODY_FONT_BOLD,
                fontSize=11,
                textColor=colors.HexColor("#4F7263"),
                spaceAfter=2,
            ),
            "h1": ParagraphStyle(
                "H1",
                parent=base,
                fontName=_BODY_FONT_BOLD,
                fontSize=20,
                leading=24,
                spaceAfter=4,
            ),
            "h2": ParagraphStyle(
                "H2",
                parent=base,
                fontName=_BODY_FONT_BOLD,
                fontSize=14,
                leading=18,
                spaceAfter=2,
            ),
            "meta": ParagraphStyle(
                "Meta",
                parent=base,
                fontName=_BODY_FONT,
                fontSize=9,
                textColor=colors.HexColor("#6B7280"),
                leading=12,
            ),
            "disclaimer": ParagraphStyle(
                "Disclaimer",
                parent=base,
                fontName=_BODY_FONT,
                fontSize=8.5,
                textColor=colors.HexColor("#6B7280"),
                leading=11,
            ),
            "body": body,
            # Chat bubbles: tinted backgrounds + a little inner padding.
            "user": ParagraphStyle(
                "UserMsg",
                parent=body,
                textColor=colors.HexColor(_INK),
                leftIndent=6,
                rightIndent=6,
                spaceBefore=2,
                spaceAfter=2,
                backColor=colors.HexColor("#F4F6F8"),
                borderPadding=(5, 7, 5, 7),
            ),
            "ai": ParagraphStyle(
                "AiMsg",
                parent=body,
                textColor=colors.HexColor("#134E4A"),
                leftIndent=6,
                rightIndent=6,
                spaceBefore=2,
                spaceAfter=2,
                backColor=colors.HexColor(_BRAND_SOFT),
                borderPadding=(5, 7, 5, 7),
            ),
        }

    def _table_style(self, n_rows: int) -> TableStyle:
        ts = TableStyle(
            [
                ("FONTNAME", (0, 0), (-1, -1), _BODY_FONT),
                ("FONTNAME", (0, 0), (-1, 0), _BODY_FONT_BOLD),
                ("FONTSIZE", (0, 0), (-1, -1), 9.5),
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#F1F5F4")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.HexColor("#0F766E")),
                ("LINEBELOW", (0, 0), (-1, 0), 0.75, colors.HexColor("#CBD5E1")),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 5),
                ("RIGHTPADDING", (0, 0), (-1, -1), 5),
                ("TOPPADDING", (0, 0), (-1, -1), 4),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ]
        )
        for row in range(1, n_rows):
            if row % 2 == 0:
                ts.add("BACKGROUND", (0, row), (-1, row), colors.HexColor("#F8FAFB"))
        return ts

    def _draw_footer(self, canvas, doc) -> None:
        canvas.saveState()
        canvas.setFont(_BODY_FONT, 8)
        canvas.setFillColor(colors.HexColor("#94A3B8"))
        canvas.drawString(
            18 * mm,
            10 * mm,
            "MindEase — Not a substitute for professional therapy",
        )
        canvas.drawRightString(
            A4[0] - 18 * mm,
            10 * mm,
            f"Page {doc.page}",
        )
        canvas.restoreState()

    # --- section renderers used by export_all_pdf -----------------------

    def _render_mood_section(self, ctx, entries, stats) -> None:
        styles = ctx["styles"]
        story = ctx["story"]
        story.append(Paragraph("Mood History", styles["h1"]))
        story.append(
            Paragraph(
                f"<b>Total entries:</b> {stats.total_entries} · "
                f"<b>Avg:</b> {stats.average_mood if stats.average_mood is not None else '—'} / 5 · "
                f"<b>Streak:</b> {stats.current_streak} days",
                styles["body"],
            )
        )
        story.append(Spacer(1, 4 * mm))
        rows: list[list] = [["Date", "Time", "Mood", "Note", "Source"]]
        for e in sorted(entries, key=lambda x: x.created_at):
            d, t = _fmt_dt(e.created_at)
            rows.append(
                [
                    d,
                    t,
                    _mood_cell(e.mood_level, styles),
                    Paragraph(_esc(e.note or ""), styles["body"]),
                    e.entry_source or "manual",
                ]
            )
        table = Table(rows, repeatRows=1, colWidths=[24 * mm, 18 * mm, 32 * mm, 80 * mm, 22 * mm])
        table.setStyle(self._table_style(len(rows)))
        story.append(table)

    def _render_chat_section(self, ctx, conversations) -> None:
        styles = ctx["styles"]
        story = ctx["story"]
        story.append(Paragraph("Chat Logs", styles["h1"]))
        story.append(Spacer(1, 4 * mm))
        for idx, conv in enumerate(conversations):
            if idx > 0:
                story.append(Spacer(1, 5 * mm))
                story.append(
                    HRFlowable(
                        width="100%",
                        thickness=0.6,
                        color=colors.HexColor("#E5E7EB"),
                        spaceBefore=0,
                        spaceAfter=3,
                    )
                )
            title = conv.title or f"Conversation {str(conv.conversation_id)[:8]}"
            story.append(Paragraph(_esc(title), styles["h2"]))
            story.append(Spacer(1, 3 * mm))
            for i, m in enumerate(sorted(conv.messages, key=lambda x: x.timestamp)):
                d, t = _fmt_dt(m.timestamp)
                sender = "MindEase" if m.sender_type == "ai" else "User"
                style = styles["ai"] if m.sender_type == "ai" else styles["user"]
                if i > 0:
                    story.append(Spacer(1, 2.5 * mm))
                story.append(
                    Paragraph(
                        f"<b>[{d} {t}] {sender}:</b> {_esc(m.content)}",
                        style,
                    )
                )

    def _render_assessment_section(self, ctx, detail_rows) -> None:
        styles = ctx["styles"]
        story = ctx["story"]
        story.append(Paragraph("Assessment Results", styles["h1"]))
        story.append(Spacer(1, 4 * mm))
        for idx, (it, result, assessment) in enumerate(detail_rows):
            if idx > 0:
                story.append(Spacer(1, 6 * mm))
            story.append(Paragraph(_esc(it.assessment_name), styles["h2"]))
            d, _ = _fmt_dt(it.completed_at)
            story.append(
                Paragraph(
                    f"Type: {it.assessment_type} · Completed: {d}",
                    styles["meta"],
                )
            )
            story.append(
                Paragraph(
                    f"<b>Score:</b> {it.score} / {it.max_score} · "
                    f"<b>Level:</b> <font color='{_LEVEL_COLORS.get(it.feedback_level, '#94A3B8')}'>"
                    f"{_esc(it.feedback_level)}</font>",
                    styles["body"],
                )
            )
            story.append(Paragraph(_esc(result.feedback_text), styles["body"]))


    # ----------------------------- AI Summary PDF ----------------------------- #

    async def export_ai_summary_pdf(self, db: AsyncSession, user_id: UUID, user: User) -> bytes:
        from app.services.ai_client import AIClient

        # Collect mood entries (last 90 days)
        mood_entries_raw = await self.mood.get_entries(db, user_id, days=90)
        mood_entries = [
            {
                "date": e.created_at.strftime("%Y-%m-%d"),
                "score": e.mood_level,
                "note": e.note or "",
            }
            for e in sorted(mood_entries_raw, key=lambda x: x.created_at)
        ]

        # Collect assessment history
        assessment_history = await self.assessment.get_history(db, user_id)
        assessments = [
            {
                "instrument": item.assessment_type.upper(),
                "name": item.assessment_name,
                "score": item.score,
                "max_score": item.max_score,
                "level": item.feedback_level,
                "date": item.completed_at.strftime("%Y-%m-%d"),
            }
            for item in sorted(assessment_history.history, key=lambda x: x.completed_at)
        ]

        # Collect chat metadata (no message content — privacy)
        conversations = await self.chat.get_user_conversations(db, user_id)
        total_messages = sum(getattr(c, "total_messages", 0) or 0 for c in conversations)
        dates = sorted(
            [c.created_at for c in conversations if c.created_at],
            key=lambda d: d,
        )
        chat_meta = {
            "total_conversations": len(conversations),
            "total_messages": total_messages,
            "first_session": dates[0].strftime("%Y-%m-%d") if dates else None,
            "last_session": dates[-1].strftime("%Y-%m-%d") if dates else None,
        }

        if not mood_entries and not assessments and not conversations:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No data to export",
            )

        payload = {
            "mood_entries": mood_entries,
            "assessments": assessments,
            "chat_meta": chat_meta,
        }

        summary_text = await AIClient().summarize_export(payload)

        def build() -> bytes:
            buf = io.BytesIO()
            doc, story, styles = self._new_doc(buf, "AI Wellness Summary", user)
            self._render_ai_summary_section(story, styles, summary_text)
            doc.build(story, onFirstPage=self._draw_footer, onLaterPages=self._draw_footer)
            return buf.getvalue()

        return await asyncio.to_thread(build)

    def _render_ai_summary_section(self, story: list, styles: dict, text: str) -> None:
        for block in text.split("\n\n"):
            block = block.strip()
            if not block:
                continue
            if block.startswith("## "):
                heading = block[3:].strip()
                story.append(Spacer(1, 4 * mm))
                story.append(Paragraph(_esc(heading), styles["h2"]))
                story.append(Spacer(1, 1.5 * mm))
            else:
                story.append(Paragraph(_esc(block), styles["body"]))
                story.append(Spacer(1, 2 * mm))


export_service = ExportService()
