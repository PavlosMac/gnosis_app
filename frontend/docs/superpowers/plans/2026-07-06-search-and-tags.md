# Reading Tags & Search/Filter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a user tag readings (freeform, up to 5 per reading, edited from the reading detail page) and filter the readings list by spread type, tags, and birth date via a collapsible server-side filter panel.

**Architecture:** Backend (`gnosis-esoterica-api`, FastAPI + Mongo via Motor) gains a `tags: list[str]` field on the `Reading` document, a `PATCH /readings/{id}/tags` command endpoint, and `spread_type`/`tags`/`birth_date` query params on the existing list endpoint — the `tags` filter path uses a Mongo aggregation pipeline for overlap-ranking, a different shape than the plain find/sort path used otherwise. Frontend (`tarot-divinations`, Next.js Server Components + Server Actions) gets a chip-based tag editor on the reading detail page and a URL-query-param filter panel on the readings list page, matching the existing pagination pattern (no client-side instant filtering).

**Tech Stack:** FastAPI, Motor/MongoDB, Pydantic v2, pytest + mongomock-motor (backend, spans two repos, this plan implements both — `/Users/pavlos/projects/private/gnosis-esoterica-api` and `/Users/pavlos/projects/private/tarot-divinations`); Next.js 16 Server Components/Actions, Zod, Tailwind CSS 4 (frontend).

## Global Constraints

- `MAX_TAGS_PER_READING = 5`, `MAX_TAG_LENGTH = 15` — defined once per repo (backend: `src/readings/schemas.py`; frontend: `src/lib/validation/reading-schemas.ts`) and enforced on both sides; backend is authoritative.
- Tags travel over the wire as **one comma-separated string**, never a JSON array — both the `PATCH .../tags` body and the `GET` list `tags` query param. Parsing (split on `,`, strip, drop empties, lowercase, dedupe preserving order) happens via a single shared backend helper, `normalize_tags()` in `src/readings/schemas.py`, used by both the PATCH validator and the GET list router.
- `spread_type` filter is exact-match, single-value (not multi-select OR).
- `birth_date` filter is exact-match only (no ranges).
- `tags` filter is ANY-match (Mongo `$in`), ranked by overlap count desc, then `created_at` desc — this requires a new aggregation-pipeline repository method, not the existing plain filter+sort path.
- Tags are not settable at reading creation (`CreateReadingRequest`/`CreateReadingCommand` are unchanged) — only via the new PATCH endpoint.
- Backend tests: `cd /Users/pavlos/projects/private/gnosis-esoterica-api && make test` (runs `uv run pytest -v` in the local `.venv`, which has all deps needed — no Docker split applies to this repo).
- Frontend has no automated test suite (no jest/vitest/testing-library in `package.json`) — verify each frontend task with `npx tsc --noEmit` from `/Users/pavlos/projects/private/tarot-divinations`, and do one final manual `npm run dev` browser pass after all frontend tasks land.

---

## Backend (`gnosis-esoterica-api`)

### Task 1: Tag data model, schema, and update command

**Files:**
- Modify: `src/readings/models.py`
- Modify: `src/readings/schemas.py`
- Create: `src/readings/commands/update_reading_tags.py`
- Test: `tests/readings/test_commands.py`

**Interfaces:**
- Produces: `normalize_tags(raw: str) -> list[str]` (in `schemas.py`) — split/strip/drop-empty/lowercase/dedupe, used by both this task's `UpdateReadingTagsRequest` and Task 4's list-filter router param.
- Produces: `MAX_TAGS_PER_READING = 5`, `MAX_TAG_LENGTH = 15` constants (in `schemas.py`).
- Produces: `UpdateReadingTagsRequest(AppSchema)` with `tags: str` field and `.normalized_tags -> list[str]` property (in `schemas.py`).
- Produces: `UpdateReadingTagsCommand(BaseCommand)` with `reading_id: str, user_id: str, tags: list[str]`, and `UpdateReadingTagsHandler(CommandHandler[UpdateReadingTagsCommand, ReadingReadModel])` taking `(read_repo: ReadingReadRepository, write_repo: ReadingWriteRepository)` (in `commands/update_reading_tags.py`) — consumed by Task 2's router and Task 2/5's wiring.

- [ ] **Step 1: Write the failing tests for the command handler**

Add to `tests/readings/test_commands.py` (append after the existing content, and add these imports at the top alongside the existing ones):

```python
from src.readings.commands.update_reading_tags import (
    UpdateReadingTagsCommand,
    UpdateReadingTagsHandler,
)
from src.readings.service import ReadingNotFoundError
```

Append at the end of the file:

```python
@pytest.fixture
def update_tags_handler(mock_db):
    return UpdateReadingTagsHandler(
        read_repo=ReadingReadRepository(mock_db),
        write_repo=ReadingWriteRepository(mock_db),
    )


async def test_update_reading_tags_normalizes_and_saves(handler, valid_command, update_tags_handler):
    created = await handler.handle(valid_command)
    result = await update_tags_handler.handle(
        UpdateReadingTagsCommand(
            reading_id=created.id,
            user_id=valid_command.user_id,
            tags=["career", "big decision"],
        )
    )
    assert result.tags == ["career", "big decision"]
    assert result.id == created.id


async def test_update_reading_tags_not_found(update_tags_handler):
    with pytest.raises(ReadingNotFoundError):
        await update_tags_handler.handle(
            UpdateReadingTagsCommand(
                reading_id=str(ObjectId()),
                user_id=str(ObjectId()),
                tags=["career"],
            )
        )


async def test_update_reading_tags_wrong_user(handler, valid_command, update_tags_handler):
    created = await handler.handle(valid_command)
    with pytest.raises(ReadingNotFoundError):
        await update_tags_handler.handle(
            UpdateReadingTagsCommand(
                reading_id=created.id,
                user_id=str(ObjectId()),
                tags=["career"],
            )
        )
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd /Users/pavlos/projects/private/gnosis-esoterica-api && make test params="tests/readings/test_commands.py"` (or `uv run pytest tests/readings/test_commands.py -v` directly)
Expected: FAIL/ERROR with `ModuleNotFoundError: No module named 'src.readings.commands.update_reading_tags'`

- [ ] **Step 3: Add `tags` to the `Reading` model**

In `src/readings/models.py`, add `tags: list[str] | None = None` to `__init__`'s parameter list right after `birth_date: date | None = None,` (line 18):

```python
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
        self.tags = tags
        self.cards = cards
```

In `to_document()`, add after the `birth_date` guard (after line 50):

```python
        if self.birth_date is not None:
            doc["birth_date"] = self.birth_date.isoformat()
        if self.tags is not None:
            doc["tags"] = self.tags
        return doc
```

In `from_document()`, add after the `birth_date` line (after line 60):

```python
            birth_date=date.fromisoformat(doc["birth_date"]) if doc.get("birth_date") else None,
            tags=doc.get("tags", []),
```

- [ ] **Step 4: Add tags to schemas, plus the shared normalize helper and update-request schema**

In `src/readings/schemas.py`, replace the full file with:

