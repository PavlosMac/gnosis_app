from src.interpretations.queries.get_interpretations_by_reading_id import (
    GetInterpretationsByReadingIdQuery,
)
from src.llm.schemas import InterpretationLens
from tests.factories import make_settings as _settings


async def test_returns_empty_list_when_reading_has_no_interpretations(
    make_reading, interpretations_query_handler
):
    reading = await make_reading()

    result = await interpretations_query_handler.handle(
        GetInterpretationsByReadingIdQuery(reading_id=reading.id)
    )

    assert result == []


async def test_returns_every_saved_lens_for_a_reading(
    make_reading, generate_and_save, interpretations_query_handler
):
    reading = await make_reading()
    await generate_and_save(reading.id, _settings())
    await generate_and_save(reading.id, _settings(lens=InterpretationLens.esoteric))

    result = await interpretations_query_handler.handle(
        GetInterpretationsByReadingIdQuery(reading_id=reading.id)
    )

    assert len(result) == 2
    assert {i.settings.lens for i in result} == {
        InterpretationLens.traditional,
        InterpretationLens.esoteric,
    }


async def test_does_not_return_another_readings_interpretations(
    make_reading, generate_and_save, interpretations_query_handler
):
    reading_one = await make_reading()
    reading_two = await make_reading()
    await generate_and_save(reading_one.id, _settings())

    result = await interpretations_query_handler.handle(
        GetInterpretationsByReadingIdQuery(reading_id=reading_two.id)
    )

    assert result == []
