from typing import Any

import structlog
from openai import APIConnectionError, APIStatusError, AsyncOpenAI, RateLimitError

from src.llm.card_catalog import get_card_meaning
from src.llm.errors import (
    CardNotFoundError,
    LLMConnectionError,
    LLMRateLimitError,
    LLMResponseError,
)
from src.llm.port import LLMPort
from src.llm.prompt_builder import build_system_prompt, build_user_prompt
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

        logger.debug(
            "calling openai",
            model=self._model,
            spread_name=request.spread_name,
            cards=[c.name for c in request.cards],
        )

        try:
            response = await self._client.beta.chat.completions.parse(
                model=self._model,
                max_completion_tokens=self._max_tokens,
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
