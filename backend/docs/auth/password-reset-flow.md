# Password Reset Flow

> **Status: Unimplemented plan (verified 2026-09-10).** Nothing described here exists in
> the code — no `src/notifications/`, no reset endpoints, no token collections — on any
> branch. Migration numbers below say "next free" because 008/009 were taken since this
> was written.

## Context

The auth domain (`src/auth/`) supports register/login/refresh/logout but has no way for a
user who forgets their password to regain access — the only path back in today is
re-registering, which fails on the unique email index. This adds a standard
request-reset-email → confirm-with-token flow, consistent with the existing JWT
access/refresh + rotation design already in the auth domain.

Decisions confirmed with the user up front:
- **Email delivery**: build an `EmailPort` abstraction now (mirroring `src/llm/`'s
  `LLMPort`), with a console/log adapter for dev and a mock adapter for tests. A real
  provider (SendGrid/SES/SMTP) is explicitly out of scope for this change.
- **Rate limiting**: add a simple in-house Mongo-backed per-email throttle on the
  request-reset endpoint (no external dependency).
- **Reset link**: add a `frontend_base_url` setting; link is
  `{frontend_base_url}/reset-password?token=...`.

## Domain placement

Extend `src/auth/` — reset is fully coupled to the `users` collection and to
`RefreshTokenRepository`, which already live there; a separate `src/password_reset/`
domain would just re-wrap the same collection. Email sending is cross-cutting
infrastructure with no persistence/CQRS/router of its own, so it goes in a new
`src/notifications/` package, mirroring `src/llm/`'s port/adapter split.

## Token scheme (deliberate deviation from refresh tokens)

- Generate with `secrets.token_urlsafe(32)`, store only
  `hashlib.sha256(raw_token.encode()).hexdigest()` in Mongo — **never the raw value**.
- Unlike a refresh token's `jti` (a lookup key nested inside a signed JWT — useless to an
  attacker without `jwt_secret_key`), a reset token *is* the entire bearer secret and
  travels as a URL query param (browser history, proxy/access logs, email logs). Hashing
  at rest means a DB read alone can't be used to reset a password.
- Single-use enforced via the same atomic `find_one_and_update` `used` flag pattern as
  `RefreshTokenRepository.consume`. No JWT needed for the token itself.
- TTL: 30 min default, configurable.

## New files

**`src/notifications/`** (new package, no email infra existed before):
- `port.py` — `EmailPort(ABC)`: `async def send_password_reset(self, to: str, reset_link: str) -> None`, `async def close(self) -> None`
- `console_adapter.py` — `ConsoleEmailAdapter(EmailPort)`: logs `to`/`reset_link` via structlog instead of sending; comment noting a real provider replaces this later
- `mock_adapter.py` — `MockEmailAdapter(EmailPort)`: appends `{"to", "reset_link"}` to `self.sent_password_resets` for test assertions

**`src/migrations/versions/NNN_password_reset_tokens_indexes.py`** (NNN = next free
number — 011 as of 2026-09) — mirrors `001_initial_indexes.py`'s TTL pattern:
```python
version = "NNN"  # match the filename prefix
async def up(db):
    await db[PASSWORD_RESET_TOKENS_COLLECTION].create_index("token_hash", unique=True)
    await db[PASSWORD_RESET_TOKENS_COLLECTION].create_index("user_id")
    await db[PASSWORD_RESET_TOKENS_COLLECTION].create_index([("expires_at", ASCENDING)], expireAfterSeconds=0)
    await db[PASSWORD_RESET_ATTEMPTS_COLLECTION].create_index("key")
    await db[PASSWORD_RESET_ATTEMPTS_COLLECTION].create_index([("created_at", -1)])
    await db[PASSWORD_RESET_ATTEMPTS_COLLECTION].create_index([("expires_at", ASCENDING)], expireAfterSeconds=0)
```
(`docs/database/db_migrations.md` documents the runner/pattern generically, not each migration — no update needed there.)

