# Gnosis Esoterica — MongoDB Model References

> These are the target models for the full application. Initial scaffolding uses only the **users** collection.

## Collections

### users
| Field              | Type              | Notes            |
|--------------------|-------------------|------------------|
| _id                | ObjectId          | PK               |
| email              | str               | unique           |
| password_hash      | str               |                  |
| display_name       | str \| null       |                  |
| credits            | int               | default 0        |
| stripe_customer_id | str \| null       |                  |
| created_at         | datetime          |                  |
| updated_at         | datetime          |                  |

### readings
| Field                | Type                                                 | Notes    |
|----------------------|------------------------------------------------------|----------|
| _id                  | ObjectId                                             | PK       |
| user_id              | ObjectId                                             | FK→users |
| spread_type          | str                                                  |          |
| question             | str \| null                                          |          |
| cards                | [{name, position, orientation}]                      | array    |
| card_interpretations | [{card_name, position, orientation, interpretation}] | array    |
| synthesis            | str                                                  |          |
| tokens_used          | int                                                  |          |
| model                | str                                                  |          |
| created_at           | datetime                                             |          |

### transactions
| Field                 | Type           | Notes            |
|-----------------------|----------------|------------------|
| _id                   | ObjectId       | PK               |
| user_id               | ObjectId       | FK→users         |
| stripe_session_id     | str            | unique           |
| stripe_payment_intent | str            |                  |
| amount                | int            | cents            |
| currency              | str            |                  |
| credits_purchased     | int            |                  |
| status                | str            | enum (see below) |
| created_at            | datetime       |                  |
| completed_at          | datetime \| null |                |

### credit_ledger
| Field          | Type              | Notes              |
|----------------|-------------------|--------------------|
| _id            | ObjectId          | PK                 |
| user_id        | ObjectId          | FK→users           |
| delta          | int               | e.g. +5, -1        |
| reason         | str               | enum (see below)   |
| balance_after  | int               |                    |
| reference_id   | ObjectId \| null  | polymorphic ref    |
| reference_type | str \| null       | e.g. "transaction" |
| created_at     | datetime          |                    |

## Relationships

```
users ─1:N─→ readings
users ─1:N─→ transactions
users ─1:N─→ credit_ledger
```

## Indexes

- **users**: unique on `email`, unique sparse on `stripe_customer_id`
- **readings**: compound on `(user_id, created_at desc)`
- **transactions**: unique on `stripe_session_id`, index on `user_id`

## Enums

- **transaction.status**: `pending` → `completed` → `failed` → `refunded`
- **credit_ledger.reason**: `purchase` | `reading` | `refund` | `admin_adjustment`
