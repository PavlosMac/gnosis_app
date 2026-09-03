import asyncio
import time
from typing import Any, cast

import structlog
from openai import (
    APIConnectionError,
    APIStatusError,
    APITimeoutError,
    AsyncOpenAI,
    ContentFilterFinishReasonError,
    LengthFinishReasonError,
    OpenAIError,
    RateLimitError,
)
from openai.types.chat import ParsedChatCompletion

from src.llm.errors import (
    LLMBusyError,
    LLMConnectionError,
    LLMError,
    LLMRateLimitError,
    LLMResponseError,
    LLMTimeoutError,
)
from src.llm.port import LLMPort
from src.llm.prompt_builder import (
    build_system_prompt,
    build_user_prompt,
    clamped_completion_cap,
    max_completion_tokens,
    request_word_budget,
)
from src.llm.schemas import (
    InterpretationRequest,
    InterpretationResponse,
    LeanReading,
    LLMUsage,
)

logger = structlog.stdlib.get_logger(__name__)


class OpenAIAdapter(LLMPort):
    def __init__(
        self,
        client: AsyncOpenAI,
        model: str,
        max_tokens: int,
        reasoning_effort: str,
        max_concurrent: int = 10,
        timeout: float = 120.0,
        acquire_timeout: float = 30.0,
    ) -> None:
        self._client = client
        self._model = model
        self._max_tokens = max_tokens
        self._reasoning_effort = reasoning_effort
        # Per-process: the effective in-flight cap multiplies by uvicorn workers.
        self._semaphore = asyncio.Semaphore(max_concurrent)
        self._timeout = timeout
        self._acquire_timeout = acquire_timeout

    async def generate_interpretation(
        self, request: InterpretationRequest
    ) -> InterpretationResponse:
        system_prompt = build_system_prompt(request)
        user_prompt = build_user_prompt(request)

        # Derived per request — a 1-card draw and an 11-card Tree of Life differ ~8× in
        # output size, and the reserved cap counts against TPM rate limits at admission.
        # The configured max_tokens is an absolute ceiling, not the per-call value.
        word_budget = request_word_budget(request)
        derived_cap = max_completion_tokens(word_budget, self._reasoning_effort)
        completion_cap = clamped_completion_cap(
            word_budget, self._reasoning_effort, self._max_tokens
        )
        if completion_cap < derived_cap:
            logger.warning(
                "completion cap clamped by openai_max_tokens — response may truncate",
                derived_cap=derived_cap,
                configured_max=self._max_tokens,
            )
        logger.debug(
            "calling openai",
            model=self._model,
            spread_name=request.spread_name,
            cards=[c.name for c in request.cards],
            completion_cap=completion_cap,
        )

        try:
            await asyncio.wait_for(self._semaphore.acquire(), timeout=self._acquire_timeout)
        except TimeoutError:
            logger.warning(
                "no llm capacity within acquire timeout",
                acquire_timeout_s=self._acquire_timeout,
            )
            raise LLMBusyError()

        start = time.monotonic()
        try:
            response = await self._call_openai(system_prompt, user_prompt, completion_cap)
        except LLMError as exc:
            logger.warning(
                "openai call failed",
                error=type(exc).__name__,
                detail=exc.detail,
                duration_s=round(time.monotonic() - start, 3),
                model=self._model,
                spread_name=request.spread_name,
            )
            raise
        finally:
            self._semaphore.release()
        duration_s = round(time.monotonic() - start, 3)

        parsed = response.choices[0].message.parsed if response.choices else None
        if not parsed:
            logger.warning("openai call failed", error="EmptyResponse", duration_s=duration_s)
            raise LLMResponseError("Empty or unparseable response from LLM")

        usage = self._extract_usage(response)
        logger.info(
            "openai call completed",
            model=response.model,
            prompt_tokens=usage.prompt_tokens,
            completion_tokens=usage.completion_tokens,
            reasoning_tokens=usage.reasoning_tokens,
            duration_s=duration_s,
            spread_name=request.spread_name,
        )

        return InterpretationResponse(reading=parsed.reading, model=response.model, usage=usage)

    async def _call_openai(
        self, system_prompt: str, user_prompt: str, completion_cap: int
    ) -> ParsedChatCompletion[LeanReading]:
        try:
            return await self._client.beta.chat.completions.parse(
                model=self._model,
                max_completion_tokens=completion_cap,
                reasoning_effort=cast(Any, self._reasoning_effort),
                timeout=self._timeout,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
                response_format=LeanReading,
            )
        # APITimeoutError subclasses APIConnectionError — this clause must come first or
        # timeouts silently map to 502.
        except APITimeoutError as exc:
            raise LLMTimeoutError() from exc
        except RateLimitError as exc:
            raise LLMRateLimitError() from exc
        except APIConnectionError as exc:
            raise LLMConnectionError() from exc
        except APIStatusError as exc:
            raise LLMResponseError(f"OpenAI API error: {exc.status_code}") from exc
        except LengthFinishReasonError as exc:
            # parse() raises when finish_reason == "length": the completion hit
            # max_completion_tokens, which reasoning tokens also count against. The
            # provider billed these tokens but the user won't be charged — keep the
            # wasted spend visible.
            wasted = getattr(exc.completion, "usage", None)
            logger.warning(
                "llm response truncated — wasted provider spend",
                completion_tokens=wasted.completion_tokens if wasted else None,
                prompt_tokens=wasted.prompt_tokens if wasted else None,
            )
            raise LLMResponseError("LLM response truncated by token limit") from exc
        except ContentFilterFinishReasonError as exc:
            raise LLMResponseError("LLM response blocked by content filter") from exc
        except OpenAIError as exc:
            # Catch-all for the rest of the SDK hierarchy (APIResponseValidationError,
            # future additions) — anything from the client maps to a domain error.
            raise LLMResponseError() from exc

    @staticmethod
    def _extract_usage(response) -> LLMUsage:
        usage = response.usage
        if usage is None:
            return LLMUsage()
        details = usage.completion_tokens_details
        return LLMUsage(
            prompt_tokens=usage.prompt_tokens,
            completion_tokens=usage.completion_tokens,
            reasoning_tokens=(details.reasoning_tokens or 0) if details else 0,
        )

    async def close(self) -> None:
        await self._client.close()