**`src/auth/commands/request_password_reset.py`**:
```python
class RequestPasswordResetCommand(BaseCommand):
    email: str

class RequestPasswordResetHandler(CommandHandler[RequestPasswordResetCommand, None]):
    def __init__(self, read_repo: AuthReadRepository, reset_token_repo: PasswordResetTokenRepository,
                 throttle_repo: PasswordResetThrottleRepository, email: EmailPort) -> None: ...
    async def handle(self, command) -> None:
        # 1. throttle check FIRST, before existence check — count_recent(command.email, window_start)
        #    >= settings.password_reset_rate_limit_max_attempts -> raise TooManyPasswordResetRequestsError()
        #    then record_attempt(command.email, expires_at=now+window) unconditionally on every call
        #    (throttled or not existing) so the 429 never leaks account existence.
        # 2. user_doc = read_repo.find_by_email(command.email); if None: return (enumeration-safe no-op)
        # 3. raw_token = secrets.token_urlsafe(32); token_hash = sha256(raw_token)
        # 4. reset_token_repo.invalidate_all_for_user(user_id)  # only one live token per user
        # 5. reset_token_repo.store(token_hash, user_id, expires_at=now+ttl)
        # 6. reset_link = f"{settings.frontend_base_url}/reset-password?token={raw_token}"
        # 7. email.send_password_reset(to=command.email, reset_link=reset_link)
```
No email-case normalization — the rest of the codebase (register/login) doesn't lowercase
emails either, so don't introduce inconsistent behavior here.

**`src/auth/commands/confirm_password_reset.py`**:
```python
class ConfirmPasswordResetCommand(BaseCommand):
    token: str
    new_password: str

class ConfirmPasswordResetHandler(CommandHandler[ConfirmPasswordResetCommand, None]):
    def __init__(self, write_repo: AuthWriteRepository, reset_token_repo: PasswordResetTokenRepository,
                 refresh_token_repo: RefreshTokenRepository) -> None: ...
    async def handle(self, command) -> None:
        # 1. token_hash = sha256(command.token)
        # 2. doc = reset_token_repo.consume(token_hash)  # atomic used-flag flip
        #    if doc is None: raise InvalidPasswordResetTokenError()   # unknown or already-used -> 400
        #    if doc["expires_at"] < now: raise ExpiredPasswordResetTokenError()  # 410
        # 3. write_repo.update(doc["user_id"], {"password_hash": hash_password(command.new_password)})
        # 4. refresh_token_repo.revoke_all_for_user(doc["user_id"])  # kill every existing session
        # 5. reset_token_repo.invalidate_all_for_user(doc["user_id"])  # defense-in-depth cleanup
```

## Modified files

**`src/database/collections/constants.py`** — add
`PASSWORD_RESET_TOKENS_COLLECTION = "password_reset_tokens"`,
`PASSWORD_RESET_ATTEMPTS_COLLECTION = "password_reset_attempts"`.

