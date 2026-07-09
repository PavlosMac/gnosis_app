import pytest
from bson import ObjectId

from src.auth.repository import AuthWriteRepository
from src.interpretations.commands.generate_interpretation import (
    GenerateInterpretationCommand,
    GenerateInterpretationHandler,
)
from src.interpretations.commands.save_interpretation import (
    SaveInterpretationCommand,
    SaveInterpretationHandler,
)
from src.interpretations.repository import (
    InterpretationReadRepository,
    InterpretationWriteRepository,
)
from src.interpretations.schemas import InterpretationSettingsOverride
from src.llm.mock_adapter import MockLLMAdapter
from src.llm.schemas import DEFAULT_SETTINGS, CardInSpread, ReadingStyle
from src.readings.commands.create_reading import CreateReadingCommand, CreateReadingHandler
from src.readings.repository import ReadingReadRepository, ReadingWriteRepository
from src.readings.service import ReadingNotFoundError


@pytest.fixture
def user_id():
    return str(ObjectId())


@pytest.fixture
def reading_repos(mock_db):
    return ReadingWriteRepository(mock_db), ReadingReadRepository(mock_db)


@pytest.fixture
def create_reading_handler(reading_repos):
    write_repo, _ = reading_repos
    return CreateReadingHandler(write_repo=write_repo)


@pytest.fixture
def generate_handler(reading_repos, mock_db):
    _, read_repo = reading_repos
    return GenerateInterpretationHandler(
        reading_read_repo=read_repo,
        user_write_repo=AuthWriteRepository(mock_db),
        llm=MockLLMAdapter(),
    )


@pytest.fixture
def save_handler(reading_repos, mock_db):
    _, read_repo = reading_repos
    return SaveInterpretationHandler(
        reading_read_repo=read_repo,
        write_repo=InterpretationWriteRepository(mock_db),
        read_repo=InterpretationReadRepository(mock_db),
    )


async def _create_reading(create_reading_handler, user_id: str):
    return await create_reading_handler.handle(
        CreateReadingCommand(
            user_id=user_id,
            spread_name="Celtic Cross",
            question="What lies ahead?",
            cards=[
                CardInSpread(
                    name="The Fool",
                    position="Present",
                    orientation="upright",
                    position_description="Will, drive, and what energises the situation",
                ),
            ],
        )
    )


async def test_generate_interpretation_returns_content(
    generate_handler, create_reading_handler, user_id
):
    reading = await _create_reading(create_reading_handler, user_id)
    result = await generate_handler.handle(
        GenerateInterpretationCommand(reading_id=reading.id, user_id=user_id)
    )
    assert len(result.card_interpretations) == 1
    assert result.card_interpretations[0].card_name == "The Fool"
    assert result.synthesis is not None
    assert result.model == "mock"
    assert result.settings == DEFAULT_SETTINGS


async def test_generate_interpretation_resolves_partial_settings_override(
    generate_handler, create_reading_handler, user_id
):
    reading = await _create_reading(create_reading_handler, user_id)
    result = await generate_handler.handle(
        GenerateInterpretationCommand(
            reading_id=reading.id,
            user_id=user_id,
            settings=InterpretationSettingsOverride(style=ReadingStyle.esoteric),
        )
    )
    assert result.settings.style == ReadingStyle.esoteric
    assert result.settings.depth == DEFAULT_SETTINGS.depth
    assert result.settings.tone == DEFAULT_SETTINGS.tone


async def test_generate_interpretation_does_not_persist(
    generate_handler, create_reading_handler, user_id, mock_db
):
    reading = await _create_reading(create_reading_handler, user_id)
    await generate_handler.handle(
        GenerateInterpretationCommand(reading_id=reading.id, user_id=user_id)
    )
    count = await mock_db["interpretations"].count_documents({})
    assert count == 0


