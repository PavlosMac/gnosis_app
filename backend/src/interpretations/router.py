from fastapi import APIRouter

from src.core.dependencies import CurrentUserId, MediatorDep
from src.interpretations.commands.generate_interpretation import GenerateInterpretationCommand
from src.interpretations.commands.save_interpretation import SaveInterpretationCommand
from src.interpretations.schemas import (
    GeneratedInterpretationResponse,
    InterpretationReadModel,
    SaveInterpretationRequest,
)

router = APIRouter(prefix="/readings", tags=["interpretations"])


@router.post(
    "/{reading_id}/interpretation/generate",
    response_model=GeneratedInterpretationResponse,
)
async def generate_interpretation(
    reading_id: str,
    user_id: CurrentUserId,
    mediator: MediatorDep,
) -> GeneratedInterpretationResponse:
    return await mediator.send(
        GenerateInterpretationCommand(reading_id=reading_id, user_id=user_id)
    )


@router.post(
    "/{reading_id}/interpretation",
    response_model=InterpretationReadModel,
)
async def save_interpretation(
    reading_id: str,
    body: SaveInterpretationRequest,
    user_id: CurrentUserId,
    mediator: MediatorDep,
) -> InterpretationReadModel:
    command = SaveInterpretationCommand(
        reading_id=reading_id,
        user_id=user_id,
        card_interpretations=body.card_interpretations,
        synthesis=body.synthesis,
        model=body.model,
        tokens_used=body.tokens_used,
        settings=body.settings,
    )
    return await mediator.send(command)
