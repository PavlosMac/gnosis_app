import asyncio
import importlib
import types
from datetime import UTC, datetime
from pathlib import Path

import structlog
from motor.motor_asyncio import AsyncIOMotorDatabase

logger = structlog.stdlib.get_logger(__name__)

MIGRATIONS_COLLECTION = "_migrations"


def discover_migrations() -> list[types.ModuleType]:
    versions_dir = Path(__file__).parent / "versions"
    files = sorted(f for f in versions_dir.glob("*.py") if f.name != "__init__.py")
    return [importlib.import_module(f"src.migrations.versions.{f.stem}") for f in files]


async def run_migrations(db: AsyncIOMotorDatabase) -> None:
    collection = db[MIGRATIONS_COLLECTION]
    await collection.create_index("version", unique=True)

    applied = {doc["version"] async for doc in collection.find({}, {"version": 1})}
    pending = [m for m in discover_migrations() if m.version not in applied]

    if not pending:
        logger.info("migrations up to date")
        return

    for migration in pending:
        logger.info(
            "applying migration", version=migration.version, description=migration.description
        )
        await migration.up(db)
        await collection.insert_one(
            {
                "version": migration.version,
                "description": migration.description,
                "applied_at": datetime.now(UTC),
            }
        )
        logger.info("migration applied", version=migration.version)


if __name__ == "__main__":

    async def _main() -> None:
        from src.core.logging import configure_logging
        from src.database.mongodb import close_mongo_connection, connect_to_mongo, get_database

        configure_logging()
        await connect_to_mongo()
        try:
            await run_migrations(get_database())
        finally:
            await close_mongo_connection()

    asyncio.run(_main())
