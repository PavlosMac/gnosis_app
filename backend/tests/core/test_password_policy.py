from pathlib import Path

import pytest

from src.core.exceptions import WeakPasswordError
from src.core.password_policy import (
    MAX_PASSWORD_LENGTH,
    MIN_PASSWORD_LENGTH,
    validate_new_password,
)

GOOD = "plum-harbour-lantern-42"
TOO_COMMON = "This password is too common. Choose a less predictable one."
PERSONAL = "Password must not contain your name or email address"

LIST_FILE = Path(__file__).parents[2] / "src/lib/passwords/common_passwords.txt"


def _entries() -> list[str]:
    lines = LIST_FILE.read_text(encoding="utf-8").splitlines()
    return [line for line in lines if line and not line.startswith("#")]


def _refused(password: str, **context: str) -> WeakPasswordError:
    with pytest.raises(WeakPasswordError) as raised:
        validate_new_password(password, **context)
    return raised.value


def test_a_good_passphrase_is_accepted():
    validate_new_password(GOOD)
    validate_new_password(GOOD, email="ada@example.com", first_name="Ada", last_name="Lovelace")


def test_error_is_a_422_with_a_code_and_a_user_facing_message():
    error = _refused("short")
    assert error.status_code == 422
    assert error.code == "weak_password"
    assert error.detail == f"Password must be at least {MIN_PASSWORD_LENGTH} characters"


def test_length_bounds():
    assert MIN_PASSWORD_LENGTH == 12
    _refused("k7#vQ2m!x9p")  # 11
    validate_new_password("k7#vQ2m!x9pZ")  # 12
    validate_new_password("k7#vQ2m!x9pZ" + "a1" * 58)  # 128
    error = _refused("k7#vQ2m!x9pZ" + "a1" * 58 + "b")
    assert error.detail == f"Password must be at most {MAX_PASSWORD_LENGTH} characters"


def test_a_listed_password_is_refused_in_any_letter_case():
    listed = _entries()[0]
    assert _refused(listed).detail == TOO_COMMON
    assert _refused(listed.upper()).detail == TOO_COMMON
    assert _refused(listed.capitalize()).detail == TOO_COMMON


@pytest.mark.parametrize(
    "password",
    [
        "aaaaaaaaaaaa",
        "111111111111111",
        "123456789012",
        "0123456789012345",
        "987654321098",
        "abcdefghijkl",
        "ABCDEFGHIJKLMNOP",
        "zyxwvutsrqpo",
        "abcabcabcabc",
        "12121212121212",
    ],
)
def test_repeats_and_plain_runs_are_refused(password):
    assert _refused(password).detail == TOO_COMMON


@pytest.mark.parametrize(
    "password",
    ["lovelace-plum-harbour", "Plum-ADA-harbour-42", "xx-ada.byron-harbour"],
)
def test_passwords_containing_the_users_name_or_email_are_refused(password):
    error = _refused(
        password, email="ada.byron@example.com", first_name="Ada", last_name="Lovelace"
    )
    assert error.detail == PERSONAL


def test_name_parts_shorter_than_three_characters_are_ignored():
    """'Li' or an initial would match almost any password."""
    validate_new_password("plum-lilac-harbour-42", email="x@example.com", first_name="Li")


def test_only_the_local_part_of_the_email_is_checked():
    validate_new_password("plum-example.com-harbour", email="ada@example.com")


def test_missing_context_is_fine():
    validate_new_password(GOOD, email=None, first_name=None, last_name=None)


def test_the_list_file_is_well_formed():
    entries = _entries()
    assert len(entries) > 1000
    assert all(MIN_PASSWORD_LENGTH <= len(e) <= MAX_PASSWORD_LENGTH for e in entries)
    assert all(e == e.lower() and e == e.strip() for e in entries)
    assert len(entries) == len(set(entries))
