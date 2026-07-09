from datetime import date

import structlog

from src.cqrs.commands import BaseCommand, CommandHandler
from src.llm.schemas import CardInSpread
from src.readings.models import Reading
from src.readings.repository import ReadingWriteRepository
from src.readings.schemas import ReadingReadModel

logger = structlog.stdlib.get_logger(__name__)


class CreateReadingCommand(BaseCommand):
    user_id: str
    spread_name: str
    question: str | None = None
    birth_date: date | None = None
    cards: list[CardInSpread]


class CreateReadingHandler(CommandHandler[CreateReadingCommand, ReadingReadModel]):
    def __init__(self, write_repo: ReadingWriteRepository) -> None:
        self._write_repo = write_repo

    async def handle(self, command: CreateReadingCommand) -> ReadingReadModel:
        reading = Reading(
            user_id=command.user_id,
            spread_type=command.spread_name,
            question=command.question,
            birth_date=command.birth_date,
            cards=[
                {
                    "name": card.name,
                    "position": card.position,
                    "orientation": card.orientation.value,
                    "position_description": card.position_description,
                }
                for card in command.cards
            ],
        )

        document = reading.to_document()
        logger.debug("saving reading", document=document)
        reading_id = await self._write_repo.insert(document)

        return ReadingReadModel.model_validate(
            {
                "_id": reading_id,
                "user_id": command.user_id,
                "spread_type": reading.spread_type,
                "question": reading.question,
                "birth_date": reading.birth_date,
                "cards": reading.cards,
                "interpretation": None,
                "created_at": reading.created_at,
            }
        )
