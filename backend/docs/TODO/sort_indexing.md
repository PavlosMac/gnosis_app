# TODO: index the spread_type + tags + date-sort combination

## Gap

A list query filtering by both `spread_type` and `tags` with a `created_at` sort
(the default, or explicit `asc`) falls back to an in-memory Mongo `SORT` — no index
on `readings` carries `spread_type` and `tags` together ahead of `created_at`.
Documented in `backend/docs/database/model_references.md` under Indexes.

Not fixed now: at current scale (no production data yet) this is a non-issue.
Deferred, not forgotten — see trigger below.

## Risk if left too long

`base_repository.py`'s cursor never sets `allowDiskUse`. Mongo's default in-memory
sort limit is 100MB; past it the query hard-fails
(`QueryExceededMemoryLimitNoDiskUseAllowed`, a 500) instead of degrading — a
correctness bug, not just latency, once a single user's matched set gets large
enough.

## Trigger to revisit

Reading volume per user or total user count growing meaningfully — well before a
single user could plausibly have a spread_type+tags match set large enough to risk
the memory limit above.

## Fix

New migration (next version after 012), following `012_reading_tags_date_index.py`'s
shape: compound index on `readings`:

```python
[("user_id", ASCENDING), ("spread_type", ASCENDING), ("tags", ASCENDING), ("created_at", DESCENDING)]
```

Verify with `explain()` (Mongo 7.0) that a combined `spread_type` + `tags` + date-sort
query is served by this index with no blocking `SORT` stage, same as migration 012's
own verification for the tags-only case. Update the Indexes table in
`backend/docs/database/model_references.md` accordingly.
