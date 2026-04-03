from src.llm.card_catalog import get_card_meaning
from src.llm.errors import CardNotFoundError
from src.llm.port import LLMPort
from src.llm.schemas import (
    CardInterpretation,
    InterpretationRequest,
    InterpretationResponse,
)


class MockLLMAdapter(LLMPort):
    async def generate_interpretation(
        self, request: InterpretationRequest
    ) -> InterpretationResponse:
        interpretations: list[CardInterpretation] = []
        for card in request.cards:
            if get_card_meaning(card.name) is None:
                raise CardNotFoundError(card.name)
            interpretations.append(
                CardInterpretation(
                    card_name=card.name,
                    position=card.position,
                    orientation=card.orientation,
                    interpretation=(
                        f"Mock interpretation for {card.name}"
                        f" in {card.position} position ({card.orientation})."
                    ),
                )
            )

        return InterpretationResponse(
            card_interpretations=interpretations,
            synthesis="Mock synthesis: this is a placeholder response from the mock LLM adapter.",
            model="mock",
            tokens_used=0,
        )

    async def close(self) -> None:
        pass
