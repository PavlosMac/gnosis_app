from src.notifications.templates import (
    password_reset_html,
    password_reset_subject,
    password_reset_text,
)

LINK = "https://tarotdivinations.com/reset-password?token=abc123"


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
