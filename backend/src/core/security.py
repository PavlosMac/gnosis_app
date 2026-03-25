import uuid
from datetime import UTC, datetime, timedelta

import jwt
from pwdlib import PasswordHash
from pwdlib.hashers.argon2 import Argon2Hasher

from src.core.config import settings

pwd_hasher = PasswordHash((Argon2Hasher(),))


def hash_password(password: str) -> str:
    return pwd_hasher.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    return pwd_hasher.verify(password, password_hash)


def create_access_token(sub: str) -> tuple[str, datetime]:
    expire = datetime.now(UTC) + timedelta(seconds=settings.jwt_access_token_expire_seconds)
    token = jwt.encode(
        {"sub": sub, "exp": expire, "type": "access", "jti": str(uuid.uuid4())},
        settings.jwt_secret_key,
        algorithm=settings.jwt_algorithm,
    )
    return token, expire


def create_refresh_token(sub: str) -> tuple[str, datetime]:
    expire = datetime.now(UTC) + timedelta(days=settings.jwt_refresh_token_expire_days)
    token = jwt.encode(
        {"sub": sub, "exp": expire, "type": "refresh", "jti": str(uuid.uuid4())},
        settings.jwt_secret_key,
        algorithm=settings.jwt_algorithm,
    )
    return token, expire


def decode_token(token: str) -> dict:
    return jwt.decode(token, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm])