```python
from datetime import date, datetime

from pydantic import Field, field_validator

from src.core.base_schema import AppSchema
from src.core.types import PyObjectId
from src.llm.schemas import CardInSpread, Orientation

MAX_TAGS_PER_READING = 5
MAX_TAG_LENGTH = 15


def normalize_tags(raw: str) -> list[str]:
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
    cards: list[CardInSpread] = Field(..., min_length=1, max_length=10)


class UpdateReadingTagsRequest(AppSchema):
    tags: str

    @field_validator("tags")
    @classmethod
    def validate_tags(cls, value: str) -> str:
        tags = normalize_tags(value)
        if len(tags) > MAX_TAGS_PER_READING:
            raise ValueError(f"A reading can have at most {MAX_TAGS_PER_READING} tags")
        for tag in tags:
            if len(tag) > MAX_TAG_LENGTH:
                raise ValueError(f"Each tag must be at most {MAX_TAG_LENGTH} characters")
        return value

    @property
    def normalized_tags(self) -> list[str]:
        return normalize_tags(self.tags)


class CardInterpretationReadModel(AppSchema):
    card_name: str
    position: str
    orientation: Orientation
    interpretation: str


class CardReadModel(AppSchema):
    name: str
    position: str
    orientation: Orientation


class ReadingReadModel(AppSchema):
    id: PyObjectId = Field(alias="_id")
    user_id: PyObjectId
    spread_type: str
    question: str | None = None
    birth_date: date | None = None
    tags: list[str] = Field(default_factory=list)
    cards: list[CardReadModel]
    card_interpretations: list[CardInterpretationReadModel]
    synthesis: str
    tokens_used: int
    model: str
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

- [ ] **Step 5: Create the update-tags command and handler**

Create `src/readings/commands/update_reading_tags.py`:

```python
from bson import ObjectId
from bson.errors import InvalidId

from src.cqrs.commands import BaseCommand, CommandHandler
from src.readings.repository import ReadingReadRepository, ReadingWriteRepository
from src.readings.schemas import ReadingReadModel
from src.readings.service import ReadingNotFoundError


class UpdateReadingTagsCommand(BaseCommand):
    reading_id: str
    user_id: str
    tags: list[str]


class UpdateReadingTagsHandler(CommandHandler[UpdateReadingTagsCommand, ReadingReadModel]):
    def __init__(
        self,
        read_repo: ReadingReadRepository,
        write_repo: ReadingWriteRepository,
    ) -> None:
        self._read_repo = read_repo
        self._write_repo = write_repo

    async def handle(self, command: UpdateReadingTagsCommand) -> ReadingReadModel:
        try:
            oid = ObjectId(command.reading_id)
        except InvalidId:
            raise ReadingNotFoundError()
        doc = await self._read_repo.find_one({"_id": oid, "user_id": ObjectId(command.user_id)})
        if doc is None:
            raise ReadingNotFoundError()
        await self._write_repo.update(command.reading_id, {"tags": command.tags})
        doc["tags"] = command.tags
        return ReadingReadModel.model_validate(doc)
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `cd /Users/pavlos/projects/private/gnosis-esoterica-api && uv run pytest tests/readings/test_commands.py -v`
Expected: PASS (all `test_create_reading*` tests plus the three new `test_update_reading_tags*` tests)

- [ ] **Step 7: Commit**

```bash
cd /Users/pavlos/projects/private/gnosis-esoterica-api
git add src/readings/models.py src/readings/schemas.py src/readings/commands/update_reading_tags.py tests/readings/test_commands.py
git commit -m "feat: add reading tags data model and update-tags command"
```

---

### Task 2: PATCH endpoint for tag updates

**Files:**
- Modify: `src/readings/router.py`
- Modify: `src/main.py`
- Modify: `tests/conftest.py`
- Test: `tests/readings/test_router.py`

**Interfaces:**
- Consumes: `UpdateReadingTagsCommand`/`UpdateReadingTagsHandler` (Task 1), `UpdateReadingTagsRequest` (Task 1, with `.normalized_tags` property).
- Produces: `PATCH /api/v1/readings/{reading_id}/tags` endpoint, returning `ReadingReadModel`.

- [ ] **Step 1: Write the failing HTTP-level tests**

Append to `tests/readings/test_router.py` (no new imports needed — file has none today, relies on `client`/`auth_token` fixtures):

```python
async def test_update_reading_tags(client, auth_token):
    create_resp = await client.post(
        "/api/v1/readings",
        json=VALID_READING_BODY,
        headers={"Authorization": f"Bearer {auth_token}"},
    )
    reading_id = create_resp.json()["_id"]
    resp = await client.patch(
        f"/api/v1/readings/{reading_id}/tags",
        json={"tags": "Career, big decision"},
        headers={"Authorization": f"Bearer {auth_token}"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["tags"] == ["career", "big decision"]
    assert data["_id"] == reading_id


async def test_update_reading_tags_too_many(client, auth_token):
    create_resp = await client.post(
        "/api/v1/readings",
        json=VALID_READING_BODY,
        headers={"Authorization": f"Bearer {auth_token}"},
    )
    reading_id = create_resp.json()["_id"]
    resp = await client.patch(
        f"/api/v1/readings/{reading_id}/tags",
        json={"tags": "a,b,c,d,e,f"},
        headers={"Authorization": f"Bearer {auth_token}"},
    )
    assert resp.status_code == 422


async def test_update_reading_tags_too_long(client, auth_token):
    create_resp = await client.post(
        "/api/v1/readings",
        json=VALID_READING_BODY,
        headers={"Authorization": f"Bearer {auth_token}"},
    )
    reading_id = create_resp.json()["_id"]
    resp = await client.patch(
        f"/api/v1/readings/{reading_id}/tags",
        json={"tags": "a-tag-that-is-definitely-too-long"},
        headers={"Authorization": f"Bearer {auth_token}"},
    )
    assert resp.status_code == 422


async def test_update_reading_tags_wrong_user(client, auth_token):
    create_resp = await client.post(
        "/api/v1/readings",
        json=VALID_READING_BODY,
        headers={"Authorization": f"Bearer {auth_token}"},
    )
    reading_id = create_resp.json()["_id"]

    reg = await client.post(
        "/api/v1/auth/register",
        json={"email": "other2@example.com", "password": "securepassword123"},
    )
    other_token = reg.json()["access_token"]

    resp = await client.patch(
        f"/api/v1/readings/{reading_id}/tags",
        json={"tags": "career"},
        headers={"Authorization": f"Bearer {other_token}"},
    )
    assert resp.status_code == 404
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd /Users/pavlos/projects/private/gnosis-esoterica-api && uv run pytest tests/readings/test_router.py -v`
Expected: FAIL with 404/405 (no `PATCH .../tags` route registered yet)

- [ ] **Step 3: Add the router endpoint**

In `src/readings/router.py`, add imports and the new endpoint:

```python
from fastapi import APIRouter, Query

from src.core.dependencies import CurrentUserId, MediatorDep
from src.core.pagination import PaginatedResponse
from src.readings.commands.create_reading import CreateReadingCommand
from src.readings.commands.update_reading_tags import UpdateReadingTagsCommand
from src.readings.queries.get_reading_by_id import GetReadingByIdQuery
from src.readings.queries.list_user_readings import ListUserReadingsQuery
from src.readings.schemas import (
    CreateReadingRequest,
    ReadingListItem,
    ReadingReadModel,
    UpdateReadingTagsRequest,
)

router = APIRouter(prefix="/readings", tags=["readings"])
```

