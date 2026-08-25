from typing import Any

import structlog
from openai import (
    APIConnectionError,
    APIStatusError,
    AsyncOpenAI,
    ContentFilterFinishReasonError,
    LengthFinishReasonError,
    OpenAIError,
    RateLimitError,
)

from src.llm.card_catalog import get_card_meaning
from src.llm.errors import (
    CardNotFoundError,
    LLMConnectionError,
    LLMRateLimitError,
    LLMResponseError,
)
from src.llm.port import LLMPort
from src.llm.prompt_builder import (
    build_system_prompt,
    build_user_prompt,
    max_completion_tokens,
    request_word_budget,
)
from src.llm.schemas import (
    InterpretationRequest,
    InterpretationResponse,
    LLMInterpretationResult,
)

logger = structlog.stdlib.get_logger(__name__)


class OpenAIAdapter(LLMPort):
    def __init__(
        self, client: AsyncOpenAI, model: str, max_tokens: int, reasoning_effort: str
    ) -> None:
        self._client = client
        self._model = model
        self._max_tokens = max_tokens
        self._reasoning_effort = reasoning_effort

    async def generate_interpretation(
        self, request: InterpretationRequest
    ) -> InterpretationResponse:
        meanings: dict[str, dict[str, Any]] = {}
        for card in request.cards:
            meaning = get_card_meaning(card.name)
            if meaning is None:
                raise CardNotFoundError(card.name)
            meanings[card.name] = meaning

        system_prompt = build_system_prompt(request)
        user_prompt = build_user_prompt(request, meanings)

        # Derived per request — a 1-card draw and an 11-card Tree of Life differ ~8× in
        # output size, and the reserved cap counts against TPM rate limits at admission.
        # The configured max_tokens is an absolute ceiling, not the per-call value.
        derived_cap = max_completion_tokens(
            request_word_budget(request), len(request.cards), self._reasoning_effort
        )
        completion_cap = min(self._max_tokens, derived_cap)
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
            response = await self._client.beta.chat.completions.parse(
                model=self._model,
                max_completion_tokens=completion_cap,
                reasoning_effort=self._reasoning_effort,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
                response_format=LLMInterpretationResult,
            )
        except RateLimitError as exc:
            raise LLMRateLimitError() from exc
        except APIConnectionError as exc:
            raise LLMConnectionError() from exc
        except APIStatusError as exc:
            raise LLMResponseError(f"OpenAI API error: {exc.status_code}") from exc
        except LengthFinishReasonError as exc:
            # parse() raises when finish_reason == "length": the completion hit
            # max_completion_tokens, which reasoning tokens also count against.
            raise LLMResponseError("LLM response truncated by token limit") from exc
        except ContentFilterFinishReasonError as exc:
            raise LLMResponseError("LLM response blocked by content filter") from exc
        except OpenAIError as exc:
            # Catch-all for the rest of the SDK hierarchy (APIResponseValidationError,
            # future additions) — anything from the client maps to a domain error.
            raise LLMResponseError() from exc
        parsed = response.choices[0].message.parsed if response.choices else None
        if not parsed:
            raise LLMResponseError("Empty or unparseable response from LLM")

        usage = response.usage
        tokens_used = usage.total_tokens if usage else 0
        if usage:
            details = usage.completion_tokens_details
            logger.info(
                "openai usage",
                model=response.model,
                prompt_tokens=usage.prompt_tokens,
                completion_tokens=usage.completion_tokens,
                reasoning_tokens=details.reasoning_tokens if details else None,
                total_tokens=usage.total_tokens,
            )

        return InterpretationResponse(
            card_interpretations=parsed.card_interpretations,
            synthesis=parsed.synthesis,
            model=response.model,
            tokens_used=tokens_used,
        )

    async def close(self) -> None:
        await self._client.close()
