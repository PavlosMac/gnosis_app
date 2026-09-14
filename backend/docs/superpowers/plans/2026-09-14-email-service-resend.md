# Email Service (Resend) + Password Reset Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the password-reset flow (request → email link → confirm) with a production Resend email adapter behind an `EmailPort` abstraction.

**Architecture:** New `src/notifications/` package mirrors `src/llm/`'s port/adapter split: `EmailPort` ABC with console (dev), mock (test), and Resend (prod) adapters, selected in `lifespan()` by `resend_api_key` presence. The reset flow itself lives in `src/auth/`: two CQRS commands, two plain repositories over new TTL-indexed collections, two unauthenticated endpoints.

**Tech Stack:** FastAPI, Motor/MongoDB, `resend` SDK v2.44+ (`Emails.send_async`, already a dependency), pytest-asyncio + mongomock-motor.

**Spec:** `docs/superpowers/specs/2026-09-14-email-service-resend-design.md` (base flow: `docs/auth/password-reset-flow.md` — this plan implements both; the spec's deltas win where they differ).

## Global Constraints

- Python 3.12, uv. Run everything via `make` targets or `.venv/bin/python -m pytest`.
- Ruff line length 100, rules E/F/I/N/W/UP. Run `make lint` before every commit.
- All `__init__.py` files are empty; use fully qualified `src.*` imports.
- Explicit return types on every function, including `-> None`. Union syntax `X | Y`.
- Never `HTTPException` — only the `AppError` hierarchy (`src/core/exceptions.py`).
- API schemas inherit `AppSchema`; commands inherit `BaseCommand` (frozen).
- Tests: `asyncio_mode = "auto"` — no `@pytest.mark.asyncio` decorators. Test names `test_<action>_<condition>`.
- Every git commit message ends with exactly these two lines:
  ```
  Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01GoVLQMYzBnNRvAiWSWZUbx
  ```
- Copy strings (email subject/body, response `detail` messages) are exact — use them verbatim from this plan.

---

### Task 1: Notifications package — port, errors, console + mock adapters

**Files:**
- Create: `src/notifications/__init__.py` (empty)
- Create: `src/notifications/port.py`
- Create: `src/notifications/errors.py`
- Create: `src/notifications/console_adapter.py`
- Create: `src/notifications/mock_adapter.py`
- Create: `tests/notifications/__init__.py` (empty)
- Test: `tests/notifications/test_adapters.py`

**Interfaces:**
- Consumes: `AppError` from `src.core.exceptions`.
- Produces: `EmailPort` ABC with `async send_password_reset(to: str, reset_link: str) -> None` and `async close() -> None`; `EmailDeliveryError(AppError)` (502); `ConsoleEmailAdapter()`; `MockEmailAdapter()` with `sent_password_resets: list[dict[str, str]]`. Later tasks import all of these by these exact names.

- [ ] **Step 1: Write the failing tests**

```python
# tests/notifications/test_adapters.py
from src.core.exceptions import AppError
from src.notifications.console_adapter import ConsoleEmailAdapter
from src.notifications.errors import EmailDeliveryError
from src.notifications.mock_adapter import MockEmailAdapter
from src.notifications.port import EmailPort


def test_email_delivery_error_is_502_app_error():
    err = EmailDeliveryError()
    assert isinstance(err, AppError)
    assert err.status_code == 502
    assert err.detail == "Email delivery failed"


async def test_mock_adapter_records_sends():
    adapter = MockEmailAdapter()
    await adapter.send_password_reset(to="a@b.com", reset_link="http://x/reset?token=t1")
    await adapter.send_password_reset(to="c@d.com", reset_link="http://x/reset?token=t2")
    assert adapter.sent_password_resets == [
        {"to": "a@b.com", "reset_link": "http://x/reset?token=t1"},
        {"to": "c@d.com", "reset_link": "http://x/reset?token=t2"},
    ]
    await adapter.close()


async def test_console_adapter_sends_without_error():
    adapter = ConsoleEmailAdapter()
    await adapter.send_password_reset(to="a@b.com", reset_link="http://x/reset?token=t1")
    await adapter.close()


def test_adapters_implement_port():
    assert issubclass(MockEmailAdapter, EmailPort)
    assert issubclass(ConsoleEmailAdapter, EmailPort)
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `.venv/bin/python -m pytest tests/notifications/test_adapters.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'src.notifications'`

- [ ] **Step 3: Implement the package**

`src/notifications/port.py`:
```python
from abc import ABC, abstractmethod


class EmailPort(ABC):
    @abstractmethod
    async def send_password_reset(self, to: str, reset_link: str) -> None: ...

    @abstractmethod
    async def close(self) -> None: ...
```

`src/notifications/errors.py`:
```python
from src.core.exceptions import AppError


class EmailDeliveryError(AppError):
    """The single error at the EmailPort boundary — adapters map every provider/SDK
    failure to this, so no SDK exception type leaks past the port."""

    def __init__(self) -> None:
        super().__init__(status_code=502, detail="Email delivery failed")
```

`src/notifications/console_adapter.py`:
```python
import structlog

from src.notifications.port import EmailPort

logger = structlog.stdlib.get_logger(__name__)


class ConsoleEmailAdapter(EmailPort):
    """Dev fallback when RESEND_API_KEY is unset — logs the link instead of sending."""

    async def send_password_reset(self, to: str, reset_link: str) -> None:
        logger.info("password reset email (console)", to=to, reset_link=reset_link)

    async def close(self) -> None:
        return None
```

`src/notifications/mock_adapter.py`:
```python
from src.notifications.port import EmailPort


class MockEmailAdapter(EmailPort):
    def __init__(self) -> None:
        self.sent_password_resets: list[dict[str, str]] = []

    async def send_password_reset(self, to: str, reset_link: str) -> None:
        self.sent_password_resets.append({"to": to, "reset_link": reset_link})

    async def close(self) -> None:
        return None
```

Also create empty `src/notifications/__init__.py` and `tests/notifications/__init__.py`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `.venv/bin/python -m pytest tests/notifications/test_adapters.py -v`
Expected: 4 PASS

- [ ] **Step 5: Lint and commit**

```bash
make lint
git add src/notifications tests/notifications
git commit -m "feat: notifications package — EmailPort with console and mock adapters

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01GoVLQMYzBnNRvAiWSWZUbx"
```

---

### Task 2: Email templates

**Files:**
- Create: `src/notifications/templates.py`
- Test: `tests/notifications/test_templates.py`

**Interfaces:**
- Produces: `password_reset_subject() -> str`, `password_reset_text(reset_link: str) -> str`, `password_reset_html(reset_link: str) -> str`. Task 3's adapter calls all three.

- [ ] **Step 1: Write the failing tests**

```python
# tests/notifications/test_templates.py
from src.notifications.templates import (
    password_reset_html,
    password_reset_subject,
    password_reset_text,
)

LINK = "https://tarotdivinations.com/reset-password?token=abc123"


def test_subject_names_the_product():
    assert password_reset_subject() == "Reset your Tarot Divinations password"


def test_text_contains_link_and_expiry():
    text = password_reset_text(LINK)
    assert LINK in text
    assert "30 minutes" in text
    assert "<" not in text  # plain part carries no markup


def test_html_contains_link_twice_and_expiry():
    html = password_reset_html(LINK)
    # once as the button href, once as the raw fallback URL
    assert html.count(LINK) == 2
    assert "30 minutes" in html
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `.venv/bin/python -m pytest tests/notifications/test_templates.py -v`
Expected: FAIL — `ModuleNotFoundError` / `ImportError`

- [ ] **Step 3: Implement templates**

`src/notifications/templates.py`:
```python
# Wording only — the authoritative TTL is settings.password_reset_token_ttl_minutes.
# If that setting changes, update this string to match.
_TTL_WORDING = "30 minutes"


def password_reset_subject() -> str:
    return "Reset your Tarot Divinations password"


def password_reset_text(reset_link: str) -> str:
    return (
        "We received a request to reset your Tarot Divinations password.\n"
        "\n"
        f"Reset it here: {reset_link}\n"
        "\n"
        f"This link expires in {_TTL_WORDING} and can only be used once.\n"
        "If you didn't request this, you can safely ignore this email."
    )


def password_reset_html(reset_link: str) -> str:
    return (
        '<div style="max-width:480px;margin:0 auto;padding:32px 24px;'
        "font-family:Georgia,'Times New Roman',serif;color:#2b2333;\">"
        '<h1 style="font-size:20px;font-weight:600;margin:0 0 16px;">'
        "Reset your password</h1>"
        '<p style="font-size:15px;line-height:1.6;margin:0 0 24px;">'
        "We received a request to reset your Tarot Divinations password. "
        "Click the button below to choose a new one.</p>"
        f'<a href="{reset_link}" style="display:inline-block;padding:12px 24px;'
        "background:#4b3869;color:#ffffff;text-decoration:none;border-radius:6px;"
        'font-size:15px;">Reset password</a>'
        '<p style="font-size:13px;line-height:1.6;color:#6f6680;margin:24px 0 0;">'
        f"This link expires in {_TTL_WORDING} and can only be used once. "
        "If the button doesn't work, paste this address into your browser:<br>"
        f'<span style="word-break:break-all;">{reset_link}</span></p>'
        '<p style="font-size:13px;line-height:1.6;color:#6f6680;margin:16px 0 0;">'
        "If you didn't request this, you can safely ignore this email.</p>"
        "</div>"
    )
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `.venv/bin/python -m pytest tests/notifications/test_templates.py -v`
Expected: 3 PASS

- [ ] **Step 5: Lint and commit**

```bash
make lint
git add src/notifications/templates.py tests/notifications/test_templates.py
git commit -m "feat: password reset email templates (text + minimal HTML)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01GoVLQMYzBnNRvAiWSWZUbx"
```

---

### Task 3: Resend adapter

**Files:**
- Create: `src/notifications/resend_adapter.py`
- Test: `tests/notifications/test_resend_adapter.py`

**Interfaces:**
- Consumes: `EmailPort`, `EmailDeliveryError`, the three template functions.
- Produces: `ResendEmailAdapter(api_key: str, from_address: str)` implementing `EmailPort`. Task 9 constructs it in `lifespan()`.

**Background for the implementer:** the `resend` SDK (v2.44.0, already installed) exposes native async `resend.Emails.send_async(params)`. Auth is a module-level global (`resend.api_key = ...`). `SendParams` is a dict (keys: `from`, `to`, `subject`, `text`, `html`); `SendResponse` subclasses `dict` with an `"id"` key. SDK exceptions live in `resend.exceptions`: a `ResendError` tree (`RateLimitError`, `ValidationError`, `InvalidApiKeyError`, `ApplicationError`, …) **plus** `NoContentError` which subclasses bare `Exception` — which is why the adapter catches broad `Exception`, not just `ResendError`.

- [ ] **Step 1: Write the failing tests**

```python
# tests/notifications/test_resend_adapter.py
import pytest
import resend.exceptions

from src.notifications.errors import EmailDeliveryError
from src.notifications.resend_adapter import ResendEmailAdapter

LINK = "https://tarotdivinations.com/reset-password?token=abc123"


@pytest.fixture
def adapter():
    return ResendEmailAdapter(
        api_key="re_test_key", from_address="Tarot Divinations <noreply@tarotdivinations.com>"
    )


async def test_send_builds_correct_payload(adapter, monkeypatch):
    captured: dict = {}

    async def fake_send_async(params):
        captured.update(params)
        return {"id": "email_123"}

    monkeypatch.setattr("resend.Emails.send_async", fake_send_async)
    await adapter.send_password_reset(to="user@example.com", reset_link=LINK)

    assert captured["from"] == "Tarot Divinations <noreply@tarotdivinations.com>"
    assert captured["to"] == "user@example.com"
    assert captured["subject"] == "Reset your Tarot Divinations password"
    assert LINK in captured["text"]
    assert LINK in captured["html"]


@pytest.mark.parametrize(
    "sdk_exc",
    [
        resend.exceptions.ResendError(
            code=429, error_type="rate_limit_exceeded", message="slow down", suggested_action=""
        ),
        resend.exceptions.NoContentError(),
        ConnectionError("network down"),
    ],
)
async def test_send_failures_map_to_email_delivery_error(adapter, monkeypatch, sdk_exc):
    async def fake_send_async(params):
        raise sdk_exc

    monkeypatch.setattr("resend.Emails.send_async", fake_send_async)
    with pytest.raises(EmailDeliveryError):
        await adapter.send_password_reset(to="user@example.com", reset_link=LINK)


async def test_close_is_a_noop(adapter):
    await adapter.close()
```

Note: if the `ResendError(...)` constructor kwargs above don't match the installed SDK
(inspect with `.venv/bin/python -c "import inspect, resend.exceptions as e; print(inspect.signature(e.ResendError.__init__))"`),
adjust the construction — the test's point is only that a `ResendError` instance is raised.

- [ ] **Step 2: Run tests to verify they fail**

Run: `.venv/bin/python -m pytest tests/notifications/test_resend_adapter.py -v`
Expected: FAIL — `ModuleNotFoundError` / `ImportError` on `resend_adapter`

- [ ] **Step 3: Implement the adapter**

`src/notifications/resend_adapter.py`:
```python
import resend
import structlog

from src.notifications.errors import EmailDeliveryError
from src.notifications.port import EmailPort
from src.notifications.templates import (
    password_reset_html,
    password_reset_subject,
    password_reset_text,
)

logger = structlog.stdlib.get_logger(__name__)


class ResendEmailAdapter(EmailPort):
    def __init__(self, api_key: str, from_address: str) -> None:
        # The SDK authenticates via a module-level global; set once at construction.
        resend.api_key = api_key
        self._from = from_address

    async def send_password_reset(self, to: str, reset_link: str) -> None:
        params: resend.Emails.SendParams = {
            "from": self._from,
            "to": to,
            "subject": password_reset_subject(),
            "text": password_reset_text(reset_link),
            "html": password_reset_html(reset_link),
        }
        try:
            response = await resend.Emails.send_async(params)
        except Exception as exc:
            # Broad on purpose: the port contract is "succeeds or raises
            # EmailDeliveryError". The SDK raises a ResendError tree but also
            # NoContentError (bare Exception) and transport-level errors.
            logger.warning(
                "resend send failed", error=type(exc).__name__, detail=str(exc), to=to
            )
            raise EmailDeliveryError() from exc
        logger.info("password reset email sent", to=to, message_id=response["id"])

    async def close(self) -> None:
        return None
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `.venv/bin/python -m pytest tests/notifications/ -v`
Expected: all PASS (this file's 5 + tasks 1–2's 7)

- [ ] **Step 5: Lint and commit**

```bash
make lint
git add src/notifications/resend_adapter.py tests/notifications/test_resend_adapter.py
git commit -m "feat: ResendEmailAdapter — async send with SDK errors mapped to EmailDeliveryError

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01GoVLQMYzBnNRvAiWSWZUbx"
```

---

### Task 4: Config, collection constants, migration 011

**Files:**
- Modify: `src/core/config.py` (inside `class Settings`, after the OpenAI block)
- Modify: `src/database/collections/constants.py`
- Create: `src/migrations/versions/011_password_reset_tokens_indexes.py`

**Interfaces:**
- Produces: settings `resend_api_key`, `email_from`, `frontend_base_url`, `password_reset_token_ttl_minutes`, `password_reset_rate_limit_window_seconds`, `password_reset_rate_limit_max_attempts`; constants `PASSWORD_RESET_TOKENS_COLLECTION`, `PASSWORD_RESET_ATTEMPTS_COLLECTION`. Tasks 5–9 use these exact names.

No new test file: settings are plain pydantic-settings fields (defaults exercised by every existing test) and the migration runner has generic coverage; the migration is verified by running the suite (`run_migrations` executes in app startup paths) and by `make migrate` at the end.

- [ ] **Step 1: Add settings**

In `src/core/config.py`, after the `openai_acquire_timeout_seconds` line, insert:

```python
    # Email (Resend). Adapter selection mirrors openai_api_key: key set -> Resend,
    # unset -> console adapter that logs the link.
    resend_api_key: str = ""
    email_from: str = "Tarot Divinations <noreply@tarotdivinations.com>"

    # Frontend (reset links are {frontend_base_url}/reset-password?token=...)
    frontend_base_url: str = "http://localhost:3000"

    # Password reset. If the TTL changes, update the expiry wording in
    # src/notifications/templates.py to match.
    password_reset_token_ttl_minutes: int = 30
    password_reset_rate_limit_window_seconds: int = 3600
    password_reset_rate_limit_max_attempts: int = 5
```

- [ ] **Step 2: Add collection constants**

Append to `src/database/collections/constants.py`:
```python
PASSWORD_RESET_TOKENS_COLLECTION = "password_reset_tokens"
PASSWORD_RESET_ATTEMPTS_COLLECTION = "password_reset_attempts"
```

- [ ] **Step 3: Write migration 011**

`src/migrations/versions/011_password_reset_tokens_indexes.py`:
```python
from motor.motor_asyncio import AsyncIOMotorDatabase
from pymongo import ASCENDING

from src.database.collections.constants import (
    PASSWORD_RESET_ATTEMPTS_COLLECTION,
    PASSWORD_RESET_TOKENS_COLLECTION,
)

version = "011"
description = "Indexes for password reset tokens and throttle attempts (TTL cleanup)"


async def up(db: AsyncIOMotorDatabase) -> None:
    await db[PASSWORD_RESET_TOKENS_COLLECTION].create_index("token_hash", unique=True)
    await db[PASSWORD_RESET_TOKENS_COLLECTION].create_index("user_id")
    await db[PASSWORD_RESET_TOKENS_COLLECTION].create_index(
        [("expires_at", ASCENDING)], expireAfterSeconds=0
    )
    await db[PASSWORD_RESET_ATTEMPTS_COLLECTION].create_index("key")
    await db[PASSWORD_RESET_ATTEMPTS_COLLECTION].create_index([("created_at", -1)])
    await db[PASSWORD_RESET_ATTEMPTS_COLLECTION].create_index(
        [("expires_at", ASCENDING)], expireAfterSeconds=0
    )
```

(`create_index` is idempotent, satisfying the re-run rule.)

- [ ] **Step 4: Run the full suite to confirm nothing regressed**

Run: `make test`
Expected: all PASS

- [ ] **Step 5: Lint and commit**

```bash
make lint
git add src/core/config.py src/database/collections/constants.py src/migrations/versions/011_password_reset_tokens_indexes.py
git commit -m "feat: password reset config, collections, and TTL index migration 011

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01GoVLQMYzBnNRvAiWSWZUbx"
```

---

### Task 5: Repositories — reset tokens, throttle, revoke-all

**Files:**
- Modify: `src/auth/repository.py` (append after `RefreshTokenRepository`; add one method to `RefreshTokenRepository`; extend the constants import)
- Test: `tests/auth/test_password_reset_repos.py`

**Interfaces:**
- Consumes: the two collection constants from Task 4.
- Produces (Tasks 7–9 depend on these exact signatures):
  - `PasswordResetTokenRepository(db)` — `store(token_hash: str, user_id: str, expires_at: datetime) -> None`, `consume(token_hash: str) -> dict[str, Any] | None`, `invalidate_all_for_user(user_id: str) -> None`
  - `PasswordResetThrottleRepository(db)` — `record_attempt(key: str, expires_at: datetime) -> None`, `count_recent(key: str, since: datetime) -> int`
  - `RefreshTokenRepository.revoke_all_for_user(user_id: str) -> None`

- [ ] **Step 1: Write the failing tests**

```python
# tests/auth/test_password_reset_repos.py
from datetime import UTC, datetime, timedelta

from src.auth.repository import (
    PasswordResetThrottleRepository,
    PasswordResetTokenRepository,
    RefreshTokenRepository,
)


async def test_consume_returns_doc_once_then_none(mock_db):
    repo = PasswordResetTokenRepository(mock_db)
    expires = datetime.now(UTC) + timedelta(minutes=30)
    await repo.store("hash1", "user1", expires_at=expires)

    doc = await repo.consume("hash1")
    assert doc is not None
    assert doc["user_id"] == "user1"

    assert await repo.consume("hash1") is None  # single-use


async def test_consume_unknown_hash_returns_none(mock_db):
    repo = PasswordResetTokenRepository(mock_db)
    assert await repo.consume("nope") is None


async def test_consume_does_not_filter_expired(mock_db):
    # The handler owns the 400-vs-410 split, so consume must return stale docs.
    repo = PasswordResetTokenRepository(mock_db)
    await repo.store("hash1", "user1", expires_at=datetime.now(UTC) - timedelta(minutes=1))
    assert await repo.consume("hash1") is not None


async def test_invalidate_all_removes_unused_tokens(mock_db):
    repo = PasswordResetTokenRepository(mock_db)
    expires = datetime.now(UTC) + timedelta(minutes=30)
    await repo.store("hash1", "user1", expires_at=expires)
    await repo.store("hash2", "user1", expires_at=expires)
    await repo.store("hash3", "other", expires_at=expires)

    await repo.invalidate_all_for_user("user1")
    assert await repo.consume("hash1") is None
    assert await repo.consume("hash2") is None
    assert await repo.consume("hash3") is not None  # other user untouched


async def test_count_recent_only_counts_key_within_window(mock_db):
    repo = PasswordResetThrottleRepository(mock_db)
    now = datetime.now(UTC)
    await repo.record_attempt("a@b.com", expires_at=now + timedelta(hours=1))
    await repo.record_attempt("a@b.com", expires_at=now + timedelta(hours=1))
    await repo.record_attempt("other@b.com", expires_at=now + timedelta(hours=1))

    assert await repo.count_recent("a@b.com", since=now - timedelta(hours=1)) == 2
    assert await repo.count_recent("a@b.com", since=now + timedelta(seconds=5)) == 0


async def test_revoke_all_for_user_deletes_only_their_tokens(mock_db):
    repo = RefreshTokenRepository(mock_db)
    expires = datetime.now(UTC) + timedelta(days=1)
    await repo.store("jti1", "fam1", "user1", expires)
    await repo.store("jti2", "fam2", "user1", expires)
    await repo.store("jti3", "fam3", "other", expires)

    await repo.revoke_all_for_user("user1")
    assert await repo.consume("jti1") is None
    assert await repo.consume("jti2") is None
    assert await repo.consume("jti3") is not None
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `.venv/bin/python -m pytest tests/auth/test_password_reset_repos.py -v`
Expected: FAIL — `ImportError: cannot import name 'PasswordResetTokenRepository'`

- [ ] **Step 3: Implement the repositories**

In `src/auth/repository.py`:

1. Extend the constants import:
```python
from src.database.collections.constants import (
    PASSWORD_RESET_ATTEMPTS_COLLECTION,
    PASSWORD_RESET_TOKENS_COLLECTION,
    REFRESH_TOKENS_COLLECTION,
    USERS_COLLECTION,
)
```

2. Add to `RefreshTokenRepository` (after `revoke_family`):
```python
    async def revoke_all_for_user(self, user_id: str) -> None:
        """Password reset kills every session — all families, all devices."""
        await self._collection.delete_many({"user_id": user_id})
```

3. Append after `RefreshTokenRepository` (plain classes, not `BaseWriteRepository`
   subclasses — same reason `RefreshTokenRepository` isn't one: they need atomic
   `find_one_and_update` / window-count semantics the base ABCs don't expose):
```python
class PasswordResetTokenRepository:
    def __init__(self, db) -> None:
        self._collection = db[PASSWORD_RESET_TOKENS_COLLECTION]

    async def store(self, token_hash: str, user_id: str, expires_at: datetime) -> None:
        await self._collection.insert_one(
            {
                "token_hash": token_hash,
                "user_id": user_id,
                "used": False,
                "expires_at": expires_at,
            }
        )

    async def consume(self, token_hash: str) -> dict[str, Any] | None:
        """Atomically mark an unused token used. Deliberately no expires_at filter —
        the handler distinguishes invalid (None) from expired (stale doc) for the
        400-vs-410 split."""
        return await self._collection.find_one_and_update(
            {"token_hash": token_hash, "used": False},
            {"$set": {"used": True}},
        )

    async def invalidate_all_for_user(self, user_id: str) -> None:
        await self._collection.delete_many({"user_id": user_id, "used": False})


class PasswordResetThrottleRepository:
    """Mongo-backed per-key request throttle; `key` is generic (currently the email)
    so a per-IP variant can reuse the collection via a prefix later."""

    def __init__(self, db) -> None:
        self._collection = db[PASSWORD_RESET_ATTEMPTS_COLLECTION]

    async def record_attempt(self, key: str, expires_at: datetime) -> None:
        await self._collection.insert_one(
            {"key": key, "created_at": datetime.now(UTC), "expires_at": expires_at}
        )

    async def count_recent(self, key: str, since: datetime) -> int:
        return await self._collection.count_documents(
            {"key": key, "created_at": {"$gte": since}}
        )
```

(`datetime`, `UTC`, and `Any` are already imported at the top of the file.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `.venv/bin/python -m pytest tests/auth/test_password_reset_repos.py tests/auth -v`
Expected: new tests PASS, existing auth tests still PASS

- [ ] **Step 5: Lint and commit**

```bash
make lint
git add src/auth/repository.py tests/auth/test_password_reset_repos.py
git commit -m "feat: password reset token + throttle repositories, revoke_all_for_user

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01GoVLQMYzBnNRvAiWSWZUbx"
```

---

### Task 6: Domain errors and API schemas

**Files:**
- Modify: `src/auth/service.py` (add three error classes after `BudgetExceededError`)
- Modify: `src/auth/schemas.py` (append four schemas)

**Interfaces:**
- Produces (Tasks 7–10 depend on these exact names and messages):
  - `InvalidPasswordResetTokenError` (400, "Invalid or already used reset token")
  - `ExpiredPasswordResetTokenError` (410, "Reset link has expired")
  - `TooManyPasswordResetRequestsError` (429, "Too many password reset requests, please try again later")
  - `PasswordResetRequestRequest`, `PasswordResetRequestResponse`, `PasswordResetConfirmRequest`, `PasswordResetConfirmResponse`

These are declarations with no behavior of their own; they're exercised by the handler
tests in Tasks 7–8 (TDD coverage arrives with the first consumer). Commit together with
Task 7 — no separate commit here.

- [ ] **Step 1: Add errors to `src/auth/service.py`** (after `BudgetExceededError`, matching its direct-`AppError` pattern):

```python
class InvalidPasswordResetTokenError(AppError):
    def __init__(self) -> None:
        super().__init__(status_code=400, detail="Invalid or already used reset token")


class ExpiredPasswordResetTokenError(AppError):
    def __init__(self) -> None:
        super().__init__(status_code=410, detail="Reset link has expired")


class TooManyPasswordResetRequestsError(AppError):
    def __init__(self) -> None:
        super().__init__(
            status_code=429,
            detail="Too many password reset requests, please try again later",
        )
```

- [ ] **Step 2: Append schemas to `src/auth/schemas.py`**:

```python
class PasswordResetRequestRequest(AppSchema):
    email: EmailStr


class PasswordResetRequestResponse(AppSchema):
    detail: str = "If an account exists for this email, a password reset link has been sent."


class PasswordResetConfirmRequest(AppSchema):
    token: str = Field(min_length=1)
    new_password: str = Field(min_length=8, max_length=128)


class PasswordResetConfirmResponse(AppSchema):
    detail: str = "Password has been reset successfully."
```

- [ ] **Step 3: Verify imports still resolve**

Run: `.venv/bin/python -c "import src.auth.service, src.auth.schemas" && make lint`
Expected: no output from the import; lint clean. Do not commit yet — Task 7 commits these files with their first tests.

---

### Task 7: RequestPasswordResetCommand + handler

**Files:**
- Create: `src/auth/commands/request_password_reset.py`
- Test: `tests/auth/test_password_reset_commands.py` (created here, extended in Task 8)

**Interfaces:**
- Consumes: `AuthReadRepository.find_by_email`, `PasswordResetTokenRepository`, `PasswordResetThrottleRepository`, `EmailPort`, `EmailDeliveryError`, `TooManyPasswordResetRequestsError`, settings from Task 4.
- Produces: `RequestPasswordResetCommand(email: str)` and `RequestPasswordResetHandler(read_repo, reset_token_repo, throttle_repo, email)` returning `None`. Task 9 registers it; Task 10's endpoint sends it.

- [ ] **Step 1: Write the failing tests**

```python
# tests/auth/test_password_reset_commands.py
import hashlib
from datetime import UTC, datetime

import pytest
from bson import ObjectId

from src.auth.commands.request_password_reset import (
    RequestPasswordResetCommand,
    RequestPasswordResetHandler,
)
from src.auth.repository import (
    AuthReadRepository,
    PasswordResetThrottleRepository,
    PasswordResetTokenRepository,
)
from src.auth.service import TooManyPasswordResetRequestsError
from src.core.config import settings
from src.notifications.errors import EmailDeliveryError
from src.notifications.mock_adapter import MockEmailAdapter
from src.notifications.port import EmailPort


@pytest.fixture
async def known_user(mock_db):
    oid = ObjectId()
    await mock_db["users"].insert_one(
        {
            "_id": oid,
            "email": "known@example.com",
            "password_hash": "x",
            "created_at": datetime.now(UTC),
        }
    )
    return str(oid)


@pytest.fixture
def mock_email_adapter():
    return MockEmailAdapter()


@pytest.fixture
def request_handler(mock_db, mock_email_adapter):
    return RequestPasswordResetHandler(
        read_repo=AuthReadRepository(mock_db),
        reset_token_repo=PasswordResetTokenRepository(mock_db),
        throttle_repo=PasswordResetThrottleRepository(mock_db),
        email=mock_email_adapter,
    )


async def test_request_unknown_email_is_silent_noop(request_handler, mock_email_adapter, mock_db):
    await request_handler.handle(RequestPasswordResetCommand(email="ghost@example.com"))
    assert mock_email_adapter.sent_password_resets == []
    assert await mock_db["password_reset_tokens"].count_documents({}) == 0


async def test_request_known_email_stores_hash_and_sends_link(
    request_handler, mock_email_adapter, mock_db, known_user
):
    await request_handler.handle(RequestPasswordResetCommand(email="known@example.com"))

    [sent] = mock_email_adapter.sent_password_resets
    assert sent["to"] == "known@example.com"
    assert sent["reset_link"].startswith(f"{settings.frontend_base_url}/reset-password?token=")

    doc = await mock_db["password_reset_tokens"].find_one({"user_id": known_user})
    assert doc is not None
    raw_token = sent["reset_link"].split("token=", 1)[1]
    # the stored value is the sha256 of the raw token — catches a raw/hash swap
    assert doc["token_hash"] == hashlib.sha256(raw_token.encode()).hexdigest()
    assert doc["token_hash"] != raw_token  # never store the raw value


async def test_second_request_invalidates_first_token(
    request_handler, mock_email_adapter, mock_db, known_user
):
    await request_handler.handle(RequestPasswordResetCommand(email="known@example.com"))
    await request_handler.handle(RequestPasswordResetCommand(email="known@example.com"))

    first_link = mock_email_adapter.sent_password_resets[0]["reset_link"]
    first_hash = hashlib.sha256(first_link.split("token=", 1)[1].encode()).hexdigest()
    repo = PasswordResetTokenRepository(mock_db)
    assert await repo.consume(first_hash) is None  # gone
    assert await mock_db["password_reset_tokens"].count_documents({}) == 1


async def test_request_rate_limited_after_max_attempts(request_handler):
    for _ in range(settings.password_reset_rate_limit_max_attempts):
        await request_handler.handle(RequestPasswordResetCommand(email="ghost@example.com"))
    with pytest.raises(TooManyPasswordResetRequestsError):
        await request_handler.handle(RequestPasswordResetCommand(email="ghost@example.com"))


async def test_email_delivery_failure_is_swallowed(mock_db, known_user):
    class FailingEmailAdapter(EmailPort):
        async def send_password_reset(self, to: str, reset_link: str) -> None:
            raise EmailDeliveryError()

        async def close(self) -> None:
            return None

    handler = RequestPasswordResetHandler(
        read_repo=AuthReadRepository(mock_db),
        reset_token_repo=PasswordResetTokenRepository(mock_db),
        throttle_repo=PasswordResetThrottleRepository(mock_db),
        email=FailingEmailAdapter(),
    )
    # must not raise — enumeration safety: a provider outage only errors for
    # existing accounts, so the endpoint answers 200 either way
    await handler.handle(RequestPasswordResetCommand(email="known@example.com"))
    assert await mock_db["password_reset_tokens"].count_documents({"user_id": known_user}) == 1
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `.venv/bin/python -m pytest tests/auth/test_password_reset_commands.py -v`
Expected: FAIL — `ModuleNotFoundError` on `src.auth.commands.request_password_reset`

- [ ] **Step 3: Implement the command + handler**

`src/auth/commands/request_password_reset.py`:
```python
import hashlib
import secrets
from datetime import UTC, datetime, timedelta

import structlog

from src.auth.repository import (
    AuthReadRepository,
    PasswordResetThrottleRepository,
    PasswordResetTokenRepository,
)
from src.auth.service import TooManyPasswordResetRequestsError
from src.core.config import settings
from src.cqrs.commands import BaseCommand, CommandHandler
from src.notifications.errors import EmailDeliveryError
from src.notifications.port import EmailPort

logger = structlog.stdlib.get_logger(__name__)


class RequestPasswordResetCommand(BaseCommand):
    email: str


class RequestPasswordResetHandler(CommandHandler[RequestPasswordResetCommand, None]):
    def __init__(
        self,
        read_repo: AuthReadRepository,
        reset_token_repo: PasswordResetTokenRepository,
        throttle_repo: PasswordResetThrottleRepository,
        email: EmailPort,
    ) -> None:
        self._read_repo = read_repo
        self._reset_token_repo = reset_token_repo
        self._throttle_repo = throttle_repo
        self._email = email

    async def handle(self, command: RequestPasswordResetCommand) -> None:
        now = datetime.now(UTC)
        window = timedelta(seconds=settings.password_reset_rate_limit_window_seconds)

        # Throttle before the existence check, and record every call (throttled or
        # unknown email alike) — identical behavior for known and unknown emails is
        # what keeps the 429 from leaking account existence.
        recent = await self._throttle_repo.count_recent(command.email, since=now - window)
        await self._throttle_repo.record_attempt(command.email, expires_at=now + window)
        if recent >= settings.password_reset_rate_limit_max_attempts:
            raise TooManyPasswordResetRequestsError()

        user_doc = await self._read_repo.find_by_email(command.email)
        if user_doc is None:
            return  # enumeration-safe no-op

        raw_token = secrets.token_urlsafe(32)
        token_hash = hashlib.sha256(raw_token.encode()).hexdigest()
        user_id = str(user_doc["_id"])

        # Only one live token per user: a new request supersedes older links.
        await self._reset_token_repo.invalidate_all_for_user(user_id)
        ttl = timedelta(minutes=settings.password_reset_token_ttl_minutes)
        await self._reset_token_repo.store(token_hash, user_id, expires_at=now + ttl)

        reset_link = f"{settings.frontend_base_url}/reset-password?token={raw_token}"
        try:
            await self._email.send_password_reset(to=command.email, reset_link=reset_link)
        except EmailDeliveryError:
            # A provider outage only errors for existing accounts (unknown emails never
            # reach the send), so surfacing it would be an enumeration oracle. Log it;
            # the endpoint answers 200 and the user can retry.
            logger.error("password reset email delivery failed", email=command.email)
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `.venv/bin/python -m pytest tests/auth/test_password_reset_commands.py -v`
Expected: 5 PASS

- [ ] **Step 5: Lint and commit (includes Task 6's files)**

```bash
make lint
git add src/auth/service.py src/auth/schemas.py src/auth/commands/request_password_reset.py tests/auth/test_password_reset_commands.py
git commit -m "feat: request-password-reset command — throttle, hashed token, reset email

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01GoVLQMYzBnNRvAiWSWZUbx"
```

---

### Task 8: ConfirmPasswordResetCommand + handler

**Files:**
- Create: `src/auth/commands/confirm_password_reset.py`
- Test: `tests/auth/test_password_reset_commands.py` (append)

**Interfaces:**
- Consumes: `AuthWriteRepository.update(id, {...})`, `PasswordResetTokenRepository.consume/invalidate_all_for_user`, `RefreshTokenRepository.revoke_all_for_user`, `hash_password` from `src.core.security`, the 400/410 errors from Task 6.
- Produces: `ConfirmPasswordResetCommand(token: str, new_password: str)` and `ConfirmPasswordResetHandler(write_repo, reset_token_repo, refresh_token_repo)` returning `None`.

- [ ] **Step 1: Append the failing tests**

Append to `tests/auth/test_password_reset_commands.py` (extend the top-of-file imports
with the names used below: `timedelta` from `datetime`, `ConfirmPasswordResetCommand`,
`ConfirmPasswordResetHandler` from `src.auth.commands.confirm_password_reset`,
`AuthWriteRepository`, `RefreshTokenRepository` from `src.auth.repository`,
`ExpiredPasswordResetTokenError`, `InvalidPasswordResetTokenError` from
`src.auth.service`, and `verify_password` from `src.core.security`):

```python
@pytest.fixture
def confirm_handler(mock_db):
    return ConfirmPasswordResetHandler(
        write_repo=AuthWriteRepository(mock_db),
        reset_token_repo=PasswordResetTokenRepository(mock_db),
        refresh_token_repo=RefreshTokenRepository(mock_db),
    )


async def _issue_token(request_handler, mock_email_adapter) -> str:
    """Run the request flow and return the raw token from the captured link."""
    await request_handler.handle(RequestPasswordResetCommand(email="known@example.com"))
    link = mock_email_adapter.sent_password_resets[-1]["reset_link"]
    return link.split("token=", 1)[1]


async def test_confirm_updates_password_and_revokes_sessions(
    request_handler, confirm_handler, mock_email_adapter, mock_db, known_user
):
    refresh_repo = RefreshTokenRepository(mock_db)
    await refresh_repo.store(
        "jti1", "fam1", known_user, datetime.now(UTC) + timedelta(days=1)
    )
    raw_token = await _issue_token(request_handler, mock_email_adapter)

    await confirm_handler.handle(
        ConfirmPasswordResetCommand(token=raw_token, new_password="new-password-123")
    )

    user = await mock_db["users"].find_one({"_id": ObjectId(known_user)})
    assert verify_password("new-password-123", user["password_hash"])
    assert await refresh_repo.consume("jti1") is None  # all sessions revoked


async def test_confirm_garbage_token_raises_invalid(confirm_handler):
    with pytest.raises(InvalidPasswordResetTokenError):
        await confirm_handler.handle(
            ConfirmPasswordResetCommand(token="garbage", new_password="new-password-123")
        )


async def test_confirm_same_token_twice_raises_invalid(
    request_handler, confirm_handler, mock_email_adapter, known_user
):
    raw_token = await _issue_token(request_handler, mock_email_adapter)
    await confirm_handler.handle(
        ConfirmPasswordResetCommand(token=raw_token, new_password="new-password-123")
    )
    with pytest.raises(InvalidPasswordResetTokenError):
        await confirm_handler.handle(
            ConfirmPasswordResetCommand(token=raw_token, new_password="other-password-123")
        )


async def test_confirm_expired_token_raises_expired(
    request_handler, confirm_handler, mock_email_adapter, mock_db, known_user
):
    raw_token = await _issue_token(request_handler, mock_email_adapter)
    await mock_db["password_reset_tokens"].update_many(
        {}, {"$set": {"expires_at": datetime.now(UTC) - timedelta(minutes=1)}}
    )
    with pytest.raises(ExpiredPasswordResetTokenError):
        await confirm_handler.handle(
            ConfirmPasswordResetCommand(token=raw_token, new_password="new-password-123")
        )
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `.venv/bin/python -m pytest tests/auth/test_password_reset_commands.py -v`
Expected: new tests FAIL — `ModuleNotFoundError` on `src.auth.commands.confirm_password_reset`; Task 7's 5 still PASS

- [ ] **Step 3: Implement the command + handler**

`src/auth/commands/confirm_password_reset.py`:
```python
import hashlib
from datetime import UTC, datetime

from src.auth.repository import (
    AuthWriteRepository,
    PasswordResetTokenRepository,
    RefreshTokenRepository,
)
from src.auth.service import ExpiredPasswordResetTokenError, InvalidPasswordResetTokenError
from src.core.security import hash_password
from src.cqrs.commands import BaseCommand, CommandHandler


class ConfirmPasswordResetCommand(BaseCommand):
    token: str
    new_password: str


class ConfirmPasswordResetHandler(CommandHandler[ConfirmPasswordResetCommand, None]):
    def __init__(
        self,
        write_repo: AuthWriteRepository,
        reset_token_repo: PasswordResetTokenRepository,
        refresh_token_repo: RefreshTokenRepository,
    ) -> None:
        self._write_repo = write_repo
        self._reset_token_repo = reset_token_repo
        self._refresh_token_repo = refresh_token_repo

    async def handle(self, command: ConfirmPasswordResetCommand) -> None:
        token_hash = hashlib.sha256(command.token.encode()).hexdigest()
        doc = await self._reset_token_repo.consume(token_hash)
        if doc is None:
            raise InvalidPasswordResetTokenError()

        # PyMongo returns naive UTC datetimes by default; normalise before comparing.
        expires_at: datetime = doc["expires_at"]
        if expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=UTC)
        if expires_at < datetime.now(UTC):
            raise ExpiredPasswordResetTokenError()

        user_id: str = doc["user_id"]
        await self._write_repo.update(
            user_id, {"password_hash": hash_password(command.new_password)}
        )
        # Kill every existing session — a reset must lock out whoever held the old
        # password — and clear any remaining reset tokens as defense-in-depth.
        await self._refresh_token_repo.revoke_all_for_user(user_id)
        await self._reset_token_repo.invalidate_all_for_user(user_id)
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `.venv/bin/python -m pytest tests/auth/test_password_reset_commands.py -v`
Expected: 9 PASS

- [ ] **Step 5: Lint and commit**

```bash
make lint
git add src/auth/commands/confirm_password_reset.py tests/auth/test_password_reset_commands.py
git commit -m "feat: confirm-password-reset command — single-use token, session revocation

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01GoVLQMYzBnNRvAiWSWZUbx"
```

---

### Task 9: Wiring — EmailDep, main.py lifespan + mediator, conftest

**Files:**
- Modify: `src/core/dependencies.py`
- Modify: `src/main.py`
- Modify: `tests/conftest.py`

**Interfaces:**
- Consumes: everything from Tasks 1, 3, 7, 8.
- Produces: `EmailDep` annotated dep; `_wire_mediator(mediator, llm, email, db)` (**breaking signature change** — `email: EmailPort` inserted after `llm`); `app.state.email`; conftest `mock_email` fixture returning the `MockEmailAdapter`. Task 10's tests use `mock_email`.

There is no new behavior to TDD here — this task is verified by the full suite passing
(the `_wire_mediator` signature change breaks `tests/conftest.py::app` until it's
updated, which every HTTP test exercises).

- [ ] **Step 1: Add `EmailDep` to `src/core/dependencies.py`**

Extend the `TYPE_CHECKING` block:
```python
if TYPE_CHECKING:
    from src.llm.port import LLMPort
    from src.notifications.port import EmailPort
```

Append at the end (mirroring `get_llm`/`LLMDep`):
```python
def get_email(request: Request) -> "EmailPort":
    return request.app.state.email


EmailDep = Annotated["EmailPort", Depends(get_email)]
```

- [ ] **Step 2: Update `src/main.py`**

Add imports (with the other `src.*` imports):
```python
from src.auth.commands.confirm_password_reset import (
    ConfirmPasswordResetCommand,
    ConfirmPasswordResetHandler,
)
from src.auth.commands.request_password_reset import (
    RequestPasswordResetCommand,
    RequestPasswordResetHandler,
)
from src.auth.repository import (  # extend the existing import
    PasswordResetThrottleRepository,
    PasswordResetTokenRepository,
)
from src.notifications.port import EmailPort
from src.notifications.resend_adapter import ResendEmailAdapter
```

Change `_wire_mediator`'s signature:
```python
def _wire_mediator(
    mediator: Mediator, llm: LLMPort, email: EmailPort, db: AsyncIOMotorDatabase
) -> None:
```

Inside `_wire_mediator`, after the existing auth registrations (below the
`GetUserByEmailQuery` line), add:
```python
    reset_token_repo = PasswordResetTokenRepository(db)
    reset_throttle_repo = PasswordResetThrottleRepository(db)
    # Fresh instance is fine — a stateless wrapper around db[collection], same as the
    # one lifespan() puts on app.state.
    refresh_token_repo = RefreshTokenRepository(db)
    mediator.register_command(
        RequestPasswordResetCommand,
        RequestPasswordResetHandler(user_read_repo, reset_token_repo, reset_throttle_repo, email),
    )
    mediator.register_command(
        ConfirmPasswordResetCommand,
        ConfirmPasswordResetHandler(user_write_repo, reset_token_repo, refresh_token_repo),
    )
```

In `lifespan()`, after the LLM adapter block (`app.state.llm = llm_adapter`), add:
```python
    if settings.resend_api_key:
        email_adapter: EmailPort = ResendEmailAdapter(
            api_key=settings.resend_api_key, from_address=settings.email_from
        )
        logger.info("email adapter initialised", adapter="resend")
    else:
        from src.notifications.console_adapter import ConsoleEmailAdapter

        email_adapter = ConsoleEmailAdapter()
        logger.info("email adapter initialised", adapter="console")
    app.state.email = email_adapter
```

Update the wiring call: `_wire_mediator(mediator, llm_adapter, email_adapter, get_database())`.

In the shutdown section, after `await llm_adapter.close()`:
```python
    await email_adapter.close()
```

- [ ] **Step 3: Update `tests/conftest.py`**

In the `app` fixture, add `from src.notifications.mock_adapter import MockEmailAdapter`
to the local imports, then:
```python
    mediator = Mediator()
    mock_llm = MockLLMAdapter()
    mock_email = MockEmailAdapter()
    _wire_mediator(mediator, mock_llm, mock_email, mock_db)

    app.state.mediator = mediator
    app.state.refresh_token_repo = RefreshTokenRepository(mock_db)
    app.state.llm = mock_llm
    app.state.email = mock_email
    return app
```

Add after the `client` fixture:
```python
@pytest.fixture
async def mock_email(app):
    return app.state.email
```

- [ ] **Step 4: Run the full suite**

Run: `make test`
Expected: all PASS — this proves the signature change is propagated everywhere.

- [ ] **Step 5: Lint, typecheck, and commit**

```bash
make lint && make typecheck
git add src/core/dependencies.py src/main.py tests/conftest.py
git commit -m "feat: wire email adapter — EmailDep, lifespan selection, mediator registrations

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01GoVLQMYzBnNRvAiWSWZUbx"
```

---

### Task 10: Router endpoints + HTTP integration tests

**Files:**
- Modify: `src/auth/router.py`
- Test: `tests/auth/test_password_reset_router.py`

**Interfaces:**
- Consumes: the two commands, the four schemas, `MediatorDep`, conftest's `client` + `mock_email` fixtures.
- Produces: `POST /api/v1/auth/forgot-password`, `POST /api/v1/auth/reset-password`.

- [ ] **Step 1: Write the failing tests**

```python
# tests/auth/test_password_reset_router.py
from src.core.config import settings

EMAIL = "resetme@example.com"
PASSWORD = "originalpassword1"


async def _register(client, email=EMAIL, password=PASSWORD):
    resp = await client.post("/api/v1/auth/register", json={"email": email, "password": password})
    assert resp.status_code == 201, resp.text
    return resp.json()


async def _raw_token(mock_email) -> str:
    link = mock_email.sent_password_resets[-1]["reset_link"]
    return link.split("token=", 1)[1]


async def test_forgot_password_same_response_for_known_and_unknown(client, mock_email):
    await _register(client)
    known = await client.post("/api/v1/auth/forgot-password", json={"email": EMAIL})
    unknown = await client.post(
        "/api/v1/auth/forgot-password", json={"email": "ghost@example.com"}
    )
    assert known.status_code == unknown.status_code == 200
    assert known.json() == unknown.json()
    assert len(mock_email.sent_password_resets) == 1  # only the known email got one


async def test_forgot_password_rate_limited_returns_429(client):
    for _ in range(settings.password_reset_rate_limit_max_attempts):
        resp = await client.post("/api/v1/auth/forgot-password", json={"email": EMAIL})
        assert resp.status_code == 200
    resp = await client.post("/api/v1/auth/forgot-password", json={"email": EMAIL})
    assert resp.status_code == 429


async def test_full_reset_flow(client, mock_email):
    await _register(client)
    resp = await client.post("/api/v1/auth/forgot-password", json={"email": EMAIL})
    assert resp.status_code == 200

    token = await _raw_token(mock_email)
    resp = await client.post(
        "/api/v1/auth/reset-password",
        json={"token": token, "new_password": "brandnewpassword1"},
    )
    assert resp.status_code == 200

    old_login = await client.post(
        "/api/v1/auth/login", json={"email": EMAIL, "password": PASSWORD}
    )
    assert old_login.status_code == 401
    new_login = await client.post(
        "/api/v1/auth/login", json={"email": EMAIL, "password": "brandnewpassword1"}
    )
    assert new_login.status_code == 200


async def test_reset_revokes_existing_refresh_tokens(client, mock_email):
    tokens = await _register(client)
    await client.post("/api/v1/auth/forgot-password", json={"email": EMAIL})
    raw = await _raw_token(mock_email)
    resp = await client.post(
        "/api/v1/auth/reset-password", json={"token": raw, "new_password": "brandnewpassword1"}
    )
    assert resp.status_code == 200

    refresh = await client.post(
        "/api/v1/auth/refresh", json={"refresh_token": tokens["refresh_token"]}
    )
    assert refresh.status_code == 401


async def test_reset_with_invalid_token_returns_400(client):
    resp = await client.post(
        "/api/v1/auth/reset-password",
        json={"token": "garbage", "new_password": "brandnewpassword1"},
    )
    assert resp.status_code == 400


async def test_reset_with_reused_token_returns_400(client, mock_email):
    await _register(client)
    await client.post("/api/v1/auth/forgot-password", json={"email": EMAIL})
    token = await _raw_token(mock_email)
    first = await client.post(
        "/api/v1/auth/reset-password", json={"token": token, "new_password": "brandnewpassword1"}
    )
    assert first.status_code == 200
    second = await client.post(
        "/api/v1/auth/reset-password", json={"token": token, "new_password": "otherpassword12"}
    )
    assert second.status_code == 400


async def test_reset_with_expired_token_returns_410(client, mock_email, mock_db):
    from datetime import UTC, datetime, timedelta

    await _register(client)
    await client.post("/api/v1/auth/forgot-password", json={"email": EMAIL})
    token = await _raw_token(mock_email)
    await mock_db["password_reset_tokens"].update_many(
        {}, {"$set": {"expires_at": datetime.now(UTC) - timedelta(minutes=1)}}
    )
    resp = await client.post(
        "/api/v1/auth/reset-password", json={"token": token, "new_password": "brandnewpassword1"}
    )
    assert resp.status_code == 410
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `.venv/bin/python -m pytest tests/auth/test_password_reset_router.py -v`
Expected: FAIL — 404s (routes don't exist yet)

- [ ] **Step 3: Add the routes**

In `src/auth/router.py`, extend the imports:
```python
from src.auth.commands.confirm_password_reset import ConfirmPasswordResetCommand
from src.auth.commands.request_password_reset import RequestPasswordResetCommand
```
and add the four schemas to the existing `src.auth.schemas` import
(`PasswordResetConfirmRequest`, `PasswordResetConfirmResponse`,
`PasswordResetRequestRequest`, `PasswordResetRequestResponse`).

Append the routes (both unauthenticated, both delegate to the mediator; no
`AuthService` — no tokens are issued, the user logs in again after resetting):
```python
@router.post("/forgot-password", response_model=PasswordResetRequestResponse)
async def forgot_password(
    body: PasswordResetRequestRequest, mediator: MediatorDep
) -> PasswordResetRequestResponse:
    await mediator.send(RequestPasswordResetCommand(email=body.email))
    return PasswordResetRequestResponse()


@router.post("/reset-password", response_model=PasswordResetConfirmResponse)
async def reset_password(
    body: PasswordResetConfirmRequest, mediator: MediatorDep
) -> PasswordResetConfirmResponse:
    await mediator.send(
        ConfirmPasswordResetCommand(token=body.token, new_password=body.new_password)
    )
    return PasswordResetConfirmResponse()
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `.venv/bin/python -m pytest tests/auth/test_password_reset_router.py -v`
Expected: 7 PASS

- [ ] **Step 5: Lint and commit**

```bash
make lint
git add src/auth/router.py tests/auth/test_password_reset_router.py
git commit -m "feat: forgot-password and reset-password endpoints

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01GoVLQMYzBnNRvAiWSWZUbx"
```

---

### Task 11: Final verification

**Files:** none created — checks only.

- [ ] **Step 1: Full gate**

Run: `make lint && make typecheck && make test`
Expected: lint clean; typecheck may report the 5 pre-existing errors noted in the docs
audit (memory: typecheck is out of CI) — flag any NEW errors, don't fix pre-existing
ones; all tests pass.

- [ ] **Step 2: Manual console-adapter flow**

With MongoDB running (`make docker-up` in another terminal if needed) and no
`RESEND_API_KEY` in the environment/.env, run `make dev`, then:
```bash
curl -s -X POST localhost:8000/api/v1/auth/register -H 'content-type: application/json' \
  -d '{"email": "manual@example.com", "password": "manualpassword1"}'
curl -s -X POST localhost:8000/api/v1/auth/forgot-password -H 'content-type: application/json' \
  -d '{"email": "manual@example.com"}'
# copy the reset link from the server log line "password reset email (console)"
curl -s -X POST localhost:8000/api/v1/auth/reset-password -H 'content-type: application/json' \
  -d '{"token": "<token from log>", "new_password": "resetpassword1"}'
curl -s -X POST localhost:8000/api/v1/auth/login -H 'content-type: application/json' \
  -d '{"email": "manual@example.com", "password": "resetpassword1"}'
```
Expected: 201, 200 (generic detail), 200 (reset success), 200 (login with new password).

- [ ] **Step 3: Real Resend delivery check (needs the user's key — ask, don't hunt for it)**

Set `RESEND_API_KEY` in `.env`, restart `make dev`, repeat the forgot-password call with
a real inbox address the user controls. Expected: log line `password reset email sent`
with a `message_id`; email arrives with working button; DKIM/SPF pass (check "show
original" in Gmail); not in spam. Then remove nothing — the key stays in `.env` (which
is gitignored; verify with `git check-ignore .env`).

- [ ] **Step 4: Report**

Report results of all three checks to the user, including the exact test count and any
typecheck deltas. Do not push or merge — the user decides integration (see
superpowers:finishing-a-development-branch).
