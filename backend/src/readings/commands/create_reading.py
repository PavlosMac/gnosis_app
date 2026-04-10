from src.cqrs.commands import BaseCommand, CommandHandler
from src.llm.port import LLMPort
from src.llm.schemas import CardInSpread, InterpretationRequest
from src.readings.models import Reading
from src.readings.repository import ReadingWriteRepository
from src.readings.schemas import ReadingReadModel


class CreateReadingCommand(BaseCommand):
    user_id: str
    spread_name: str
    question: str | None = None
    cards: list[CardInSpread]


class CreateReadingHandler(CommandHandler[CreateReadingCommand, ReadingReadModel]):
    def __init__(
        self,
        write_repo: ReadingWriteRepository,
        llm: LLMPort,
    ) -> None:
        self._write_repo = write_repo
        self._llm = llm

    async def handle(self, command: CreateReadingCommand) -> ReadingReadModel:
        llm_request = InterpretationRequest(
            spread_name=command.spread_name,
            question=command.question,
            cards=command.cards,
        )
        llm_response = await self._llm.generate_interpretation(llm_request)

        reading = Reading(
            user_id=command.user_id,
            spread_type=command.spread_name,
            question=command.question,
            cards=[
                {
                    "name": card.name,
                    "position": card.position,
                    "orientation": card.orientation.value,
                }
                for card in command.cards
            ],
            card_interpretations=[
                {
                    "card_name": ci.card_name,
                    "position": ci.position,
                    "orientation": ci.orientation.value,
                    "interpretation": ci.interpretation,
                }
                for ci in llm_response.card_interpretations
            ],
            synthesis=llm_response.synthesis,
            tokens_used=llm_response.tokens_used,
            model=llm_response.model,
        )

        reading_id = await self._write_repo.insert(reading.to_document())

        return ReadingReadModel.model_validate(
            {
                "_id": reading_id,
                "user_id": command.user_id,
                "spread_type": reading.spread_type,
                "question": reading.question,
                "cards": reading.cards,
                "card_interpretations": reading.card_interpretations,
                "synthesis": reading.synthesis,
                "tokens_used": reading.tokens_used,
                "model": reading.model,
                "created_at": reading.created_at,
            }
        )
