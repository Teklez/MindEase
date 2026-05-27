"""Email sending service.

Uses stdlib smtplib (no extra deps). If SMTP_HOST is not configured,
emails are logged instead of sent — so dev environments work out of the
box.
"""
from __future__ import annotations

import asyncio
import logging
import smtplib
from email.message import EmailMessage
from email.utils import formataddr

from app.config import get_settings

logger = logging.getLogger(__name__)

_BATCH_CONCURRENCY = 8  # tune per provider


class EmailService:
    def __init__(self) -> None:
        s = get_settings()
        self.host = s.SMTP_HOST
        self.port = s.SMTP_PORT
        self.user = s.SMTP_USER
        self.password = s.SMTP_PASSWORD
        self.use_tls = s.SMTP_USE_TLS
        self.from_email = s.FROM_EMAIL
        self.from_name = s.FROM_NAME

    @property
    def configured(self) -> bool:
        return bool(self.host)

    async def send(self, to: str, subject: str, html: str, text: str | None = None) -> bool:
        if not self.configured:
            logger.info("[EMAIL DEV] (smtp unconfigured) to=%s subject=%r", to, subject)
            return True
        return await asyncio.to_thread(self._send_sync, to, subject, html, text)

    def _send_sync(self, to: str, subject: str, html: str, text: str | None) -> bool:
        try:
            msg = EmailMessage()
            msg["Subject"] = subject
            msg["From"] = formataddr((self.from_name, self.from_email))
            msg["To"] = to
            msg.set_content(text or _strip_html(html))
            msg.add_alternative(html, subtype="html")

            assert self.host is not None
            with smtplib.SMTP(self.host, self.port, timeout=20) as server:
                if self.use_tls:
                    server.starttls()
                if self.user and self.password:
                    server.login(self.user, self.password)
                server.send_message(msg)
            return True
        except Exception as exc:
            logger.warning("Email to %s failed: %s", to, exc)
            return False

    async def send_bulk(self, recipients: list[str], subject: str, html: str, text: str | None = None) -> int:
        """Send the same email to many recipients. Returns success count.
        Bounded concurrency keeps SMTP providers happy."""
        if not recipients:
            return 0
        sem = asyncio.Semaphore(_BATCH_CONCURRENCY)

        async def _one(to: str) -> bool:
            async with sem:
                return await self.send(to, subject, html, text)

        results = await asyncio.gather(*(_one(r) for r in recipients), return_exceptions=False)
        return sum(1 for r in results if r)


def _strip_html(html: str) -> str:
    import re
    return re.sub(r"<[^>]+>", "", html).strip()


email_service = EmailService()
