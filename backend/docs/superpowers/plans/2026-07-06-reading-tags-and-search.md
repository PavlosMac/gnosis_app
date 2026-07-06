# Reading Tags and Search Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users tag readings after the fact via a new `PATCH /readings/{id}/tags` endpoint, and search `GET /readings` by `spread_type`, `birth_date`, and `tags` — with tag matches ranked by overlap count (most matching tags first).

**Architecture:** Follows the existing CQRS domain layout in `src/readings/`. One new command (`UpdateReadingTagsCommand`/`Handler`), one extended query (`ListUserReadingsQuery`), two new repository methods on `ReadingReadRepository`, one new migration. No new files outside `src/readings/` and `src/migrations/versions/`.

**Tech Stack:** FastAPI, Pydantic v2, Motor (async MongoDB), pytest-asyncio, mongomock-motor.

**Spec:** `docs/superpowers/specs/2026-07-06-reading-tags-and-search-design.md`

## Global Constraints

- Tags are free-form strings, normalized to lowercase, deduped, order-preserved (first occurrence wins).
- Max 5 tags per reading (`MAX_TAGS_PER_READING = 5`) — exceeding it raises a validation error (422), never silently truncates.
- Tags are only ever set via `PATCH /readings/{id}/tags` — never at creation (`POST /readings` is unchanged).
- `PATCH /readings/{id}/tags` is a full replace, not a merge, of the tag list.
- Tags travel as one raw comma-separated string on the wire, both in the PATCH body (e.g. `{"tags": "career, big-decision, love"}`) and the GET search param (e.g. `?tags=career,love`) — never a JSON array or repeated query params. Both are parsed by the shared `parse_comma_separated_tags` helper (`schemas.py`); the 5-tag cap is enforced only on top of that in `UpdateReadingTagsRequest`, not on GET.
- Multi-tag search is OR-match (`$in`), ranked by number of matching tags descending, then `created_at` descending as a tiebreaker.
- `$setIntersection` is NOT available in `mongomock` (confirmed by direct testing) — the ranking pipeline must use `$filter` + `$in` + `$$this` instead, which works on both mongomock and real MongoDB.
- `spread_type` and `birth_date` are exact-match filters, combined via `$match` alongside the tag filter.
- `birth_date` is stored as an ISO date string on the document (`Reading.to_document`), not a BSON date — filters must convert `date` to `.isoformat()` before querying.

---

### Task 1: `Reading.tags` field + `UpdateReadingTagsCommand`/`Handler`

**Files:**
- Modify: `src/readings/models.py:7-67`
- Modify: `src/readings/schemas.py:30,44`
- Create: `src/readings/commands/update_reading_tags.py`
- Test: `tests/readings/test_commands.py`

**Interfaces:**
- Consumes: `ReadingReadRepository.find_one(filter: dict) -> dict | None` (`src/readings/repository.py:15`, inherited from `BaseReadRepository.find_one`), `ReadingWriteRepository.update(id: str, update: dict) -> bool` (`src/database/base_repository.py:21-23`), `ReadingNotFoundError` (`src/readings/service.py:4-6`).
- Produces: `Reading.tags: list[str]` (default `[]`, omitted from the document when empty). `UpdateReadingTagsCommand(reading_id: str, user_id: str, tags: list[str])`. `UpdateReadingTagsHandler(write_repo: ReadingWriteRepository, read_repo: ReadingReadRepository)` with `async def handle(command: UpdateReadingTagsCommand) -> ReadingReadModel`. `ReadingReadModel.tags: list[str]` and `ReadingListItem.tags: list[str]` (both default `[]`).

- [ ] **Step 1: Write the failing tests**

Add to `tests/readings/test_commands.py`:

