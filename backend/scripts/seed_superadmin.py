"""Seed a superadmin user in the database.

Standalone async script — runs inside the API container.
Usage: python -m scripts.seed_superadmin <email> <password> [--birth-date YYYY-MM-DD]
"""

import argparse
import asyncio
import sys
from datetime import UTC, date, datetime

from motor.motor_asyncio import AsyncIOMotorClient

from src.core.config import settings
from src.core.security import hash_password


async def seed_superadmin(email: str, password: str, birth_date: str | None = None) -> None:
    client: AsyncIOMotorClient = AsyncIOMotorClient(settings.mongodb_uri)
    db = client[settings.mongodb_database]
    collection = db["users"]
    # Emails are stored lower-cased; lookups fold the query (AuthReadRepository).
    email = email.strip().lower()

    existing = await collection.find_one({"email": email})
    if existing:
        print(f"User with email '{email}' already exists — skipping.")
        client.close()
        return

    now = datetime.now(UTC)
    document = {
        "email": email,
        "password_hash": hash_password(password),
        # Seeded accounts skip email verification.
        "status": "active",
        "credits": 0,
        "is_superadmin": True,
        "created_at": now,
        "updated_at": now,
    }

    # Only when asked for (the dev compose service does, so the profile shows a card of
    # the day); production superadmins get no invented date of birth.
    if birth_date:
        document["birth_date"] = birth_date

    result = await collection.insert_one(document)
    print(f"Superadmin created: {email} (id: {result.inserted_id})")
    client.close()


def main() -> None:
    parser = argparse.ArgumentParser(description="Seed a superadmin user")
    parser.add_argument("email", help="Superadmin email address")
    parser.add_argument("password", help="Superadmin password")
    parser.add_argument(
        "--birth-date",
        help="Optional ISO date (YYYY-MM-DD) to store as the account's birth date",
    )
    args = parser.parse_args()
    if args.birth_date:
        date.fromisoformat(args.birth_date)  # fail early on a malformed value

    asyncio.run(seed_superadmin(args.email, args.password, args.birth_date))


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print(f"ERROR: {e}", file=sys.stderr)
        sys.exit(1)
