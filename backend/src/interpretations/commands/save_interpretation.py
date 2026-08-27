from src.cqrs.commands import BaseCommand, CommandHandler
from src.interpretations.models import Interpretation
from src.interpretations.repository import InterpretationWriteRepository
from src.interpretations.schemas import CardInterpretationReadModel
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


class SaveInterpretationHandler(CommandHandler[SaveInterpretationCommand, None]):
    def __init__(
        self,
        reading_read_repo: ReadingReadRepository,
        write_repo: InterpretationWriteRepository,
    ) -> None:
        self._reading_read_repo = reading_read_repo
        self._write_repo = write_repo

    async def handle(self, command: SaveInterpretationCommand) -> None:
        reading = await self._reading_read_repo.find_owned(command.reading_id, command.user_id)
        if reading is None:
            raise ReadingNotFoundError()

        interpretation = Interpretation(
            reading_id=command.reading_id,
            user_id=command.user_id,
            card_interpretations=[
                ci.model_dump(mode="json", exclude_none=True) for ci in command.card_interpretations
            ],
            synthesis=command.synthesis,
            tokens_used=command.tokens_used,
            model=command.model,
            settings=command.settings.model_dump(mode="json"),
        )
        await self._write_repo.upsert_by_lens(command.reading_id, interpretation.to_document())
