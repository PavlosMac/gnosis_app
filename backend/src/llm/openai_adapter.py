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
    def __init__(self, client: AsyncOpenAI, model: str, max_tokens: int) -> None:
        self._client = client
        self._model = model
        self._max_tokens = max_tokens

    async def generate_interpretation(
        self, request: InterpretationRequest
    ) -> InterpretationResponse:
        meanings: dict[str, dict[str, Any]] = {}
        for card in request.cards:
            meaning = get_card_meaning(card.name)
            if meaning is None:
                raise CardNotFoundError(card.name)
            meanings[card.name] = meaning

        system_prompt = build_system_prompt()
        user_prompt = build_user_prompt(request, meanings)

        logger.debug(
            "calling openai",
            model=self._model,
            cards=[c.name for c in request.cards],
        )

        try:
            response = await self._client.beta.chat.completions.parse(
                model=self._model,
                max_tokens=self._max_tokens,
                temperature=0.7,
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

        tokens_used = response.usage.total_tokens if response.usage else 0

        return InterpretationResponse(
            card_interpretations=parsed.card_interpretations,
            synthesis=parsed.synthesis,
            model=response.model,
            tokens_used=tokens_used,
        )

    async def close(self) -> None:
        await self._client.close()
