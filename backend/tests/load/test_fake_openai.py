"""The fake provider behind `scripts/load_interpretations.py` must speak enough of the
chat-completions wire format for the *real* SDK's structured-output `parse()` to accept
it — otherwise the live load test would measure the SDK rejecting the fake, not the
API under load. So this drives the fake with a genuine `AsyncOpenAI` client."""

import httpx
import pytest
from openai import AsyncOpenAI

from scripts.fake_openai import app as fake_openai_app
from src.llm.schemas import LeanReading


@pytest.fixture
def sdk_client(monkeypatch: pytest.MonkeyPatch) -> AsyncOpenAI:
    monkeypatch.setenv("FAKE_OPENAI_LATENCY_S", "0")
    return AsyncOpenAI(
        api_key="load-test",
        base_url="http://fake/v1",
        http_client=httpx.AsyncClient(transport=httpx.ASGITransport(app=fake_openai_app)),
        max_retries=0,
    )


async def test_sdk_parses_the_fake_completion_as_a_lean_reading(sdk_client: AsyncOpenAI):
    completion = await sdk_client.beta.chat.completions.parse(
        model="gpt-5.4",
        messages=[{"role": "user", "content": "Interpret The Fool."}],
        response_format=LeanReading,
        max_completion_tokens=500,
    )

    parsed = completion.choices[0].message.parsed
    assert isinstance(parsed, LeanReading)
    assert len(parsed.reading.split()) >= 50, "the fake should return a reading-sized narrative"
    assert completion.model == "gpt-5.4"
    assert completion.usage is not None
    assert completion.usage.prompt_tokens > 0
    assert completion.usage.completion_tokens > 0
    details = completion.usage.completion_tokens_details
    assert details is not None and details.reasoning_tokens == 300


async def test_fake_honours_the_latency_env(monkeypatch: pytest.MonkeyPatch):
    import time

    monkeypatch.setenv("FAKE_OPENAI_LATENCY_S", "0.2")
    client = AsyncOpenAI(
        api_key="load-test",
        base_url="http://fake/v1",
        http_client=httpx.AsyncClient(transport=httpx.ASGITransport(app=fake_openai_app)),
        max_retries=0,
    )
    started = time.perf_counter()
    await client.beta.chat.completions.parse(
        model="gpt-5.4",
        messages=[{"role": "user", "content": "x"}],
        response_format=LeanReading,
    )
    assert time.perf_counter() - started >= 0.2
