from typing import Literal

from pydantic_settings import BaseSettings, SettingsConfigDict

# Shared with src.llm.prompt_builder, whose REASONING_HEADROOM table is keyed by these
# values and import-checks itself against this type.
ReasoningEffort = Literal["none", "low", "medium", "high", "xhigh"]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Application
    app_name: str = "gnosis_esoterica"
    app_env: str = "development"
    debug: bool = False

    # MongoDB
    # No default on purpose: the address differs per environment and the prod URI
    # embeds credentials, so it must come from the environment (.env, the dev compose
    # `environment:` block, or .env.gnosis.prod). Startup fails fast if it is missing.
    mongodb_uri: str
    mongodb_database: str = "gnosis_esoterica"

    # JWT
    # No default on purpose: a fallback committed to the repo would let anyone forge
    # tokens. Startup fails fast unless JWT_SECRET_KEY is set (env or .env).
    jwt_secret_key: str
    jwt_access_token_expire_seconds: int = 86400
    jwt_refresh_token_expire_days: int = 30
    jwt_algorithm: str = "HS256"

    # OpenAI
    openai_api_key: str = ""
    # Decided in docs/prompts/lean_prompt_architecture.md (Tunables): gpt-5.4 over mini —
    # reading quality depends on the model thinking well; cost is bounded by the
    # word-budget ceiling. (Supersedes the earlier gpt-5.4-mini default.)
    openai_model: str = "gpt-5.4"
    # Absolute ceiling on completion tokens, not the per-call value — the adapter derives a
    # per-request cap from the word budget and reasoning effort, and clamps it to this.
    # Setting it too low truncates large spreads (logged as a warning).
    openai_max_tokens: int = 10000
    openai_reasoning_effort: ReasoningEffort = "medium"
    # Per-call wall-clock limit. Worst case a request holds a semaphore slot for
    # timeout × (max_retries + 1) while the SDK retries.
    openai_timeout_seconds: float = 120.0
    openai_max_retries: int = 2
    # In-flight call cap, per process — the effective cap multiplies by uvicorn workers.
    openai_max_concurrent: int = 10
    # Bounded wait for a semaphore slot; waiting longer returns 503 instead of queueing.
    openai_acquire_timeout_seconds: float = 30.0

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

    # Support contact form — messages are relayed to this inbox through the email
    # adapter (Reply-To = the user). Empty means the endpoint answers 503.
    support_email: str = ""
    support_contact_rate_limit_window_seconds: int = 3600
    support_contact_rate_limit_max_attempts: int = 5

    # Lean prompt word budget (server-owned; reading length is a product decision)
    llm_words_per_card: int = 100
    # A significator-chart card carries a whole facet of character, not one moment in a
    # situation — it earns more room.
    significator_budget_scale: float = 1.5

    # Usage accounting. $ per 1M tokens (input, output); resolved response model ids are
    # matched against keys by prefix, unknown ids priced at the most expensive entry.
    # "mock" prices the local/test MockLLMAdapter at $0 — it always reports zero-token
    # usage, but an explicit entry avoids the price-table-gap warning on every dev/test
    # call, which would otherwise bury a genuine gap for a real unpriced model.
    model_price_table: dict[str, tuple[float, float]] = {
        "gpt-5.4-mini": (0.75, 4.50),
        "gpt-5.4": (2.50, 15.00),
        "mock": (0.0, 0.0),
    }
    # Default per-user spend cap; a user document's budget_usd field overrides it.
    user_budget_usd: float = 3.00

    # Logging
    log_level: Literal["DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"] = "INFO"
    log_json: bool = False


# pydantic-settings fills mongodb_uri and jwt_secret_key from the environment at runtime; pyright
# can't see that and flags the missing argument.
settings = Settings()  # pyright: ignore[reportCallIssue]
