from src.llm.port import LLMPort
from src.llm.schemas import InterpretationRequest, InterpretationResponse, LLMUsage


class MockLLMAdapter(LLMPort):
    """Deterministic stand-in for local dev and tests: one woven narrative naming every
    card, zero-cost usage so the budget gate and ledger paths need no special-casing."""

    async def generate_interpretation(
        self, request: InterpretationRequest
    ) -> InterpretationResponse:
        sentences = [
            f"Mock reading for the {request.spread_name} spread"
            + (f' asking "{request.question}"' if request.question else "")
            + "."
        ]
        for card in request.cards:
            sentence = f"{card.name} ({card.orientation.value})"
            if card.position:
                sentence += f" in the {card.position} position"
            sentences.append(sentence + " enters the story.")
        sentences.append("The threads resolve into a single mock narrative.")

        return InterpretationResponse(
            reading=" ".join(sentences),
            model="mock",
            usage=LLMUsage(),
        )

    async def close(self) -> None:
        pass
