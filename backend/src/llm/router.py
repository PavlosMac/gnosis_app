import structlog
from fastapi import APIRouter

from src.core.dependencies import IsSuperAdmin, LLMDep
from src.llm.schemas import InterpretationRequest, InterpretationResponse

logger = structlog.stdlib.get_logger(__name__)

router = APIRouter(prefix="/llm", tags=["llm"])


@router.post("/interpret", response_model=InterpretationResponse)
async def interpret(
    body: InterpretationRequest, llm: LLMDep, _admin: IsSuperAdmin
) -> InterpretationResponse:
    logger.debug("interpret request body", body=body.model_dump())
    return await llm.generate_interpretation(body)
