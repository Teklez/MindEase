"""
Demo user seeding.

Creates a small cast of hand-crafted "persona" users plus a larger pool of
generated users so the app has enough data to demo and stress-test lists,
charts, and group flows.

All demo users share the password ``demo`` and live under the
``@mindease.demo`` email domain, which is the sentinel the orchestrator uses
to detect (and optionally wipe) the demo dataset.
"""
from __future__ import annotations

import random
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import hash_password
from app.models.user import User


DEMO_DOMAIN = "mindease.demo"
DEMO_PASSWORD = "demo"


@dataclass
class PersonaSpec:
    """A hand-crafted demo user. Drives `seed_activity` so the data tells a story."""

    email: str
    display_name: str
    # Story arc per `seed_activity` — pick one of:
    #   "recovering"  — starts low, gradually improves (default protagonist)
    #   "thriving"    — mostly good, occasional dips
    #   "struggling"  — persistent low mood, recent crisis flag
    #   "new_user"    — sparse activity, just started ~2 weeks ago
    #   "consistent"  — steady middle mood, daily logger
    arc: str = "recovering"
    # Days ago the account was created; activity is scoped to this window.
    joined_days_ago: int = 90
    # Bias for which AI personas the user chats with most.
    preferred_personas: list[str] = field(default_factory=lambda: ["sage", "marcus"])


PERSONAS: list[PersonaSpec] = [
    PersonaSpec(
        email="alice@mindease.demo",
        display_name="Alice Tadesse",
        arc="recovering",
        joined_days_ago=90,
        preferred_personas=["sage", "marcus"],
    ),
    PersonaSpec(
        email="marcus@mindease.demo",
        display_name="Marcus Bekele",
        arc="thriving",
        joined_days_ago=85,
        preferred_personas=["marcus", "sage"],
    ),
    PersonaSpec(
        email="sara@mindease.demo",
        display_name="Sara Haile",
        arc="struggling",
        joined_days_ago=70,
        preferred_personas=["kira", "dr_chen"],
    ),
    PersonaSpec(
        email="david@mindease.demo",
        display_name="David Wolde",
        arc="consistent",
        joined_days_ago=90,
        preferred_personas=["marcus", "dr_chen"],
    ),
    PersonaSpec(
        email="hana@mindease.demo",
        display_name="Hana Yohannes",
        arc="new_user",
        joined_days_ago=14,
        preferred_personas=["sage"],
    ),
]


# Pool used to generate the bulk demo users. Mix of common Ethiopian names
# and international names so group rosters look diverse.
_FIRST_NAMES = [
    "Yonas", "Selam", "Bethel", "Dawit", "Mahlet", "Kalkidan", "Eyob", "Ruth",
    "Abel", "Tigist", "Bereket", "Mariam", "Helen", "Solomon", "Liya", "Daniel",
    "Aisha", "Noah", "Maya", "Leo", "Sophie", "Adam", "Lina", "Omar",
    "Priya", "Carlos", "Emma", "Felix", "Zoe", "Theo",
]

_LAST_NAMES = [
    "Tesfaye", "Girma", "Alemu", "Mekonnen", "Demissie", "Tadesse", "Asfaw",
    "Berhanu", "Gebre", "Negussie", "Ali", "Hassan", "Khan", "Patel",
    "Silva", "Cohen", "Nguyen", "Park", "Andersen", "Marquez",
]


def _generate_user_specs(count: int, rng: random.Random) -> list[PersonaSpec]:
    """Produce N stochastic persona specs. Idempotent given the same `rng` seed."""
    arcs = ["recovering", "thriving", "consistent", "new_user", "struggling"]
    arc_weights = [30, 25, 25, 15, 5]
    persona_options = [
        ["sage", "marcus"],
        ["marcus", "kira"],
        ["dr_chen", "sage"],
        ["kira", "dr_chen"],
        ["sage"],
        ["marcus"],
    ]

    specs: list[PersonaSpec] = []
    used_emails: set[str] = set()
    i = 0
    while len(specs) < count:
        first = rng.choice(_FIRST_NAMES)
        last = rng.choice(_LAST_NAMES)
        email = f"{first.lower()}.{last.lower()}{i}@{DEMO_DOMAIN}"
        if email in used_emails:
            i += 1
            continue
        used_emails.add(email)
        arc = rng.choices(arcs, weights=arc_weights, k=1)[0]
        joined = 14 if arc == "new_user" else rng.randint(30, 90)
        specs.append(
            PersonaSpec(
                email=email,
                display_name=f"{first} {last}",
                arc=arc,
                joined_days_ago=joined,
                preferred_personas=rng.choice(persona_options),
            )
        )
        i += 1
    return specs


async def get_existing_demo_users(db: AsyncSession) -> list[User]:
    """Return all users whose email is in the demo domain."""
    result = await db.execute(
        select(User).where(User.email.like(f"%@{DEMO_DOMAIN}"))
    )
    return list(result.scalars().all())


async def seed_users(
    db: AsyncSession,
    *,
    extra_generated: int = 25,
    rng_seed: int = 42,
) -> list[tuple[User, PersonaSpec]]:
    """Insert demo users (idempotent — skips any already present).

    Returns the full list of demo users paired with their PersonaSpec so
    downstream seeders can drive activity per-arc.
    """
    rng = random.Random(rng_seed)
    specs = PERSONAS + _generate_user_specs(extra_generated, rng)

    # Hash the shared password once.
    pw_hash = hash_password(DEMO_PASSWORD)

    now = datetime.now(timezone.utc)
    results: list[tuple[User, PersonaSpec]] = []

    for spec in specs:
        existing = await db.execute(select(User).where(User.email == spec.email))
        user = existing.scalar_one_or_none()
        if user is None:
            user = User(
                email=spec.email,
                password_hash=pw_hash,
                display_name=spec.display_name,
                is_verified=True,
                account_status="active",
                created_at=now - timedelta(days=spec.joined_days_ago),
                last_login=now - timedelta(hours=rng.randint(1, 72)),
            )
            db.add(user)
            await db.flush()  # populate user_id
        results.append((user, spec))

    await db.commit()
    return results
