import html
from datetime import datetime
from zoneinfo import ZoneInfo

# Wording only — the authoritative TTL is settings.password_reset_token_ttl_minutes.
# If that setting changes, update this string to match.
_TTL_WORDING = "30 minutes"

# Support inbox is read by a Sweden-based operator; render local time, not UTC.
_SUPPORT_TZ = ZoneInfo("Europe/Stockholm")


def _format_local(submitted_at: datetime) -> str:
    return submitted_at.astimezone(_SUPPORT_TZ).strftime("%Y-%m-%d %H:%M %Z")


def password_reset_subject() -> str:
    return "Reset your Tarot Divinations password"


def password_reset_text(reset_link: str) -> str:
    return (
        "We received a request to reset your Tarot Divinations password.\n"
        "\n"
        f"Reset it here: {reset_link}\n"
        "\n"
        f"This link expires in {_TTL_WORDING} and can only be used once.\n"
        "If you didn't request this, you can safely ignore this email."
    )


def password_reset_html(reset_link: str) -> str:
    return (
        '<div style="max-width:480px;margin:0 auto;padding:32px 24px;'
        "font-family:Georgia,'Times New Roman',serif;color:#2b2333;\">"
        '<h1 style="font-size:20px;font-weight:600;margin:0 0 16px;">'
        "Reset your password</h1>"
        '<p style="font-size:15px;line-height:1.6;margin:0 0 24px;">'
        "We received a request to reset your Tarot Divinations password. "
        "Click the button below to choose a new one.</p>"
        f'<a href="{reset_link}" style="display:inline-block;padding:12px 24px;'
        "background:#4b3869;color:#ffffff;text-decoration:none;border-radius:6px;"
        'font-size:15px;">Reset password</a>'
        '<p style="font-size:13px;line-height:1.6;color:#6f6680;margin:24px 0 0;">'
        f"This link expires in {_TTL_WORDING} and can only be used once. "
        "If the button doesn't work, paste this address into your browser:<br>"
        f'<span style="word-break:break-all;">{reset_link}</span></p>'
        '<p style="font-size:13px;line-height:1.6;color:#6f6680;margin:16px 0 0;">'
        "If you didn't request this, you can safely ignore this email.</p>"
        "</div>"
    )


def _hours_wording(hours: int) -> str:
    return "1 hour" if hours == 1 else f"{hours} hours"


def _days_wording(days: int) -> str:
    return "1 day" if days == 1 else f"{days} days"


def email_verification_subject() -> str:
    return "Confirm your email for Tarot Divinations"


def email_verification_text(verify_link: str, ttl_hours: int, retention_days: int) -> str:
    """The wording is derived from the settings the caller passes
    (email_verification_token_ttl_hours, pending_account_ttl_days), so it cannot drift."""
    return (
        "Welcome to Tarot Divinations.\n"
        "\n"
        f"Confirm your email address here: {verify_link}\n"
        "\n"
        f"This link expires in {_hours_wording(ttl_hours)} and can only be used once. "
        "You can sign in once your address is confirmed.\n"
        f"An account that is never confirmed is deleted after {_days_wording(retention_days)}.\n"
        "If you didn't create this account, you can safely ignore this email."
    )


def email_verification_html(verify_link: str, ttl_hours: int, retention_days: int) -> str:
    return (
        '<div style="max-width:480px;margin:0 auto;padding:32px 24px;'
        "font-family:Georgia,'Times New Roman',serif;color:#2b2333;\">"
        '<h1 style="font-size:20px;font-weight:600;margin:0 0 16px;">'
        "Confirm your email</h1>"
        '<p style="font-size:15px;line-height:1.6;margin:0 0 24px;">'
        "Welcome to Tarot Divinations. Confirm your email address to finish "
        "creating your account; you can sign in once it is confirmed.</p>"
        f'<a href="{verify_link}" style="display:inline-block;padding:12px 24px;'
        "background:#4b3869;color:#ffffff;text-decoration:none;border-radius:6px;"
        'font-size:15px;">Confirm email</a>'
        '<p style="font-size:13px;line-height:1.6;color:#6f6680;margin:24px 0 0;">'
        f"This link expires in {_hours_wording(ttl_hours)} and can only be used once. "
        "If the button doesn't work, paste this address into your browser:<br>"
        f'<span style="word-break:break-all;">{verify_link}</span></p>'
        '<p style="font-size:13px;line-height:1.6;color:#6f6680;margin:16px 0 0;">'
        f"An account that is never confirmed is deleted after "
        f"{_days_wording(retention_days)}. "
        "If you didn't create this account, you can safely ignore this email.</p>"
        "</div>"
    )


