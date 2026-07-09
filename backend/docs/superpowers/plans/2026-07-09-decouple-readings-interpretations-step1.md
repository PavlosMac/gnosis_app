# Decouple Readings from Interpretations — Step 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split reading creation from interpretation generation into separate persistence models and endpoints — a reading can be saved without an interpretation, an interpretation can be previewed without being saved, and saving is an explicit, separate action. This is Step 1 of the phased build order in `docs/advanced-intrepretation.md` — no calibration/context tuning yet (that's Step 2); this step ships the target architecture with a hardcoded calibration default.

**Architecture:** New `src/interpretations/` domain (its own collection, model, repository, schemas, commands) alongside the existing `src/readings/` domain. `readings` documents are trimmed to drop embedded interpretation fields; a reading's interpretation now lives in a separate `interpretations` document, upserted by `reading_id` (one per reading, no history). `POST /readings` no longer calls the LLM. Two new endpoints — `POST /readings/{id}/interpretation/generate` (stateless preview) and `POST /readings/{id}/interpretation` (save/upsert) — do that work explicitly.

**Tech Stack:** FastAPI, Motor (async MongoDB), Pydantic v2, pytest-asyncio + mongomock-motor, CQRS/Mediator pattern (see `CLAUDE.md`).

## Global Constraints

- Never use `HTTPException` — all errors go through the `AppError` hierarchy (`src/core/exceptions.py`); reuse `ReadingNotFoundError` (`src/readings/service.py`) for ownership failures on reading-scoped endpoints.
- Commands and their handlers are co-located in one file under `commands/`; queries and handlers under `queries/`.
- All `__init__.py` files are empty.
- Services/repos are injected into routers via the mediator — never construct a service/repo directly in a route handler.
- Ruff: line length 100, rules E/F/I/N/W/UP (UP046 ignored). Run `make lint` before committing.
- Type hints: `X | Y` not `Optional[X]`; lowercase `dict`/`list` generics; explicit return types including `-> None`.
- No magic numbers — `DEFAULT_CALIBRATION = 3` is a named constant in `src/interpretations/schemas.py`, imported wherever needed, never inlined as a literal `3`.
- Test commands: use `make test-docker params="<pytest node ids>"` for anything importing the full app (controllers, routers, integration) — `make test` fails on those with `ModuleNotFoundError: data_algorithm` (environment limitation, not a code defect). Pure unit tests with no app import can use `make test`.
- `tests/conftest.py`'s `mock_db` fixture (mongomock-motor) is autouse; don't add new fixtures that bypass it.

---

## Task 1: Interpretations collection — constant and migrations

**Files:**
- Modify: `src/database/collections/constants.py`
- Create: `src/migrations/versions/005_interpretations_indexes.py`
- Create: `src/migrations/versions/006_backfill_interpretations.py`

**Interfaces:**
- Produces: `INTERPRETATIONS_COLLECTION` constant, consumed by every file in Task 2 onward.

No dedicated test file — this repo has no per-migration-file tests (`001`–`004` have none either; only the generic runner is tested in `tests/migrations/test_runner.py`). Verified by running the existing runner test suite and via `make migrate` / dev server restart per `docs/db_migrations.md`.

- [ ] **Step 1: Add the collection constant**

Edit `src/database/collections/constants.py`:

```python
USERS_COLLECTION = "users"
REFRESH_TOKENS_COLLECTION = "refresh_tokens"
READINGS_COLLECTION = "readings"
INTERPRETATIONS_COLLECTION = "interpretations"
```

- [ ] **Step 2: Create the index migration**

Create `src/migrations/versions/005_interpretations_indexes.py`:

```python
from motor.motor_asyncio import AsyncIOMotorDatabase

from src.database.collections.constants import INTERPRETATIONS_COLLECTION

version = "005"
description = "Create unique index on reading_id for interpretations collection"


async def up(db: AsyncIOMotorDatabase) -> None:
    await db[INTERPRETATIONS_COLLECTION].create_index("reading_id", unique=True)
```

- [ ] **Step 3: Create the backfill migration**

Create `src/migrations/versions/006_backfill_interpretations.py`:

```python
from motor.motor_asyncio import AsyncIOMotorDatabase

from src.database.collections.constants import INTERPRETATIONS_COLLECTION, READINGS_COLLECTION

version = "006"
description = "Backfill interpretations collection from embedded reading data"

_DEFAULT_CALIBRATION = 3  # pre-calibration readings had no setting; assume neutral


async def up(db: AsyncIOMotorDatabase) -> None:
    async for reading in db[READINGS_COLLECTION].find({"card_interpretations": {"$exists": True}}):
        await db[INTERPRETATIONS_COLLECTION].update_one(
            {"reading_id": reading["_id"]},
            {
                "$setOnInsert": {
                    "reading_id": reading["_id"],
                    "user_id": reading["user_id"],
                    "card_interpretations": reading["card_interpretations"],
                    "synthesis": reading["synthesis"],
                    "tokens_used": reading.get("tokens_used", 0),
                    "model": reading.get("model", ""),
                    "calibration": _DEFAULT_CALIBRATION,
                }
            },
            upsert=True,
        )
```

- [ ] **Step 4: Run the existing migration runner tests to confirm nothing broke**

Run: `make test-docker params="tests/migrations"`
Expected: PASS (these test the generic runner mechanism with fake migration modules — unaffected by adding real migration files, but confirms the harness still works).

- [ ] **Step 5: Commit**

```bash
git add src/database/collections/constants.py src/migrations/versions/005_interpretations_indexes.py src/migrations/versions/006_backfill_interpretations.py
git commit -m "feat: add interpretations collection index and backfill migration"
```

---

## Task 2: Interpretations domain scaffold — model, repository, schemas

**Files:**
- Create: `src/interpretations/__init__.py`
- Create: `src/interpretations/models.py`
- Create: `src/interpretations/repository.py`
- Create: `src/interpretations/schemas.py`
- Create: `tests/interpretations/__init__.py`
- Test: `tests/interpretations/test_repository.py`

**Interfaces:**
- Consumes: `INTERPRETATIONS_COLLECTION` (Task 1), `BaseReadRepository`/`BaseWriteRepository` (`src/database/base_repository.py`), `AppSchema` (`src/core/base_schema.py`), `PyObjectId` (`src/core/types.py`), `Orientation` (`src/llm/schemas.py`).
- Produces: `Interpretation` (model, with `to_document()`/`from_document()`), `InterpretationWriteRepository.upsert_by_reading_id(reading_id: str, document: dict) -> None`, `InterpretationReadRepository.find_by_reading_id(reading_id: str) -> dict | None`, `CardInterpretationReadModel`, `GeneratedInterpretationResponse`, `SaveInterpretationRequest`, `InterpretationReadModel`, `DEFAULT_CALIBRATION = 3` — all consumed by Tasks 4–9.

- [ ] **Step 1: Write the failing repository test**

Create `tests/interpretations/__init__.py` (empty).

Create `tests/interpretations/test_repository.py`:

```python
import pytest
from bson import ObjectId

from src.interpretations.models import Interpretation
from src.interpretations.repository import (
    InterpretationReadRepository,
    InterpretationWriteRepository,
)


@pytest.fixture
def repos(mock_db):
    return InterpretationWriteRepository(mock_db), InterpretationReadRepository(mock_db)


def _make_interpretation(reading_id: str, user_id: str, calibration: int = 3) -> Interpretation:
    return Interpretation(
        reading_id=reading_id,
        user_id=user_id,
        card_interpretations=[
            {
                "card_name": "The Fool",
                "position": "Present",
                "orientation": "upright",
                "interpretation": "New beginnings.",
            }
        ],
        synthesis="A journey begins.",
        tokens_used=42,
        model="mock",
        calibration=calibration,
    )


async def test_upsert_by_reading_id_creates_new_document(repos):
    write_repo, read_repo = repos
    reading_id = str(ObjectId())
    user_id = str(ObjectId())
    interpretation = _make_interpretation(reading_id, user_id)

    await write_repo.upsert_by_reading_id(reading_id, interpretation.to_document())

    doc = await read_repo.find_by_reading_id(reading_id)
    assert doc is not None
    assert str(doc["reading_id"]) == reading_id
    assert str(doc["user_id"]) == user_id
    assert doc["synthesis"] == "A journey begins."
    assert doc["calibration"] == 3


async def test_upsert_by_reading_id_replaces_existing_document(repos):
    write_repo, read_repo = repos
    reading_id = str(ObjectId())
    user_id = str(ObjectId())

    await write_repo.upsert_by_reading_id(
        reading_id, _make_interpretation(reading_id, user_id, calibration=3).to_document()
    )
    await write_repo.upsert_by_reading_id(
        reading_id, _make_interpretation(reading_id, user_id, calibration=5).to_document()
    )

    doc = await read_repo.find_by_reading_id(reading_id)
    assert doc["calibration"] == 5
    count = await read_repo.count({"reading_id": ObjectId(reading_id)})
    assert count == 1


async def test_find_by_reading_id_returns_none_when_missing(repos):
    _, read_repo = repos
    result = await read_repo.find_by_reading_id(str(ObjectId()))
    assert result is None


def test_interpretation_round_trips_through_document():
    reading_id = str(ObjectId())
    user_id = str(ObjectId())
    interpretation = _make_interpretation(reading_id, user_id, calibration=4)
    interpretation.id = str(ObjectId())

    restored = Interpretation.from_document(interpretation.to_document())

    assert restored.reading_id == reading_id
    assert restored.user_id == user_id
    assert restored.calibration == 4
    assert restored.synthesis == "A journey begins."
    assert restored.tokens_used == 42
```

