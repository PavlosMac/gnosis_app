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
| email              | str             | unique; stored lower-cased (every writer folds it, `find_by_email` folds the query) |
| password_hash      | str             | optional only while `status` is `invited` (set when the invite is accepted). Every reader treats absence as "wrong password" |
| first_name         | str             | optional (absent on accounts created before 2026-10-04) |
| last_name          | str             | optional (as above)                     |
| birth_date         | str (ISO date)  | optional (absent on accounts created before 2026-11-03, on invited ones until accepted, and on seeded ones unless the seed sets it). Required at register / accept-invite; 18+ enforced by `BirthDate` in `src/auth/schemas.py` |
| consents           | sub-doc         | optional; `{terms: {version, accepted_at}, privacy: {version, accepted_at}}`. `version` is the frontend's dated MDX filename, stored unvalidated. Readers treat absent as `{}` |
| status             | str             | `invited` \| `pending_verification` \| `active`. **Absent means active** (no backfill) — `user_status()` in `src/auth/models.py`. `invited` = superadmin invite not yet accepted: no password, names or consents |
| email_verified_at  | datetime        | optional; set when the emailed link is confirmed |
| verification_deadline_at | datetime  | optional; only on pending and invited accounts. Purge clock for the TTL index of migrations 014/015; moved forward by each resend or re-invite, removed on verification or acceptance |
| credits            | int             | default 0                               |
| is_superadmin      | bool            | default false                           |
| stripe_customer_id | str             | optional (reserved; payments not built) |
| usage              | sub-doc         | optional; created lazily by the budget gate: `{prompt_tokens, completion_tokens, cost_usd, readings, updated_at}`, `$inc`'d atomically per generate |
| budget_usd         | float           | optional per-user override of `Settings.user_budget_usd` ($3 default) |
| created_at         | datetime        |                                         |
| updated_at         | datetime        |                                         |

Account deletion (`DeleteUserHandler`) removes the document and everything in the other
collections that references it — see
[`../auth/registration-verification-and-consent.md`](../auth/registration-verification-and-consent.md).

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

### email_verification_tokens
Source: `src/auth/repository.py` (`EmailVerificationTokenRepository`; it and
`PasswordResetTokenRepository` are thin subclasses of `OneTimeTokenRepository`). Same
shape and lifecycle as `password_reset_tokens`: created by `POST /auth/register` and by
the resend background task, raw token only in the emailed link, consumed atomically,
400-vs-410 decided by the handler. Confirming deletes all of the user's rows. Superadmin
invites (`POST /users/invite`) store their token here too, with `expires_at` =
`Settings.invite_ttl_days` after issue; the accept handler tells the two apart by the
user's `status`.

| Field      | Type     | Notes                                                   |
|------------|----------|---------------------------------------------------------|
| _id        | ObjectId | PK                                                      |
| token_hash | str      | unique                                                  |
| user_id    | str      | FK→users, stored as a string                            |
| used       | bool     | set true on consume                                     |
| expires_at | datetime | TTL index; `Settings.email_verification_token_ttl_hours` (24) after issue |

### password_reset_attempts
Source: `src/auth/repository.py` (`ThrottleRepository`; `PasswordResetThrottleRepository`
is its unprefixed subclass). A generic per-key request throttle shared by every limiter,
one document per attempt. Keys: the case-folded email for forgot-password,
`support:<user_id>` for the support relay, `verify:<email>` for resend-verification,
`login:<ip>:<email>` for login, `login:delete:<user_id>` for the delete-account password
check, `register:<ip>` for registration, `invite:<ip>` for the public invite lookup and accept. A handler records the
attempt first, then counts documents with that key inside the window
(`Settings.password_reset_rate_limit_window_seconds`, 3600s, max 5), so concurrent bursts can
only over-throttle, never under-throttle.

| Field      | Type     | Notes                                              |
|------------|----------|----------------------------------------------------|
| _id        | ObjectId | PK                                                 |
| key        | str      | throttle scope                                     |
| created_at | datetime | attempt time; window counts are `>=` this          |
| expires_at | datetime | TTL index; `created_at` + window                   |

### major_arcana_meanings
Source: `src/cards/` (read repository, `GET /api/v1/cards/major-arcana/{number}`, login required).
One generated write-up per major arcana card, shown in the card-of-the-day dialog. The text is
the same for every user. Migration 016 creates the index only; the rows are upserted by
`src.cards.loader` at every API start (`lifespan` in `src/main.py`), and on demand with
`make -C backend card-meanings-load`, from the committed `src/lib/cards/major_arcana_meanings.json`, which
`scripts/major_arcana_meanings.py` generated once offline; nothing writes it at request time.
The loader refuses a file with a bad or duplicate `number` or an empty text field.
Two paragraphs only: there is no reversed reading for a card of the day (decided 2026-11-10).

