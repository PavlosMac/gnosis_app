from src.core.base_schema import AppSchema


class MajorArcanaMeaningResponse(AppSchema):
    """The generated card-of-the-day write-up for one major arcana card: two paragraphs,
    the day upright and its shadow (no reversed reading, decided 2026-11-10). `number` is
    the frontend deck index (0 = The Fool .. 21 = The World) and `name` the frontend
    spelling, so the client looks a card up by its own `idx` with no alias logic.
    Generation metadata stored alongside (model, effort, word_count, generated_at) is not
    exposed."""

    number: int
    name: str
    upright: str
    shadow: str


class SpreadCardMeaningResponse(AppSchema):
    """The general meaning of one card of the full deck, shown when a card in a spread is
    clicked: one piece of plain prose, paragraphs separated by a blank line, the same text
    whether the card fell upright or reversed. `number` is the frontend deck index
    (0 = The Fool .. 77 = King of Swords). Generation metadata is not exposed."""

    number: int
    name: str
    meaning: str