- [ ] **Step 2: Run test to verify it fails**

Run: `make test-docker params="tests/interpretations/test_repository.py"`
Expected: FAIL with `ModuleNotFoundError: No module named 'src.interpretations'`

- [ ] **Step 3: Create the domain model**

Create `src/interpretations/__init__.py` (empty).

Create `src/interpretations/models.py`:

```python
from datetime import UTC, datetime
from typing import Any

from bson import ObjectId


class Interpretation:
    def __init__(
        self,
        reading_id: str,
        user_id: str,
        card_interpretations: list[dict[str, Any]],
        synthesis: str,
        tokens_used: int,
        model: str,
        calibration: int,
        context: str | None = None,
        id: str | None = None,
        created_at: datetime | None = None,
        updated_at: datetime | None = None,
    ) -> None:
        self.id = id
        self.reading_id = reading_id
        self.user_id = user_id
        self.card_interpretations = card_interpretations
        self.synthesis = synthesis
        self.tokens_used = tokens_used
        self.model = model
        self.calibration = calibration
        self.context = context
        self.created_at = created_at or datetime.now(UTC)
        self.updated_at = updated_at or datetime.now(UTC)

    def to_document(self) -> dict[str, Any]:
        doc: dict[str, Any] = {
            "reading_id": ObjectId(self.reading_id),
            "user_id": ObjectId(self.user_id),
            "card_interpretations": self.card_interpretations,
            "synthesis": self.synthesis,
            "tokens_used": self.tokens_used,
            "model": self.model,
            "calibration": self.calibration,
            "created_at": self.created_at,
            "updated_at": self.updated_at,
        }
        if self.id:
            doc["_id"] = ObjectId(self.id)
        if self.context is not None:
            doc["context"] = self.context
        return doc

    @classmethod
    def from_document(cls, doc: dict[str, Any]) -> "Interpretation":
        return cls(
            id=str(doc["_id"]),
            reading_id=str(doc["reading_id"]),
            user_id=str(doc["user_id"]),
            card_interpretations=doc["card_interpretations"],
            synthesis=doc["synthesis"],
            tokens_used=doc["tokens_used"],
            model=doc["model"],
            calibration=doc["calibration"],
            context=doc.get("context"),
            created_at=doc.get("created_at"),
            updated_at=doc.get("updated_at"),
        )
```

- [ ] **Step 4: Create the repository**

Create `src/interpretations/repository.py`:

```python
from typing import Any

from bson import ObjectId

from src.database.base_repository import BaseReadRepository, BaseWriteRepository
from src.database.collections.constants import INTERPRETATIONS_COLLECTION


class InterpretationWriteRepository(BaseWriteRepository):
    @property
    def collection_name(self) -> str:
        return INTERPRETATIONS_COLLECTION

    async def upsert_by_reading_id(self, reading_id: str, document: dict[str, Any]) -> None:
        await self._collection.update_one(
            {"reading_id": ObjectId(reading_id)},
            {"$set": document},
            upsert=True,
        )


class InterpretationReadRepository(BaseReadRepository):
    @property
    def collection_name(self) -> str:
        return INTERPRETATIONS_COLLECTION

    async def find_by_reading_id(self, reading_id: str) -> dict[str, Any] | None:
        return await self.find_one({"reading_id": ObjectId(reading_id)})

    async def find_reading_ids_with_interpretation(self, reading_ids: list[str]) -> set[str]:
        if not reading_ids:
            return set()
        object_ids = [ObjectId(rid) for rid in reading_ids]
        cursor = self._collection.find({"reading_id": {"$in": object_ids}}, {"reading_id": 1})
        docs = await cursor.to_list(length=len(object_ids))
        return {str(doc["reading_id"]) for doc in docs}
```

(`find_reading_ids_with_interpretation` isn't exercised until Task 8, but it lives here since it belongs to this repository — it's a single batched query, not per-item, to avoid N+1 lookups when the list handler checks a whole page of readings at once.)

- [ ] **Step 5: Create the schemas**

Create `src/interpretations/schemas.py`:

```python
from datetime import datetime

from pydantic import Field

from src.core.base_schema import AppSchema
from src.core.types import PyObjectId
from src.llm.schemas import Orientation

DEFAULT_CALIBRATION = 3


class CardInterpretationReadModel(AppSchema):
    card_name: str
    position: str
    orientation: Orientation
    interpretation: str


class GeneratedInterpretationResponse(AppSchema):
    card_interpretations: list[CardInterpretationReadModel]
    synthesis: str
    model: str
    tokens_used: int
    calibration: int


class SaveInterpretationRequest(AppSchema):
    card_interpretations: list[CardInterpretationReadModel] = Field(..., min_length=1)
    synthesis: str = Field(..., min_length=1)
    model: str = Field(..., min_length=1)
    tokens_used: int = Field(..., ge=0)


class InterpretationReadModel(AppSchema):
    id: PyObjectId = Field(alias="_id")
    reading_id: PyObjectId
    user_id: PyObjectId
    card_interpretations: list[CardInterpretationReadModel]
    synthesis: str
    tokens_used: int
    model: str
    calibration: int
    context: str | None = None
    created_at: datetime
    updated_at: datetime
```

- [ ] **Step 6: Run test to verify it passes**

Run: `make test-docker params="tests/interpretations/test_repository.py"`
Expected: PASS (4 tests)

- [ ] **Step 7: Lint**

Run: `make lint`
Expected: no errors in the new files.

- [ ] **Step 8: Commit**

```bash
git add src/interpretations/ tests/interpretations/
git commit -m "feat: scaffold interpretations domain model, repository, and schemas"
```

---

## Task 3: Persist position_description on reading cards

**Problem:** `CardInSpread` (`src/llm/schemas.py:14-25`) has an optional `position_description` the frontend sends at creation time for LLM context, but `CreateReadingHandler` never persists it (`src/readings/commands/create_reading.py:46-53`) — it's used once and discarded. Once `generate` (Task 5) can re-run the LLM call later from the saved reading, that context needs to survive.

**Files:**
- Modify: `src/readings/commands/create_reading.py`
- Modify: `src/readings/schemas.py`
- Test: `tests/readings/test_commands.py`

**Interfaces:**
- Produces: `Reading.cards` dicts now always include a `position_description` key (`str | None`); `CardReadModel.position_description: str | None`.

- [ ] **Step 1: Write the failing test**

Add to `tests/readings/test_commands.py` (after `test_create_reading_without_question`):

```python
async def test_create_reading_persists_position_description(handler):
    command = CreateReadingCommand(
        user_id=str(ObjectId()),
        spread_name="Celtic Cross",
        cards=[
            CardInSpread(
                name="The Fool",
                position="Present",
                orientation="upright",
                position_description="Will, drive, and what energises the situation",
            ),
        ],
    )
    result = await handler.handle(command)
    assert result.cards[0].position_description == (
        "Will, drive, and what energises the situation"
    )
```

- [ ] **Step 2: Run test to verify it fails**

Run: `make test-docker params="tests/readings/test_commands.py::test_create_reading_persists_position_description"`
Expected: FAIL with `AttributeError: 'CardReadModel' object has no attribute 'position_description'`

- [ ] **Step 3: Persist the field in the handler**

Edit `src/readings/commands/create_reading.py`, replace the `cards=[...]` comprehension inside `CreateReadingHandler.handle()` (currently lines 46-53):

```python
            cards=[
                {
                    "name": card.name,
                    "position": card.position,
                    "orientation": card.orientation.value,
                    "position_description": card.position_description,
                }
                for card in command.cards
            ],
```

- [ ] **Step 4: Expose the field on the read model**

Edit `src/readings/schemas.py`, replace `CardReadModel` (currently lines 56-59):

```python
class CardReadModel(AppSchema):
    name: str
    position: str
    orientation: Orientation
    position_description: str | None = None
```

- [ ] **Step 5: Run test to verify it passes**

Run: `make test-docker params="tests/readings/test_commands.py"`
Expected: PASS (all tests in file, including the new one)

- [ ] **Step 6: Commit**

```bash
git add src/readings/commands/create_reading.py src/readings/schemas.py tests/readings/test_commands.py
git commit -m "fix: persist position_description on reading cards for later regeneration"
```

---

## Task 4: Decouple CreateReadingHandler from the LLM

**This is the core breaking change.** `Reading` and `ReadingReadModel` are trimmed of interpretation fields in the same task as removing the LLM call from `CreateReadingHandler`, because a trimmed model and an unchanged handler can't coexist — the handler constructs `Reading(..., card_interpretations=..., synthesis=..., ...)`, so both must change together or the code won't even import.

**Files:**
- Modify: `src/readings/models.py`
- Modify: `src/readings/schemas.py`
- Modify: `src/readings/commands/create_reading.py`
- Modify: `src/main.py`
- Modify: `tests/conftest.py`
- Modify: `tests/readings/test_commands.py`
- Modify: `tests/readings/test_router.py`
- Modify: `tests/readings/test_queries.py`

**Interfaces:**
- Consumes: `InterpretationReadModel` (Task 2).
- Produces: `Reading` model with fields `user_id, spread_type, cards, question, birth_date, tags, id, created_at` only. `ReadingReadModel.interpretation: InterpretationReadModel | None = None`. `CreateReadingHandler.__init__(self, write_repo: ReadingWriteRepository) -> None` (no `llm` param) — this signature change is consumed by Tasks 5 onward's wiring.

- [ ] **Step 1: Write the failing tests**

Edit `tests/readings/test_commands.py`:

Remove the import `from src.llm.mock_adapter import MockLLMAdapter` (no longer used in this file after this task).