def invite_subject() -> str:
    return "You're invited to Tarot Divinations"


def invite_text(invite_link: str, ttl_days: int) -> str:
    """Wording derived from settings.invite_ttl_days, which the caller passes."""
    return (
        "You have been invited to Tarot Divinations.\n"
        "\n"
        f"Accept the invitation and create your account here: {invite_link}\n"
        "\n"
        f"This link expires in {_days_wording(ttl_days)} and can only be used once. "
        "You will choose your name and password when you open it.\n"
        "If you weren't expecting this invitation, you can safely ignore this email."
    )


def invite_html(invite_link: str, ttl_days: int) -> str:
    return (
        '<div style="max-width:480px;margin:0 auto;padding:32px 24px;'
        "font-family:Georgia,'Times New Roman',serif;color:#2b2333;\">"
        '<h1 style="font-size:20px;font-weight:600;margin:0 0 16px;">'
        "You're invited</h1>"
        '<p style="font-size:15px;line-height:1.6;margin:0 0 24px;">'
        "You have been invited to Tarot Divinations. Accept the invitation to create "
        "your account; you will choose your name and password when you open it.</p>"
        f'<a href="{invite_link}" style="display:inline-block;padding:12px 24px;'
        "background:#4b3869;color:#ffffff;text-decoration:none;border-radius:6px;"
        'font-size:15px;">Accept invitation</a>'
        '<p style="font-size:13px;line-height:1.6;color:#6f6680;margin:24px 0 0;">'
        f"This link expires in {_days_wording(ttl_days)} and can only be used once. "
        "If the button doesn't work, paste this address into your browser:<br>"
        f'<span style="word-break:break-all;">{invite_link}</span></p>'
        '<p style="font-size:13px;line-height:1.6;color:#6f6680;margin:16px 0 0;">'
        "If you weren't expecting this invitation, you can safely ignore this email.</p>"
        "</div>"
    )


def admin_message_subject(subject: str) -> str:
    # A header line must never carry CR/LF, whatever the admin typed.
    return " ".join(subject.split())


def admin_message_text(message: str) -> str:
    return message


def admin_message_html(message: str) -> str:
    # Plain text from the admin, escaped; <pre> keeps the admin's own line breaks.
    return (
        '<div style="max-width:640px;margin:0 auto;padding:32px 24px;'
        "font-family:Georgia,'Times New Roman',serif;color:#2b2333;\">"
        '<pre style="white-space:pre-wrap;word-break:break-word;font-family:inherit;'
        'font-size:15px;line-height:1.6;margin:0;">'
        f"{html.escape(message)}</pre>"
        "</div>"
    )


def support_request_subject(subject: str) -> str:
    # A header line must never carry CR/LF, whatever the user typed.
    return f"[Support] {' '.join(subject.split())}"


def support_request_text(
    message: str, user_email: str, user_id: str, submitted_at: datetime
) -> str:
    return (
        f"{message}\n"
        "\n"
        "--\n"
        f"From: {user_email}\n"
        f"User ID: {user_id}\n"
        f"Submitted: {_format_local(submitted_at)}\n"
    )


def support_request_html(
    message: str, user_email: str, user_id: str, submitted_at: datetime
) -> str:
    # Everything user-supplied is escaped; <pre> keeps the user's own line breaks.
    return (
        '<div style="max-width:640px;margin:0 auto;padding:32px 24px;'
        "font-family:Georgia,'Times New Roman',serif;color:#2b2333;\">"
        '<pre style="white-space:pre-wrap;word-break:break-word;font-family:inherit;'
        'font-size:15px;line-height:1.6;margin:0 0 24px;">'
        f"{html.escape(message)}</pre>"
        '<p style="font-size:13px;line-height:1.6;color:#6f6680;margin:0;'
        'border-top:1px solid #d9d3e0;padding-top:16px;">'
        f"From: {html.escape(user_email)}<br>"
        f"User ID: {html.escape(user_id)}<br>"
        f"Submitted: {html.escape(_format_local(submitted_at))}"
        "</p>"
        "</div>"
    )
