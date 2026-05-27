"""Broadcast notifications to opted-in users (e.g. new assessment, new resource)."""
from __future__ import annotations

import logging

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.models.user import User
from app.services.email_service import email_service

logger = logging.getLogger(__name__)


def _opted_in(user: User) -> bool:
    """Default: opted IN unless notification_preferences.broadcast_emails == False."""
    prefs = user.notification_preferences or {}
    return prefs.get("broadcast_emails", True) is not False


def _is_real_email(email: str | None) -> bool:
    return bool(email) and not email.endswith("@mindease.temp")


async def opted_in_recipients(db: AsyncSession) -> list[str]:
    """Return email addresses of registered, active, opted-in users."""
    res = await db.execute(
        select(User).where(User.account_status == "active")
    )
    return [u.email for u in res.scalars() if _is_real_email(u.email) and _opted_in(u)]


async def count_recipients(db: AsyncSession) -> int:
    res = await db.execute(
        select(User).where(User.account_status == "active")
    )
    return sum(1 for u in res.scalars() if _is_real_email(u.email) and _opted_in(u))


# ── Templates ─────────────────────────────────────────────────────────────── #

_FRONTEND = get_settings().FRONTEND_URL


def _layout(title: str, intro: str, body_html: str, cta_label: str, cta_href: str) -> str:
    return f"""<!doctype html>
<html><body style="margin:0;font-family:'Inter',-apple-system,sans-serif;background:#f3f1ea;padding:24px;color:#2a2f2c">
  <div style="max-width:560px;margin:0 auto;background:#fdfcf7;border:1px solid #d8d4c9;border-radius:14px;padding:32px;box-shadow:0 2px 8px rgba(40,50,45,0.06)">
    <div style="font-size:11px;letter-spacing:0.12em;text-transform:uppercase;color:#5a7361;font-family:'JetBrains Mono',monospace;margin-bottom:12px">MindEase</div>
    <h1 style="font-family:'Fraunces',Georgia,serif;font-weight:500;font-size:24px;margin:0 0 8px;letter-spacing:-0.01em;color:#2a2f2c">{title}</h1>
    <p style="color:#6c726e;font-size:14px;margin:0 0 22px;line-height:1.55">{intro}</p>
    <div style="background:#f3f1ea;border-radius:10px;padding:18px 20px;margin-bottom:24px">{body_html}</div>
    <a href="{cta_href}" style="display:inline-block;background:#5a7361;color:#fdfcf7;text-decoration:none;font-weight:600;font-size:14px;padding:11px 22px;border-radius:8px">{cta_label}</a>
    <hr style="border:none;border-top:1px solid #d8d4c9;margin:32px 0 16px">
    <p style="color:#9aa09c;font-size:11.5px;line-height:1.55;margin:0">
      You're receiving this because you signed up for MindEase. You can adjust your notification preferences in settings.
    </p>
  </div>
</body></html>"""


def assessment_email(name: str, description: str) -> tuple[str, str]:
    subject = f"New assessment available: {name}"
    body = (
        f'<div style="font-family:Fraunces,Georgia,serif;font-size:18px;font-weight:500;color:#2a2f2c;margin-bottom:6px">{_e(name)}</div>'
        f'<div style="color:#6c726e;font-size:13.5px;line-height:1.55">{_e(description)}</div>'
    )
    html = _layout(
        "A new self-check is ready for you",
        "We've added a new screening tool to MindEase. Take a few minutes when it feels right.",
        body,
        "Open MindEase",
        f"{_FRONTEND}/assessments",
    )
    return subject, html


def resource_email(title: str, description: str, resource_type: str) -> tuple[str, str]:
    subject = f"New {resource_type} added to MindEase"
    body = (
        f'<div style="font-family:Fraunces,Georgia,serif;font-size:18px;font-weight:500;color:#2a2f2c;margin-bottom:6px">{_e(title)}</div>'
        f'<div style="color:#6c726e;font-size:13.5px;line-height:1.55">{_e(description)}</div>'
    )
    html = _layout(
        f"A new {resource_type} just landed",
        "Something new is in your MindEase library — explore when you have a moment.",
        body,
        "Browse resources",
        f"{_FRONTEND}/resources",
    )
    return subject, html


def _e(s: str) -> str:
    import html
    return html.escape(s)


# ── Dispatch ──────────────────────────────────────────────────────────────── #

async def broadcast_new_assessment(db: AsyncSession, name: str, description: str) -> int:
    recipients = await opted_in_recipients(db)
    if not recipients:
        return 0
    subject, html = assessment_email(name, description)
    return await email_service.send_bulk(recipients, subject, html)


async def broadcast_new_resource(db: AsyncSession, title: str, description: str, resource_type: str) -> int:
    recipients = await opted_in_recipients(db)
    if not recipients:
        return 0
    subject, html = resource_email(title, description, resource_type)
    return await email_service.send_bulk(recipients, subject, html)