Replace the `handler` fixture:

```python
@pytest.fixture
def handler(mock_db):
    return CreateReadingHandler(write_repo=ReadingWriteRepository(mock_db))
```

Replace `test_create_reading_returns_read_model`:

```python
async def test_create_reading_returns_read_model(handler, valid_command):
    result = await handler.handle(valid_command)
    assert result.id is not None
    assert result.user_id == valid_command.user_id
    assert result.spread_type == "Celtic Cross"
    assert result.question == "What does the future hold?"
    assert len(result.cards) == 1
    assert result.cards[0].name == "The Fool"
    assert result.interpretation is None
```

Edit `tests/readings/test_router.py`, replace `test_create_reading`:

```python
async def test_create_reading(client, auth_token):
    resp = await client.post(
        "/api/v1/readings",
        json=VALID_READING_BODY,
        headers={"Authorization": f"Bearer {auth_token}"},
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["spread_type"] == "Celtic Cross"
    assert data["question"] == "What does the future hold?"
    assert len(data["cards"]) == 1
    assert data["interpretation"] is None
    assert data["_id"] is not None
```

Replace the interpretation assertion in `test_get_reading_by_id`:

```python
    assert data["_id"] == reading_id
    assert data["spread_type"] == "Celtic Cross"
    assert data["interpretation"] is None
```

(delete the old `assert len(data["card_interpretations"]) == 1` line)

Edit `tests/readings/test_queries.py`:

Remove the import `from src.llm.mock_adapter import MockLLMAdapter`.

Replace the `create_handler` fixture:

```python
@pytest.fixture
def create_handler(repos):
    write_repo, _ = repos
    return CreateReadingHandler(write_repo=write_repo)
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `make test-docker params="tests/readings"`
Expected: FAIL — `TypeError: CreateReadingHandler.__init__() got an unexpected keyword argument` or similar, since the fixtures no longer pass `llm` but the handler still requires it.

- [ ] **Step 3: Trim the domain model**

Replace `src/readings/models.py` in full:

```python
from datetime import UTC, date, datetime
from typing import Any

from bson import ObjectId


class Reading:
    def __init__(
        self,
        user_id: str,
        spread_type: str,
        cards: list[dict[str, Any]],
        question: str | None = None,
        birth_date: date | None = None,
        tags: list[str] | None = None,
        id: str | None = None,
        created_at: datetime | None = None,
    ) -> None:
        self.id = id
        self.user_id = user_id
        self.spread_type = spread_type
        self.question = question
        self.birth_date = birth_date
        self.tags = tags if tags is not None else []
        self.cards = cards
        self.created_at = created_at or datetime.now(UTC)

    def to_document(self) -> dict[str, Any]:
        doc: dict[str, Any] = {
            "user_id": ObjectId(self.user_id),
            "spread_type": self.spread_type,
            "cards": self.cards,
            "created_at": self.created_at,
        }
        if self.id:
            doc["_id"] = ObjectId(self.id)
        if self.question is not None:
            doc["question"] = self.question
        if self.birth_date is not None:
            doc["birth_date"] = self.birth_date.isoformat()
        if self.tags:
            doc["tags"] = self.tags
        return doc

    @classmethod
    def from_document(cls, doc: dict[str, Any]) -> "Reading":
        return cls(
            id=str(doc["_id"]),
            user_id=str(doc["user_id"]),
            spread_type=doc["spread_type"],
            question=doc.get("question"),
            birth_date=date.fromisoformat(doc["birth_date"]) if doc.get("birth_date") else None,
            tags=doc.get("tags", []),
            cards=doc["cards"],
            created_at=doc.get("created_at"),
        )
```

- [ ] **Step 4: Trim and extend the schemas**

Replace `src/readings/schemas.py` in full:

```python
from datetime import date, datetime

from pydantic import Field, field_validator

from src.core.base_schema import AppSchema
from src.core.types import PyObjectId
from src.interpretations.schemas import InterpretationReadModel
from src.llm.schemas import CardInSpread, Orientation

MAX_TAGS_PER_READING = 5
MAX_TAG_LENGTH = 25


def parse_comma_separated_tags(raw: str) -> list[str]:
    seen: set[str] = set()
    normalized: list[str] = []
    for piece in raw.split(","):
        tag = piece.strip().lower()
        if not tag or tag in seen:
            continue
        seen.add(tag)
        normalized.append(tag)
    return normalized


class CreateReadingRequest(AppSchema):
    spread_name: str = Field(..., min_length=1, max_length=100)
    question: str | None = Field(default=None, min_length=5, max_length=500)
    birth_date: date | None = Field(default=None)
    cards: list[CardInSpread] = Field(..., min_length=1, max_length=12)


class UpdateReadingTagsRequest(AppSchema):
    tags: list[str]

    @field_validator("tags", mode="before")
    @classmethod
    def validate_tags(cls, value: str) -> list[str]:
        if not isinstance(value, str):
            raise ValueError("tags must be a comma-separated string")
        parsed = parse_comma_separated_tags(value)
        if len(parsed) > MAX_TAGS_PER_READING:
            raise ValueError(f"A reading can have at most {MAX_TAGS_PER_READING} tags")
        for tag in parsed:
            if len(tag) > MAX_TAG_LENGTH:
                raise ValueError(f"Each tag must be at most {MAX_TAG_LENGTH} characters")
        return parsed


class CardReadModel(AppSchema):
    name: str
    position: str
    orientation: Orientation
    position_description: str | None = None


class ReadingReadModel(AppSchema):
    id: PyObjectId = Field(alias="_id")
    user_id: PyObjectId
    spread_type: str
    question: str | None = None
    birth_date: date | None = None
    tags: list[str] = Field(default_factory=list)
    cards: list[CardReadModel]
    interpretation: InterpretationReadModel | None = None
    created_at: datetime


class ReadingListItem(AppSchema):
    id: PyObjectId = Field(alias="_id")
    user_id: PyObjectId
    spread_type: str
    question: str | None = None
    birth_date: date | None = None
    tags: list[str] = Field(default_factory=list)
    cards: list[CardReadModel]
    created_at: datetime
```

(`CardInterpretationReadModel` is deleted from this file — it's orphaned by removing the flat `card_interpretations` field, and `src/interpretations/schemas.py` now owns the equivalent shape.)

- [ ] **Step 5: Drop the LLM call from the handler**

Replace `src/readings/commands/create_reading.py` in full:

```python
from datetime import date

import structlog

from src.cqrs.commands import BaseCommand, CommandHandler
from src.llm.schemas import CardInSpread
from src.readings.models import Reading
from src.readings.repository import ReadingWriteRepository
from src.readings.schemas import ReadingReadModel

logger = structlog.stdlib.get_logger(__name__)


class CreateReadingCommand(BaseCommand):
    user_id: str
    spread_name: str
    question: str | None = None
    birth_date: date | None = None
    cards: list[CardInSpread]


class CreateReadingHandler(CommandHandler[CreateReadingCommand, ReadingReadModel]):
    def __init__(self, write_repo: ReadingWriteRepository) -> None:
        self._write_repo = write_repo

    async def handle(self, command: CreateReadingCommand) -> ReadingReadModel:
        reading = Reading(
            user_id=command.user_id,
            spread_type=command.spread_name,
            question=command.question,
            birth_date=command.birth_date,
            cards=[
                {
                    "name": card.name,
                    "position": card.position,
                    "orientation": card.orientation.value,
                    "position_description": card.position_description,
                }
                for card in command.cards
            ],
        )

        document = reading.to_document()
        logger.debug("saving reading", document=document)
        reading_id = await self._write_repo.insert(document)

        return ReadingReadModel.model_validate(
            {
                "_id": reading_id,
                "user_id": command.user_id,
                "spread_type": reading.spread_type,
                "question": reading.question,
                "birth_date": reading.birth_date,
                "cards": reading.cards,
                "interpretation": None,
                "created_at": reading.created_at,
            }
        )
```

- [ ] **Step 6: Update main.py wiring**

Edit `src/main.py`, change line 62 from:

```python
    mediator.register_command(CreateReadingCommand, CreateReadingHandler(reading_write_repo, llm))
```

to:

```python
    mediator.register_command(CreateReadingCommand, CreateReadingHandler(reading_write_repo))
```

(leave the `llm` parameter on `_wire_mediator(mediator, llm)` itself — Task 5 needs it for `GenerateInterpretationHandler`.)

- [ ] **Step 7: Update the test app fixture**

Edit `tests/conftest.py`, change:

```python
    mediator.register_command(
        CreateReadingCommand, CreateReadingHandler(reading_write_repo, mock_llm)
    )
```

to:

```python
    mediator.register_command(CreateReadingCommand, CreateReadingHandler(reading_write_repo))
