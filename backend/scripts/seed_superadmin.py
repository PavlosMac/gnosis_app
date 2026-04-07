"""Seed a superadmin user in the database.

Standalone async script — runs inside the API container.
Usage: python -m scripts.seed_superadmin <email> <password> [display_name]
"""

import argparse
import asyncio
import sys
from datetime import UTC, datetime

from motor.motor_asyncio import AsyncIOMotorClient

from src.core.config import settings
from src.core.security import hash_password


async def seed_superadmin(email: str, password: str, display_name: str | None) -> None:
    client: AsyncIOMotorClient = AsyncIOMotorClient(settings.mongodb_uri)
    db = client[settings.mongodb_database]
    collection = db["users"]

    existing = await collection.find_one({"email": email})
    if existing:
        print(f"User with email '{email}' already exists — skipping.")
        client.close()
        return

    now = datetime.now(UTC)
    document = {
        "email": email,
        "password_hash": hash_password(password),
        "credits": 0,
        "is_superadmin": True,
        "created_at": now,
        "updated_at": now,
    }
    if display_name:
        document["display_name"] = display_name

    result = await collection.insert_one(document)
    print(f"Superadmin created: {email} (id: {result.inserted_id})")
    client.close()


def main() -> None:
    parser = argparse.ArgumentParser(description="Seed a superadmin user")
    parser.add_argument("email", help="Superadmin email address")
    parser.add_argument("password", help="Superadmin password")
    parser.add_argument("display_name", nargs="?", default=None, help="Display name (optional)")
    args = parser.parse_args()

    asyncio.run(seed_superadmin(args.email, args.password, args.display_name))


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print(f"ERROR: {e}", file=sys.stderr)
        sys.exit(1)
