# Reading Tags and Search — Design

## Goal
Let users tag their readings after the fact, and search their reading list by
`spread_type`, `birth_date`, and `tags`. Tag search ranks results by how many
requested tags a reading matches (most matches first).

## Out of scope
- Setting tags at creation time (`POST /readings`) — tags are only ever set
  via the new PATCH endpoint below.
- A fixed/predefined tag vocabulary — tags are free-form strings.
- Full-text search — all filters are exact/set matches, not fuzzy.

## Data model

`src/readings/models.py` — `Reading.__init__` gets a new parameter:

```python
tags: list[str] = []
```

Follows the existing optional-field convention used by `question`/`birth_date`
(`models.py:47-50`):
- `to_document()` omits the `tags` key entirely when the list is empty.
- `from_document()` defaults to `[]` when the key is absent.

## Schemas

`src/readings/schemas.py`:
- `ReadingReadModel` (line 30) — add `tags: list[str] = []`.
- `ReadingListItem` (line 44) — add `tags: list[str] = []`.
- `CreateReadingRequest` (line 10) — **unchanged**, no tags field.

## Setting tags — new PATCH endpoint

No existing endpoint mutates a reading after creation. Add:

- `src/readings/commands/update_reading_tags.py` (new file) —
  `UpdateReadingTagsCommand(reading_id: str, user_id: str, tags: list[str])`
  + `UpdateReadingTagsHandler`. Handler verifies the reading belongs to
  `user_id` before writing (reuse the existing not-found/ownership pattern
  from `GetReadingByIdHandler`), then calls
  `ReadingWriteRepository.update(reading_id, {"tags": tags})`
  (`base_repository.py:21-23` already supports arbitrary `$set` updates).
- `src/readings/router.py` — new route:
  ```python
  @router.patch("/{reading_id}", response_model=ReadingReadModel)
  async def update_reading_tags(
      reading_id: str,
      body: UpdateReadingTagsRequest,
      user_id: CurrentUserId,
      mediator: MediatorDep,
  ) -> ReadingReadModel:
      ...
  ```
- `src/readings/schemas.py` — new `UpdateReadingTagsRequest(AppSchema)` with
  `tags: list[str]`. Tags are lowercased on write for consistent search
  (`tags = [t.lower() for t in body.tags]` in the handler).
- Full replace semantics: PATCH sets the tag list to exactly what's passed,
  it does not merge with existing tags.

## Search params

`src/readings/router.py:29-38` (`GET /readings`) — add optional query params:

```python
spread_type: str | None = Query(default=None)
birth_date: date | None = Query(default=None)
tags: list[str] | None = Query(default=None)
```

Passed into `ListUserReadingsQuery` (`src/readings/queries/list_user_readings.py:11-14`),
which gains matching optional fields.

## Ranked tag matching

Ranking by overlap count needs a value that isn't stored on the document, so
it can't be done with `find()` + `.sort()`. It requires an aggregation
pipeline, used only when `tags` is supplied:

```
$match:     { user_id, tags: {$in: requested_tags}, ...spread_type/birth_date if given }
$addFields: { matched_tag_count: { $size: { $setIntersection: ["$tags", requested_tags] } } }
$sort:      { matched_tag_count: -1, created_at: -1 }
$skip / $limit
```

`src/readings/repository.py` — add a new method on `ReadingReadRepository`,
`find_by_user_id_ranked_by_tags(...)`, rather than overloading
`find_by_user_id` (line 20) — the query shape (aggregate vs. find) is
different enough that branching in the query handler between two repo
methods is cleaner than conditional pipeline-building inside one method.

`src/readings/queries/list_user_readings.py` (`ListUserReadingsHandler.handle`,
lines 23-28) — branches:
- `tags` supplied → call `find_by_user_id_ranked_by_tags`.
- no `tags` → existing `find_by_user_id` (extended to accept the optional
  `spread_type`/`birth_date` filters), sorted by `created_at` as today.

`count_by_user_id` (`repository.py:33-34`) stays a plain `count_documents`
with the same `$match` filter in both cases — count doesn't depend on
ranking.

**Caveat:** sorting on `matched_tag_count` is a computed field, so Mongo
sorts that stage in memory — no index can back it. Acceptable at expected
per-user reading volumes; would need revisiting only if a single user's
reading count grows very large.

## Indexes

New migration `src/migrations/versions/003_reading_tags_index.py` (follows
the pattern in `002_readings_indexes.py`):

- `(user_id, tags)` — supports the `$match` stage's tag lookup.
- `(user_id, spread_type, created_at)` — supports spread_type filtering
  without tags.
- Existing `(user_id, created_at)` (`002_readings_indexes.py:11`) continues
  to cover the plain, filterless list.

## Testing

- Unit (`test_commands.py`): `UpdateReadingTagsHandler` — sets tags, rejects
  update for a reading not owned by `user_id`.
- Unit (`test_queries.py`): `ListUserReadingsHandler` — filters by
  `spread_type`, `birth_date`, `tags`; ranks multi-tag results by overlap
  count descending.
- Integration (`test_router.py`): `PATCH /readings/{id}` sets tags and
  returns them in the response; `GET /readings` with each query param
  returns filtered results.