```

(leave `mock_llm = MockLLMAdapter()` and `app.state.llm = mock_llm` — both still used.)

- [ ] **Step 8: Run tests to verify they pass**

Run: `make test-docker params="tests/readings"`
Expected: PASS (all tests)

- [ ] **Step 9: Lint**

Run: `make lint`
Expected: no errors.

- [ ] **Step 10: Commit**

```bash
git add src/readings/models.py src/readings/schemas.py src/readings/commands/create_reading.py src/main.py tests/conftest.py tests/readings/test_commands.py tests/readings/test_router.py tests/readings/test_queries.py
git commit -m "feat: decouple reading creation from interpretation generation"
```

---

## Task 5: GenerateInterpretationCommand — stateless preview + token tracking

**Files:**
- Create: `src/interpretations/commands/__init__.py`
- Create: `src/interpretations/commands/generate_interpretation.py`
- Modify: `src/auth/models.py`
- Modify: `src/auth/repository.py`
- Create: `tests/interpretations/test_commands.py`

**Interfaces:**
- Consumes: `ReadingReadRepository` (`src/readings/repository.py`), `ReadingNotFoundError` (`src/readings/service.py`), `LLMPort`/`InterpretationRequest`/`CardInSpread` (`src/llm/`), `DEFAULT_CALIBRATION`/`GeneratedInterpretationResponse` (Task 2).
- Produces: `GenerateInterpretationCommand(reading_id: str, user_id: str)`, `GenerateInterpretationHandler.__init__(self, reading_read_repo, user_write_repo, llm) -> None` — consumed by Task 9's router wiring. `AuthWriteRepository.increment_tokens_used(user_id: str, tokens: int) -> None` — a new repository method, consumed nowhere else in Step 1.

- [ ] **Step 1: Write the failing tests**

Create `src/interpretations/commands/__init__.py` (empty).

Create `tests/interpretations/test_commands.py`:

```python
import pytest
from bson import ObjectId

from src.auth.repository import AuthWriteRepository
from src.interpretations.commands.generate_interpretation import (
    GenerateInterpretationCommand,
    GenerateInterpretationHandler,
)
from src.interpretations.schemas import DEFAULT_CALIBRATION
from src.llm.mock_adapter import MockLLMAdapter
from src.llm.schemas import CardInSpread
from src.readings.commands.create_reading import CreateReadingCommand, CreateReadingHandler
from src.readings.repository import ReadingReadRepository, ReadingWriteRepository
from src.readings.service import ReadingNotFoundError


@pytest.fixture
def user_id():
    return str(ObjectId())


@pytest.fixture
def reading_repos(mock_db):
    return ReadingWriteRepository(mock_db), ReadingReadRepository(mock_db)


@pytest.fixture
def create_reading_handler(reading_repos):
    write_repo, _ = reading_repos
    return CreateReadingHandler(write_repo=write_repo)


@pytest.fixture
def generate_handler(reading_repos, mock_db):
    _, read_repo = reading_repos
    return GenerateInterpretationHandler(
        reading_read_repo=read_repo,
        user_write_repo=AuthWriteRepository(mock_db),
        llm=MockLLMAdapter(),
    )


async def _create_reading(create_reading_handler, user_id: str):
    return await create_reading_handler.handle(
        CreateReadingCommand(
            user_id=user_id,
            spread_name="Celtic Cross",
            question="What lies ahead?",
            cards=[
                CardInSpread(
                    name="The Fool",
                    position="Present",
                    orientation="upright",
                    position_description="Will, drive, and what energises the situation",
                ),
            ],
        )
    )


async def test_generate_interpretation_returns_content(
    generate_handler, create_reading_handler, user_id
):
    reading = await _create_reading(create_reading_handler, user_id)
    result = await generate_handler.handle(
        GenerateInterpretationCommand(reading_id=reading.id, user_id=user_id)
    )
    assert len(result.card_interpretations) == 1
    assert result.card_interpretations[0].card_name == "The Fool"
    assert result.synthesis is not None
    assert result.model == "mock"
    assert result.calibration == DEFAULT_CALIBRATION


async def test_generate_interpretation_does_not_persist(
    generate_handler, create_reading_handler, user_id, mock_db
):
    reading = await _create_reading(create_reading_handler, user_id)
    await generate_handler.handle(
        GenerateInterpretationCommand(reading_id=reading.id, user_id=user_id)
    )
    count = await mock_db["interpretations"].count_documents({})
    assert count == 0


async def test_generate_interpretation_increments_total_tokens_used(
    generate_handler, create_reading_handler, user_id, mock_db
):
    reading = await create_reading_handler.handle(
        CreateReadingCommand(
            user_id=user_id,
            spread_name="Significators",
            cards=[
                CardInSpread(name="The Fool", position="day number", orientation="upright"),
            ],
        )
    )
    await mock_db["users"].insert_one({"_id": ObjectId(user_id), "total_tokens_used": 100})

    await generate_handler.handle(
        GenerateInterpretationCommand(reading_id=reading.id, user_id=user_id)
    )

    user_doc = await mock_db["users"].find_one({"_id": ObjectId(user_id)})
    assert user_doc["total_tokens_used"] == 100 + 4503  # MockLLMAdapter's significators tokens


async def test_generate_interpretation_not_found(generate_handler, user_id):
    with pytest.raises(ReadingNotFoundError):
        await generate_handler.handle(
            GenerateInterpretationCommand(reading_id=str(ObjectId()), user_id=user_id)
        )


async def test_generate_interpretation_wrong_user(
    generate_handler, create_reading_handler, user_id
):
    reading = await _create_reading(create_reading_handler, user_id)
    other_user = str(ObjectId())
    with pytest.raises(ReadingNotFoundError):
        await generate_handler.handle(
            GenerateInterpretationCommand(reading_id=reading.id, user_id=other_user)
        )
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `make test-docker params="tests/interpretations/test_commands.py"`
Expected: FAIL with `ModuleNotFoundError: No module named 'src.interpretations.commands.generate_interpretation'`

- [ ] **Step 3: Add total_tokens_used to the User model**

Edit `src/auth/models.py`, replace the file in full:

```python
from datetime import UTC, datetime
from typing import Any

from bson import ObjectId


class User:
    def __init__(
        self,
        email: str,
        password_hash: str,
        display_name: str | None = None,
        credits: int = 0,
        is_superadmin: bool = False,
        stripe_customer_id: str | None = None,
        total_tokens_used: int = 0,
        id: str | None = None,
        created_at: datetime | None = None,
        updated_at: datetime | None = None,
    ) -> None:
        self.id = id
        self.email = email
        self.password_hash = password_hash
        self.display_name = display_name
        self.credits = credits
        self.is_superadmin = is_superadmin
        self.stripe_customer_id = stripe_customer_id
        self.total_tokens_used = total_tokens_used
        self.created_at = created_at or datetime.now(UTC)
        self.updated_at = updated_at or datetime.now(UTC)

    def to_document(self) -> dict[str, Any]:
        doc: dict[str, Any] = {
            "email": self.email,
            "password_hash": self.password_hash,
            "credits": self.credits,
            "is_superadmin": self.is_superadmin,
            "total_tokens_used": self.total_tokens_used,
            "created_at": self.created_at,
            "updated_at": self.updated_at,
        }
        if self.id:
            doc["_id"] = ObjectId(self.id)
        if self.display_name is not None:
            doc["display_name"] = self.display_name
        if self.stripe_customer_id is not None:
            doc["stripe_customer_id"] = self.stripe_customer_id
        return doc

    @classmethod
    def from_document(cls, doc: dict[str, Any]) -> "User":
        return cls(
            id=str(doc["_id"]),
            email=doc["email"],
            password_hash=doc["password_hash"],
            display_name=doc.get("display_name"),
            credits=doc.get("credits", 0),
            is_superadmin=doc.get("is_superadmin", False),
            stripe_customer_id=doc.get("stripe_customer_id"),
            total_tokens_used=doc.get("total_tokens_used", 0),
            created_at=doc.get("created_at"),
            updated_at=doc.get("updated_at"),
        )

    def update(self, **kwargs: Any) -> None:
        for key, value in kwargs.items():
            if hasattr(self, key):
                setattr(self, key, value)
        self.updated_at = datetime.now(UTC)
```

- [ ] **Step 4: Add the increment method to the repository**

Edit `src/auth/repository.py`, add the `ObjectId` import and the new method:

```python
from datetime import datetime
from typing import Any

from bson import ObjectId

from src.database.base_repository import BaseReadRepository, BaseWriteRepository
from src.database.collections.constants import REFRESH_TOKENS_COLLECTION, USERS_COLLECTION


class AuthWriteRepository(BaseWriteRepository):
    @property
    def collection_name(self) -> str:
        return USERS_COLLECTION

    async def increment_tokens_used(self, user_id: str, tokens: int) -> None:
        await self._collection.update_one(
            {"_id": ObjectId(user_id)},
            {"$inc": {"total_tokens_used": tokens}},
        )
```

(leave `AuthReadRepository` and `RefreshTokenRepository` below unchanged.)

- [ ] **Step 5: Create the command and handler**

Create `src/interpretations/commands/generate_interpretation.py`:

