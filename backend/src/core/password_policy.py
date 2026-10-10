"""The rules a new password must pass (registration and password reset).

Strength comes from length plus a blocklist, deliberately not from character-mix rules:
forced digits and symbols push people towards "Password1!", which passes such a rule and
is still weak. The blocklist is a bundled file — no third-party lookup, so sign-up has no
outside dependency. Login does not apply these rules, so accounts created under the
older 8-character minimum keep working.
"""

from pathlib import Path

from src.core.exceptions import WeakPasswordError

MIN_PASSWORD_LENGTH = 12
MAX_PASSWORD_LENGTH = 128

# Name and email parts shorter than this would match almost any password ("Li", "Al").
_MIN_PERSONAL_PART_LENGTH = 3
# A password that is one short unit repeated ("aaaa…", "abcabc…", "1212…").
_MAX_REPEAT_UNIT_LENGTH = 4

_TOO_COMMON = "This password is too common. Choose a less predictable one."
_PERSONAL = "Password must not contain your name or email address"

_LIST_FILE = Path(__file__).resolve().parent.parent / "lib" / "passwords" / "common_passwords.txt"


def _load_common_passwords() -> frozenset[str]:
    lines = _LIST_FILE.read_text(encoding="utf-8").splitlines()
    return frozenset(line for line in lines if line and not line.startswith("#"))


# Loaded once at import; entries are lower-cased and at least MIN_PASSWORD_LENGTH long.
_COMMON_PASSWORDS = _load_common_passwords()


def _is_repeated_unit(password: str) -> bool:
    for size in range(1, _MAX_REPEAT_UNIT_LENGTH + 1):
        unit = password[:size]
        if len(password) % size == 0 and unit * (len(password) // size) == password:
            return True
    return False


def _is_plain_run(password: str) -> bool:
    """ "123456789012", "987654321098", "abcdefghijkl" — every step is +1 or every step
    is -1. Digits wrap (9 -> 0), which is how people extend a numeric run."""
    if password.isdigit():
        steps = {(int(b) - int(a)) % 10 for a, b in zip(password, password[1:])}
        return steps in ({1}, {9})
    if password.isalpha() and password.isascii():
        steps = {ord(b) - ord(a) for a, b in zip(password, password[1:])}
        return steps in ({1}, {-1})
    return False


def _personal_parts(email: str | None, first_name: str | None, last_name: str | None) -> list[str]:
    candidates = [(email or "").split("@", 1)[0], first_name or "", last_name or ""]
    parts = (candidate.strip().lower() for candidate in candidates)
    return [part for part in parts if len(part) >= _MIN_PERSONAL_PART_LENGTH]


def validate_password_strength(password: str) -> None:
    """The rules that need nothing but the password itself. Raises WeakPasswordError."""
    if len(password) < MIN_PASSWORD_LENGTH:
        raise WeakPasswordError(f"Password must be at least {MIN_PASSWORD_LENGTH} characters")
    if len(password) > MAX_PASSWORD_LENGTH:
        raise WeakPasswordError(f"Password must be at most {MAX_PASSWORD_LENGTH} characters")

    folded = password.lower()
    if folded in _COMMON_PASSWORDS or _is_repeated_unit(folded) or _is_plain_run(folded):
        raise WeakPasswordError(_TOO_COMMON)


def validate_password_is_not_personal(
    password: str,
    *,
    email: str | None = None,
    first_name: str | None = None,
    last_name: str | None = None,
) -> None:
    """Refuse a password built from the account's own email (local part) or name."""
    folded = password.lower()
    if any(part in folded for part in _personal_parts(email, first_name, last_name)):
        raise WeakPasswordError(_PERSONAL)


def validate_new_password(
    password: str,
    *,
    email: str | None = None,
    first_name: str | None = None,
    last_name: str | None = None,
) -> None:
    """Every rule. Raises WeakPasswordError (422, code "weak_password") on the first
    one that fails; the detail is user-facing."""
    validate_password_strength(password)
    validate_password_is_not_personal(
        password, email=email, first_name=first_name, last_name=last_name
    )