| Field        | Type     | Notes                                                                  |
|--------------|----------|------------------------------------------------------------------------|
| _id          | ObjectId | PK                                                                     |
| number       | int      | unique; frontend deck index, 0 = The Fool .. 21 = The World            |
| name         | str      | the frontend spelling ("Judgement", "The World")                       |
| slug         | str      |                                                                        |
| upright      | str      | paragraph 1                                                            |
| shadow       | str      | paragraph 2                                                            |
| word_count, model, effort, generated_at | | generation metadata; not exposed by the API |
| updated_at   | datetime | set on every upsert                                                    |

A card missing from the collection answers 404; the dialog then shows "This card's meaning has
not been written yet."

### spread_card_meanings
Source: `src/cards/` (read repository, `GET /api/v1/cards/spread/{number}`, **public**: the
reading page is open to visitors and the text holds no user data). One general meaning per
card of the full deck, shown when a card in a spread is clicked, on the live reading and on a
saved one. The same text is shown whether the card fell upright or reversed; each text covers
the card's shadow side. Same lifecycle as `major_arcana_meanings`: migration 017 creates the
index only, and the rows are upserted by `src.cards.loader` at every API start and with
`make -C backend card-meanings-load`, from the committed `src/lib/cards/spread_card_meanings.json`.
`scripts/spread_card_meanings.py` generated that file offline from a prompt and the card name
alone (no source data); a regenerated card replaces its text. The loader refuses a bad or
duplicate `number` or an empty `meaning`.

| Field        | Type     | Notes                                                                  |
|--------------|----------|------------------------------------------------------------------------|
| _id          | ObjectId | PK                                                                     |
| number       | int      | unique; frontend deck index, 0 = The Fool .. 21 = The World, then Pentacles from 22, Wands 36, Cups 50, Swords 64 (Ace..Ten, Page, Knight, Queen, King) |
| name         | str      | the frontend spelling ("Judgement", "Page of Wands")                   |
| slug         | str      |                                                                        |
| meaning      | str      | plain prose, two or three paragraphs separated by a blank line; no markdown |
| word_count, model, effort, generated_at | | generation metadata; not exposed by the API |
| updated_at   | datetime | set on every upsert                                                    |

A card missing from the collection answers 404; the dialog then shows "This card's meaning has
not been written yet."

### _migrations
Managed by `src/migrations/runner.py`. Fields: `version` (unique), `description`, `applied_at`.

## Relationships

```
users ─1:N─→ refresh_tokens
users ─1:N─→ readings ─1:1─→ interpretations   (unique reading_id index)
users ─1:N─→ interpretations                   (denormalized user_id for usage queries)
users ─1:1─→ user_tags   (derived from that user's readings.tags)
users ─1:N─→ password_reset_tokens       (user_id as string)
users ─1:N─→ email_verification_tokens   (user_id as string)
password_reset_attempts is keyed by email, user id or client IP (with a limiter prefix), not by FK
```

## Indexes

Owned by migrations. Current state after 001–017:

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
| email_verification_tokens | `token_hash`                       | unique             | 013       |
| email_verification_tokens | `user_id`                          |                    | 013       |
| email_verification_tokens | `expires_at`                       | TTL (0s)           | 013       |
| users           | `verification_deadline_at` (`pending_users_ttl`) | TTL (0s), partial: `status in ["pending_verification", "invited"]` | 015 (superseded 014's `status = "pending_verification"`) |
| major_arcana_meanings | `number` (`number_unique`)             | unique             | 016       |
| spread_card_meanings  | `number` (`number_unique`)             | unique             | 017       |
| _migrations     | `version`                                    | unique             | runner    |

A tag filter with a date sort (`tags=…&sort=created_at`) is served entirely by the 012
index: one tag is a plain scan in date order, several tags are a `SORT_MERGE` of one
scan per tag (Mongo 7.0, checked with `explain()`). Adding `spread_type` to that
combination still ends in an in-memory `SORT` — the planner has no index carrying
both `spread_type` and `tags` ahead of `created_at`.

## Leftovers

- `stripe_customer_id` on `users` (and its unique sparse index) is a leftover from the
  original Stripe plan; payments are not built. The current payment design is in
  `docs/plans/2026-08-31-mollie-recurring-subscription.md`.