```python
from src.readings.commands.update_reading_tags import (
    UpdateReadingTagsCommand,
    UpdateReadingTagsHandler,
)


@pytest.fixture
def update_tags_handler(mock_db):
    return UpdateReadingTagsHandler(
        write_repo=ReadingWriteRepository(mock_db),
        read_repo=ReadingReadRepository(mock_db),
    )


async def test_update_reading_tags_sets_tags(handler, valid_command, update_tags_handler):
    created = await handler.handle(valid_command)
    result = await update_tags_handler.handle(
        UpdateReadingTagsCommand(
            reading_id=created.id, user_id=valid_command.user_id, tags=["career", "love"]
        )
    )
    assert result.tags == ["career", "love"]


async def test_update_reading_tags_persists(handler, valid_command, update_tags_handler, mock_db):
    created = await handler.handle(valid_command)
    await update_tags_handler.handle(
        UpdateReadingTagsCommand(
            reading_id=created.id, user_id=valid_command.user_id, tags=["career"]
        )
    )
    read_repo = ReadingReadRepository(mock_db)
    doc = await read_repo.find_by_id(created.id)
    assert doc["tags"] == ["career"]


async def test_update_reading_tags_replaces_existing(handler, valid_command, update_tags_handler):
    created = await handler.handle(valid_command)
    await update_tags_handler.handle(
        UpdateReadingTagsCommand(
            reading_id=created.id, user_id=valid_command.user_id, tags=["career", "love"]
        )
    )
    result = await update_tags_handler.handle(
        UpdateReadingTagsCommand(reading_id=created.id, user_id=valid_command.user_id, tags=["luck"])
    )
    assert result.tags == ["luck"]


async def test_update_reading_tags_not_found(update_tags_handler, valid_command):
    with pytest.raises(ReadingNotFoundError):
        await update_tags_handler.handle(
            UpdateReadingTagsCommand(
                reading_id=str(ObjectId()), user_id=valid_command.user_id, tags=["career"]
            )
        )


async def test_update_reading_tags_wrong_user(handler, valid_command, update_tags_handler):
    created = await handler.handle(valid_command)
    with pytest.raises(ReadingNotFoundError):
        await update_tags_handler.handle(
            UpdateReadingTagsCommand(
                reading_id=created.id, user_id=str(ObjectId()), tags=["career"]
            )
        )
```

Add the missing import at the top of `tests/readings/test_commands.py`:

```python
from src.readings.service import ReadingNotFoundError
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `make test params="tests/readings/test_commands.py -v"`
Expected: FAIL with `ModuleNotFoundError: No module named 'src.readings.commands.update_reading_tags'`

- [ ] **Step 3: Add `tags` to the `Reading` model**

In `src/readings/models.py`, add `tags` to `__init__` (after `birth_date`, before `id`):

```python
    def __init__(
        self,
        user_id: str,
        spread_type: str,
        cards: list[dict[str, Any]],
        card_interpretations: list[dict[str, Any]],
        synthesis: str,
        tokens_used: int,
        model: str,
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
        self.card_interpretations = card_interpretations
        self.synthesis = synthesis
        self.tokens_used = tokens_used
        self.model = model
        self.created_at = created_at or datetime.now(UTC)
```

In `to_document()`, add after the `birth_date` block:

```python
        if self.tags:
            doc["tags"] = self.tags
```

In `from_document()`, add `tags=doc.get("tags", []),` after the `birth_date=` line.

- [ ] **Step 4: Add `tags` to the read schemas**

In `src/readings/schemas.py`, add to `ReadingReadModel` (after `birth_date`) and `ReadingListItem` (after `birth_date`):

```python
    tags: list[str] = []
```

- [ ] **Step 5: Create the command and handler**

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
        write_repo: ReadingWriteRepository,
        read_repo: ReadingReadRepository,
    ) -> None:
        self._write_repo = write_repo
        self._read_repo = read_repo

    async def handle(self, command: UpdateReadingTagsCommand) -> ReadingReadModel:
        try:
            reading_oid = ObjectId(command.reading_id)
        except InvalidId:
            raise ReadingNotFoundError()

        doc = await self._read_repo.find_one(
            {"_id": reading_oid, "user_id": ObjectId(command.user_id)}
        )
        if doc is None:
            raise ReadingNotFoundError()

        await self._write_repo.update(command.reading_id, {"tags": command.tags})
        doc["tags"] = command.tags
        return ReadingReadModel.model_validate(doc)
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `make test params="tests/readings/test_commands.py -v"`
Expected: PASS (all `test_update_reading_tags_*` and pre-existing tests)

- [ ] **Step 7: Run full unit suite and lint**

Run: `make test && make lint`
Expected: PASS, no lint errors

- [ ] **Step 8: Commit**

```bash
git add src/readings/models.py src/readings/schemas.py src/readings/commands/update_reading_tags.py tests/readings/test_commands.py
git commit -m "feat: add Reading.tags field and UpdateReadingTagsCommand"
```

---

### Task 2: `UpdateReadingTagsRequest` schema with comma-string validator

**Files:**
- Modify: `src/readings/schemas.py`
- Test: `tests/readings/test_schemas.py` (new file)

**Interfaces:**
- Consumes: nothing new.
- Produces: `parse_comma_separated_tags(value: str) -> list[str]` module-level function in `schemas.py` (split/trim/lowercase/dedupe, no cap — reused by Task 5's GET search param parsing). `UpdateReadingTagsRequest(AppSchema)` with `tags: list[str]` (input accepted as a raw string, output is the normalized list, with the 5-cap enforced on top of `parse_comma_separated_tags`). `MAX_TAGS_PER_READING = 5` constant in `schemas.py`.

- [ ] **Step 1: Write the failing tests**

Create `tests/readings/test_schemas.py`:

```python
import pytest
from pydantic import ValidationError

from src.readings.schemas import UpdateReadingTagsRequest


def test_parses_comma_separated_string():
    result = UpdateReadingTagsRequest(tags="career, big-decision, love")
    assert result.tags == ["career", "big-decision", "love"]


def test_strips_whitespace():
    result = UpdateReadingTagsRequest(tags="  career ,love  ")
    assert result.tags == ["career", "love"]


def test_lowercases():
    result = UpdateReadingTagsRequest(tags="Career, LOVE")
    assert result.tags == ["career", "love"]


def test_dedupes_preserving_first_seen_order():
    result = UpdateReadingTagsRequest(tags="love, career, love")
    assert result.tags == ["love", "career"]


def test_drops_empty_pieces_from_trailing_comma():
    result = UpdateReadingTagsRequest(tags="career, love,")
    assert result.tags == ["career", "love"]


def test_empty_string_yields_empty_list():
    result = UpdateReadingTagsRequest(tags="")
    assert result.tags == []


def test_raises_when_over_five_tags():
    with pytest.raises(ValidationError):
        UpdateReadingTagsRequest(tags="a, b, c, d, e, f")


def test_allows_exactly_five_tags():
    result = UpdateReadingTagsRequest(tags="a, b, c, d, e")
    assert result.tags == ["a", "b", "c", "d", "e"]
```

Add a direct test for the shared helper too — Task 5 imports it independently
of `UpdateReadingTagsRequest`:

```python
from src.readings.schemas import parse_comma_separated_tags


def test_parse_comma_separated_tags_normalizes():
    assert parse_comma_separated_tags(" Career, love, love,") == ["career", "love"]


def test_parse_comma_separated_tags_no_cap():
    result = parse_comma_separated_tags("a, b, c, d, e, f")
    assert result == ["a", "b", "c", "d", "e", "f"]
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `make test params="tests/readings/test_schemas.py -v"`
Expected: FAIL with `ImportError: cannot import name 'UpdateReadingTagsRequest'`

- [ ] **Step 3: Add the schema**

In `src/readings/schemas.py`, add the import and the new class:

```python
from pydantic import Field, field_validator
```

(extends the existing `from pydantic import Field` import — add `field_validator` to it)

```python
MAX_TAGS_PER_READING = 5


def parse_comma_separated_tags(value: str) -> list[str]:
    parsed: list[str] = []
    for piece in value.split(","):
        tag = piece.strip().lower()
        if tag and tag not in parsed:
            parsed.append(tag)
    return parsed


class UpdateReadingTagsRequest(AppSchema):
    tags: list[str]

    @field_validator("tags", mode="before")
    @classmethod
    def validate_tags(cls, value: str) -> list[str]:
        parsed = parse_comma_separated_tags(value)
        if len(parsed) > MAX_TAGS_PER_READING:
            raise ValueError(f"A reading can have at most {MAX_TAGS_PER_READING} tags")
        return parsed
```

`parse_comma_separated_tags` has no cap — the 5-tag limit is a write-side
storage constraint on `UpdateReadingTagsRequest` only. Task 5's GET search
param reuses `parse_comma_separated_tags` directly, without the cap.

- [ ] **Step 4: Run tests to verify they pass**

Run: `make test params="tests/readings/test_schemas.py -v"`
Expected: PASS

- [ ] **Step 5: Run full unit suite and lint**

Run: `make test && make lint`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/readings/schemas.py tests/readings/test_schemas.py
git commit -m "feat: add UpdateReadingTagsRequest comma-string validator"
```

---

### Task 3: `PATCH /readings/{id}/tags` endpoint

**Files:**
- Modify: `src/readings/router.py`
- Modify: `src/main.py:41-59`
- Modify: `tests/conftest.py:20-69`
- Test: `tests/readings/test_router.py`

**Interfaces:**
- Consumes: `UpdateReadingTagsCommand`/`Handler` (Task 1), `UpdateReadingTagsRequest` (Task 2), `CurrentUserId`/`MediatorDep` (`src/core/dependencies.py:31,58`).
- Produces: `PATCH /api/v1/readings/{reading_id}/tags` → `ReadingReadModel`.

- [ ] **Step 1: Write the failing tests**

Add to `tests/readings/test_router.py`:

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
        json={"tags": "career, big-decision"},
        headers={"Authorization": f"Bearer {auth_token}"},
    )
    assert resp.status_code == 200
    assert resp.json()["tags"] == ["career", "big-decision"]


async def test_update_reading_tags_unauthenticated(client):
    resp = await client.patch(
        "/api/v1/readings/507f1f77bcf86cd799439011/tags",
        json={"tags": "career"},
    )
    assert resp.status_code == 401


async def test_update_reading_tags_not_found(client, auth_token):
    resp = await client.patch(
        "/api/v1/readings/507f1f77bcf86cd799439011/tags",
        json={"tags": "career"},
        headers={"Authorization": f"Bearer {auth_token}"},
    )
    assert resp.status_code == 404


async def test_update_reading_tags_wrong_user(client, auth_token):
    create_resp = await client.post(
        "/api/v1/readings",
        json=VALID_READING_BODY,
        headers={"Authorization": f"Bearer {auth_token}"},
    )
    reading_id = create_resp.json()["_id"]

    reg = await client.post(
        "/api/v1/auth/register",
        json={"email": "other-tags@example.com", "password": "securepassword123"},
    )
    other_token = reg.json()["access_token"]

    resp = await client.patch(
        f"/api/v1/readings/{reading_id}/tags",
        json={"tags": "career"},
        headers={"Authorization": f"Bearer {other_token}"},
    )
    assert resp.status_code == 404


async def test_update_reading_tags_over_cap(client, auth_token):
    create_resp = await client.post(
        "/api/v1/readings",
        json=VALID_READING_BODY,
        headers={"Authorization": f"Bearer {auth_token}"},
    )
    reading_id = create_resp.json()["_id"]

    resp = await client.patch(
        f"/api/v1/readings/{reading_id}/tags",
        json={"tags": "a, b, c, d, e, f"},
        headers={"Authorization": f"Bearer {auth_token}"},
    )
    assert resp.status_code == 422
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `make test-docker params="tests/readings/test_router.py -v -k update_reading_tags"`
Expected: FAIL with 404 (no matching route) since the endpoint doesn't exist yet

- [ ] **Step 3: Add the router endpoint**

In `src/readings/router.py`, add the import and route:

```python
from src.readings.commands.update_reading_tags import UpdateReadingTagsCommand
from src.readings.schemas import (
    CreateReadingRequest,
    ReadingListItem,
    ReadingReadModel,
    UpdateReadingTagsRequest,
)
```

(replaces the existing `from src.readings.schemas import ...` line, and adds the new command import alongside the existing `CreateReadingCommand` import)

```python
@router.patch("/{reading_id}/tags", response_model=ReadingReadModel)
async def update_reading_tags(
    reading_id: str,
    body: UpdateReadingTagsRequest,
    user_id: CurrentUserId,
    mediator: MediatorDep,
) -> ReadingReadModel:
    command = UpdateReadingTagsCommand(reading_id=reading_id, user_id=user_id, tags=body.tags)
    return await mediator.send(command)
```

Place it after `create_reading` and before `list_readings` — route ordering doesn't matter here since `/{reading_id}/tags` and `""` don't overlap, but keep create/update/list/get grouped logically.

- [ ] **Step 4: Wire the handler in `src/main.py`**

In `src/main.py`, add the import:

```python
from src.readings.commands.update_reading_tags import (
    UpdateReadingTagsCommand,
    UpdateReadingTagsHandler,
)
```

In `_wire_mediator`, after the existing `mediator.register_command(CreateReadingCommand, ...)` line:

```python
    mediator.register_command(
        UpdateReadingTagsCommand,
        UpdateReadingTagsHandler(reading_write_repo, reading_read_repo),
    )
```

- [ ] **Step 5: Wire the handler in `tests/conftest.py`**

In `tests/conftest.py`, add the import inside the `app` fixture:

```python
    from src.readings.commands.update_reading_tags import (
        UpdateReadingTagsCommand,
        UpdateReadingTagsHandler,
    )
```

After the existing `mediator.register_command(CreateReadingCommand, ...)` line in the `app` fixture:

```python
    mediator.register_command(
        UpdateReadingTagsCommand,
        UpdateReadingTagsHandler(reading_write_repo, reading_read_repo),
    )
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `make test-docker params="tests/readings/test_router.py -v"`
Expected: PASS (all tests in the file, including pre-existing ones)

- [ ] **Step 7: Run full suite and lint**

Run: `make test-docker && make lint`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add src/readings/router.py src/main.py tests/conftest.py tests/readings/test_router.py
git commit -m "feat: add PATCH /readings/{id}/tags endpoint"
```

---

### Task 4: `spread_type` and `birth_date` search params

**Files:**
- Modify: `src/readings/repository.py`
- Modify: `src/readings/queries/list_user_readings.py`
- Modify: `src/readings/router.py`
- Test: `tests/readings/test_queries.py`
- Test: `tests/readings/test_router.py`

**Interfaces:**
- Consumes: nothing new.
- Produces: `ReadingReadRepository.find_by_user_id(user_id, skip, limit, spread_type=None, birth_date=None)`, `ReadingReadRepository.count_by_user_id(user_id, spread_type=None, birth_date=None)`, `ReadingReadRepository._build_filter(user_id, spread_type=None, birth_date=None, tags=None) -> dict[str, Any]` (used by Task 5 too). `ListUserReadingsQuery.spread_type: str | None`, `.birth_date: date | None`.

- [ ] **Step 1: Write the failing tests**

Add `from datetime import date` to the top of the import block in
`tests/readings/test_queries.py` (as the first line, before `import pytest`
— stdlib imports sort first per this project's ruff/isort config).

Add the test functions to `tests/readings/test_queries.py`:

```python
async def test_list_user_readings_filters_by_spread_type(create_handler, list_handler, user_id):
    await create_handler.handle(_make_command(user_id, spread="Celtic Cross"))
    await create_handler.handle(_make_command(user_id, spread="Three Card"))
    result = await list_handler.handle(
        ListUserReadingsQuery(user_id=user_id, spread_type="Three Card")
    )
    assert len(result.items) == 1
    assert result.items[0].spread_type == "Three Card"


async def test_list_user_readings_filters_by_birth_date(create_handler, list_handler, user_id):
    command_with_date = CreateReadingCommand(
        user_id=user_id,
        spread_name="Celtic Cross",
        birth_date=date(1990, 5, 1),
        cards=[CardInSpread(name="The Fool", position="Present", orientation="upright")],
    )
    await create_handler.handle(command_with_date)
    await create_handler.handle(_make_command(user_id))
    result = await list_handler.handle(
        ListUserReadingsQuery(user_id=user_id, birth_date=date(1990, 5, 1))
    )
    assert len(result.items) == 1
    assert result.items[0].birth_date == date(1990, 5, 1)
```

Add to `tests/readings/test_router.py`:

```python
async def test_list_readings_filters_by_spread_type(client, auth_token):
    await client.post(
        "/api/v1/readings",
        json=VALID_READING_BODY,
        headers={"Authorization": f"Bearer {auth_token}"},
    )
    other_body = {**VALID_READING_BODY, "spread_name": "Three Card"}
    await client.post(
        "/api/v1/readings",
        json=other_body,
        headers={"Authorization": f"Bearer {auth_token}"},
    )
    resp = await client.get(
        "/api/v1/readings?spread_type=Three Card",
        headers={"Authorization": f"Bearer {auth_token}"},
    )
    data = resp.json()
    assert len(data["items"]) == 1
    assert data["items"][0]["spread_type"] == "Three Card"
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `make test params="tests/readings/test_queries.py -v -k filters_by"`
Expected: FAIL with `TypeError: ListUserReadingsQuery() got an unexpected keyword argument 'spread_type'`

- [ ] **Step 3: Add the filter builder and extend repository methods**

In `src/readings/repository.py`, add `date` import and rewrite the class:

```python
from datetime import date
from typing import Any

from bson import ObjectId

from src.database.base_repository import BaseReadRepository, BaseWriteRepository
from src.database.collections.constants import READINGS_COLLECTION


class ReadingWriteRepository(BaseWriteRepository):
    @property
    def collection_name(self) -> str:
        return READINGS_COLLECTION


class ReadingReadRepository(BaseReadRepository):
    @property
    def collection_name(self) -> str:
        return READINGS_COLLECTION

    def _build_filter(
        self,
        user_id: str,
        spread_type: str | None = None,
        birth_date: date | None = None,
        tags: list[str] | None = None,
    ) -> dict[str, Any]:
        filter_query: dict[str, Any] = {"user_id": ObjectId(user_id)}
        if spread_type is not None:
            filter_query["spread_type"] = spread_type
        if birth_date is not None:
            filter_query["birth_date"] = birth_date.isoformat()
        if tags is not None:
            filter_query["tags"] = {"$in": tags}
        return filter_query

    async def find_by_user_id(
        self,
        user_id: str,
        skip: int = 0,
        limit: int = 20,
        spread_type: str | None = None,
        birth_date: date | None = None,
    ) -> list[dict[str, Any]]:
        return await self.find_many(
            self._build_filter(user_id, spread_type, birth_date),
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
        return await self.count(self._build_filter(user_id, spread_type, birth_date))
```

- [ ] **Step 4: Extend the query and handler**

In `src/readings/queries/list_user_readings.py`, replace the import block at
the top of the file with:

```python
import asyncio
from datetime import date

from pydantic import Field

from src.core.pagination import PaginatedResponse
from src.cqrs.queries import BaseQuery, QueryHandler
from src.readings.repository import ReadingReadRepository
from src.readings.schemas import ReadingListItem
```

Then update `ListUserReadingsQuery`:

```python
class ListUserReadingsQuery(BaseQuery):
    user_id: str
    page: int = Field(default=1, ge=1)
    page_size: int = Field(default=20, ge=1, le=100)
    spread_type: str | None = None
    birth_date: date | None = None
```

Update `handle` to pass the new filters through:

```python
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

- [ ] **Step 5: Add query params to the router**

In `src/readings/router.py`, add as the first import line (before
`from fastapi import APIRouter, Query`):

```python
from datetime import date
```

Update `list_readings`:

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

- [ ] **Step 6: Run tests to verify they pass**

Run: `make test params="tests/readings/test_queries.py -v"`
Expected: PASS

Run: `make test-docker params="tests/readings/test_router.py -v"`
Expected: PASS

- [ ] **Step 7: Run full suite and lint**

Run: `make test-docker && make lint`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add src/readings/repository.py src/readings/queries/list_user_readings.py src/readings/router.py tests/readings/test_queries.py tests/readings/test_router.py
git commit -m "feat: add spread_type and birth_date search params to GET /readings"
```

---

### Task 5: Ranked `tags` search param

**Files:**
- Modify: `src/readings/repository.py`
- Modify: `src/readings/queries/list_user_readings.py`
- Modify: `src/readings/router.py`
- Test: `tests/readings/test_queries.py`
- Test: `tests/readings/test_router.py`

**Interfaces:**
- Consumes: `ReadingReadRepository._build_filter` (Task 4), `UpdateReadingTagsHandler` (Task 1, used in tests to set up tagged readings), `parse_comma_separated_tags` (Task 2, used in the router to parse the comma-separated `tags` query param).
- Produces: `ReadingReadRepository.find_by_user_id_ranked_by_tags(user_id, tags, skip, limit, spread_type=None, birth_date=None) -> list[dict]`. `ListUserReadingsQuery.tags: list[str] | None`.

- [ ] **Step 1: Write the failing tests**

Add to `tests/readings/test_queries.py`:

```python
async def test_list_user_readings_ranks_by_tag_overlap(
    create_handler, list_handler, update_tags_handler, user_id
):
    one_match = await create_handler.handle(_make_command(user_id, spread="One Match"))
    two_match = await create_handler.handle(_make_command(user_id, spread="Two Match"))
    no_match = await create_handler.handle(_make_command(user_id, spread="No Match"))

    await update_tags_handler.handle(
        UpdateReadingTagsCommand(reading_id=one_match.id, user_id=user_id, tags=["career"])
    )
    await update_tags_handler.handle(
        UpdateReadingTagsCommand(
            reading_id=two_match.id, user_id=user_id, tags=["career", "love"]
        )
    )
    await update_tags_handler.handle(
        UpdateReadingTagsCommand(reading_id=no_match.id, user_id=user_id, tags=["luck"])
    )

    result = await list_handler.handle(
        ListUserReadingsQuery(user_id=user_id, tags=["career", "love"])
    )

    assert [item.spread_type for item in result.items] == ["Two Match", "One Match"]
    assert result.total == 2
```

Add the fixture this test needs (alongside the existing `list_handler` fixture):

```python
@pytest.fixture
def update_tags_handler(repos):
    write_repo, read_repo = repos
    return UpdateReadingTagsHandler(write_repo=write_repo, read_repo=read_repo)
```

Add the import at the top of `tests/readings/test_queries.py`:

```python
from src.readings.commands.update_reading_tags import (
    UpdateReadingTagsCommand,
    UpdateReadingTagsHandler,
)
```

Add to `tests/readings/test_router.py`:

```python
async def test_list_readings_filters_by_tags(client, auth_token):
    one_match = await client.post(
        "/api/v1/readings",
        json=VALID_READING_BODY,
        headers={"Authorization": f"Bearer {auth_token}"},
    )
    two_match = await client.post(
        "/api/v1/readings",
        json={**VALID_READING_BODY, "spread_name": "Two Match"},
        headers={"Authorization": f"Bearer {auth_token}"},
    )

    await client.patch(
        f"/api/v1/readings/{one_match.json()['_id']}/tags",
        json={"tags": "career"},
        headers={"Authorization": f"Bearer {auth_token}"},
    )
    await client.patch(
        f"/api/v1/readings/{two_match.json()['_id']}/tags",
        json={"tags": "career, love"},
        headers={"Authorization": f"Bearer {auth_token}"},
    )

    resp = await client.get(
        "/api/v1/readings?tags=career,love",
        headers={"Authorization": f"Bearer {auth_token}"},
    )
    data = resp.json()
    assert [item["spread_type"] for item in data["items"]] == ["Two Match", "Celtic Cross"]
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `make test params="tests/readings/test_queries.py -v -k tag_overlap"`
Expected: FAIL with `TypeError: ListUserReadingsQuery() got an unexpected keyword argument 'tags'`

- [ ] **Step 3: Add the ranked aggregation method**

In `src/readings/repository.py`, add after `count_by_user_id`:

```python
    async def find_by_user_id_ranked_by_tags(
        self,
        user_id: str,
        tags: list[str],
        skip: int = 0,
        limit: int = 20,
        spread_type: str | None = None,
        birth_date: date | None = None,
    ) -> list[dict[str, Any]]:
        match_filter = self._build_filter(user_id, spread_type, birth_date, tags)
        cursor = self._collection.aggregate(
            [
                {"$match": match_filter},
                {
                    "$addFields": {
                        "matched_tag_count": {
                            "$size": {
                                "$filter": {
                                    "input": "$tags",
                                    "cond": {"$in": ["$$this", tags]},
                                }
                            }
                        }
                    }
                },
                {"$sort": {"matched_tag_count": -1, "created_at": -1}},
                {"$skip": skip},
                {"$limit": limit},
            ]
        )
        return await cursor.to_list(length=limit)
```

Update `count_by_user_id` to accept `tags`, so the paginated total is correct when tag-filtering:

```python
    async def count_by_user_id(
        self,
        user_id: str,
        spread_type: str | None = None,
        birth_date: date | None = None,
        tags: list[str] | None = None,
    ) -> int:
        return await self.count(self._build_filter(user_id, spread_type, birth_date, tags))
```

- [ ] **Step 4: Extend the query and branch the handler**

In `src/readings/queries/list_user_readings.py`, add to `ListUserReadingsQuery`:

```python
    tags: list[str] | None = None
```

Replace `handle`:

```python
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
        return PaginatedResponse[ReadingListItem](
            items=[ReadingListItem.model_validate(doc) for doc in docs],
            total=total,
            page=query.page,
            page_size=query.page_size,
        )
```

- [ ] **Step 5: Add the `tags` query param to the router**

`tags` arrives as one comma-separated string (`?tags=career,love`), matching
the PATCH body format — not FastAPI's native repeated-param list syntax. It's
parsed with the same `parse_comma_separated_tags` helper from Task 2 (no
5-cap applied here — that cap is a write-side limit on `UpdateReadingTagsRequest`
only).

In `src/readings/router.py`, add `parse_comma_separated_tags` to the schemas
import:

```python
from src.readings.schemas import (
    CreateReadingRequest,
    ReadingListItem,
    ReadingReadModel,
    UpdateReadingTagsRequest,
    parse_comma_separated_tags,
)
```

Update `list_readings`:

```python
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
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `make test params="tests/readings/test_queries.py -v"`
Expected: PASS

Run: `make test-docker params="tests/readings/test_router.py -v"`
Expected: PASS

- [ ] **Step 7: Run full suite and lint**

Run: `make test-docker && make lint`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add src/readings/repository.py src/readings/queries/list_user_readings.py src/readings/router.py tests/readings/test_queries.py tests/readings/test_router.py
git commit -m "feat: add ranked tags search param to GET /readings"
```

---

### Task 6: Indexes for tag and spread_type search

**Files:**
- Create: `src/migrations/versions/003_reading_tags_index.py`

**Interfaces:**
- Consumes: `READINGS_COLLECTION` (`src/database/collections/constants.py:3`).
- Produces: nothing consumed by later tasks — this is a leaf migration file.

Migration files aren't individually unit-tested in this project (`tests/migrations/test_runner.py` tests the runner mechanics generically with mocked migration modules) — this task's verification is running the migration against a real database and confirming the indexes exist.

- [ ] **Step 1: Create the migration**

Create `src/migrations/versions/003_reading_tags_index.py`:

```python
from motor.motor_asyncio import AsyncIOMotorDatabase
from pymongo import ASCENDING, DESCENDING

from src.database.collections.constants import READINGS_COLLECTION

version = "003"
description = "Create indexes for reading tag and spread_type search"


async def up(db: AsyncIOMotorDatabase) -> None:
    await db[READINGS_COLLECTION].create_index([("user_id", ASCENDING), ("tags", ASCENDING)])
    await db[READINGS_COLLECTION].create_index(
        [("user_id", ASCENDING), ("spread_type", ASCENDING), ("created_at", DESCENDING)]
    )
```

- [ ] **Step 2: Run lint**

Run: `make lint`
Expected: PASS

- [ ] **Step 3: Run the migration against the local dev database and verify**

```bash
make docker-up
docker compose exec api python -m src.migrations.runner
docker compose exec mongo mongosh gnosis_esoterica --eval "db.readings.getIndexes()"
```

Expected: output includes an index on `{user_id: 1, tags: 1}` and one on `{user_id: 1, spread_type: 1, created_at: -1}`, and the `_migrations` collection has a document with `version: "003"`.

(Adjust the `mongosh`/container/db name invocation to match whatever this repo's `docker-compose.yml` actually names the mongo service and database — check `docker-compose.yml` if the command above doesn't connect.)

- [ ] **Step 4: Run full suite**

Run: `make test-docker`
Expected: PASS (the migration runner's generic tests are unaffected; no new test failures)

- [ ] **Step 5: Commit**

```bash
git add src/migrations/versions/003_reading_tags_index.py
git commit -m "feat: add indexes for reading tag and spread_type search"
```

---

## Post-plan checklist

- [ ] All 6 tasks committed
- [ ] `make test-docker && make lint` passes on the final state
- [ ] Manually exercise the golden path once against `make dev` / `make docker-up`: create a reading, PATCH tags onto it, then `GET /readings?tags=...` and confirm ranking
