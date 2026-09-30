# Gnosis Esoterica — MongoDB Model References

Current collections as written by the domain models (`src/<domain>/models.py`) and indexed by
migrations (`src/migrations/versions/`). Collection names come from
`src/database/collections/constants.py` — except `_migrations`, which is hardcoded in
`src/migrations/runner.py`.

Optional fields are **omitted** from the document when unset (never stored as `null`).

## Collections

### users
Source: `src/auth/models.py`

| Field              | Type            | Notes                                   |
|--------------------|-----------------|-----------------------------------------|
| _id                | ObjectId        | PK                                      |
| email              | str             | unique                                  |
| password_hash      | str             |                                         |
| display_name       | str             | optional                                |
| credits            | int             | default 0                               |
| is_superadmin      | bool            | default false                           |
| stripe_customer_id | str             | optional (reserved; payments not built) |
| usage              | sub-doc         | optional; created lazily by the budget gate: `{prompt_tokens, completion_tokens, cost_usd, readings, updated_at}`, `$inc`'d atomically per generate |
| budget_usd         | float           | optional per-user override of `Settings.user_budget_usd` ($3 default) |
| created_at         | datetime        |                                         |
| updated_at         | datetime        |                                         |

`total_tokens_used` was retired by migration 009 — superseded by the `usage` aggregate.

### refresh_tokens
Source: `src/auth/repository.py` (`RefreshTokenRepository`) — no domain model, written directly.

| Field      | Type     | Notes                                         |
|------------|----------|-----------------------------------------------|
| _id        | ObjectId | PK                                            |
| jti        | str      | unique                                        |
| family_id  | str      | rotation family; whole family revoked on reuse |
| user_id    | str      |                                               |
| used       | bool     | set true on consume (atomic find-and-update)  |
| expires_at | datetime | TTL index                                     |

### readings
Source: `src/readings/models.py`

| Field       | Type                              | Notes                          |
|-------------|-----------------------------------|--------------------------------|
| _id         | ObjectId                          | PK                             |
| user_id     | ObjectId                          | FK→users                       |
| spread_type | str                               |                                |
| question    | str                               | optional                       |
| birth_date  | str (ISO date)                    | optional                       |
| tags        | [str]                             | optional (omitted when empty)  |
| cards       | [{name, position?, orientation, position_description?}] | array; optional keys omitted when unset |
| created_at  | datetime                          |                                |

Legacy documents may still carry embedded `card_interpretations`, `synthesis`, `tokens_used`,
`model`. Migration 006 copied these into `interpretations`; the app no longer reads them from
`readings`.

### interpretations
Source: `src/interpretations/models.py`. **One interpretation per reading** (unique
`reading_id` index) — generated and persisted in one idempotent call; a repeat generate
returns the stored document.

| Field      | Type                                                       | Notes                              |
|------------|------------------------------------------------------------|------------------------------------|
| _id        | ObjectId                                                   | PK                                 |
| reading_id | ObjectId                                                   | FK→readings                        |
| user_id    | ObjectId                                                   | FK→users                           |
| reading    | str                                                        | one woven narrative                |
| model      | str                                                        | resolved LLM model id from the response |
| usage      | {prompt_tokens, completion_tokens, reasoning_tokens, model, cost_usd} | optional (absent on docs migrated by 008); the per-interpretation ledger, priced at call time |
| created_at | datetime                                                   |                                    |
| updated_at | datetime                                                   |                                    |

Migration 008 collapsed the legacy per-card shape (`card_interpretations`, `synthesis`,
`tokens_used`, `settings`) into one narrative document per reading — newest kept —
and removed `settings` entirely.

### user_tags
Source: `src/readings/repository.py` (`UserTagsWriteRepository`). **One document per user**
(unique `user_id` index) holding their whole tag vocabulary across readings — derived state,
not user-edited. `UpdateReadingTagsHandler` rewrites it from that user's readings after every
tag edit; migration 010 backfilled it. `GET /api/v1/readings` returns it as `user_tags`, so
the front-end never has to page through readings to discover tags.

| Field      | Type                  | Notes                                             |
|------------|-----------------------|---------------------------------------------------|
| _id        | ObjectId              | PK                                                |
| user_id    | ObjectId              | FK→users, unique                                  |
| tags       | [{name: str, count: int}] | readings carrying each tag; count desc, then name asc |
| updated_at | datetime              | last rebuild                                      |

Users who have never tagged a reading have no document (the API treats that as `[]`).

