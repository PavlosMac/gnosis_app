from fastapi import APIRouter

from src.core.dependencies import CurrentUserId, MediatorDep
from src.interpretations.commands.generate_interpretation import GenerateInterpretationCommand
from src.interpretations.schemas import GeneratedInterpretationResponse

router = APIRouter(prefix="/readings", tags=["interpretations"])


@router.post(
    "/{reading_id}/interpretation",
    response_model=GeneratedInterpretationResponse,
)
async def generate_interpretation(
    reading_id: str,
    user_id: CurrentUserId,
    mediator: MediatorDep,
) -> GeneratedInterpretationResponse:
    """Generate the reading's one interpretation and persist it immediately.

    Idempotent: a repeat call returns the stored interpretation without calling the
    LLM or charging the budget — this is what the reading gets, no more.
    """
    return await mediator.send(
        GenerateInterpretationCommand(reading_id=reading_id, user_id=user_id)
    )