(`create_reading`, `list_readings`, `get_reading` endpoints stay exactly as they are — only the import block above changes.) Add this new endpoint at the end of the file:

```python
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
        tags=body.normalized_tags,
    )
    return await mediator.send(command)
```

- [ ] **Step 4: Wire the command into the mediator (app + tests)**

In `src/main.py`, add the import alongside the existing readings imports (after line 28):

```python
from src.readings.commands.create_reading import CreateReadingCommand, CreateReadingHandler
from src.readings.commands.update_reading_tags import (
    UpdateReadingTagsCommand,
    UpdateReadingTagsHandler,
)
```

In `_wire_mediator`, add registration right after the existing `CreateReadingCommand` registration (after line 57):

```python
    mediator.register_command(CreateReadingCommand, CreateReadingHandler(reading_write_repo, llm))
    mediator.register_command(
        UpdateReadingTagsCommand,
        UpdateReadingTagsHandler(reading_read_repo, reading_write_repo),
    )
```

In `tests/conftest.py`, add the same import alongside the existing `create_reading` import (after line 33) and the same registration alongside the existing `CreateReadingCommand` registration (after line 62), inside the `app` fixture:

```python
    from src.readings.commands.create_reading import CreateReadingCommand, CreateReadingHandler
    from src.readings.commands.update_reading_tags import (
        UpdateReadingTagsCommand,
        UpdateReadingTagsHandler,
    )
```

```python
    mediator.register_command(
        CreateReadingCommand, CreateReadingHandler(reading_write_repo, mock_llm)
    )
    mediator.register_command(
        UpdateReadingTagsCommand,
        UpdateReadingTagsHandler(reading_read_repo, reading_write_repo),
    )
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `cd /Users/pavlos/projects/private/gnosis-esoterica-api && uv run pytest tests/readings/test_router.py -v`
Expected: PASS (all tests including the 4 new ones)

- [ ] **Step 6: Commit**

```bash
cd /Users/pavlos/projects/private/gnosis-esoterica-api
git add src/readings/router.py src/main.py tests/conftest.py tests/readings/test_router.py
git commit -m "feat: add PATCH /readings/{id}/tags endpoint"
```

---

### Task 3: List filters — spread_type and birth_date (non-tags path)

**Files:**
- Modify: `src/readings/repository.py`
- Modify: `src/readings/queries/list_user_readings.py`
- Modify: `src/readings/router.py`
- Test: `tests/readings/test_queries.py`

**Interfaces:**
- Produces: `ReadingReadRepository.find_by_user_id(user_id, skip, limit, spread_type=None, birth_date=None)` and `.count_by_user_id(user_id, spread_type=None, birth_date=None)` — extended signatures, same names, consumed by Task 4's handler branch.
- Produces: `ListUserReadingsQuery` gains `spread_type: str | None = None`, `birth_date: date | None = None` fields (`tags` field added in Task 4).

- [ ] **Step 1: Write the failing tests**

Add `from datetime import date` to the top imports of `tests/readings/test_queries.py` (alongside the existing `import pytest` / `from bson import ObjectId`). Append at the end of the file:

```python
async def test_list_user_readings_filter_by_spread_type(create_handler, list_handler, user_id):
    await create_handler.handle(_make_command(user_id, spread="Celtic Cross"))
    await create_handler.handle(_make_command(user_id, spread="Three Card"))
    result = await list_handler.handle(
        ListUserReadingsQuery(user_id=user_id, spread_type="Three Card")
    )
    assert len(result.items) == 1
    assert result.items[0].spread_type == "Three Card"


async def test_list_user_readings_filter_by_birth_date_matches(create_handler, list_handler, user_id):
    command = CreateReadingCommand(
        user_id=user_id,
        spread_name="Significators",
        birth_date=date(1990, 5, 1),
        cards=[CardInSpread(name="The Fool", position="Present", orientation="upright")],
    )
    await create_handler.handle(command)
    result = await list_handler.handle(
        ListUserReadingsQuery(user_id=user_id, birth_date=date(1990, 5, 1))
    )
    assert len(result.items) == 1


async def test_list_user_readings_filter_by_birth_date_excludes_non_matching(
    create_handler, list_handler, user_id
):
    await create_handler.handle(_make_command(user_id))
    result = await list_handler.handle(
        ListUserReadingsQuery(user_id=user_id, birth_date=date(1990, 5, 1))
    )
    assert result.items == []
    assert result.total == 0
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd /Users/pavlos/projects/private/gnosis-esoterica-api && uv run pytest tests/readings/test_queries.py -v`
Expected: FAIL with `TypeError: ListUserReadingsQuery() got unexpected keyword argument 'spread_type'` (or `'birth_date'`)

- [ ] **Step 3: Extend the repository with an extra-filter builder**

Replace `src/readings/repository.py` in full:

```python
from datetime import date
from typing import Any

from bson import ObjectId

from src.database.base_repository import BaseReadRepository, BaseWriteRepository
from src.database.collections.constants import READINGS_COLLECTION


def _build_filter(
    user_id: str,
    spread_type: str | None,
    birth_date: date | None,
) -> dict[str, Any]:
    filter_: dict[str, Any] = {"user_id": ObjectId(user_id)}
    if spread_type:
        filter_["spread_type"] = spread_type
    if birth_date:
        filter_["birth_date"] = birth_date.isoformat()
    return filter_


class ReadingWriteRepository(BaseWriteRepository):
    @property
    def collection_name(self) -> str:
        return READINGS_COLLECTION


class ReadingReadRepository(BaseReadRepository):
    @property
    def collection_name(self) -> str:
        return READINGS_COLLECTION

    async def find_by_user_id(
        self,
        user_id: str,
        skip: int = 0,
        limit: int = 20,
        spread_type: str | None = None,
        birth_date: date | None = None,
    ) -> list[dict[str, Any]]:
        return await self.find_many(
            _build_filter(user_id, spread_type, birth_date),
            skip=skip,
            limit=limit,
            sort=[("created_at", -1)],
        )

    async def count_by_user_id(
        self,
        user_id: str,
        spread_type: str | None = None,
        birth_date: date | None = None,
    ) -> int:
        return await self.count(_build_filter(user_id, spread_type, birth_date))
```

(`find_by_user_id_ranked_by_tag_overlap` is added in Task 4, not here.)

- [ ] **Step 4: Extend the query and handler**

In `src/readings/queries/list_user_readings.py`, replace the full file:

```python
import asyncio
from datetime import date

from pydantic import Field

from src.core.pagination import PaginatedResponse
from src.cqrs.queries import BaseQuery, QueryHandler
from src.readings.repository import ReadingReadRepository
from src.readings.schemas import ReadingListItem


class ListUserReadingsQuery(BaseQuery):
    user_id: str
    page: int = Field(default=1, ge=1)
    page_size: int = Field(default=20, ge=1, le=100)
    spread_type: str | None = None
    birth_date: date | None = None