```python
from datetime import date

import structlog
from bson import ObjectId
from bson.errors import InvalidId

from src.auth.repository import AuthWriteRepository
from src.cqrs.commands import BaseCommand, CommandHandler
from src.interpretations.schemas import DEFAULT_CALIBRATION, GeneratedInterpretationResponse
from src.llm.port import LLMPort
from src.llm.schemas import CardInSpread, InterpretationRequest
from src.readings.repository import ReadingReadRepository
from src.readings.service import ReadingNotFoundError

logger = structlog.stdlib.get_logger(__name__)


class GenerateInterpretationCommand(BaseCommand):
    reading_id: str
    user_id: str


class GenerateInterpretationHandler(
    CommandHandler[GenerateInterpretationCommand, GeneratedInterpretationResponse]
):
    def __init__(
        self,
        reading_read_repo: ReadingReadRepository,
        user_write_repo: AuthWriteRepository,
        llm: LLMPort,
    ) -> None:
        self._reading_read_repo = reading_read_repo
        self._user_write_repo = user_write_repo
        self._llm = llm

    async def handle(
        self, command: GenerateInterpretationCommand
    ) -> GeneratedInterpretationResponse:
        try:
            reading_oid = ObjectId(command.reading_id)
        except InvalidId:
            raise ReadingNotFoundError()
        reading = await self._reading_read_repo.find_one(
            {"_id": reading_oid, "user_id": ObjectId(command.user_id)}
        )
        if reading is None:
            raise ReadingNotFoundError()

        llm_request = InterpretationRequest(
            spread_name=reading["spread_type"],
            question=reading.get("question"),
            birth_date=(
                date.fromisoformat(reading["birth_date"]) if reading.get("birth_date") else None
            ),
            cards=[
                CardInSpread(
                    name=card["name"],
                    position=card["position"],
                    orientation=card["orientation"],
                    position_description=card.get("position_description"),
                )
                for card in reading["cards"]
            ],
        )
        llm_response = await self._llm.generate_interpretation(llm_request)

        await self._user_write_repo.increment_tokens_used(
            command.user_id, llm_response.tokens_used
        )

        return GeneratedInterpretationResponse(
            card_interpretations=[
                {
                    "card_name": ci.card_name,
                    "position": ci.position,
                    "orientation": ci.orientation.value,
                    "interpretation": ci.interpretation,
                }
                for ci in llm_response.card_interpretations
            ],
            synthesis=llm_response.synthesis,
            model=llm_response.model,
            tokens_used=llm_response.tokens_used,
            calibration=DEFAULT_CALIBRATION,
        )
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `make test-docker params="tests/interpretations/test_commands.py"`
Expected: PASS (5 tests)

- [ ] **Step 7: Run the full auth and readings suites to confirm no regression**

Run: `make test-docker params="tests/auth tests/readings"`
Expected: PASS

- [ ] **Step 8: Lint**

Run: `make lint`
Expected: no errors.

- [ ] **Step 9: Commit**

```bash
git add src/interpretations/commands/ src/auth/models.py src/auth/repository.py tests/interpretations/test_commands.py
git commit -m "feat: add stateless interpretation generation with token usage tracking"
```

---

## Task 6: SaveInterpretationCommand — upsert by reading_id

**Files:**
- Create: `src/interpretations/commands/save_interpretation.py`
- Modify: `tests/interpretations/test_commands.py`

**Interfaces:**
- Consumes: `Interpretation` model, `InterpretationWriteRepository`/`InterpretationReadRepository` (Task 2), `ReadingReadRepository`/`ReadingNotFoundError`.
- Produces: `SaveInterpretationCommand(reading_id, user_id, card_interpretations, synthesis, model, tokens_used)`, `SaveInterpretationHandler.__init__(self, reading_read_repo, write_repo, read_repo) -> None` — consumed by Task 9's router wiring.

- [ ] **Step 1: Write the failing tests**

Add to `tests/interpretations/test_commands.py`. First, extend the imports at the top of the file:

```python
from src.interpretations.commands.save_interpretation import (
    SaveInterpretationCommand,
    SaveInterpretationHandler,
)
from src.interpretations.repository import InterpretationReadRepository, InterpretationWriteRepository
```

Add a fixture below `generate_handler`:

```python
@pytest.fixture
def save_handler(reading_repos, mock_db):
    _, read_repo = reading_repos
    return SaveInterpretationHandler(
        reading_read_repo=read_repo,
        write_repo=InterpretationWriteRepository(mock_db),
        read_repo=InterpretationReadRepository(mock_db),
    )
```

Add tests at the end of the file:

```python
async def test_save_interpretation_creates_document(
    create_reading_handler, generate_handler, save_handler, user_id
):
    reading = await _create_reading(create_reading_handler, user_id)
    generated = await generate_handler.handle(
        GenerateInterpretationCommand(reading_id=reading.id, user_id=user_id)
    )

    result = await save_handler.handle(
        SaveInterpretationCommand(
            reading_id=reading.id,
            user_id=user_id,
            card_interpretations=generated.card_interpretations,
            synthesis=generated.synthesis,
            model=generated.model,
            tokens_used=generated.tokens_used,
        )
    )

    assert result.reading_id == reading.id
    assert result.calibration == DEFAULT_CALIBRATION
    assert result.synthesis == generated.synthesis
    assert result.card_interpretations[0].card_name == "The Fool"


async def test_save_interpretation_upserts_on_second_save(
    create_reading_handler, generate_handler, save_handler, user_id
):
    reading = await _create_reading(create_reading_handler, user_id)
    generated = await generate_handler.handle(
        GenerateInterpretationCommand(reading_id=reading.id, user_id=user_id)
    )
    first_save = await save_handler.handle(
        SaveInterpretationCommand(
            reading_id=reading.id,
            user_id=user_id,
            card_interpretations=generated.card_interpretations,
            synthesis="First synthesis",
            model=generated.model,
            tokens_used=generated.tokens_used,
        )
    )
    second_save = await save_handler.handle(
        SaveInterpretationCommand(
            reading_id=reading.id,
            user_id=user_id,
            card_interpretations=generated.card_interpretations,
            synthesis="Second synthesis",
            model=generated.model,
            tokens_used=generated.tokens_used,
        )
    )

    assert second_save.id == first_save.id
    assert second_save.synthesis == "Second synthesis"


async def test_save_interpretation_not_found(save_handler, user_id):
    with pytest.raises(ReadingNotFoundError):
        await save_handler.handle(
            SaveInterpretationCommand(
                reading_id=str(ObjectId()),
                user_id=user_id,
                card_interpretations=[],
                synthesis="x",
                model="mock",
                tokens_used=0,
            )
        )


async def test_save_interpretation_wrong_user(
    create_reading_handler, generate_handler, save_handler, user_id
):
    reading = await _create_reading(create_reading_handler, user_id)
    generated = await generate_handler.handle(
        GenerateInterpretationCommand(reading_id=reading.id, user_id=user_id)
    )
    other_user = str(ObjectId())
    with pytest.raises(ReadingNotFoundError):
        await save_handler.handle(
            SaveInterpretationCommand(
                reading_id=reading.id,
                user_id=other_user,
                card_interpretations=generated.card_interpretations,
                synthesis=generated.synthesis,
                model=generated.model,
                tokens_used=generated.tokens_used,
            )
        )
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `make test-docker params="tests/interpretations/test_commands.py"`
Expected: FAIL with `ModuleNotFoundError: No module named 'src.interpretations.commands.save_interpretation'`

- [ ] **Step 3: Create the command and handler**

Create `src/interpretations/commands/save_interpretation.py`:

```python
from bson import ObjectId
from bson.errors import InvalidId

from src.cqrs.commands import BaseCommand, CommandHandler
from src.interpretations.models import Interpretation
from src.interpretations.repository import InterpretationReadRepository, InterpretationWriteRepository
from src.interpretations.schemas import (
    DEFAULT_CALIBRATION,
    CardInterpretationReadModel,
    InterpretationReadModel,
)
from src.readings.repository import ReadingReadRepository
from src.readings.service import ReadingNotFoundError


class SaveInterpretationCommand(BaseCommand):
    reading_id: str
    user_id: str
    card_interpretations: list[CardInterpretationReadModel]
    synthesis: str
    model: str
    tokens_used: int


class SaveInterpretationHandler(
    CommandHandler[SaveInterpretationCommand, InterpretationReadModel]
):
    def __init__(
        self,
        reading_read_repo: ReadingReadRepository,
        write_repo: InterpretationWriteRepository,
        read_repo: InterpretationReadRepository,
    ) -> None:
        self._reading_read_repo = reading_read_repo
        self._write_repo = write_repo
        self._read_repo = read_repo

    async def handle(self, command: SaveInterpretationCommand) -> InterpretationReadModel:
        try:
            reading_oid = ObjectId(command.reading_id)
        except InvalidId:
            raise ReadingNotFoundError()
        reading = await self._reading_read_repo.find_one(
            {"_id": reading_oid, "user_id": ObjectId(command.user_id)}
        )
        if reading is None:
            raise ReadingNotFoundError()

        interpretation = Interpretation(
            reading_id=command.reading_id,
            user_id=command.user_id,
            card_interpretations=[
                {
                    "card_name": ci.card_name,
                    "position": ci.position,
                    "orientation": ci.orientation.value,
                    "interpretation": ci.interpretation,
                }
                for ci in command.card_interpretations
            ],
            synthesis=command.synthesis,
            tokens_used=command.tokens_used,
            model=command.model,
            calibration=DEFAULT_CALIBRATION,
        )
        await self._write_repo.upsert_by_reading_id(
            command.reading_id, interpretation.to_document()
        )

        doc = await self._read_repo.find_by_reading_id(command.reading_id)
        return InterpretationReadModel.model_validate(doc)
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `make test-docker params="tests/interpretations/test_commands.py"`
Expected: PASS (9 tests total)

- [ ] **Step 5: Lint**

Run: `make lint`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/interpretations/commands/save_interpretation.py tests/interpretations/test_commands.py
git commit -m "feat: add interpretation save (upsert by reading_id)"
```

---

## Task 7: Embed saved interpretation in GetReadingByIdQuery

**Files:**
- Modify: `src/readings/queries/get_reading_by_id.py`
- Modify: `src/main.py`
- Modify: `tests/conftest.py`
- Modify: `tests/readings/test_queries.py`

**Interfaces:**
- Consumes: `InterpretationReadRepository.find_by_reading_id` (Task 2).
- Produces: `GetReadingByIdHandler.__init__(self, read_repo, interpretation_read_repo) -> None` — signature change, consumed by Task 9's router wiring update.

- [ ] **Step 1: Write the failing tests**

Edit `tests/readings/test_queries.py`, add imports:

```python
from src.interpretations.models import Interpretation
from src.interpretations.repository import InterpretationReadRepository, InterpretationWriteRepository
```

Replace the `get_handler` fixture:

