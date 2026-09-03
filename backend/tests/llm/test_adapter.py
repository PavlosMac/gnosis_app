import asyncio
from unittest.mock import AsyncMock, MagicMock

import pytest
from openai import (
    APIConnectionError,
    APIStatusError,
    APITimeoutError,
    ContentFilterFinishReasonError,
    LengthFinishReasonError,
    OpenAIError,
    RateLimitError,
)

from src.llm.errors import (
    LLMBusyError,
    LLMConnectionError,
    LLMRateLimitError,
    LLMResponseError,
    LLMTimeoutError,
)
from src.llm.openai_adapter import OpenAIAdapter
from src.llm.schemas import (
    CardInSpread,
    InterpretationRequest,
    LeanReading,
    Orientation,
)


def _make_client(
    parsed: LeanReading | None = None,
    model: str = "gpt-5.4-2026-01-01",
    prompt_tokens: int = 480,
    completion_tokens: int = 723,
    reasoning_tokens: int | None = 329,
) -> MagicMock:
    if parsed is None:
        parsed = LeanReading(reading="A rich woven narrative naming The Fool.")

    message = MagicMock()
    message.parsed = parsed

    choice = MagicMock()
    choice.message = message

    usage = MagicMock()
    usage.prompt_tokens = prompt_tokens
    usage.completion_tokens = completion_tokens
    usage.completion_tokens_details = (
        MagicMock(reasoning_tokens=reasoning_tokens) if reasoning_tokens is not None else None
    )

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


def _one_card_request() -> InterpretationRequest:
    return _make_request(
        CardInSpread(name="The Fool", position="Past", orientation=Orientation.upright)
    )


def _make_adapter(client, **overrides) -> OpenAIAdapter:
    kwargs = {
        "client": client,
        "model": "gpt-5.4",
        "max_tokens": 10000,
        "reasoning_effort": "none",
        "acquire_timeout": 0.5,
    }
    kwargs.update(overrides)
    return OpenAIAdapter(**kwargs)


async def test_success_returns_reading_and_usage_split():
    adapter = _make_adapter(_make_client())
    result = await adapter.generate_interpretation(_one_card_request())
    assert result.reading == "A rich woven narrative naming The Fool."
    assert result.model == "gpt-5.4-2026-01-01"
    assert result.usage.prompt_tokens == 480
    assert result.usage.completion_tokens == 723
    assert result.usage.reasoning_tokens == 329


async def test_missing_completion_token_details_default_reasoning_to_zero():
    adapter = _make_adapter(_make_client(reasoning_tokens=None))
    result = await adapter.generate_interpretation(_one_card_request())
    assert result.usage.reasoning_tokens == 0


async def test_no_catalog_lookup_unknown_card_is_sent_verbatim():
    """The lean design has no card catalog in the interpret path — any card name the
    client sends reaches the model as-is."""
    client = _make_client()
    adapter = _make_adapter(client)
    req = _make_request(
        CardInSpread(name="Card of Doom", position="Present", orientation=Orientation.upright)
    )
    await adapter.generate_interpretation(req)
    messages = client.beta.chat.completions.parse.call_args.kwargs["messages"]
    assert "Card of Doom" in messages[1]["content"]


async def test_empty_response_raises_llm_response_error():
    client = _make_client()
    # Simulate parsed=None (unparseable response)
    client.beta.chat.completions.parse.return_value.choices[0].message.parsed = None
    adapter = _make_adapter(client)
    with pytest.raises(LLMResponseError):
        await adapter.generate_interpretation(_one_card_request())


async def _assert_maps(side_effect, expected_error):
    client = _make_client()
    client.beta.chat.completions.parse = AsyncMock(side_effect=side_effect)
    adapter = _make_adapter(client)
    with pytest.raises(expected_error):
        await adapter.generate_interpretation(_one_card_request())


async def test_rate_limit_error_mapped():
    await _assert_maps(
        RateLimitError(message="rate limit", response=MagicMock(status_code=429), body={}),
        LLMRateLimitError,
    )


async def test_connection_error_mapped():
    await _assert_maps(APIConnectionError(request=MagicMock()), LLMConnectionError)


