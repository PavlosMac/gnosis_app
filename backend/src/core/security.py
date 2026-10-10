import hashlib
import secrets
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


def create_access_token(sub: str, family_id: str) -> tuple[str, datetime]:
    expire = datetime.now(UTC) + timedelta(seconds=settings.jwt_access_token_expire_seconds)
    token = jwt.encode(
        {"sub": sub, "exp": expire, "type": "access", "family_id": family_id},
        settings.jwt_secret_key,
        algorithm=settings.jwt_algorithm,
    )
    return token, expire


def create_refresh_token(sub: str, jti: str, family_id: str) -> tuple[str, datetime]:
    expire = datetime.now(UTC) + timedelta(days=settings.jwt_refresh_token_expire_days)
    token = jwt.encode(
        {"sub": sub, "exp": expire, "type": "refresh", "jti": jti, "family_id": family_id},
        settings.jwt_secret_key,
        algorithm=settings.jwt_algorithm,
    )
    return token, expire


def decode_token(token: str) -> dict:
    return jwt.decode(token, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm])


def generate_url_token() -> str:
    """A fresh one-time token for an emailed link (password reset, email verification).
    Only its hash is ever stored — see hash_token."""
    return secrets.token_urlsafe(32)


def hash_token(raw_token: str) -> str:
    """One-time tokens are stored hashed, so a database read never yields a usable link."""
    return hashlib.sha256(raw_token.encode()).hexdigest()


def ensure_utc(dt: datetime) -> datetime:
    """PyMongo returns naive UTC datetimes by default; normalise before comparing
    (e.g. a one-time token's `expires_at` against `datetime.now(UTC)`)."""
    return dt.replace(tzinfo=UTC) if dt.tzinfo is None else dt
