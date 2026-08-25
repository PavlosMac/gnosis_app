"""Shared test data factories.

Plain constants and factory functions (not pytest fixtures) so they can be used at
module scope — e.g. as default argument values — from any test package. Pytest
fixtures shared across files live in tests/conftest.py.
"""

from src.llm.schemas import InterpretationLens, InterpretationSettings, ReadingIntent

# The canonical valid POST /readings body used by HTTP-level router tests.
VALID_READING_BODY = {
    "spread_name": "Celtic Cross",
    "question": "What does the future hold?",
    "cards": [
        {"name": "The Fool", "position": "Present", "orientation": "upright"},
    ],
}


def make_settings(
    lens: InterpretationLens = InterpretationLens.traditional,
    intent: ReadingIntent = ReadingIntent.reflective,
    depth: int = 60,
) -> InterpretationSettings:
    return InterpretationSettings(lens=lens, intent=intent, depth=depth)


DEFAULT_SETTINGS = make_settings()
