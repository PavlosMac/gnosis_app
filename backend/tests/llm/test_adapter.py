from unittest.mock import AsyncMock, MagicMock

import pytest
from openai import APIConnectionError, APIStatusError, RateLimitError

from src.llm.errors import (
    CardNotFoundError,
    LLMConnectionError,
    LLMRateLimitError,
    LLMResponseError,
)
from src.llm.openai_adapter import OpenAIAdapter
from src.llm.schemas import (
    CardInSpread,
    CardInterpretation,
    InterpretationRequest,
    LLMInterpretationResult,
    Orientation,
)


def _make_parsed_result() -> LLMInterpretationResult:
    return LLMInterpretationResult(
        card_interpretations=[
            CardInterpretation(
                card_name="The Fool",
                position="Past",
                orientation=Orientation.upright,
                interpretation="A rich per-card interpretation.",
            )
        ],
        synthesis="A rich synthesis narrative.",
    )


def _make_client(
    parsed: LLMInterpretationResult | None = None,
    model: str = "gpt-4o",
    tokens: int = 120,
) -> MagicMock:
    if parsed is None:
        parsed = _make_parsed_result()

    message = MagicMock()
    message.parsed = parsed

    choice = MagicMock()
    choice.message = message

    usage = MagicMock()
    usage.total_tokens = tokens

    completion = MagicMock()
    completion.choices = [choice]
    completion.model = model
    completion.usage = usage

    client = MagicMock()
    client.beta = MagicMock()
    client.beta.chat = MagicMock()
    client.beta.chat.completions = MagicMock()
    client.beta.chat.completions.parse = AsyncMock(return_value=completion)
    client.close = AsyncMock()
    return client


def _make_request(*cards: CardInSpread) -> InterpretationRequest:
    return InterpretationRequest(
        spread_name="Test Spread",
        question="What does this spread reveal?",
        cards=list(cards),
    )


@pytest.fixture
def adapter():
    return OpenAIAdapter(
        client=_make_client(), model="gpt-4o", max_tokens=1024, reasoning_effort="none"
    )


async def test_success_returns_interpretation(adapter):
    req = _make_request(
        CardInSpread(name="The Fool", position="Past", orientation=Orientation.upright)
    )
    result = await adapter.generate_interpretation(req)
    assert len(result.card_interpretations) == 1
    assert result.card_interpretations[0].card_name == "The Fool"
    assert result.synthesis == "A rich synthesis narrative."
    assert result.model == "gpt-4o"
    assert result.tokens_used == 120


async def test_unknown_card_raises_card_not_found():
    client = _make_client()
    adapter = OpenAIAdapter(client=client, model="gpt-4o", max_tokens=1024, reasoning_effort="none")
    req = _make_request(
        CardInSpread(name="Card of Doom", position="Present", orientation=Orientation.upright)
    )
    with pytest.raises(CardNotFoundError):
        await adapter.generate_interpretation(req)


async def test_empty_response_raises_llm_response_error():
    client = _make_client()
    # Simulate parsed=None (unparseable response)
    client.beta.chat.completions.parse.return_value.choices[0].message.parsed = None
    adapter = OpenAIAdapter(client=client, model="gpt-4o", max_tokens=1024, reasoning_effort="none")
    req = _make_request(
        CardInSpread(name="The Fool", position="Past", orientation=Orientation.upright)
    )
    with pytest.raises(LLMResponseError):
        await adapter.generate_interpretation(req)


async def test_rate_limit_error_mapped():
    client = _make_client()
    client.beta.chat.completions.parse = AsyncMock(
        side_effect=RateLimitError(
            message="rate limit", response=MagicMock(status_code=429), body={}
        )
    )
    adapter = OpenAIAdapter(client=client, model="gpt-4o", max_tokens=1024, reasoning_effort="none")
    req = _make_request(
        CardInSpread(name="The Fool", position="Past", orientation=Orientation.upright)
    )
    with pytest.raises(LLMRateLimitError):
        await adapter.generate_interpretation(req)


async def test_connection_error_mapped():
    client = _make_client()
    client.beta.chat.completions.parse = AsyncMock(
        side_effect=APIConnectionError(request=MagicMock())
    )
    adapter = OpenAIAdapter(client=client, model="gpt-4o", max_tokens=1024, reasoning_effort="none")
    req = _make_request(
        CardInSpread(name="The Fool", position="Past", orientation=Orientation.upright)
    )
    with pytest.raises(LLMConnectionError):
        await adapter.generate_interpretation(req)


async def test_api_status_error_mapped():
    client = _make_client()
    client.beta.chat.completions.parse = AsyncMock(
        side_effect=APIStatusError(
            message="server error",
            response=MagicMock(status_code=500),
            body={},
        )
    )
    adapter = OpenAIAdapter(client=client, model="gpt-4o", max_tokens=1024, reasoning_effort="none")
    req = _make_request(
        CardInSpread(name="The Fool", position="Past", orientation=Orientation.upright)
    )
    with pytest.raises(LLMResponseError):
        await adapter.generate_interpretation(req)


async def test_close_calls_client_close():
    client = _make_client()
    adapter = OpenAIAdapter(client=client, model="gpt-4o", max_tokens=1024, reasoning_effort="none")
    await adapter.close()
    client.close.assert_awaited_once()
