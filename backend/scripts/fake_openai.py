"""A stand-in for api.openai.com, for load-testing the API without spending money.

Serves `POST /v1/chat/completions` with the minimum the SDK's structured-output
`parse()` accepts (`message.content` holding the JSON for `LeanReading`, no `refusal`,
`finish_reason: "stop"`, a `usage` block). Every call sleeps `FAKE_OPENAI_LATENCY_S`
(default 2.0) first, so the API's semaphore and acquire timeout are exercised the way a
slow real model would. `FAKE_OPENAI_FAIL_RATE` (default 0) makes every 1/rate-th call a
429, to exercise the rate-limit path — note the SDK retries 429s, so expect extra latency.

Usage:
    uv run uvicorn scripts.fake_openai:app --port 8099
    # then start the API with
    OPENAI_API_KEY=anything OPENAI_BASE_URL=http://127.0.0.1:8099/v1 uv run uvicorn src.main:app

`scripts/load_interpretations.py` starts both and tears them down for you.
"""

import asyncio
import itertools
import json
import os
import time
from typing import Any

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

app = FastAPI(title="fake-openai", docs_url=None, redoc_url=None)

COMPLETION_TOKENS = 700
REASONING_TOKENS = 300

# Roughly a one-card reading's worth of prose, so the response body is realistically sized
_SENTENCE = (
    "The Fool steps from the cliff with the sun at his back, and the little dog at his "
    "heels barks not in warning but in joy, for the fall is the beginning of the road. "
)
NARRATIVE = (_SENTENCE * 5).strip()

_calls = itertools.count(1)


def _env_float(name: str, default: float) -> float:
    raw = os.environ.get(name)
    return float(raw) if raw else default


def _should_fail(call_number: int) -> bool:
    rate = _env_float("FAKE_OPENAI_FAIL_RATE", 0.0)
    if rate <= 0:
        return False
    return call_number % max(round(1 / rate), 1) == 0


def _prompt_tokens(messages: list[dict[str, Any]]) -> int:
    chars = sum(len(str(m.get("content", ""))) for m in messages)
    return max(chars // 4, 1)


@app.post("/v1/chat/completions")
async def chat_completions(request: Request) -> JSONResponse:
    body: dict[str, Any] = await request.json()
    await asyncio.sleep(_env_float("FAKE_OPENAI_LATENCY_S", 2.0))

    call_number = next(_calls)
    if _should_fail(call_number):
        return JSONResponse(
            status_code=429,
            headers={"retry-after": "0"},
            content={
                "error": {
                    "message": "Rate limit reached (fake)",
                    "type": "rate_limit_error",
                    "code": "rate_limit_exceeded",
                }
            },
        )

    prompt_tokens = _prompt_tokens(body.get("messages", []))
    return JSONResponse(
        {
            "id": f"chatcmpl-fake-{call_number}",
            "object": "chat.completion",
            "created": int(time.time()),
            "model": body.get("model", "gpt-5.4"),
            "choices": [
                {
                    "index": 0,
                    "finish_reason": "stop",
                    "logprobs": None,
                    "message": {
                        "role": "assistant",
                        "refusal": None,
                        "content": json.dumps({"reading": NARRATIVE}),
                    },
                }
            ],
            "usage": {
                "prompt_tokens": prompt_tokens,
                "completion_tokens": COMPLETION_TOKENS,
                "total_tokens": prompt_tokens + COMPLETION_TOKENS,
                "completion_tokens_details": {"reasoning_tokens": REASONING_TOKENS},
            },
        }
    )