```python
@pytest.fixture
def get_handler(repos, mock_db):
    _, read_repo = repos
    return GetReadingByIdHandler(read_repo, InterpretationReadRepository(mock_db))
```

Update `test_get_reading_by_id` to add one assertion:

```python
async def test_get_reading_by_id(create_handler, get_handler, user_id):
    created = await create_handler.handle(_make_command(user_id))
    result = await get_handler.handle(GetReadingByIdQuery(reading_id=created.id, user_id=user_id))
    assert result.id == created.id
    assert result.spread_type == "Celtic Cross"
    assert result.interpretation is None
```

Add a new test after it:

```python
async def test_get_reading_by_id_includes_saved_interpretation(
    create_handler, get_handler, user_id, mock_db
):
    created = await create_handler.handle(_make_command(user_id))
    interpretation = Interpretation(
        reading_id=created.id,
        user_id=user_id,
        card_interpretations=[
            {
                "card_name": "The Fool",
                "position": "Present",
                "orientation": "upright",
                "interpretation": "New beginnings.",
            }
        ],
        synthesis="A journey begins.",
        tokens_used=10,
        model="mock",
        calibration=3,
    )
    await InterpretationWriteRepository(mock_db).upsert_by_reading_id(
        created.id, interpretation.to_document()
    )

    result = await get_handler.handle(GetReadingByIdQuery(reading_id=created.id, user_id=user_id))

    assert result.interpretation is not None
    assert result.interpretation.synthesis == "A journey begins."
    assert result.interpretation.calibration == 3
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `make test-docker params="tests/readings/test_queries.py"`
Expected: FAIL with `TypeError: GetReadingByIdHandler.__init__() takes 2 positional arguments but 3 were given` (fixture) — then, once that's the only failure, it confirms the signature needs the change made in the next step.

- [ ] **Step 3: Update the handler**

Replace `src/readings/queries/get_reading_by_id.py` in full:

```python
from bson import ObjectId
from bson.errors import InvalidId

from src.cqrs.queries import BaseQuery, QueryHandler
from src.interpretations.repository import InterpretationReadRepository
from src.readings.repository import ReadingReadRepository
from src.readings.schemas import ReadingReadModel
from src.readings.service import ReadingNotFoundError


class GetReadingByIdQuery(BaseQuery):
    reading_id: str
    user_id: str


class GetReadingByIdHandler(QueryHandler[GetReadingByIdQuery, ReadingReadModel]):
    def __init__(
        self,
        read_repo: ReadingReadRepository,
        interpretation_read_repo: InterpretationReadRepository,
    ) -> None:
        self._read_repo = read_repo
        self._interpretation_read_repo = interpretation_read_repo

    async def handle(self, query: GetReadingByIdQuery) -> ReadingReadModel:
        try:
            oid = ObjectId(query.reading_id)
        except InvalidId:
            raise ReadingNotFoundError()
        doc = await self._read_repo.find_one({"_id": oid, "user_id": ObjectId(query.user_id)})
        if doc is None:
            raise ReadingNotFoundError()
        doc["interpretation"] = await self._interpretation_read_repo.find_by_reading_id(
            query.reading_id
        )
        return ReadingReadModel.model_validate(doc)
```

- [ ] **Step 4: Update wiring**

Edit `src/main.py`, change:

```python
    mediator.register_query(GetReadingByIdQuery, GetReadingByIdHandler(reading_read_repo))
```

to (add the repo instantiation above it if not already present from a later task; at this point add just the interpretation read repo instantiation inline):

```python
    interpretation_read_repo = InterpretationReadRepository(db)

    mediator.register_query(
        GetReadingByIdQuery, GetReadingByIdHandler(reading_read_repo, interpretation_read_repo)
    )
```

Add the import near the other `src.interpretations` usage (or as a new import block if this is the first one in `main.py`):

```python
from src.interpretations.repository import InterpretationReadRepository
```

- [ ] **Step 5: Update the test app fixture**

Edit `tests/conftest.py`, mirror the same change: add `from src.interpretations.repository import InterpretationReadRepository` to the local imports inside the `app` fixture, instantiate `interpretation_read_repo = InterpretationReadRepository(mock_db)`, and change:

```python
    mediator.register_query(GetReadingByIdQuery, GetReadingByIdHandler(reading_read_repo))
```

to:

```python
    mediator.register_query(
        GetReadingByIdQuery, GetReadingByIdHandler(reading_read_repo, interpretation_read_repo)
    )
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `make test-docker params="tests/readings"`
Expected: PASS

- [ ] **Step 7: Lint**

Run: `make lint`
Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add src/readings/queries/get_reading_by_id.py src/main.py tests/conftest.py tests/readings/test_queries.py
git commit -m "feat: embed saved interpretation in GetReadingByIdQuery"
```

---

## Task 8: has_interpretation flag on the reading list

**Files:**
- Modify: `src/readings/schemas.py`
- Modify: `src/readings/queries/list_user_readings.py`
- Modify: `src/main.py`
- Modify: `tests/conftest.py`
- Modify: `tests/readings/test_queries.py`

**Interfaces:**
- Consumes: `InterpretationReadRepository.find_reading_ids_with_interpretation` (Task 2).
- Produces: `ReadingListItem.has_interpretation: bool`, `ListUserReadingsHandler.__init__(self, read_repo, interpretation_read_repo) -> None` — signature change, consumed by Task 9's router wiring update.

- [ ] **Step 1: Write the failing tests**

Edit `tests/readings/test_queries.py`, replace the `list_handler` fixture:

```python
@pytest.fixture
def list_handler(repos, mock_db):
    _, read_repo = repos
    return ListUserReadingsHandler(read_repo, InterpretationReadRepository(mock_db))
```

Add tests at the end of the file:

```python
async def test_list_user_readings_has_interpretation_false_by_default(
    create_handler, list_handler, user_id
):
    await create_handler.handle(_make_command(user_id))
    result = await list_handler.handle(ListUserReadingsQuery(user_id=user_id))
    assert result.items[0].has_interpretation is False


async def test_list_user_readings_has_interpretation_true_when_saved(
    create_handler, list_handler, user_id, mock_db
):
    created = await create_handler.handle(_make_command(user_id))
    interpretation = Interpretation(
        reading_id=created.id,
        user_id=user_id,
        card_interpretations=[
            {
                "card_name": "The Fool",
                "position": "Present",
                "orientation": "upright",
                "interpretation": "New beginnings.",
            }
        ],
        synthesis="A journey begins.",
        tokens_used=10,
        model="mock",
        calibration=3,
    )
    await InterpretationWriteRepository(mock_db).upsert_by_reading_id(
        created.id, interpretation.to_document()
    )

    result = await list_handler.handle(ListUserReadingsQuery(user_id=user_id))

    assert result.items[0].has_interpretation is True
```

(`Interpretation`/`InterpretationWriteRepository` are already imported from Task 7's changes to this file.)

- [ ] **Step 2: Run tests to verify they fail**

Run: `make test-docker params="tests/readings/test_queries.py"`
Expected: FAIL with `TypeError: ListUserReadingsHandler.__init__() takes 2 positional arguments but 3 were given`

- [ ] **Step 3: Add the field to the schema**

Edit `src/readings/schemas.py`, replace `ReadingListItem`:

```python
class ReadingListItem(AppSchema):
    id: PyObjectId = Field(alias="_id")
    user_id: PyObjectId
    spread_type: str
    question: str | None = None
    birth_date: date | None = None
    tags: list[str] = Field(default_factory=list)
    cards: list[CardReadModel]
    has_interpretation: bool = False
    created_at: datetime
```

- [ ] **Step 4: Compute the flag in the handler**

Replace `src/readings/queries/list_user_readings.py` in full:

```python
import asyncio
from datetime import date

from pydantic import Field

from src.core.pagination import PaginatedResponse
from src.cqrs.queries import BaseQuery, QueryHandler
from src.interpretations.repository import InterpretationReadRepository
from src.readings.repository import ReadingReadRepository
from src.readings.schemas import ReadingListItem


class ListUserReadingsQuery(BaseQuery):
    user_id: str
    page: int = Field(default=1, ge=1)
    page_size: int = Field(default=20, ge=1, le=100)
    spread_type: str | None = None
    birth_date: date | None = None
    tags: list[str] | None = None


class ListUserReadingsHandler(
    QueryHandler[ListUserReadingsQuery, PaginatedResponse[ReadingListItem]]
):
    def __init__(
        self,
        read_repo: ReadingReadRepository,
        interpretation_read_repo: InterpretationReadRepository,
    ) -> None:
        self._read_repo = read_repo
        self._interpretation_read_repo = interpretation_read_repo

    async def handle(self, query: ListUserReadingsQuery) -> PaginatedResponse[ReadingListItem]:
        skip = (query.page - 1) * query.page_size
        if query.tags:
            docs, total = await asyncio.gather(
                self._read_repo.find_by_user_id_ranked_by_tags(
                    query.user_id,
                    query.tags,
                    skip=skip,
                    limit=query.page_size,
                    spread_type=query.spread_type,
                    birth_date=query.birth_date,
                ),
                self._read_repo.count_by_user_id(
                    query.user_id,
                    spread_type=query.spread_type,
                    birth_date=query.birth_date,
                    tags=query.tags,
                ),
            )
        else:
            docs, total = await asyncio.gather(
                self._read_repo.find_by_user_id(
                    query.user_id,
                    skip=skip,
                    limit=query.page_size,
                    spread_type=query.spread_type,
                    birth_date=query.birth_date,
                ),
                self._read_repo.count_by_user_id(
                    query.user_id,
                    spread_type=query.spread_type,
                    birth_date=query.birth_date,
                ),
            )

        reading_ids = [str(doc["_id"]) for doc in docs]
        interpreted_ids = await self._interpretation_read_repo.find_reading_ids_with_interpretation(
            reading_ids
        )
        for doc in docs:
            doc["has_interpretation"] = str(doc["_id"]) in interpreted_ids

        return PaginatedResponse[ReadingListItem](
            items=[ReadingListItem.model_validate(doc) for doc in docs],
            total=total,
            page=query.page,
            page_size=query.page_size,
        )
