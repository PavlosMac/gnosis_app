from fastapi import APIRouter

from src.core.dependencies import LLMDep
from src.llm.schemas import InterpretationRequest, InterpretationResponse

router = APIRouter(prefix="/llm", tags=["llm"])


@router.post("/interpret", response_model=InterpretationResponse)
async def interpret(body: InterpretationRequest, llm: LLMDep) -> InterpretationResponse:
    return await llm.generate_interpretation(body)
