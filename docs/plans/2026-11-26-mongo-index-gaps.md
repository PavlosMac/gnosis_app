# Close the MongoDB index gaps found in the 2026-11-25 audit

**Status:** agreed in outline, not started (2026-11-26). Part 1 is a correctness fix and
should ship first; parts 2 to 4 are small and optional (see "Decisions needed").

## Background

An audit on 2026-11-25 compared every index created by migrations 001 to 019, every query
the backend runs, and the indexes actually present on the dev database
(`gnosis_esoterica` on `localhost:27019`). Every read path on `readings`, `interpretations`
and `users` is served by an index. Four gaps came out of it. Nothing here is a speed
problem at today's size (4 users, 87 readings, 57 interpretations); part 1 is a
correctness problem.

`explain()` was not run for any query, and the test suite uses mongomock, which does not
check index use. Verification below therefore runs against a real Mongo.

## Part 1. `user_tags.user_id` unique index is missing (do first)

**What was found.** On the dev database `user_tags` has only `_id_`, although `_migrations`
records `010` as applied and `010_user_tags.py` creates a unique index on `user_id`. The
cause is unknown (the collection was probably dropped and recreated outside the runner; no
script in `backend/scripts`, the Makefiles or the compose file drops it). The runner never
re-runs an applied version, so the index will not come back by itself.

**Why it matters.** `UserTagsWriteRepository.replace_for_user` is an upsert that relies on
that unique index: its `DuplicateKeyError` retry only exists because the index is there.
Without it, two racing tag edits for one user can create two documents, and
`find_by_user_id` then returns an arbitrary one, so the tag vocabulary shown can be stale.

**Steps.**

1. Check prod first, read-only, with the commands in
   [`../reference/database/production-mongo-commands.md`](../reference/database/production-mongo-commands.md)
   ("Indexes"): `db.user_tags.getIndexes()` and
   `db.user_tags.aggregate([{$group: {_id: "$user_id", n: {$sum: 1}}}, {$match: {n: {$gt: 1}}}])`.
   Record the result in `docs/notes/issues.md`.
2. Write migration `020_user_tags_unique_index.py` (one logical concern per file, no
   application imports). `up()`:
   - removes duplicate `user_tags` documents, keeping the newest `updated_at` per
     `user_id`. The collection is derived state rebuilt from `readings.tags` after every
     tag edit, so nothing is lost; and
   - calls `create_index([("user_id", 1)], unique=True)`, a no-op where it already exists,
     which keeps `up()` idempotent.
3. Write `tests/migrations/test_user_tags_unique_index_migration.py` first: version matches
   filename; the index is created; a re-run is safe; duplicates are collapsed to the
   newest document and other users' documents are untouched; an empty collection is a
   no-op.
4. Run `make -C backend migrate` against the dev database and confirm with
   `db.user_tags.getIndexes()`.

## Part 2. `refresh_tokens.user_id` has no index (recommended)

`RefreshTokenRepository.revoke_all_for_user` runs `delete_many({"user_id": ...})` on
password reset and on account deletion. There is no index on `user_id`, so it scans the
collection. TTL keeps the collection small (10 rows now), so this is cheap today and grows
with active sessions.

Add `create_index("user_id")` to the same migration 020. No query change. Cost: one more
index to maintain on every login and refresh, which is a write per rotation.

## Part 3. Trim the throttle collection's indexes (optional)

`password_reset_attempts` has an index on `created_at` desc that no query uses. The one
query is `count_documents({key, created_at: {$gte: since}})` in `ThrottleRepository`, which
today uses the `key` index and filters the rest.

Replace the unused index with `(key, created_at)`, which matches the query exactly. This
needs `drop_index` on the old one (find it by key pattern, as `012` does, and tolerate its
absence). Gain is small because the rows per key are few and expire within the hour; the
real benefit is one fewer index to write on every throttled request.

Leave `users.stripe_customer_id` alone: it is a documented leftover from the unbuilt
payment plan (`model-references.md`, "Leftovers"), harmless, and the payment plan may
still use it.

## Part 4. Cheaper count on the admin user list (optional)

`ListUsersHandler` calls `count({})`, which is `count_documents` and scans. For a whole
collection `estimated_document_count()` reads metadata and is O(1). Add `count_all()` to
`BaseReadRepository` and use it there only. Paging by `skip` stays; it is fine until the
list is in the tens of thousands.

## Decisions needed

- Parts 2 and 3: include them in migration 020 now, or only part 1? Recommendation: part 1
  and part 2 in one migration, skip part 3 until the throttle shows up in a profile, and
  do part 4 only if the list is ever slow.
- Whether to fix the dev database by running the migration, or by dropping `user_tags` and
  letting the runner re-run 010. Recommendation: run 020; it is the same path prod takes.

## Not in this plan

- `Reset all credits` is a full `update_many`; that is inherent.
- `count_tags_by_user_id` unwinds one user's tags in memory; bounded per user.
- The `spread_type` + `tags` + date-sort combination still sorts in memory; it has its own
  plan, [`2026-09-29-readings-sort-index.md`](2026-09-29-readings-sort-index.md).

## When it ships

Update the Indexes table in
[`../reference/database/model-references.md`](../reference/database/model-references.md)
(and its "current state after 001 to 0NN" line), add a dated line to
[`../notes/issues.md`](../notes/issues.md), delete this plan, and remove its row from
[`../README.md`](../README.md).
