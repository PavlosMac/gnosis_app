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
from src.llm.schemas import InterpretationRequest, InterpretationResponse

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
            response = await self._client.chat.completions.create(
                model=self._model,
                max_tokens=self._max_tokens,
                temperature=0.7,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
            )
        except RateLimitError as exc:
            raise LLMRateLimitError() from exc
        except APIConnectionError as exc:
            raise LLMConnectionError() from exc
        except APIStatusError as exc:
            raise LLMResponseError(f"OpenAI API error: {exc.status_code}") from exc

        content = response.choices[0].message.content if response.choices else None
        if not content:
            raise LLMResponseError("Empty response from LLM")

        tokens_used = response.usage.total_tokens if response.usage else 0

        return InterpretationResponse(
            interpretation=content,
            model=response.model,
            tokens_used=tokens_used,
        )

    async def close(self) -> None:
        await self._client.close()