```

(One batched `$in` query for the whole page — not a per-item lookup — so this doesn't turn into an N+1 query as the page grows.)

- [ ] **Step 5: Update wiring**

Edit `src/main.py`, change:

```python
    mediator.register_query(ListUserReadingsQuery, ListUserReadingsHandler(reading_read_repo))
```

to:

```python
    mediator.register_query(
        ListUserReadingsQuery,
        ListUserReadingsHandler(reading_read_repo, interpretation_read_repo),
    )
```

(`interpretation_read_repo` is already instantiated from Task 7's change.)

- [ ] **Step 6: Update the test app fixture**

Edit `tests/conftest.py`, mirror the same change:

```python
    mediator.register_query(
        ListUserReadingsQuery,
        ListUserReadingsHandler(reading_read_repo, interpretation_read_repo),
    )
```

- [ ] **Step 7: Run tests to verify they pass**

Run: `make test-docker params="tests/readings"`
Expected: PASS

- [ ] **Step 8: Lint**

Run: `make lint`
Expected: no errors.

- [ ] **Step 9: Commit**

```bash
git add src/readings/schemas.py src/readings/queries/list_user_readings.py src/main.py tests/conftest.py tests/readings/test_queries.py
git commit -m "feat: add has_interpretation flag to reading list"
```

---

## Task 9: Router endpoints and full mediator wiring

**Files:**
- Modify: `src/readings/router.py`
- Modify: `src/main.py`
- Modify: `tests/conftest.py`
- Modify: `tests/readings/test_router.py`

**Interfaces:**
- Consumes: everything from Tasks 2, 5, 6.
- Produces: `POST /api/v1/readings/{reading_id}/interpretation/generate`, `POST /api/v1/readings/{reading_id}/interpretation` — the public API surface for this step.

- [ ] **Step 1: Write the failing tests**

Add to `tests/readings/test_router.py`, at the end of the file:

```python
async def test_generate_interpretation(client, auth_token):
    create_resp = await client.post(
        "/api/v1/readings",
        json=VALID_READING_BODY,
        headers={"Authorization": f"Bearer {auth_token}"},
    )
    reading_id = create_resp.json()["_id"]

    resp = await client.post(
        f"/api/v1/readings/{reading_id}/interpretation/generate",
        headers={"Authorization": f"Bearer {auth_token}"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert len(data["card_interpretations"]) == 1
    assert data["synthesis"] is not None
    assert data["calibration"] == 3


async def test_generate_interpretation_does_not_persist(client, auth_token):
    create_resp = await client.post(
        "/api/v1/readings",
        json=VALID_READING_BODY,
        headers={"Authorization": f"Bearer {auth_token}"},
    )
    reading_id = create_resp.json()["_id"]
    await client.post(
        f"/api/v1/readings/{reading_id}/interpretation/generate",
        headers={"Authorization": f"Bearer {auth_token}"},
    )

    resp = await client.get(
        f"/api/v1/readings/{reading_id}",
        headers={"Authorization": f"Bearer {auth_token}"},
    )
    assert resp.json()["interpretation"] is None


async def test_generate_interpretation_not_found(client, auth_token):
    resp = await client.post(
        "/api/v1/readings/507f1f77bcf86cd799439011/interpretation/generate",
        headers={"Authorization": f"Bearer {auth_token}"},
    )
    assert resp.status_code == 404


async def test_save_interpretation(client, auth_token):
    create_resp = await client.post(
        "/api/v1/readings",
        json=VALID_READING_BODY,
        headers={"Authorization": f"Bearer {auth_token}"},
    )
    reading_id = create_resp.json()["_id"]
    generated = (
        await client.post(
            f"/api/v1/readings/{reading_id}/interpretation/generate",
            headers={"Authorization": f"Bearer {auth_token}"},
        )
    ).json()

    resp = await client.post(
        f"/api/v1/readings/{reading_id}/interpretation",
        json={
            "card_interpretations": generated["card_interpretations"],
            "synthesis": generated["synthesis"],
            "model": generated["model"],
            "tokens_used": generated["tokens_used"],
        },
        headers={"Authorization": f"Bearer {auth_token}"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["reading_id"] == reading_id
    assert data["synthesis"] == generated["synthesis"]

    get_resp = await client.get(
        f"/api/v1/readings/{reading_id}",
        headers={"Authorization": f"Bearer {auth_token}"},
    )
    assert get_resp.json()["interpretation"]["synthesis"] == generated["synthesis"]


async def test_save_interpretation_overwrites_previous(client, auth_token):
    create_resp = await client.post(
        "/api/v1/readings",
        json=VALID_READING_BODY,
        headers={"Authorization": f"Bearer {auth_token}"},
    )
    reading_id = create_resp.json()["_id"]
    generated = (
        await client.post(
            f"/api/v1/readings/{reading_id}/interpretation/generate",
            headers={"Authorization": f"Bearer {auth_token}"},
        )
    ).json()
    body = {
        "card_interpretations": generated["card_interpretations"],
        "synthesis": generated["synthesis"],
        "model": generated["model"],
        "tokens_used": generated["tokens_used"],
    }
    first = await client.post(
        f"/api/v1/readings/{reading_id}/interpretation",
        json=body,
        headers={"Authorization": f"Bearer {auth_token}"},
    )
    second = await client.post(
        f"/api/v1/readings/{reading_id}/interpretation",
        json={**body, "synthesis": "A revised synthesis."},
        headers={"Authorization": f"Bearer {auth_token}"},
    )
    assert second.json()["_id"] == first.json()["_id"]
    assert second.json()["synthesis"] == "A revised synthesis."


async def test_save_interpretation_wrong_user(client, auth_token):
    create_resp = await client.post(
        "/api/v1/readings",
        json=VALID_READING_BODY,
        headers={"Authorization": f"Bearer {auth_token}"},
    )
    reading_id = create_resp.json()["_id"]
    generated = (
        await client.post(
            f"/api/v1/readings/{reading_id}/interpretation/generate",
            headers={"Authorization": f"Bearer {auth_token}"},
        )
    ).json()

    reg = await client.post(
        "/api/v1/auth/register",
        json={"email": "otherinterp@example.com", "password": "securepassword123"},
    )
    other_token = reg.json()["access_token"]

    resp = await client.post(
        f"/api/v1/readings/{reading_id}/interpretation",
        json={
            "card_interpretations": generated["card_interpretations"],
            "synthesis": generated["synthesis"],
            "model": generated["model"],
            "tokens_used": generated["tokens_used"],
        },
        headers={"Authorization": f"Bearer {other_token}"},
    )
    assert resp.status_code == 404
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `make test-docker params="tests/readings/test_router.py"`
Expected: FAIL with 404 on the new endpoints (routes don't exist yet).

- [ ] **Step 3: Add the router endpoints**

Edit `src/readings/router.py`, replace in full:

```python
from datetime import date

from fastapi import APIRouter, Query

from src.core.dependencies import CurrentUserId, MediatorDep
from src.core.pagination import PaginatedResponse
from src.interpretations.commands.generate_interpretation import GenerateInterpretationCommand
from src.interpretations.commands.save_interpretation import SaveInterpretationCommand
from src.interpretations.schemas import (
    GeneratedInterpretationResponse,
    InterpretationReadModel,
    SaveInterpretationRequest,
)
from src.readings.commands.create_reading import CreateReadingCommand
from src.readings.commands.update_reading_tags import UpdateReadingTagsCommand
from src.readings.queries.get_reading_by_id import GetReadingByIdQuery
from src.readings.queries.list_user_readings import ListUserReadingsQuery
from src.readings.schemas import (
    CreateReadingRequest,
    ReadingListItem,
    ReadingReadModel,
    UpdateReadingTagsRequest,
    parse_comma_separated_tags,
)

router = APIRouter(prefix="/readings", tags=["readings"])


@router.post("", response_model=ReadingReadModel, status_code=201)
async def create_reading(
    body: CreateReadingRequest,
    user_id: CurrentUserId,
    mediator: MediatorDep,
) -> ReadingReadModel:
    command = CreateReadingCommand(
        user_id=user_id,
        spread_name=body.spread_name,
        question=body.question,
        birth_date=body.birth_date,
        cards=body.cards,
    )
    return await mediator.send(command)


@router.get("", response_model=PaginatedResponse[ReadingListItem])
async def list_readings(
    user_id: CurrentUserId,
    mediator: MediatorDep,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    spread_type: str | None = Query(default=None),
    birth_date: date | None = Query(default=None),
    tags: str | None = Query(default=None),
) -> PaginatedResponse[ReadingListItem]:
    return await mediator.query(
        ListUserReadingsQuery(
            user_id=user_id,
            page=page,
            page_size=page_size,
            spread_type=spread_type,
            birth_date=birth_date,
            tags=parse_comma_separated_tags(tags) if tags else None,
        )
    )


@router.get("/{reading_id}", response_model=ReadingReadModel)
async def get_reading(
    reading_id: str,
    user_id: CurrentUserId,
    mediator: MediatorDep,
) -> ReadingReadModel:
    return await mediator.query(GetReadingByIdQuery(reading_id=reading_id, user_id=user_id))


@router.patch("/{reading_id}/tags", response_model=ReadingReadModel)
async def update_reading_tags(
    reading_id: str,
    body: UpdateReadingTagsRequest,
    user_id: CurrentUserId,
    mediator: MediatorDep,
) -> ReadingReadModel:
    command = UpdateReadingTagsCommand(
        reading_id=reading_id,
        user_id=user_id,
        tags=body.tags,
    )
    return await mediator.send(command)


@router.post(
    "/{reading_id}/interpretation/generate",
    response_model=GeneratedInterpretationResponse,
)
async def generate_interpretation(
    reading_id: str,
    user_id: CurrentUserId,
    mediator: MediatorDep,
) -> GeneratedInterpretationResponse:
    return await mediator.send(
        GenerateInterpretationCommand(reading_id=reading_id, user_id=user_id)
    )


@router.post(
    "/{reading_id}/interpretation",
    response_model=InterpretationReadModel,
)
async def save_interpretation(
    reading_id: str,
    body: SaveInterpretationRequest,
    user_id: CurrentUserId,
    mediator: MediatorDep,
) -> InterpretationReadModel:
    command = SaveInterpretationCommand(
        reading_id=reading_id,
        user_id=user_id,
        card_interpretations=body.card_interpretations,
        synthesis=body.synthesis,
        model=body.model,
        tokens_used=body.tokens_used,
    )
    return await mediator.send(command)
```

- [ ] **Step 4: Wire the new commands in main.py**

Edit `src/main.py`. Replace the import block (the `from src.health.router import ...` line through the `from src.llm.openai_adapter import ...` line) so it reads, in full:

```python
from src.health.router import router as health_router
from src.interpretations.commands.generate_interpretation import (
    GenerateInterpretationCommand,
    GenerateInterpretationHandler,
)
from src.interpretations.commands.save_interpretation import (
    SaveInterpretationCommand,
    SaveInterpretationHandler,
)
from src.interpretations.repository import InterpretationReadRepository, InterpretationWriteRepository
from src.llm.openai_adapter import OpenAIAdapter
```

Then replace the entire `_wire_mediator` function body with:

```python
def _wire_mediator(mediator: Mediator, llm: LLMPort) -> None:
    db = get_database()

    user_write_repo = AuthWriteRepository(db)
    user_read_repo = AuthReadRepository(db)

    mediator.register_command(
        RegisterUserCommand, RegisterUserHandler(user_write_repo, user_read_repo)
    )
    mediator.register_query(GetUserByIdQuery, GetUserByIdHandler(user_read_repo))
    mediator.register_query(GetUserByEmailQuery, GetUserByEmailHandler(user_read_repo))
    mediator.register_query(ListUsersQuery, ListUsersHandler(user_read_repo))

    reading_write_repo = ReadingWriteRepository(db)
    reading_read_repo = ReadingReadRepository(db)
    interpretation_read_repo = InterpretationReadRepository(db)
    interpretation_write_repo = InterpretationWriteRepository(db)

    mediator.register_command(CreateReadingCommand, CreateReadingHandler(reading_write_repo))
    mediator.register_command(
        UpdateReadingTagsCommand,
        UpdateReadingTagsHandler(reading_write_repo, reading_read_repo),
    )
    mediator.register_query(
        GetReadingByIdQuery, GetReadingByIdHandler(reading_read_repo, interpretation_read_repo)
    )
    mediator.register_query(
        ListUserReadingsQuery,
        ListUserReadingsHandler(reading_read_repo, interpretation_read_repo),
    )
    mediator.register_command(
        GenerateInterpretationCommand,
        GenerateInterpretationHandler(reading_read_repo, user_write_repo, llm),
    )
    mediator.register_command(
        SaveInterpretationCommand,
        SaveInterpretationHandler(
            reading_read_repo, interpretation_write_repo, interpretation_read_repo
        ),
    )
```

This supersedes the incremental edits made to this function in Tasks 4, 7, and 8 — by this point the function should look exactly like the block above.

- [ ] **Step 5: Mirror the wiring in tests/conftest.py**

Replace the entire `app` fixture in `tests/conftest.py` with:

```python
@pytest.fixture
async def app(mock_db):
    from src.auth.commands.register_user import RegisterUserCommand, RegisterUserHandler
    from src.auth.queries.get_user_by_email import GetUserByEmailHandler, GetUserByEmailQuery
    from src.auth.queries.get_user_by_id import GetUserByIdHandler, GetUserByIdQuery
    from src.auth.repository import (
        AuthReadRepository,
        AuthWriteRepository,
        RefreshTokenRepository,
    )
    from src.cqrs.mediator import Mediator
    from src.interpretations.commands.generate_interpretation import (
        GenerateInterpretationCommand,
        GenerateInterpretationHandler,
    )
    from src.interpretations.commands.save_interpretation import (
        SaveInterpretationCommand,
        SaveInterpretationHandler,
    )
    from src.interpretations.repository import (
        InterpretationReadRepository,
        InterpretationWriteRepository,
    )
    from src.llm.mock_adapter import MockLLMAdapter
    from src.main import app
    from src.readings.commands.create_reading import CreateReadingCommand, CreateReadingHandler
    from src.readings.commands.update_reading_tags import (
        UpdateReadingTagsCommand,
        UpdateReadingTagsHandler,
    )
    from src.readings.queries.get_reading_by_id import (
        GetReadingByIdHandler,
        GetReadingByIdQuery,
    )
    from src.readings.queries.list_user_readings import (
        ListUserReadingsHandler,
        ListUserReadingsQuery,
    )
    from src.readings.repository import ReadingReadRepository, ReadingWriteRepository
    from src.users.queries.list_users import ListUsersHandler, ListUsersQuery

    mediator = Mediator()
    user_write_repo = AuthWriteRepository(mock_db)
    user_read_repo = AuthReadRepository(mock_db)

    mediator.register_command(
        RegisterUserCommand, RegisterUserHandler(user_write_repo, user_read_repo)
    )
    mediator.register_query(GetUserByIdQuery, GetUserByIdHandler(user_read_repo))
    mediator.register_query(GetUserByEmailQuery, GetUserByEmailHandler(user_read_repo))
    mediator.register_query(ListUsersQuery, ListUsersHandler(user_read_repo))

    mock_llm = MockLLMAdapter()
    reading_write_repo = ReadingWriteRepository(mock_db)
    reading_read_repo = ReadingReadRepository(mock_db)
    interpretation_read_repo = InterpretationReadRepository(mock_db)
    interpretation_write_repo = InterpretationWriteRepository(mock_db)

    mediator.register_command(CreateReadingCommand, CreateReadingHandler(reading_write_repo))
    mediator.register_command(
        UpdateReadingTagsCommand,
        UpdateReadingTagsHandler(reading_write_repo, reading_read_repo),
    )
    mediator.register_query(
        GetReadingByIdQuery, GetReadingByIdHandler(reading_read_repo, interpretation_read_repo)
    )
    mediator.register_query(
        ListUserReadingsQuery,
        ListUserReadingsHandler(reading_read_repo, interpretation_read_repo),
    )
    mediator.register_command(
        GenerateInterpretationCommand,
        GenerateInterpretationHandler(reading_read_repo, user_write_repo, mock_llm),
    )
    mediator.register_command(
        SaveInterpretationCommand,
        SaveInterpretationHandler(
            reading_read_repo, interpretation_write_repo, interpretation_read_repo
        ),
    )

    app.state.mediator = mediator
    app.state.refresh_token_repo = RefreshTokenRepository(mock_db)
    app.state.llm = mock_llm
    return app
```

This supersedes the incremental edits made to this fixture in Tasks 4, 7, and 8 — by this point the fixture should look exactly like the block above.

- [ ] **Step 6: Run tests to verify they pass**

Run: `make test-docker params="tests/readings"`
Expected: PASS (all tests, including the 6 new ones)

- [ ] **Step 7: Lint**

Run: `make lint`
Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add src/readings/router.py src/main.py tests/conftest.py tests/readings/test_router.py
git commit -m "feat: add generate/save interpretation endpoints"
```

---

## Task 10: Full regression pass

**Files:** none (verification only)

- [ ] **Step 1: Run the entire test suite**

Run: `make test-docker`
Expected: PASS, zero failures across the whole suite (including `tests/auth`, `tests/llm`, `tests/users`, `tests/health`, `tests/migrations`, `tests/readings`, `tests/interpretations`).

- [ ] **Step 2: Run lint across the whole project**

Run: `make lint`
Expected: no errors.

- [ ] **Step 3: Manually verify the migrations apply cleanly**

Run: `make migrate` (or restart the dev server per `docs/db_migrations.md`) against a local/dev Mongo instance.
Expected: migrations `005` and `006` apply without error; `db.interpretations.getIndexes()` shows a unique index on `reading_id`.

- [ ] **Step 4: Fix any regressions found**

If any test fails, identify whether it's this plan's scope creep (a file this plan should have updated but didn't) or a pre-existing issue — fix in place, re-run Step 1.

- [ ] **Step 5: Final commit (only if fixes were needed in Step 4)**

```bash
git add -A
git commit -m "fix: address regressions found in full suite run"
```

---

## What Step 1 deliberately leaves out (see `docs/advanced-intrepretation.md`)

- Calibration/context tuning (Step 2) — `DEFAULT_CALIBRATION` is hardcoded everywhere in this plan.
- `interpretation_style` on `User` + `PATCH /auth/me` (Step 3).
- Credit deduction/enforcement, rate-limiting on generate (explicit follow-ups, not designed).
