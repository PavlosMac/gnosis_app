from datetime import UTC, datetime

import jwt

from src.auth.exceptions import InvalidCredentialsError
from src.auth.models import User
from src.auth.repository import UserReadRepository
from src.auth.schemas import TokenResponse
from src.auth.token_blacklist_repository import TokenBlacklistRepository
from src.core.config import settings
from src.core.exceptions import UnauthorizedError
from src.core.security import create_access_token, create_refresh_token, verify_password


class AuthService:
    def __init__(
        self,
        read_repo: UserReadRepository,
        blacklist_repo: TokenBlacklistRepository,
    ) -> None:
        self._read_repo = read_repo
        self._blacklist_repo = blacklist_repo

    async def authenticate(self, email: str, password: str) -> TokenResponse:
        doc = await self._read_repo.find_by_email(email)
        if doc is None:
            raise InvalidCredentialsError()

        user = User.from_document(doc)
        if not verify_password(password, user.password_hash):
            raise InvalidCredentialsError()

        return self._create_tokens(user.id)

    async def refresh_tokens(self, refresh_token: str) -> TokenResponse:
        try:
            payload = jwt.decode(
                refresh_token,
                settings.jwt_secret_key,
                algorithms=[settings.jwt_algorithm],
            )
        except jwt.PyJWTError:
            raise UnauthorizedError("Invalid refresh token")

        if payload.get("type") != "refresh":
            raise UnauthorizedError("Invalid token type")

        jti: str | None = payload.get("jti")
        if jti and await self._blacklist_repo.is_blacklisted(jti):
            raise UnauthorizedError("Token has been revoked")

        user_id: str | None = payload.get("sub")
        if user_id is None:
            raise UnauthorizedError("Invalid refresh token")

        doc = await self._read_repo.find_by_id(user_id)
        if doc is None:
            raise UnauthorizedError("User not found")

        if jti:
            expires_at = datetime.fromtimestamp(payload["exp"], tz=UTC)
            await self._blacklist_repo.add(jti, user_id, expires_at)

        return self._create_tokens(user_id)

    async def revoke_token(self, token: str, user_id: str) -> None:
        try:
            payload = jwt.decode(
                token,
                settings.jwt_secret_key,
                algorithms=[settings.jwt_algorithm],
            )
        except jwt.PyJWTError:
            return

        jti: str | None = payload.get("jti")
        if jti:
            expires_at = datetime.fromtimestamp(payload["exp"], tz=UTC)
            await self._blacklist_repo.add(jti, user_id, expires_at)

    @staticmethod
    def _create_tokens(user_id: str) -> TokenResponse:
        return TokenResponse(
            access_token=create_access_token(user_id),
            refresh_token=create_refresh_token(user_id),
        )

    @staticmethod
    def create_tokens_for_user(user_id: str) -> TokenResponse:
        return TokenResponse(
            access_token=create_access_token(user_id),
            refresh_token=create_refresh_token(user_id),
        )