class ListUserReadingsHandler(
    QueryHandler[ListUserReadingsQuery, PaginatedResponse[ReadingListItem]]
):
    def __init__(self, read_repo: ReadingReadRepository) -> None:
        self._read_repo = read_repo

    async def handle(self, query: ListUserReadingsQuery) -> PaginatedResponse[ReadingListItem]:
        skip = (query.page - 1) * query.page_size
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
        return PaginatedResponse[ReadingListItem](
            items=[ReadingListItem.model_validate(doc) for doc in docs],
            total=total,
            page=query.page,
            page_size=query.page_size,
        )
```

(The `tags` branch is added in Task 4 — this handler intentionally has no tags logic yet.)

- [ ] **Step 5: Add router query params**

In `src/readings/router.py`, add the `date` import at the top and extend `list_readings`:

```python
from datetime import date

from fastapi import APIRouter, Query
```

```python
@router.get("", response_model=PaginatedResponse[ReadingListItem])
async def list_readings(
    user_id: CurrentUserId,
    mediator: MediatorDep,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    spread_type: str | None = Query(default=None),
    birth_date: date | None = Query(default=None),
) -> PaginatedResponse[ReadingListItem]:
    return await mediator.query(
        ListUserReadingsQuery(
            user_id=user_id,
            page=page,
            page_size=page_size,
            spread_type=spread_type,
            birth_date=birth_date,
        )
    )
```

(The `tags` query param is added in Task 4.)

- [ ] **Step 6: Run the tests to verify they pass**

Run: `cd /Users/pavlos/projects/private/gnosis-esoterica-api && uv run pytest tests/readings/test_queries.py tests/readings/test_router.py -v`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
cd /Users/pavlos/projects/private/gnosis-esoterica-api
git add src/readings/repository.py src/readings/queries/list_user_readings.py src/readings/router.py tests/readings/test_queries.py
git commit -m "feat: add spread_type and birth_date filters to readings list"
```

---

### Task 4: List filter — tags with overlap ranking + tags index migration

**Files:**
- Modify: `src/readings/repository.py`
- Modify: `src/readings/queries/list_user_readings.py`
- Modify: `src/readings/router.py`
- Create: `src/migrations/versions/003_reading_tags_index.py`
- Test: `tests/readings/test_queries.py`
- Test: `tests/readings/test_router.py`

**Interfaces:**
- Consumes: `normalize_tags()` from `src/readings/schemas.py` (Task 1).
- Produces: `ReadingReadRepository.find_by_user_id_ranked_by_tag_overlap(user_id, tags, skip, limit, spread_type=None, birth_date=None) -> tuple[list[dict], int]`.

- [ ] **Step 1: Write the failing query-level tests**

Append to `tests/readings/test_queries.py`:

```python
async def test_list_user_readings_filter_by_tags_ranks_by_overlap(
    create_handler, list_handler, repos, user_id
):
    write_repo, _ = repos
    high_overlap = await create_handler.handle(_make_command(user_id))
    low_overlap = await create_handler.handle(_make_command(user_id))
    await write_repo.update(high_overlap.id, {"tags": ["career", "love"]})
    await write_repo.update(low_overlap.id, {"tags": ["career"]})

    result = await list_handler.handle(
        ListUserReadingsQuery(user_id=user_id, tags=["career", "love"])
    )
    assert [item.id for item in result.items] == [high_overlap.id, low_overlap.id]
    assert result.total == 2


async def test_list_user_readings_filter_by_tags_excludes_no_match(
    create_handler, list_handler, repos, user_id
):
    write_repo, _ = repos
    tagged = await create_handler.handle(_make_command(user_id))
    await create_handler.handle(_make_command(user_id))
    await write_repo.update(tagged.id, {"tags": ["career"]})

    result = await list_handler.handle(ListUserReadingsQuery(user_id=user_id, tags=["career"]))
    assert len(result.items) == 1
    assert result.items[0].id == tagged.id


async def test_list_user_readings_filter_combined_spread_type_and_tags(
    create_handler, list_handler, repos, user_id
):
    write_repo, _ = repos
    matching = await create_handler.handle(_make_command(user_id, spread="Celtic Cross"))
    other_spread = await create_handler.handle(_make_command(user_id, spread="Three Card"))
    await write_repo.update(matching.id, {"tags": ["career"]})
    await write_repo.update(other_spread.id, {"tags": ["career"]})

    result = await list_handler.handle(
        ListUserReadingsQuery(user_id=user_id, spread_type="Celtic Cross", tags=["career"])
    )
    assert len(result.items) == 1
    assert result.items[0].id == matching.id
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd /Users/pavlos/projects/private/gnosis-esoterica-api && uv run pytest tests/readings/test_queries.py -v`
Expected: FAIL with `TypeError: ListUserReadingsQuery() got unexpected keyword argument 'tags'`

- [ ] **Step 3: Add the aggregation repository method**

In `src/readings/repository.py`, add this method inside `ReadingReadRepository` (after `count_by_user_id`):

```python
    async def find_by_user_id_ranked_by_tag_overlap(
        self,
        user_id: str,
        tags: list[str],
        skip: int,
        limit: int,
        spread_type: str | None = None,
        birth_date: date | None = None,
    ) -> tuple[list[dict[str, Any]], int]:
        match_stage: dict[str, Any] = {
            **_build_filter(user_id, spread_type, birth_date),
            "tags": {"$in": tags},
        }
        pipeline = [
            {"$match": match_stage},
            {"$addFields": {"overlap": {"$size": {"$setIntersection": ["$tags", tags]}}}},
            {
                "$facet": {
                    "items": [
                        {"$sort": {"overlap": -1, "created_at": -1}},
                        {"$skip": skip},
                        {"$limit": limit},
                    ],
                    "total": [{"$count": "count"}],
                }
            },
        ]
        result = await self._collection.aggregate(pipeline).to_list(length=1)
        facet = result[0] if result else {"items": [], "total": []}
        total = facet["total"][0]["count"] if facet["total"] else 0
        return facet["items"], total
```

- [ ] **Step 4: Branch the handler on tags presence**

In `src/readings/queries/list_user_readings.py`, add `tags: list[str] | None = None` to `ListUserReadingsQuery` (after `birth_date`), and replace the `handle` method body:

```python
class ListUserReadingsQuery(BaseQuery):
    user_id: str
    page: int = Field(default=1, ge=1)
    page_size: int = Field(default=20, ge=1, le=100)
    spread_type: str | None = None
    tags: list[str] | None = None
    birth_date: date | None = None
```

```python
    async def handle(self, query: ListUserReadingsQuery) -> PaginatedResponse[ReadingListItem]:
        skip = (query.page - 1) * query.page_size

        if query.tags:
            docs, total = await self._read_repo.find_by_user_id_ranked_by_tag_overlap(
                query.user_id,
                query.tags,
                skip=skip,
                limit=query.page_size,
                spread_type=query.spread_type,
                birth_date=query.birth_date,
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

        return PaginatedResponse[ReadingListItem](
            items=[ReadingListItem.model_validate(doc) for doc in docs],
            total=total,
            page=query.page,
            page_size=query.page_size,
        )
```

- [ ] **Step 5: Add the tags router query param**

