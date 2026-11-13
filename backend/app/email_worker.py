"""Deliver committed account mail. Run separately from the HTTP server."""

import argparse
import logging
import os
import smtplib
import ssl
import time
from datetime import UTC, datetime, timedelta
from email.message import EmailMessage
from email.utils import format_datetime
from hashlib import sha256
from pathlib import Path

from sqlalchemy import select

from app.core.config import Settings, get_settings
from app.core.database import create_engine_for_url, create_session_factory
from app.models.account import AccountToken
from app.models.user import User
from app.services.account import link_token

logger = logging.getLogger(__name__)


def deliver(message: EmailMessage, token_id: str, settings: Settings) -> None:
    if settings.mail_mode == "outbox":
        # Keep local links copyable as plain UTF-8, without MIME soft wrapping.
        message.set_content(message.get_content(), cte="8bit")
        folder = Path(settings.mail_outbox)
        folder.mkdir(mode=0o700, parents=True, exist_ok=True)
        target = folder / f"{token_id}.eml"
        # Exclusive permissions on POSIX; Windows uses the containing user ACL.
        with open(
            target,
            "wb",
            opener=lambda path, flags: os.open(path, flags, 0o600),
        ) as stream:
            stream.write(message.as_bytes())
        return
    with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=15) as server:
        server.ehlo()
        server.starttls(context=ssl.create_default_context())
        server.ehlo()
        server.login(settings.smtp_username, settings.smtp_password)
        server.send_message(message)


def deliver_batch(factory, settings: Settings) -> int:
    count = 0
    # Lock one committed queue row at a time. Concurrent PostgreSQL workers skip it.
    for _ in range(50):
        with factory.begin() as session:
            now = datetime.now(UTC)
            record = session.scalar(
                select(AccountToken)
                .where(
                    AccountToken.sent_at.is_(None),
                    AccountToken.used_at.is_(None),
                    AccountToken.expires_at > now,
                    AccountToken.next_attempt_at <= now,
                    AccountToken.attempts < 5,
                )
                .order_by(AccountToken.created_at)
                .with_for_update(skip_locked=True)
                .limit(1)
            )
            if record is None:
                break
            user = session.get(User, record.user_id)
            if (
                user is None
                or not user.is_active
                or (
                    user.privacy_version
                    if record.purpose == "private"
                    else user.credential_version
                )
                != record.credential_version
            ):
                record.used_at = now
                continue
            raw = link_token(record, settings)
            if sha256(raw.encode()).hexdigest() != record.digest:
                record.used_at = now
                logger.warning(
                    "Queued link invalidated: API/worker signing keys differ "
                    "or the secret was rotated"
                )
                continue
            message = EmailMessage()
            message["From"] = settings.mail_from
            message["To"] = user.email
            message["Date"] = format_datetime(now)
            message["Subject"] = (
                "Tomohu — confirmar e-mail"
                if record.purpose == "verify"
                else "Tomohu — recuperar senha de privacidade"
                if record.purpose == "private"
                else "Tomohu — recuperar senha"
            )
            message["Message-ID"] = f"<{record.id}@tomohu>"
            link = (
                settings.frontend_url.rstrip("/")
                + "/#account/"
                + record.purpose
                + "/"
                + raw
            )
            message.set_content(
                f"Abra o link e confirme a ação no Tomohu:\n{link}\n\n"
                "O link expira em 30 minutos, tem uso único e não altera "
                "seus cadernos. Se não pediu esta ação, ignore este e-mail."
            )
            try:
                deliver(message, record.id, settings)
            except (OSError, smtplib.SMTPException):
                record.attempts += 1
                record.next_attempt_at = now + timedelta(
                    seconds=30 * 2**record.attempts
                )
                logger.warning("Account mail delivery failed; retry scheduled")
            else:
                record.sent_at = datetime.now(UTC)
                count += 1
    return count


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--once", action="store_true")
    args = parser.parse_args()
    settings = get_settings()
    if not os.getenv("TOMOHU_JWT_SECRET"):
        raise SystemExit(
            "Set TOMOHU_JWT_SECRET identically for the API and mail worker "
            "before sending account links."
        )
    engine = create_engine_for_url(settings.database_url)
    factory = create_session_factory(engine)
    try:
        while True:
            deliver_batch(factory, settings)
            if args.once:
                return
            time.sleep(5)
    finally:
        engine.dispose()


if __name__ == "__main__":
    main()
