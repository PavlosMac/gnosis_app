"""Shared test data factories.

Plain constants and factory functions (not pytest fixtures) so they can be used at
module scope — e.g. as default argument values — from any test package. Pytest
fixtures shared across files live in tests/conftest.py.
"""

# The canonical valid POST /readings body used by HTTP-level router tests.
VALID_READING_BODY = {
    "spread_name": "Celtic Cross",
    "question": "What does the future hold?",
    "cards": [
        {"name": "The Fool", "position": "Present", "orientation": "upright"},
    ],
}


def make_usage(
    prompt_tokens: int = 100,
    completion_tokens: int = 500,
    reasoning_tokens: int = 200,
    model: str = "mock",
    cost_usd: float = 0.0,
) -> dict:
    """A ledger usage payload in the wire shape SaveInterpretationRequest expects."""
    return {
        "prompt_tokens": prompt_tokens,
        "completion_tokens": completion_tokens,
        "reasoning_tokens": reasoning_tokens,
        "model": model,
        "cost_usd": cost_usd,
    }


DEFAULT_PASSWORD = "securepassword123"


def make_register_body(
    email: str = "user@example.com",
    password: str = DEFAULT_PASSWORD,
    first_name: str = "Test",
    last_name: str = "User",
    terms: str = "2026-10-04",
    privacy: str = "2026-10-04",
) -> dict:
    """A valid POST /auth/register body — names and both consents are required."""
    return {
        "email": email,
        "password": password,
        "first_name": first_name,
        "last_name": last_name,
        "consents": {"terms": terms, "privacy": privacy},
    }


def verification_token(mock_email, index: int = -1) -> str:
    """The raw token from a verification mail the mock adapter recorded."""
    link = mock_email.sent_email_verifications[index]["verify_link"]
    return link.split("token=", 1)[1]


async def register_verify_and_login(
    client, mock_email, email: str, password: str = DEFAULT_PASSWORD
) -> dict:
    """The only route to a session: register -> confirm the emailed token -> log in.
    Returns the TokenResponse body."""
    reg = await client.post(
        "/api/v1/auth/register", json=make_register_body(email=email, password=password)
    )
    assert reg.status_code == 201, f"Registration failed: {reg.text}"
    verify = await client.post(
        "/api/v1/auth/verify-email", json={"token": verification_token(mock_email)}
    )
    assert verify.status_code == 200, f"Verification failed: {verify.text}"
    login = await client.post("/api/v1/auth/login", json={"email": email, "password": password})
    assert login.status_code == 200, f"Login failed: {login.text}"
    return login.json()
