from src.llm.card_catalog import get_card_meaning
from src.llm.errors import CardNotFoundError
from src.llm.port import LLMPort
from src.llm.schemas import (
    SIGNIFICATORS_SPREAD,
    CardInterpretation,
    InterpretationRequest,
    InterpretationResponse,
    Orientation,
)

_SIGNIFICATORS_MOCK = InterpretationResponse(
    card_interpretations=[
        CardInterpretation(
            card_name="The Hierophant",
            position="day number",
            orientation=Orientation.upright,
            interpretation=(
                "The Hierophant as your day number card signifies a deep connection to tradition, "
                "structure, and societal norms. You present to the world as someone who values "
                "established systems and respects the wisdom of institutions. This card highlights "
                "your role as a teacher or guide, where you may naturally embody the archetype of "
                "'The Teacher.' You likely have a deep-seated respect for authority and may find "
                "fulfillment in roles that allow you to impart knowledge or uphold communal "
                "values. With Taurus as the astrological correspondence, there is a fixed, earthy "
                "quality to your personality that emphasizes reliability, perseverance, and a "
                "practical approach to life."
            ),
        ),
        CardInterpretation(
            card_name="The Empress",
            position="life number 1",
            orientation=Orientation.upright,
            interpretation=(
                "The Empress in your life number position highlights an innate connection with "
                "abundance, beauty, and nurturing energies. You are deeply in tune with nature and "
                "creativity, embodying the archetype of 'The Mother.' This card suggests that your "
                "life path is infused with a sense of fertility and growth, both literally and "
                "metaphorically. Your presence often brings harmony and sensuality to your "
                "surroundings, encouraging others to appreciate the beauty and bounty of life. "
                "The Earth element and the influence of Venus in Aries suggest a dynamic yet "
                "nurturing spirit, characterized by a blend of creativity and leadership."
            ),
        ),
        CardInterpretation(
            card_name="The Hanged Man",
            position="life number 2",
            orientation=Orientation.upright,
            interpretation=(
                "The Hanged Man reveals a life theme centered around patience, introspection, and "
                "the pursuit of deeper understanding. As part of your life path, you are called to "
                "embrace moments of suspension and surrender, allowing yourself to see the world "
                "from new perspectives. This card suggests a journey of sacrifice and initiation, "
                "where you willingly undergo transformation to attain wisdom. The energy of "
                "Scorpio and the influence of Neptune and Pluto suggest a profound ability to "
                "delve into the mysteries of the mind and soul, fostering a unique vision and "
                "artistic insight."
            ),
        ),
        CardInterpretation(
            card_name="The World",
            position="life number 3",
            orientation=Orientation.upright,
            interpretation=(
                "The World card indicates that your life journey is one of achieving mastery and "
                "fulfillment. You are someone who seeks wholeness and completeness in your "
                "endeavors, often bringing projects and phases of life to successful conclusions. "
                "This card suggests that you have the ability to integrate various aspects of your "
                "life into a cohesive whole, achieving a sense of empowerment and recognition. "
                "The card's association with the Vernal Equinox speaks to your capability to draw "
                "from a wide range of influences, embodying a sense of universality and the "
                "culmination of acquired knowledge."
            ),
        ),
        CardInterpretation(
            card_name="Strength",
            position="star sign",
            orientation=Orientation.upright,
            interpretation=(
                "As a Leo, the Strength card perfectly encapsulates your core identity. You "
                "possess a vibrant energy and a charismatic presence that naturally draws others "
                "to you. This card highlights your courage, confidence, and the ability to harness "
                "your inner strength to overcome adversity. With a strong willpower and a zest "
                "for life, you are driven by passion and creativity. The Sun and Mars influence "
                "suggest that you thrive in settings where you can lead and inspire others, often "
                "finding yourself in the spotlight or in roles that require dynamic leadership."
            ),
        ),
        CardInterpretation(
            card_name="Six of Wands",
            position="decanate",
            orientation=Orientation.upright,
            interpretation=(
                "The Six of Wands as your decanate card underscores a natural inclination towards "
                "success and recognition. You are likely to experience triumphs that build upon "
                "your past achievements, and you possess the drive and determination to pursue "
                "your goals with clarity and focus. This card suggests a strong sense of identity "
                "and a willingness to take the lead, often culminating in public acclaim or media "
                "attention. The Fire element reinforces your dynamic and ambitious nature, "
                "constantly propelling you towards new ventures and victories."
            ),
        ),
    ],
    synthesis=(
        "This significator chart reveals a querent deeply attuned to the interplay of tradition "
        "and innovation, nurturing and leading. The Hierophant and The Empress together highlight "
        "a character that values wisdom and structure, while also embracing the nurturing and "
        "creative forces of life. As your life continues, the themes of The Hanged Man and The "
        "World suggest that you are on a journey of profound introspection and accomplishment, "
        "striving for both personal growth and the fulfillment of your broader goals. Strength, "
        "as your Leo card, amplifies your natural charisma and drive, while the Six of Wands "
        "confirms your path towards recognition and success, driven by a strong sense of purpose "
        "and leadership. Together, these cards paint a portrait of a person who is both a "
        "grounded teacher and a visionary leader, harmonizing the practical with the spiritual, "
        "and the traditional with the progressive."
    ),
    model="mock",
    tokens_used=4503,
)


class MockLLMAdapter(LLMPort):
    async def generate_interpretation(
        self, request: InterpretationRequest
    ) -> InterpretationResponse:
        if request.spread_name == SIGNIFICATORS_SPREAD:
            return _SIGNIFICATORS_MOCK

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
                        + (f" in {card.position} position" if card.position else "")
                        + f" ({card.orientation})."
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
