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
    mongodb_uri: str = "mongodb://localhost:27017"
    mongodb_database: str = "gnosis_esoterica"

    # JWT
    jwt_secret_key: str = "840d6240860f87b5e3112f79253623b44746eb325352e0a6"
    jwt_access_token_expire_seconds: int = 86400
    jwt_refresh_token_expire_days: int = 30
    jwt_algorithm: str = "HS256"

    # OpenAI
    openai_api_key: str = ""
    openai_model: str = "gpt-5.4-mini"
    # Absolute ceiling on completion tokens, not the per-call value — the adapter derives a
    # per-request cap from the word budget, card count and reasoning effort, and clamps it
    # to this. Setting it too low truncates large spreads (logged as a warning).
    openai_max_tokens: int = 10000
    openai_reasoning_effort: ReasoningEffort = "medium"

    # Logging
    log_level: Literal["DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"] = "INFO"
    log_json: bool = False


settings = Settings()
