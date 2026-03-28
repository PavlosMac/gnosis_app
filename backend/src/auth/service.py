import uuid

import jwt

from src.auth.models import User
from src.auth.repository import AuthReadRepository, RefreshTokenRepository
from src.auth.schemas import TokenResponse
from src.core.exceptions import ConflictError, UnauthorizedError
from src.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    verify_password,
)


class EmailAlreadyExistsError(ConflictError):
    def __init__(self) -> None:
        super().__init__(detail="A user with this email already exists")


class InvalidCredentialsError(UnauthorizedError):
    def __init__(self) -> None:
        super().__init__(detail="Invalid email or password")


class AuthService:
    def __init__(
        self,
        read_repo: AuthReadRepository,
        refresh_repo: RefreshTokenRepository,
    ) -> None:
        self._read_repo = read_repo
        self._refresh_repo = refresh_repo

    async def authenticate(self, email: str, password: str) -> TokenResponse:
        doc = await self._read_repo.find_by_email(email)
        if doc is None:
            raise InvalidCredentialsError()

        user = User.from_document(doc)
        if not verify_password(password, user.password_hash):
            raise InvalidCredentialsError()

        return await self._create_and_store_tokens(user.id, family_id=str(uuid.uuid4()))

    async def refresh_tokens(self, refresh_token: str) -> TokenResponse:
        try:
            payload = decode_token(refresh_token)
        except jwt.PyJWTError:
            raise UnauthorizedError("Invalid refresh token")

        if payload.get("type") != "refresh":
            raise UnauthorizedError("Invalid token type")

        jti: str | None = payload.get("jti")
        family_id: str | None = payload.get("family_id")
        if jti is None or family_id is None:
            raise UnauthorizedError("Invalid refresh token")

        doc = await self._refresh_repo.consume(jti)
        if doc is None:
            await self._refresh_repo.revoke_family(family_id)
            raise UnauthorizedError("Token has been revoked")

        user_id: str | None = payload.get("sub")
        if user_id is None:
            raise UnauthorizedError("Invalid refresh token")

        user_doc = await self._read_repo.find_by_id(user_id)
        if user_doc is None:
            raise UnauthorizedError("User not found")

        return await self._create_and_store_tokens(user_id, family_id)

    async def revoke_token(self, token: str, user_id: str) -> None:
        try:
            payload = decode_token(token)
        except jwt.PyJWTError:
            return

        family_id: str | None = payload.get("family_id")
        if family_id:
            await self._refresh_repo.revoke_family(family_id)

    async def create_tokens_for_user(self, user_id: str) -> TokenResponse:
        return await self._create_and_store_tokens(user_id, family_id=str(uuid.uuid4()))

    async def _create_and_store_tokens(
        self, user_id: str, family_id: str
    ) -> TokenResponse:
        jti = str(uuid.uuid4())
        access_token, access_expires = create_access_token(user_id, family_id)
        refresh_token, refresh_expires = create_refresh_token(user_id, jti, family_id)
        await self._refresh_repo.store(jti, family_id, user_id, refresh_expires)
        return TokenResponse(
            access_token=access_token,
            refresh_token=refresh_token,
            access_token_expires_at=int(access_expires.timestamp()),
            refresh_token_expires_at=int(refresh_expires.timestamp()),
        )
