from datetime import UTC, datetime

from src.notifications.templates import (
    password_reset_html,
    password_reset_subject,
    password_reset_text,
    support_request_html,
    support_request_subject,
    support_request_text,
)

LINK = "https://tarotdivinations.com/reset-password?token=abc123"

USER_EMAIL = "asker@example.com"
USER_ID = "64b7f0c2e4b0a1b2c3d4e5f6"
SUBMITTED_AT = datetime(2026, 9, 15, 10, 30, 0, tzinfo=UTC)


def test_subject_names_the_product():
    assert password_reset_subject() == "Reset your Tarot Divinations password"


def test_text_contains_link_and_expiry():
    text = password_reset_text(LINK)
    assert LINK in text
    assert "30 minutes" in text
    assert "<" not in text  # plain part carries no markup


def test_html_contains_link_twice_and_expiry():
    html = password_reset_html(LINK)
    # once as the button href, once as the raw fallback URL
    assert html.count(LINK) == 2
    assert "30 minutes" in html


def test_support_subject_is_prefixed():
    assert support_request_subject("Card missing from spread") == (
        "[Support] Card missing from spread"
    )


def test_support_subject_collapses_line_breaks():
    # A header line must never carry CR/LF, whatever the user typed.
    assert support_request_subject("first\r\nsecond   third") == "[Support] first second third"


def test_support_text_contains_message_and_metadata():
    text = support_request_text(
        message="My reading vanished.\nPlease help.",
        user_email=USER_EMAIL,
        user_id=USER_ID,
        submitted_at=SUBMITTED_AT,
    )
    assert "My reading vanished.\nPlease help." in text
    assert USER_EMAIL in text
    assert USER_ID in text
    assert "2026-09-15 12:30 CEST" in text
    assert "<" not in text


def test_support_html_escapes_message_and_contains_metadata():
    html = support_request_html(
        message="<script>alert(1)</script> & more",
        user_email=USER_EMAIL,
        user_id=USER_ID,
        submitted_at=SUBMITTED_AT,
    )
    assert "<script>" not in html
    assert "&lt;script&gt;alert(1)&lt;/script&gt; &amp; more" in html
    assert USER_EMAIL in html
    assert USER_ID in html
    assert "2026-09-15 12:30 CEST" in html


def test_support_html_escapes_metadata():
    html = support_request_html(
        message="hello there friend",
        user_email="<b>x</b>@example.com",
        user_id=USER_ID,
        submitted_at=SUBMITTED_AT,
    )
    assert "<b>x</b>" not in html
    assert "&lt;b&gt;x&lt;/b&gt;@example.com" in html