**`src/auth/repository.py`** — add two plain classes (not `BaseWriteRepository` subclasses,
same reason `RefreshTokenRepository` isn't one — they need atomic
`find_one_and_update`/window-count semantics the base ABCs don't expose):
```python
class PasswordResetTokenRepository:
    def __init__(self, db): self._collection = db[PASSWORD_RESET_TOKENS_COLLECTION]
    async def store(self, token_hash: str, user_id: str, expires_at: datetime) -> None: ...
    async def consume(self, token_hash: str) -> dict | None:
        # find_one_and_update({"token_hash": ..., "used": False}, {"$set": {"used": True}})
        # Does NOT filter on expires_at, so handler can distinguish "invalid" (None)
        # from "expired" (doc found but stale) for the 400 vs 410 split.
    async def invalidate_all_for_user(self, user_id: str) -> None:
        # delete_many({"user_id": user_id, "used": False})

class PasswordResetThrottleRepository:
    def __init__(self, db): self._collection = db[PASSWORD_RESET_ATTEMPTS_COLLECTION]
    async def record_attempt(self, key: str, expires_at: datetime) -> None:
        # insert_one({"key": key, "created_at": now, "expires_at": expires_at})
    async def count_recent(self, key: str, since: datetime) -> int:
        # count_documents({"key": key, "created_at": {"$gte": since}})
```
`key` is a generic string (not `email`) so a per-IP variant can reuse the collection later
via a prefix without a schema change — not built now, v1 is per-email only.

Also add to `RefreshTokenRepository`:
```python
async def revoke_all_for_user(self, user_id: str) -> None:
    await self._collection.delete_many({"user_id": user_id})
```

**`src/auth/service.py`** — add three `AppError` subclasses (same pattern as
`EmailAlreadyExistsError`/`InvalidCredentialsError` already in this file, and matching
`LLMRateLimitError`'s precedent of setting a custom status directly on `AppError` — no
generic core `RateLimitError` exists and none is needed for a single call site):
```python
class InvalidPasswordResetTokenError(AppError):      # 400
class ExpiredPasswordResetTokenError(AppError):       # 410
class TooManyPasswordResetRequestsError(AppError):    # 429
```

**`src/auth/schemas.py`** — add:
```python
class PasswordResetRequestRequest(AppSchema):
    email: EmailStr

class PasswordResetRequestResponse(AppSchema):
    detail: str = "If an account exists for this email, a password reset link has been sent."

class PasswordResetConfirmRequest(AppSchema):
    token: str
    new_password: str = Field(min_length=8, max_length=128)

class PasswordResetConfirmResponse(AppSchema):
    detail: str = "Password has been reset successfully."
```

**`src/auth/router.py`** — add two routes, both bypassing `AuthService` (no tokens issued;
confirm requires logging in again with the new password since all sessions are revoked):
```python
@router.post("/forgot-password", status_code=200)
async def forgot_password(body: PasswordResetRequestRequest, mediator: MediatorDep) -> PasswordResetRequestResponse:
    await mediator.send(RequestPasswordResetCommand(email=body.email))
    return PasswordResetRequestResponse()

@router.post("/reset-password", status_code=200)
async def reset_password(body: PasswordResetConfirmRequest, mediator: MediatorDep) -> PasswordResetConfirmResponse:
    await mediator.send(ConfirmPasswordResetCommand(token=body.token, new_password=body.new_password))
    return PasswordResetConfirmResponse()
```
`forgot-password` always returns 200 regardless of whether the email exists (enumeration
safety) — 429 only fires from the throttle, which fires identically for known/unknown
emails so it doesn't leak existence either.

**`src/core/config.py`** — add:
```python
# Frontend
frontend_base_url: str = "http://localhost:3000"

# Password reset
password_reset_token_ttl_minutes: int = 30
password_reset_rate_limit_window_seconds: int = 3600
password_reset_rate_limit_max_attempts: int = 5
```

**`src/core/dependencies.py`** — mirror `get_llm`/`LLMDep` exactly:
```python
if TYPE_CHECKING:
    from src.notifications.port import EmailPort
...
def get_email(request: Request) -> "EmailPort":
    return request.app.state.email

EmailDep = Annotated["EmailPort", Depends(get_email)]
```

**`src/main.py`**:
- In `lifespan()`, after the LLM adapter block: construct
  `email_adapter: EmailPort = ConsoleEmailAdapter()`, log
  `"email adapter initialised", adapter="console"`, set `app.state.email = email_adapter`;
  add `await email_adapter.close()` to shutdown alongside `llm_adapter.close()`.
- `_wire_mediator(mediator: Mediator, llm: LLMPort, email: EmailPort, db: AsyncIOMotorDatabase) -> None` —
  add the `email` param (breaking signature change; update the `lifespan()` call site and
  `tests/conftest.py::app`). Inside, alongside the existing `user_write_repo`/`user_read_repo`
  locals, add:
  ```python
  reset_token_repo = PasswordResetTokenRepository(db)
  reset_throttle_repo = PasswordResetThrottleRepository(db)
  refresh_token_repo = RefreshTokenRepository(db)  # fresh instance is fine — it's a
      # stateless wrapper around db[collection], same as the one lifespan() puts on
      # app.state; no need to thread a shared instance through
  mediator.register_command(RequestPasswordResetCommand,
      RequestPasswordResetHandler(user_read_repo, reset_token_repo, reset_throttle_repo, email))
  mediator.register_command(ConfirmPasswordResetCommand,
      ConfirmPasswordResetHandler(user_write_repo, reset_token_repo, refresh_token_repo))
  ```

**`tests/conftest.py`** — in the `app` fixture: create `mock_email = MockEmailAdapter()`,
call `_wire_mediator(mediator, mock_llm, mock_email, mock_db)` (new signature), set
`app.state.email = mock_email`. Add:
```python
@pytest.fixture
async def mock_email(app):
    return app.state.email
```

## Tests

**`tests/auth/test_password_reset_commands.py`** (handler-level, mirrors
`tests/auth/test_commands.py` — construct repos from `mock_db` + a local
`MockEmailAdapter()`, instantiate handlers directly):
- unknown email → silent no-op, no token doc, no email sent
- known email → token doc stored with `token_hash` (not raw), email captured with matching `to`/link
- dedicated check: sha256(token extracted from captured link) == stored `token_hash` (catches a raw/hash swap)
- second request for same email invalidates the first token (`consume` on old token → `None`)
- exceeding `password_reset_rate_limit_max_attempts` → `TooManyPasswordResetRequestsError`
- confirm success → password hash updated (`verify_password` new password), all refresh tokens for that user gone
- confirm with garbage token → `InvalidPasswordResetTokenError`
- confirm twice with same token → `InvalidPasswordResetTokenError` on the second call
- confirm with expired token (pre-stored with past `expires_at`) → `ExpiredPasswordResetTokenError`

**`tests/auth/test_password_reset_router.py`** (HTTP-level, mirrors `tests/auth/test_router.py`):
- `/forgot-password` returns 200 with identical body for known and unknown email
- exceeding the rate limit returns 429
- full flow: register → `/forgot-password` → pull raw token from `mock_email.sent_password_resets[-1]["reset_link"]` → `/reset-password` → `/auth/login` succeeds with new password, fails 401 with old
- pre-reset `refresh_token` is rejected (401) by `/auth/refresh` after a successful reset
- invalid token → 400, reused token → 400, expired token (backdate `expires_at` directly in `mock_db["password_reset_tokens"]`) → 410

## Build order

1. `src/database/collections/constants.py`
2. `src/migrations/versions/008_password_reset_tokens_indexes.py`
3. `src/notifications/port.py`, `console_adapter.py`, `mock_adapter.py`
4. `src/core/config.py`
5. `src/auth/repository.py` (two new repos + `revoke_all_for_user`)
6. `src/auth/service.py` (three new errors)
7. `src/auth/schemas.py` (four new schemas)
8. `src/auth/commands/request_password_reset.py`, `confirm_password_reset.py`
9. `src/auth/router.py`
10. `src/core/dependencies.py` (`EmailDep`)
11. `src/main.py` (adapter wiring, `_wire_mediator` signature + registrations)
12. `tests/conftest.py`
13. `tests/auth/test_password_reset_commands.py`, `tests/auth/test_password_reset_router.py`

## Verification

- `make lint` — ruff clean (E/F/I/N/W/UP)
- `make test` — full suite passes, including existing `tests/auth/*` (confirms the
  `_wire_mediator` signature change didn't break anything) and the new test files
- Manually exercise via `make dev`: register a user, `POST /api/v1/auth/forgot-password`,
  check server logs for the console-adapter-printed reset link, `POST
  /api/v1/auth/reset-password` with the token, confirm old refresh token is rejected and
  login works with the new password