In `src/readings/router.py`, import `normalize_tags` and add the `tags` param:

```python
from src.readings.schemas import (
    CreateReadingRequest,
    ReadingListItem,
    ReadingReadModel,
    UpdateReadingTagsRequest,
    normalize_tags,
)
```

```python
@router.get("", response_model=PaginatedResponse[ReadingListItem])
async def list_readings(
    user_id: CurrentUserId,
    mediator: MediatorDep,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    spread_type: str | None = Query(default=None),
    tags: str | None = Query(default=None),
    birth_date: date | None = Query(default=None),
) -> PaginatedResponse[ReadingListItem]:
    return await mediator.query(
        ListUserReadingsQuery(
            user_id=user_id,
            page=page,
            page_size=page_size,
            spread_type=spread_type,
            tags=normalize_tags(tags) if tags else None,
            birth_date=birth_date,
        )
    )
```

- [ ] **Step 6: Add an HTTP-level test for the tags query param**

Append to `tests/readings/test_router.py`:

```python
async def test_list_readings_filter_by_tags(client, auth_token):
    create_resp = await client.post(
        "/api/v1/readings", json=VALID_READING_BODY, headers={"Authorization": f"Bearer {auth_token}"}
    )
    reading_id = create_resp.json()["_id"]
    await client.patch(
        f"/api/v1/readings/{reading_id}/tags",
        json={"tags": "career"},
        headers={"Authorization": f"Bearer {auth_token}"},
    )
    resp = await client.get(
        "/api/v1/readings", params={"tags": "career"}, headers={"Authorization": f"Bearer {auth_token}"}
    )
    data = resp.json()
    assert data["total"] == 1
    assert data["items"][0]["tags"] == ["career"]


async def test_list_readings_filter_by_spread_type(client, auth_token):
    await client.post(
        "/api/v1/readings", json=VALID_READING_BODY, headers={"Authorization": f"Bearer {auth_token}"}
    )
    await client.post(
        "/api/v1/readings",
        json={**VALID_READING_BODY, "spread_name": "Three Card"},
        headers={"Authorization": f"Bearer {auth_token}"},
    )
    resp = await client.get(
        "/api/v1/readings",
        params={"spread_type": "Three Card"},
        headers={"Authorization": f"Bearer {auth_token}"},
    )
    data = resp.json()
    assert data["total"] == 1
    assert data["items"][0]["spread_type"] == "Three Card"
```

- [ ] **Step 7: Run the tests to verify they pass**

Run: `cd /Users/pavlos/projects/private/gnosis-esoterica-api && uv run pytest tests/readings -v`
Expected: PASS (full `tests/readings` suite)

- [ ] **Step 8: Add the tags index migration**

Create `src/migrations/versions/003_reading_tags_index.py`, following `002_readings_indexes.py`'s shape exactly:

```python
from motor.motor_asyncio import AsyncIOMotorDatabase

from src.database.collections.constants import READINGS_COLLECTION

version = "003"
description = "Create index on readings tags"


async def up(db: AsyncIOMotorDatabase) -> None:
    await db[READINGS_COLLECTION].create_index("tags")
```

- [ ] **Step 9: Commit**

```bash
cd /Users/pavlos/projects/private/gnosis-esoterica-api
git add src/readings/repository.py src/readings/queries/list_user_readings.py src/readings/router.py \
        src/migrations/versions/003_reading_tags_index.py tests/readings/test_queries.py tests/readings/test_router.py
git commit -m "feat: add tags filter with overlap ranking to readings list"
```

---

## Frontend (`tarot-divinations`)

### Task 5: Types and tag validation schema

**Files:**
- Modify: `src/types/reading.ts`
- Create: `src/lib/validation/reading-schemas.ts`

**Interfaces:**
- Produces: `ReadingListItem.tags: string[]` (and inherited on `ReadingDetail`), `UpdateTagsResult` type — consumed by Task 6 (server action) and Task 7 (component).
- Produces: `MAX_TAGS_PER_READING`, `MAX_TAG_LENGTH`, `updateTagsSchema` — consumed by Task 6 (server action) and Task 7 (component).

- [ ] **Step 1: Add `tags` to the reading types**

In `src/types/reading.ts`, modify `ReadingListItem` (currently lines 26-34) to add `tags: string[];` after `birth_date?: string;`, and append the new `UpdateTagsResult` type after `ReadingDetail`:

```typescript
export interface ReadingListItem {
  _id: string;
  user_id: string;
  spread_type: string;
  question: string | null;
  cards: SavedCard[];
  created_at: string;
  birth_date?: string;
  tags: string[];
}

export interface ReadingDetail extends ReadingListItem {
  card_interpretations: CardInterpretation[];
  synthesis: string;
  model: string;
  tokens_used: number;
}

export type UpdateTagsResult =
  | { ok: true; data: ReadingDetail }
  | { ok: false; error: string };
```

- [ ] **Step 2: Create the tag validation schema**

Create `src/lib/validation/reading-schemas.ts`:

```typescript
import { z } from "zod";

export const MAX_TAGS_PER_READING = 5;
export const MAX_TAG_LENGTH = 15;

export const updateTagsSchema = z.object({
  tags: z
    .array(z.string().max(MAX_TAG_LENGTH, "tags should be comma separated"))
    .max(MAX_TAGS_PER_READING, `Max ${MAX_TAGS_PER_READING} tags`),
});
```

- [ ] **Step 3: Verify types compile**

Run: `cd /Users/pavlos/projects/private/tarot-divinations && npx tsc --noEmit`
Expected: no new errors (existing pre-existing errors, if any, are unrelated and unchanged)

- [ ] **Step 4: Commit**

```bash
cd /Users/pavlos/projects/private/tarot-divinations
git add src/types/reading.ts src/lib/validation/reading-schemas.ts
git commit -m "feat: add tags type and validation schema"
```

---

### Task 6: Server action to update reading tags

**Files:**
- Modify: `src/app/user/readings/[id]/actions.ts`

**Interfaces:**
- Consumes: `updateTagsSchema` (Task 5), `UpdateTagsResult` (Task 5).
- Produces: `updateReadingTags(readingId: string, tags: string[]) => Promise<UpdateTagsResult>` — consumed by Task 7's component.

- [ ] **Step 1: Add the server action**

In `src/app/user/readings/[id]/actions.ts`, add imports and the new export (the existing `getReading` export is unchanged):

```typescript
"use server";

import { authenticatedFetch } from "@/lib/api-client";
import { getCurrentUser } from "@/lib/session";
import type { ReadingDetail, UpdateTagsResult } from "@/types/reading";
import { updateTagsSchema } from "@/lib/validation/reading-schemas";

export const getReading = async (
  id: string
): Promise<
  | { ok: true; data: ReadingDetail }
  | { ok: false; error: string }
> => {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "You must be logged in." };

  if (!id || !/^[a-f0-9]{24}$/.test(id))
    return { ok: false, error: "Invalid reading ID." };

  const result = await authenticatedFetch<ReadingDetail>(
    `/api/v1/readings/${id}`,
    { method: "GET" }
  );

  if (!result.ok)
    return { ok: false, error: result.message ?? "Failed to fetch reading." };

  if (result.data.user_id !== user.id) {
    return { ok: false, error: "You do not have permission to view this reading." };
  }

  return { ok: true, data: result.data };
};

export const updateReadingTags = async (
  readingId: string,
  tags: string[]
): Promise<UpdateTagsResult> => {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "You must be logged in." };

  const parsed = updateTagsSchema.safeParse({ tags });
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0].message };

  const result = await authenticatedFetch<ReadingDetail>(
    `/api/v1/readings/${readingId}/tags`,
    { method: "PATCH", body: JSON.stringify({ tags: tags.join(", ") }) }
  );

  if (!result.ok)
    return { ok: false, error: result.message ?? "Failed to update tags." };

  return { ok: true, data: result.data };
};
```

