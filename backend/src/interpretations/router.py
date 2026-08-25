from fastapi import APIRouter

from src.core.dependencies import CurrentUserId, MediatorDep
from src.interpretations.commands.generate_interpretation import GenerateInterpretationCommand
from src.interpretations.commands.save_interpretation import SaveInterpretationCommand
from src.interpretations.queries.get_interpretations_by_reading_id import (
    GetInterpretationsByReadingIdQuery,
)
from src.interpretations.schemas import (
    GeneratedInterpretationResponse,
    GenerateInterpretationRequest,
    InterpretationsResponse,
    SaveInterpretationRequest,
)
from src.interpretations.service import LensMismatchError
from src.llm.schemas import InterpretationLens

router = APIRouter(prefix="/readings", tags=["interpretations"])


@router.post(
    "/{reading_id}/interpretation/generate",
    response_model=GeneratedInterpretationResponse,
)
async def generate_interpretation(
    reading_id: str,
    body: GenerateInterpretationRequest,
    user_id: CurrentUserId,
    mediator: MediatorDep,
) -> GeneratedInterpretationResponse:
    return await mediator.send(
        GenerateInterpretationCommand(
            reading_id=reading_id,
            user_id=user_id,
            settings=body.settings,
        )
    )


@router.put(
    "/{reading_id}/interpretations/{lens}",
    response_model=InterpretationsResponse,
)
async def save_interpretation(
    reading_id: str,
    lens: InterpretationLens,
    body: SaveInterpretationRequest,
    user_id: CurrentUserId,
    mediator: MediatorDep,
) -> InterpretationsResponse:
    # The path segment names the slot; the body's settings must agree. Checked here at
    # the boundary so the lens travels into the command exactly once (via settings).
    if lens != body.settings.lens:
        raise LensMismatchError()
    await mediator.send(
        SaveInterpretationCommand(
            reading_id=reading_id,
            user_id=user_id,
            card_interpretations=body.card_interpretations,
            synthesis=body.synthesis,
            model=body.model,
            tokens_used=body.tokens_used,
            settings=body.settings,
        )
    )
    interpretations = await mediator.query(
        GetInterpretationsByReadingIdQuery(reading_id=reading_id)
    )
    return InterpretationsResponse(interpretations=interpretations)
