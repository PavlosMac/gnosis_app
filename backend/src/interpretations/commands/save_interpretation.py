from bson import ObjectId
from bson.errors import InvalidId

from src.cqrs.commands import BaseCommand, CommandHandler
from src.interpretations.models import Interpretation
from src.interpretations.repository import (
    InterpretationReadRepository,
    InterpretationWriteRepository,
)
from src.interpretations.schemas import CardInterpretationReadModel, InterpretationReadModel
from src.llm.schemas import InterpretationSettings
from src.readings.repository import ReadingReadRepository
from src.readings.service import ReadingNotFoundError


class SaveInterpretationCommand(BaseCommand):
    reading_id: str
    user_id: str
    card_interpretations: list[CardInterpretationReadModel]
    synthesis: str
    model: str
    tokens_used: int
    settings: InterpretationSettings
    context: str | None = None


class SaveInterpretationHandler(
    CommandHandler[SaveInterpretationCommand, InterpretationReadModel]
):
    def __init__(
        self,
        reading_read_repo: ReadingReadRepository,
        write_repo: InterpretationWriteRepository,
        read_repo: InterpretationReadRepository,
    ) -> None:
        self._reading_read_repo = reading_read_repo
        self._write_repo = write_repo
        self._read_repo = read_repo

    async def handle(self, command: SaveInterpretationCommand) -> InterpretationReadModel:
        try:
            reading_oid = ObjectId(command.reading_id)
        except InvalidId:
            raise ReadingNotFoundError()
        reading = await self._reading_read_repo.find_one(
            {"_id": reading_oid, "user_id": ObjectId(command.user_id)}
        )
        if reading is None:
            raise ReadingNotFoundError()

        interpretation = Interpretation(
            reading_id=command.reading_id,
            user_id=command.user_id,
            card_interpretations=[
                {
                    "card_name": ci.card_name,
                    "position": ci.position,
                    "orientation": ci.orientation.value,
                    "interpretation": ci.interpretation,
                }
                for ci in command.card_interpretations
            ],
            synthesis=command.synthesis,
            tokens_used=command.tokens_used,
            model=command.model,
            settings=command.settings.model_dump(mode="json"),
            context=command.context,
        )
        await self._write_repo.upsert_by_reading_id(
            command.reading_id, interpretation.to_document()
        )

        doc = await self._read_repo.find_by_reading_id(command.reading_id)
        return InterpretationReadModel.model_validate(doc)