- [ ] **Step 2: Verify types compile**

Run: `cd /Users/pavlos/projects/private/tarot-divinations && npx tsc --noEmit`
Expected: no new errors

- [ ] **Step 3: Commit**

```bash
cd /Users/pavlos/projects/private/tarot-divinations
git add src/app/user/readings/\[id\]/actions.ts
git commit -m "feat: add updateReadingTags server action"
```

---

### Task 7: Tag editor component on the reading detail page

**Files:**
- Create: `src/components/ReadingTags.tsx`
- Modify: `src/app/user/readings/[id]/page.tsx`

**Interfaces:**
- Consumes: `updateReadingTags` (Task 6), `MAX_TAGS_PER_READING`/`MAX_TAG_LENGTH` (Task 5).
- Produces: `<ReadingTags readingId: string, initialTags: string[] />` — rendered in the detail page.

- [ ] **Step 1: Create the `ReadingTags` component**

Create `src/components/ReadingTags.tsx`:

```tsx
"use client";

import { useState } from "react";
import type { KeyboardEvent, ClipboardEvent } from "react";
import { useRouter } from "next/navigation";
import { updateReadingTags } from "@/app/user/readings/[id]/actions";
import { MAX_TAGS_PER_READING, MAX_TAG_LENGTH } from "@/lib/validation/reading-schemas";

interface ReadingTagsProps {
  readingId: string;
  initialTags: string[];
}

const ReadingTags = ({ readingId, initialTags }: ReadingTagsProps) => {
  const router = useRouter();
  const [tags, setTags] = useState(initialTags);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<string[]>(initialTags);
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const startEditing = () => {
    setDraft(tags);
    setInput("");
    setError(null);
    setEditing(true);
  };

  const cancelEditing = () => {
    setEditing(false);
    setInput("");
    setError(null);
  };

  const removeDraftTag = (tag: string) => {
    setDraft((prev) => prev.filter((t) => t !== tag));
    setError(null);
  };

  const commitTag = (raw: string) => {
    const tag = raw.trim().toLowerCase();
    if (!tag) return;
    if (draft.length >= MAX_TAGS_PER_READING) return;
    if (tag.length > MAX_TAG_LENGTH) {
      setError("tags should be comma separated");
      return;
    }
    if (draft.includes(tag)) return;
    setDraft((prev) => [...prev, tag]);
    setError(null);
  };

  const handleInputChange = (value: string) => {
    if (value.includes(",")) {
      const parts = value.split(",");
      const last = parts.pop() ?? "";
      parts.forEach(commitTag);
      setInput(last);
      return;
    }
    setInput(value);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      commitTag(input);
      setInput("");
    }
  };

  const handlePaste = (e: ClipboardEvent<HTMLInputElement>) => {
    const pasted = e.clipboardData.getData("text");
    if (!pasted.includes(",")) return;
    e.preventDefault();
    pasted.split(",").forEach(commitTag);
    setInput("");
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    const result = await updateReadingTags(readingId, draft);
    setSaving(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setTags(result.data.tags);
    setEditing(false);
    router.refresh();
  };

  const atMax = draft.length >= MAX_TAGS_PER_READING;

  return (
    <div className="flex flex-wrap items-center gap-2 mb-6">
      {(editing ? draft : tags).map((tag) => (
        <span
          key={tag}
          className={
            editing
              ? "flex items-center gap-1.5 pl-3 pr-1.5 py-1 rounded-full border border-[#d4af37]/30 bg-[#1a0033]/60 text-[#e6d5b8]/80 text-xs tracking-wide"
              : "px-3 py-1 rounded-full border border-[#d4af37]/30 bg-[#1a0033]/60 text-[#e6d5b8]/80 text-xs tracking-wide"
          }
          style={{ fontFamily: "'Crimson Pro', serif" }}
        >
          {tag}
          {editing && (
            <button
              type="button"
              onClick={() => removeDraftTag(tag)}
              aria-label={`Remove ${tag}`}
              className="w-4 h-4 rounded-full text-[#d4af37]/60 hover:text-[#d4af37] hover:bg-[#d4af37]/10 flex items-center justify-center leading-none"
            >
              ×
            </button>
          )}
        </span>
      ))}

      {editing && (
        <input
          type="text"
          value={input}
          disabled={atMax}
          onChange={(e) => handleInputChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          placeholder={atMax ? "Max 5 tags" : "Add a tag…"}
          className="px-3 py-1 rounded-full border border-[#d4af37]/30 bg-[#1a0033]/40 text-[#e6d5b8] text-xs
                     placeholder-[#e6d5b8]/30 focus:outline-none focus:border-[#d4af37]/60 disabled:opacity-50"
          style={{ fontFamily: "'Crimson Pro', serif" }}
        />
      )}

      {editing ? (
        <>
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="w-7 h-7 rounded-full border border-[#d4af37]/50 text-[#d4af37]/70
                       hover:text-[#d4af37] hover:border-[#d4af37]
                       hover:shadow-[0_0_10px_rgba(212,175,55,0.4)]
                       transition-all duration-300 flex items-center justify-center text-sm disabled:opacity-50"
          >
            ✓
          </button>
          <button
            type="button"
            onClick={cancelEditing}
            className="w-7 h-7 rounded-full border border-[#d4af37]/50 text-[#d4af37]/70
                       hover:text-[#d4af37] hover:border-[#d4af37]
                       hover:shadow-[0_0_10px_rgba(212,175,55,0.4)]
                       transition-all duration-300 flex items-center justify-center text-sm"
          >
            ✕
          </button>
        </>
      ) : (
        <button
          type="button"
          onClick={startEditing}
          className="w-7 h-7 rounded-full border border-[#d4af37]/50 text-[#d4af37]/70
                     hover:text-[#d4af37] hover:border-[#d4af37]
                     hover:shadow-[0_0_10px_rgba(212,175,55,0.4)]
                     transition-all duration-300 flex items-center justify-center text-sm"
        >
          +
        </button>
      )}

      {error && (
        <p className="w-full text-xs text-red-400/80" style={{ fontFamily: "'Crimson Pro', serif" }}>
          {error}
        </p>
      )}
    </div>
  );
};

export default ReadingTags;
```

- [ ] **Step 2: Wire it into the reading detail page**

In `src/app/user/readings/[id]/page.tsx`, add the import after the existing imports (after line 7):

```tsx
import type { TarotCardData } from "@/types/models";
import ReadingTags from "@/components/ReadingTags";
```