async def test_generate_interpretation_increments_total_tokens_used(
    generate_handler, create_reading_handler, user_id, mock_db
):
    reading = await create_reading_handler.handle(
        CreateReadingCommand(
            user_id=user_id,
            spread_name="Significators",
            cards=[
                CardInSpread(name="The Fool", position="day number", orientation="upright"),
            ],
        )
    )
    await mock_db["users"].insert_one({"_id": ObjectId(user_id), "total_tokens_used": 100})

    await generate_handler.handle(
        GenerateInterpretationCommand(reading_id=reading.id, user_id=user_id)
    )

    user_doc = await mock_db["users"].find_one({"_id": ObjectId(user_id)})
    assert user_doc["total_tokens_used"] == 100 + 4503  # MockLLMAdapter's significators tokens


async def test_generate_interpretation_not_found(generate_handler, user_id):
    with pytest.raises(ReadingNotFoundError):
        await generate_handler.handle(
            GenerateInterpretationCommand(reading_id=str(ObjectId()), user_id=user_id)
        )


async def test_generate_interpretation_wrong_user(
    generate_handler, create_reading_handler, user_id
):
    reading = await _create_reading(create_reading_handler, user_id)
    other_user = str(ObjectId())
    with pytest.raises(ReadingNotFoundError):
        await generate_handler.handle(
            GenerateInterpretationCommand(reading_id=reading.id, user_id=other_user)
        )


async def test_save_interpretation_creates_document(
    create_reading_handler, generate_handler, save_handler, user_id
):
    reading = await _create_reading(create_reading_handler, user_id)
    generated = await generate_handler.handle(
        GenerateInterpretationCommand(reading_id=reading.id, user_id=user_id)
    )

    result = await save_handler.handle(
        SaveInterpretationCommand(
            reading_id=reading.id,
            user_id=user_id,
            card_interpretations=generated.card_interpretations,
            synthesis=generated.synthesis,
            model=generated.model,
            tokens_used=generated.tokens_used,
            settings=generated.settings,
        )
    )

    assert result.reading_id == reading.id
    assert result.settings == DEFAULT_SETTINGS
    assert result.synthesis == generated.synthesis
    assert result.card_interpretations[0].card_name == "The Fool"


async def test_save_interpretation_upserts_on_second_save(
    create_reading_handler, generate_handler, save_handler, user_id
):
    reading = await _create_reading(create_reading_handler, user_id)
    generated = await generate_handler.handle(
        GenerateInterpretationCommand(reading_id=reading.id, user_id=user_id)
    )
    first_save = await save_handler.handle(
        SaveInterpretationCommand(
            reading_id=reading.id,
            user_id=user_id,
            card_interpretations=generated.card_interpretations,
            synthesis="First synthesis",
            model=generated.model,
            tokens_used=generated.tokens_used,
            settings=generated.settings,
        )
    )
    second_save = await save_handler.handle(
        SaveInterpretationCommand(
            reading_id=reading.id,
            user_id=user_id,
            card_interpretations=generated.card_interpretations,
            synthesis="Second synthesis",
            model=generated.model,
            tokens_used=generated.tokens_used,
            settings=generated.settings,
        )
    )

    assert second_save.id == first_save.id
    assert second_save.synthesis == "Second synthesis"
    assert second_save.created_at == first_save.created_at


async def test_save_interpretation_not_found(save_handler, user_id):
    with pytest.raises(ReadingNotFoundError):
        await save_handler.handle(
            SaveInterpretationCommand(
                reading_id=str(ObjectId()),
                user_id=user_id,
                card_interpretations=[
                    {
                        "card_name": "The Fool",
                        "position": "Present",
                        "orientation": "upright",
                        "interpretation": "New beginnings.",
                    }
                ],
                synthesis="x",
                model="mock",
                tokens_used=0,
                settings=DEFAULT_SETTINGS,
            )
        )


async def test_save_interpretation_wrong_user(
    create_reading_handler, generate_handler, save_handler, user_id
):
    reading = await _create_reading(create_reading_handler, user_id)
    generated = await generate_handler.handle(
        GenerateInterpretationCommand(reading_id=reading.id, user_id=user_id)
    )
    other_user = str(ObjectId())
    with pytest.raises(ReadingNotFoundError):
        await save_handler.handle(
            SaveInterpretationCommand(
                reading_id=reading.id,
                user_id=other_user,
                card_interpretations=generated.card_interpretations,
                synthesis=generated.synthesis,
                model=generated.model,
                tokens_used=generated.tokens_used,
                settings=generated.settings,
            )
        )