async def test_timeout_maps_to_504_not_connection_error():
    """APITimeoutError subclasses APIConnectionError — the except order in the adapter
    must map it to LLMTimeoutError (504), not silently to 502."""
    await _assert_maps(APITimeoutError(request=MagicMock()), LLMTimeoutError)


async def test_api_status_error_mapped():
    await _assert_maps(
        APIStatusError(message="server error", response=MagicMock(status_code=500), body={}),
        LLMResponseError,
    )


async def test_length_finish_reason_mapped():
    """parse() raises when the completion hits max_completion_tokens — the error
    inherits OpenAIError directly, not APIStatusError, so it needs its own clause."""
    await _assert_maps(LengthFinishReasonError(completion=MagicMock()), LLMResponseError)


async def test_content_filter_finish_reason_mapped():
    await _assert_maps(ContentFilterFinishReasonError(), LLMResponseError)


async def test_any_other_openai_error_mapped():
    """The catch-all: no exception from the SDK hierarchy may escape as a 500."""
    await _assert_maps(OpenAIError("unexpected"), LLMResponseError)


async def test_per_call_timeout_is_passed_to_the_sdk():
    client = _make_client()
    adapter = _make_adapter(client, timeout=42.0)
    await adapter.generate_interpretation(_one_card_request())
    assert client.beta.chat.completions.parse.call_args.kwargs["timeout"] == 42.0


async def test_close_calls_client_close():
    client = _make_client()
    adapter = _make_adapter(client)
    await adapter.close()
    client.close.assert_awaited_once()


async def test_completion_cap_is_derived_per_request():
    from src.llm.prompt_builder import max_completion_tokens, request_word_budget

    client = _make_client()
    adapter = _make_adapter(client)
    req = _one_card_request()
    await adapter.generate_interpretation(req)
    expected = max_completion_tokens(request_word_budget(req), "none")
    sent = client.beta.chat.completions.parse.call_args.kwargs["max_completion_tokens"]
    assert sent == expected
    assert sent < 10000  # the constructor ceiling is not the per-call value


async def test_completion_cap_clamped_by_configured_ceiling():
    client = _make_client()
    adapter = _make_adapter(client, max_tokens=100)
    await adapter.generate_interpretation(_one_card_request())
    sent = client.beta.chat.completions.parse.call_args.kwargs["max_completion_tokens"]
    assert sent == 100


async def test_response_format_is_the_lean_reading_schema():
    client = _make_client()
    adapter = _make_adapter(client)
    await adapter.generate_interpretation(_one_card_request())
    assert client.beta.chat.completions.parse.call_args.kwargs["response_format"] is LeanReading


# --- Concurrency control ---


async def test_semaphore_caps_in_flight_calls():
    client = _make_client()
    completion = client.beta.chat.completions.parse.return_value
    gate = asyncio.Event()
    in_flight = 0
    peak = 0

    async def slow_call(**kwargs):
        nonlocal in_flight, peak
        in_flight += 1
        peak = max(peak, in_flight)
        await gate.wait()
        in_flight -= 1
        return completion

    client.beta.chat.completions.parse = AsyncMock(side_effect=slow_call)

    adapter = _make_adapter(client, max_concurrent=2, acquire_timeout=5.0)
    tasks = [
        asyncio.create_task(adapter.generate_interpretation(_one_card_request())) for _ in range(4)
    ]
    await asyncio.sleep(0.05)
    assert peak == 2
    gate.set()
    await asyncio.gather(*tasks)
    assert peak == 2


async def test_saturated_semaphore_returns_busy_after_bounded_wait():
    client = _make_client()
    started = asyncio.Event()

    async def hang(**kwargs):
        started.set()
        await asyncio.sleep(30)

    client.beta.chat.completions.parse = AsyncMock(side_effect=hang)
    adapter = _make_adapter(client, max_concurrent=1, acquire_timeout=0.05)

    hog = asyncio.create_task(adapter.generate_interpretation(_one_card_request()))
    await started.wait()
    with pytest.raises(LLMBusyError):
        await adapter.generate_interpretation(_one_card_request())
    hog.cancel()
    with pytest.raises(asyncio.CancelledError):
        await hog