Insert the component between the header block's closing `</div>` (line 91) and the `{/* Interpretation content */}` comment (line 93):

```tsx
          </time>
        </div>

        <ReadingTags readingId={reading._id} initialTags={reading.tags} />

        {/* Interpretation content */}
```

- [ ] **Step 3: Verify types compile**

Run: `cd /Users/pavlos/projects/private/tarot-divinations && npx tsc --noEmit`
Expected: no new errors

- [ ] **Step 4: Commit**

```bash
cd /Users/pavlos/projects/private/tarot-divinations
git add src/components/ReadingTags.tsx src/app/user/readings/\[id\]/page.tsx
git commit -m "feat: add tag editor to reading detail page"
```

---

### Task 8: Filter data plumbing and tag pills on the readings list

**Files:**
- Modify: `src/app/user/readings/actions.ts`
- Modify: `src/app/user/readings/page.tsx`

**Interfaces:**
- Produces: `getReadings(page, pageSize, filters?: { spreadType?: string; tags?: string; birthDate?: string })` — extended signature, consumed by Task 9 (filter panel wiring passes the parsed `searchParams` through).

- [ ] **Step 1: Extend `getReadings` with filters**

Replace `src/app/user/readings/actions.ts` in full:

```typescript
"use server";

import { authenticatedFetch } from "@/lib/api-client";
import { getCurrentUser } from "@/lib/session";
import type { PaginatedReadings } from "@/types/reading";

interface ReadingsFilters {
  spreadType?: string;
  tags?: string;
  birthDate?: string;
}

export const getReadings = async (
  page = 1,
  pageSize = 10,
  filters?: ReadingsFilters
): Promise<
  | { ok: true; data: PaginatedReadings }
  | { ok: false; error: string }
> => {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "You must be logged in." };

  const safePage = Math.max(1, Math.floor(Number(page)) || 1);
  const safePageSize = Math.min(50, Math.max(1, Math.floor(Number(pageSize)) || 10));

  const params = new URLSearchParams({
    page: String(safePage),
    page_size: String(safePageSize),
  });
  if (filters?.spreadType) params.set("spread_type", filters.spreadType);
  if (filters?.tags) params.set("tags", filters.tags);
  if (filters?.birthDate) params.set("birth_date", filters.birthDate);

  const result = await authenticatedFetch<PaginatedReadings>(
    `/api/v1/readings?${params.toString()}`,
    { method: "GET" }
  );

  if (!result.ok)
    return { ok: false, error: result.message ?? "Failed to fetch readings." };

  return { ok: true, data: result.data };
};
```

- [ ] **Step 2: Parse filter searchParams and pass them through**

In `src/app/user/readings/page.tsx`, replace the `searchParams` type and the top of the component body (currently lines 21-32):

```tsx
const ReadingsPage = async ({
  searchParams,
}: {
  searchParams: Promise<{
    page?: string;
    spread_type?: string;
    tags?: string;
    birth_date?: string;
  }>;
}) => {
  const {
    page: pageParam,
    spread_type: spreadType,
    tags,
    birth_date: birthDate,
  } = await searchParams;
  const currentPage = Math.max(1, parseInt(pageParam ?? "1", 10) || 1);
  const result = await getReadings(currentPage, PAGE_SIZE, {
    spreadType,
    tags,
    birthDate,
  });

  const totalPages = result.ok
    ? Math.max(1, Math.ceil(result.data.total / PAGE_SIZE))
    : 1;

  const filterParams = new URLSearchParams();
  if (spreadType) filterParams.set("spread_type", spreadType);
  if (tags) filterParams.set("tags", tags);
  if (birthDate) filterParams.set("birth_date", birthDate);
  const pageHref = (targetPage: number) => {
    const params = new URLSearchParams(filterParams);
    params.set("page", String(targetPage));
    return `/user/readings?${params.toString()}`;
  };
```

- [ ] **Step 3: Show tag pills on each list item**

In the same file, insert after the birth-date block (currently lines 133-141) and before the card-count block (currently line 143):

```tsx
                  {/* Tags */}
                  {reading.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-3">
                      {reading.tags.map((tag) => (
                        <span
                          key={tag}
                          className="px-3 py-1 rounded-full border border-[#d4af37]/30 bg-[#1a0033]/60
                                     text-[#e6d5b8]/80 text-xs tracking-wide"
                          style={{ fontFamily: "'Crimson Pro', serif" }}
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
```

- [ ] **Step 4: Make pagination links carry the active filters**

Replace the two `href` values in the pagination block (currently lines 167 and 191):

```tsx
                    href={pageHref(currentPage - 1)}
```

```tsx
                    href={pageHref(currentPage + 1)}
```

- [ ] **Step 5: Add the relevance hint when a tags filter is active**

Replace the results-count paragraph (currently lines 54-62):

```tsx
          {result.ok && (
            <p
              className="text-[#e6d5b8]/50 text-sm mt-3"
              style={{ fontFamily: "'Crimson Pro', serif" }}
            >
              {result.data.total} reading{result.data.total !== 1 ? "s" : ""} in
              the archive
              {tags && " (sorted by relevance)"}
            </p>
          )}
```

- [ ] **Step 6: Verify types compile**

Run: `cd /Users/pavlos/projects/private/tarot-divinations && npx tsc --noEmit`
Expected: no new errors

- [ ] **Step 7: Commit**

```bash
cd /Users/pavlos/projects/private/tarot-divinations
git add src/app/user/readings/actions.ts src/app/user/readings/page.tsx
git commit -m "feat: plumb reading filters through list page and pagination"
```

---

### Task 9: Filter panel component and final manual verification

**Files:**
- Create: `src/components/ReadingsFilterPanel.tsx`
- Modify: `src/app/user/readings/page.tsx`

**Interfaces:**
- Consumes: `spreadType`/`tags`/`birthDate` parsed searchParams (Task 8).
- Produces: `<ReadingsFilterPanel currentSpreadType?: string, currentTags?: string, currentBirthDate?: string />`.

- [ ] **Step 1: Create the filter panel component**