### password_reset_tokens
Source: `src/auth/repository.py` (`PasswordResetTokenRepository`) — no domain model, written
directly. Created by `POST /auth/forgot-password`; the raw token goes in the email link and only
its hash is stored. Consumed by an atomic find-and-update on `(token_hash, used=false)`; the
handler tells an expired token from an invalid one by inspecting `expires_at` on the matched
document (410 vs 400), so the TTL index only cleans up. Requesting a new token first deletes
the user's other unused tokens, so at most one is live per user.

| Field      | Type     | Notes                                                   |
|------------|----------|---------------------------------------------------------|
| _id        | ObjectId | PK                                                      |
| token_hash | str      | unique                                                  |
| user_id    | str      | FK→users, stored as a string (like `refresh_tokens`)    |
| used       | bool     | set true on consume                                     |
| expires_at | datetime | TTL index; `Settings.password_reset_token_ttl_minutes` (30) after issue |

### password_reset_attempts
Source: `src/auth/repository.py` (`PasswordResetThrottleRepository`). A generic per-key
request throttle, one document per attempt: `key` is the case-folded email for
forgot-password and `support:<user_id>` for the support contact relay. A handler records the
attempt first, then counts documents with that key inside the window
(`Settings.password_reset_rate_limit_window_seconds`, 3600s, max 5), so concurrent bursts can
only over-throttle, never under-throttle.

| Field      | Type     | Notes                                              |
|------------|----------|----------------------------------------------------|
| _id        | ObjectId | PK                                                 |
| key        | str      | throttle scope                                     |
| created_at | datetime | attempt time; window counts are `>=` this          |
| expires_at | datetime | TTL index; `created_at` + window                   |

### _migrations
Managed by `src/migrations/runner.py`. Fields: `version` (unique), `description`, `applied_at`.

## Relationships

```
users ─1:N─→ refresh_tokens
users ─1:N─→ readings ─1:1─→ interpretations   (unique reading_id index)
users ─1:N─→ interpretations                   (denormalized user_id for usage queries)
users ─1:1─→ user_tags   (derived from that user's readings.tags)
users ─1:N─→ password_reset_tokens   (user_id as string)
password_reset_attempts is keyed by email or `support:<user_id>`, not by FK
```

## Indexes

Owned by migrations. Current state after 001–012:

| Collection      | Index                                        | Options            | Migration |
|-----------------|----------------------------------------------|--------------------|-----------|
| users           | `email`                                      | unique             | 001       |
| users           | `stripe_customer_id`                         | unique, sparse     | 001       |
| users           | `created_at` desc                            |                    | 001       |
| refresh_tokens  | `jti`                                        | unique             | 001       |
| refresh_tokens  | `family_id`                                  |                    | 001       |
| refresh_tokens  | `expires_at`                                 | TTL (0s)           | 001       |
| readings        | `(user_id, created_at desc)`                 |                    | 002       |
| readings        | `(user_id, spread_type, created_at desc)`    |                    | 003       |
| readings        | `(user_id, spread_type, birth_date)`         |                    | 004       |
| readings        | `(user_id, tags, created_at desc)`           |                    | 012 (superseded 003's `(user_id, tags)`) |
| interpretations | `reading_id`                                 | unique             | 008 (superseded 005's `(reading_id, settings.lens)`) |
| user_tags       | `user_id`                                    | unique             | 010       |
| password_reset_tokens   | `token_hash`                         | unique             | 011       |
| password_reset_tokens   | `user_id`                            |                    | 011       |
| password_reset_tokens   | `expires_at`                         | TTL (0s)           | 011       |
| password_reset_attempts | `key`                                |                    | 011       |
| password_reset_attempts | `created_at` desc                    |                    | 011       |
| password_reset_attempts | `expires_at`                         | TTL (0s)           | 011       |
| _migrations     | `version`                                    | unique             | runner    |

A tag filter with a date sort (`tags=…&sort=created_at`) is served entirely by the 012
index: one tag is a plain scan in date order, several tags are a `SORT_MERGE` of one
scan per tag (Mongo 7.0, checked with `explain()`). Adding `spread_type` to that
combination still ends in an in-memory `SORT` — the planner has no index carrying
both `spread_type` and `tags` ahead of `created_at`.

## Leftovers

- `stripe_customer_id` on `users` (and its unique sparse index) is a leftover from the
  original Stripe plan; payments are not built. The current payment design is in
  `docs/payment/`.
