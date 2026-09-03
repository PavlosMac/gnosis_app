# Gnosis Esoterica — MongoDB Model References

Current collections as written by the domain models (`src/<domain>/models.py`) and indexed by
migrations (`src/migrations/versions/`). Collection names come from
`src/database/collections/constants.py`.

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
| cards       | [{name, position?, orientation}]  | array                          |
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

### _migrations
Managed by `src/migrations/runner.py`. Fields: `version` (unique), `description`, `applied_at`.

## Relationships

```
users ─1:N─→ refresh_tokens
users ─1:N─→ readings ─1:N─→ interpretations
```

## Indexes

Owned by migrations. Current state after 001–009:

| Collection      | Index                                        | Options            | Migration |
|-----------------|----------------------------------------------|--------------------|-----------|
| users           | `email`                                      | unique             | 001       |
| users           | `stripe_customer_id`                         | unique, sparse     | 001       |
| users           | `created_at` desc                            |                    | 001       |
| refresh_tokens  | `jti`                                        | unique             | 001       |
| refresh_tokens  | `family_id`                                  |                    | 001       |
| refresh_tokens  | `expires_at`                                 | TTL (0s)           | 001       |
| readings        | `(user_id, created_at desc)`                 |                    | 002       |
| readings        | `(user_id, tags)`                            |                    | 003       |
| readings        | `(user_id, spread_type, created_at desc)`    |                    | 003       |
| readings        | `(user_id, spread_type, birth_date)`         |                    | 004       |
| interpretations | `reading_id`                                 | unique             | 008 (superseded 005's `(reading_id, settings.lens)`) |
| _migrations     | `version`                                    | unique             | runner    |

## Planned

- **Password reset** (`password-reset` branch): `password_reset_tokens` and
  `password_reset_attempts` collections, next free migration number — see
  `docs/auth/password-reset-flow.md`.
- **Payments**: Mollie subscriptions, not Stripe — see `docs/payment/mollie-recurring-subscription.md`.
  `stripe_customer_id` on `users` is a leftover from the original plan.