Create `src/components/ReadingsFilterPanel.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import readingsConfig from "@/lib/readings-config.json";

interface ReadingsFilterPanelProps {
  currentSpreadType?: string;
  currentTags?: string;
  currentBirthDate?: string;
}

const ReadingsFilterPanel = ({
  currentSpreadType,
  currentTags,
  currentBirthDate,
}: ReadingsFilterPanelProps) => {
  const router = useRouter();
  const hasActiveFilter = Boolean(currentSpreadType || currentTags || currentBirthDate);
  const [expanded, setExpanded] = useState(hasActiveFilter);
  const [spreadType, setSpreadType] = useState(currentSpreadType ?? "");
  const [tags, setTags] = useState(currentTags ?? "");
  const [birthDate, setBirthDate] = useState(currentBirthDate ?? "");

  const togglePill = (name: string) => {
    setSpreadType((prev) => (prev === name ? "" : name));
  };

  const applyFilters = () => {
    const params = new URLSearchParams();
    if (spreadType) params.set("spread_type", spreadType);
    if (tags.trim()) params.set("tags", tags.trim());
    if (birthDate) params.set("birth_date", birthDate);
    router.push(`/user/readings?${params.toString()}`);
  };

  const clearFilters = () => {
    setSpreadType("");
    setTags("");
    setBirthDate("");
    setExpanded(false);
    router.push("/user/readings");
  };

  return (
    <div className="mb-8">
      <button
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
        className="text-[#d4af37]/50 hover:text-[#d4af37]/80 transition-colors text-sm tracking-widest select-none block mx-auto"
        style={{ fontFamily: "'Cinzel', serif" }}
      >
        &#9671; Filter Readings &#9671;
      </button>

      {expanded && (
        <div className="mt-6 rounded-xl border border-[#d4af37]/20 bg-gradient-to-b from-[#1a0033]/60 to-[#0a0015]/60 backdrop-blur-sm p-5 sm:p-6 flex flex-col gap-5">
          <div>
            <p
              className="text-xs text-[#d4af37]/60 tracking-widest uppercase mb-2"
              style={{ fontFamily: "'Cinzel', serif" }}
            >
              Spread Type
            </p>
            <div className="flex flex-wrap gap-2">
              {readingsConfig.readings.map((reading) => (
                <button
                  key={reading.name}
                  type="button"
                  aria-pressed={spreadType === reading.name}
                  onClick={() => togglePill(reading.name)}
                  className={`px-4 py-2 rounded-full border text-xs tracking-wide transition-all duration-300
                    ${spreadType === reading.name
                      ? 'bg-gradient-to-br from-[#d4af37] to-[#b8942f] text-[#1a0033] border-[#d4af37] font-bold'
                      : 'border-[#d4af37]/30 text-[#e6d5b8]/60 hover:border-[#d4af37]/60 hover:text-[#e6d5b8]/90'}`}
                  style={{ fontFamily: "'Cinzel', serif" }}
                >
                  {reading.name}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label
              htmlFor="tags-filter"
              className="block text-xs text-[#d4af37]/60 tracking-widest uppercase mb-2"
              style={{ fontFamily: "'Cinzel', serif" }}
            >
              Tags
            </label>
            <input
              id="tags-filter"
              type="text"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="career, love"
              className="w-full px-4 py-3 rounded-lg bg-[#0a0015]/60 border border-[#d4af37]/20
                         text-[#e6d5b8] placeholder-[#e6d5b8]/20 text-sm
                         focus:outline-none focus:border-[#d4af37]/60 focus:ring-1 focus:ring-[#d4af37]/20
                         transition-all duration-300"
              style={{ fontFamily: "'Crimson Pro', serif" }}
            />
          </div>

          <div>
            <label
              htmlFor="birth-date-filter"
              className="block text-xs text-[#d4af37]/60 tracking-widest uppercase mb-2"
              style={{ fontFamily: "'Cinzel', serif" }}
            >
              Birth Date
            </label>
            <input
              id="birth-date-filter"
              type="date"
              value={birthDate}
              onChange={(e) => setBirthDate(e.target.value)}
              style={{ colorScheme: "dark", fontFamily: "'Crimson Pro', serif" }}
              className="w-full px-4 py-3 rounded-lg bg-[#0a0015]/60 border border-[#d4af37]/20
                         text-[#e6d5b8] text-sm
                         focus:outline-none focus:border-[#d4af37]/60 focus:ring-1 focus:ring-[#d4af37]/20
                         transition-all duration-300"
            />
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={applyFilters}
              className="px-8 py-3 bg-gradient-to-br from-[#d4af37] to-[#b8942f] text-[#1a0033] rounded-lg
                         font-bold hover:scale-105 active:scale-95 transition-all duration-300
                         border border-[#d4af37]/50 shadow-lg text-sm"
              style={{ fontFamily: "'Cinzel', serif", letterSpacing: "0.1em" }}
            >
              Apply
            </button>
            <button
              type="button"
              onClick={clearFilters}
              className="px-8 py-3 border border-[#d4af37]/40 text-[#d4af37] hover:bg-[#d4af37]/10 rounded-lg transition-all text-sm"
              style={{ fontFamily: "'Cinzel', serif" }}
            >
              Clear
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReadingsFilterPanel;
```

- [ ] **Step 2: Wire it into the readings list page**

In `src/app/user/readings/page.tsx`, add the import after the existing imports:

```tsx
import { getReadings } from "./actions";
import ReadingsFilterPanel from "@/components/ReadingsFilterPanel";
```

Render it right after the header block's closing `</div>` (currently line 63) and before `{!result.ok ? (` (currently line 65):

```tsx
        </div>

        <ReadingsFilterPanel
          currentSpreadType={spreadType}
          currentTags={tags}
          currentBirthDate={birthDate}
        />

        {!result.ok ? (
```

- [ ] **Step 3: Verify types compile**

Run: `cd /Users/pavlos/projects/private/tarot-divinations && npx tsc --noEmit`
Expected: no new errors

- [ ] **Step 4: Commit**

```bash
cd /Users/pavlos/projects/private/tarot-divinations
git add src/components/ReadingsFilterPanel.tsx src/app/user/readings/page.tsx
git commit -m "feat: add readings filter panel"
```

- [ ] **Step 5: Manual end-to-end verification**

With both backend (`cd /Users/pavlos/projects/private/gnosis-esoterica-api && make dev`, or the equivalent already-running dev setup) and frontend (`cd /Users/pavlos/projects/private/tarot-divinations && npm run dev`) running:

1. Open a reading's detail page, click `+`, add 2-3 tags (typing + Enter, and one via comma-paste), remove one, click `✓` — confirm the chips update immediately and persist across a page reload.
2. Try adding a 6th tag — confirm the input disables with "Max 5 tags".
3. Try adding a tag longer than 15 characters — confirm the inline "tags should be comma separated" hint appears and the chip isn't added.
4. On `/user/readings`, expand "◆ Filter Readings ◆", select a spread-type pill, type a tag, pick a birth date, click Apply — confirm the URL updates with `spread_type`/`tags`/`birth_date` params and the list narrows accordingly, with the "(sorted by relevance)" hint showing when a tags filter is active.
5. Click a Prev/Next pagination link while a filter is active — confirm the filter params are preserved in the URL.
6. Click Clear — confirm the panel collapses and the URL resets to `/user/readings` with no filters.

---

## Self-Review Notes

- **Spec coverage:** Data model (Task 1), PATCH endpoint (Task 2), spread_type/birth_date filters (Task 3), tags filter + ranking + migration (Task 4), frontend types/validation (Task 5), server action (Task 6), tag editor UI (Task 7), filter data plumbing + tag pills + pagination carry-through (Task 8), filter panel UI + relevance hint (Task 9) — every section of `docs/search-and-tags.md` maps to a task.
- **Line-number corrections applied vs. the spec doc:** the spec's own citations for `src/main.py` (54-59, not 50-65), `TarotGame.tsx` visual-reference ranges, and the reading detail page's insertion point (after line 91, before line 93 in the *current* file — the spec's "line 91"/"line 94" were already accurate here) were re-verified against the actual current files before writing this plan; all code snippets above were copied from real current file contents, not from the spec's prose.
- **No placeholders:** every step above contains complete, runnable code — no TBDs.
