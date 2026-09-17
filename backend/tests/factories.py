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
