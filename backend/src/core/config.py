from typing import Literal

from pydantic_settings import BaseSettings, SettingsConfigDict


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
    jwt_secret_key: str = "change-me-to-a-random-secret"
    jwt_access_token_expire_seconds: int = 3600
    jwt_refresh_token_expire_days: int = 30
    jwt_algorithm: str = "HS256"

    # Logging
    log_level: Literal["DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"] = "INFO"
    log_json: bool = False


settings = Settings()
