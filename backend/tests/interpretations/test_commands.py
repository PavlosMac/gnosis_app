import pytest
from bson import ObjectId

from src.interpretations.commands.generate_interpretation import GenerateInterpretationCommand
from src.interpretations.commands.save_interpretation import SaveInterpretationCommand
from src.interpretations.queries.get_interpretations_by_reading_id import (
    GetInterpretationsByReadingIdQuery,
)
from src.llm.schemas import CardInSpread, InterpretationLens, ReadingIntent
from src.readings.commands.create_reading import CreateReadingCommand
from src.readings.service import ReadingNotFoundError
from tests.factories import DEFAULT_SETTINGS as DEFAULT
from tests.factories import make_settings as _settings


async def test_generate_interpretation_returns_content(generate_handler, make_reading, user_id):
    reading = await make_reading()
    result = await generate_handler.handle(
        GenerateInterpretationCommand(reading_id=reading.id, user_id=user_id, settings=DEFAULT)
    )
    assert len(result.card_interpretations) == 1
    assert result.card_interpretations[0].card_name == "The Fool"
    assert result.synthesis is not None
    assert result.model == "mock"
    assert result.settings == DEFAULT


async def test_generate_interpretation_echoes_the_settings_it_was_given(
    generate_handler, make_reading, user_id
):
    """Settings are echoed verbatim — there is no server-side default to fall back to."""
    reading = await make_reading()
    chosen = _settings(
        lens=InterpretationLens.alchemical, intent=ReadingIntent.predictive, depth=85
    )
    result = await generate_handler.handle(
        GenerateInterpretationCommand(reading_id=reading.id, user_id=user_id, settings=chosen)
    )
    assert result.settings == chosen


async def test_generate_interpretation_does_not_persist(
    generate_handler, make_reading, user_id, mock_db
):
    reading = await make_reading()
    await generate_handler.handle(
        GenerateInterpretationCommand(reading_id=reading.id, user_id=user_id, settings=DEFAULT)
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
        GenerateInterpretationCommand(reading_id=reading.id, user_id=user_id, settings=DEFAULT)
    )

    user_doc = await mock_db["users"].find_one({"_id": ObjectId(user_id)})
    assert user_doc["total_tokens_used"] == 100 + 4503  # MockLLMAdapter's significators tokens


async def test_generate_interpretation_not_found(generate_handler, user_id):
    with pytest.raises(ReadingNotFoundError):
        await generate_handler.handle(
            GenerateInterpretationCommand(
                reading_id=str(ObjectId()), user_id=user_id, settings=DEFAULT
            )
        )


async def test_generate_interpretation_wrong_user(generate_handler, make_reading, user_id):
    reading = await make_reading()
    other_user = str(ObjectId())
    with pytest.raises(ReadingNotFoundError):
        await generate_handler.handle(
            GenerateInterpretationCommand(
                reading_id=reading.id, user_id=other_user, settings=DEFAULT
            )
        )


async def _saved_slots(interpretations_query_handler, reading_id):
    return await interpretations_query_handler.handle(
        GetInterpretationsByReadingIdQuery(reading_id=reading_id)
    )


async def test_save_interpretation_creates_document(
    make_reading, generate_and_save, interpretations_query_handler, user_id
):
    reading = await make_reading()
    generated = await generate_and_save(reading.id, DEFAULT)

    [saved] = await _saved_slots(interpretations_query_handler, reading.id)
    assert saved.reading_id == reading.id
    assert saved.settings == DEFAULT
    assert saved.synthesis == generated.synthesis
    assert saved.card_interpretations[0].card_name == "The Fool"


async def test_save_interpretation_upserts_on_second_save(
    make_reading, generate_and_save, interpretations_query_handler, user_id
):
    reading = await make_reading()

    await generate_and_save(reading.id, DEFAULT, synthesis="First synthesis")
    [first] = await _saved_slots(interpretations_query_handler, reading.id)
    await generate_and_save(reading.id, DEFAULT, synthesis="Second synthesis")
    [second] = await _saved_slots(interpretations_query_handler, reading.id)

    assert second.id == first.id
    assert second.synthesis == "Second synthesis"
    assert second.created_at == first.created_at


def _save_command(reading_id: str, user_id: str) -> SaveInterpretationCommand:
    return SaveInterpretationCommand(
        reading_id=reading_id,
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
        settings=DEFAULT,
    )


async def test_save_interpretation_not_found(save_handler, user_id):
    with pytest.raises(ReadingNotFoundError):
        await save_handler.handle(_save_command(str(ObjectId()), user_id))


async def test_save_interpretation_wrong_user(make_reading, save_handler, user_id):
    reading = await make_reading()
    other_user = str(ObjectId())
    with pytest.raises(ReadingNotFoundError):
        await save_handler.handle(_save_command(reading.id, other_user))


async def test_slot_key_is_derived_from_settings_lens(
    make_reading, generate_and_save, interpretations_query_handler, user_id
):
    """The repository derives the slot from settings.lens, so no caller can store a
    document under a different slot than its settings claim — the invariant the old
    command-level lens/settings.lens mismatch check used to guard at runtime."""
    reading = await make_reading()
    await generate_and_save(reading.id, _settings(lens=InterpretationLens.esoteric))

    [saved] = await _saved_slots(interpretations_query_handler, reading.id)
    assert saved.settings.lens == InterpretationLens.esoteric


async def test_each_lens_gets_its_own_slot(
    make_reading, generate_and_save, interpretations_query_handler, user_id
):
    reading = await make_reading()

    await generate_and_save(reading.id, _settings(lens=InterpretationLens.traditional))
    await generate_and_save(reading.id, _settings(lens=InterpretationLens.esoteric))

    all_interpretations = await _saved_slots(interpretations_query_handler, reading.id)
    assert len(all_interpretations) == 2
    assert {i.settings.lens for i in all_interpretations} == {
        InterpretationLens.traditional,
        InterpretationLens.esoteric,
    }


async def test_changing_intent_replaces_the_lens_slot_rather_than_adding_one(
    make_reading, generate_and_save, interpretations_query_handler, user_id
):
    """Intent is stored on the slot but is not part of its identity."""
    reading = await make_reading()

    await generate_and_save(
        reading.id, _settings(lens=InterpretationLens.traditional, intent=ReadingIntent.reflective)
    )
    [first] = await _saved_slots(interpretations_query_handler, reading.id)
    await generate_and_save(
        reading.id, _settings(lens=InterpretationLens.traditional, intent=ReadingIntent.predictive)
    )
    [second] = await _saved_slots(interpretations_query_handler, reading.id)

    assert second.id == first.id
    assert second.settings.intent == ReadingIntent.predictive
    assert second.created_at == first.created_at
