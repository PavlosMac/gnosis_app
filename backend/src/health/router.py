from fastapi import APIRouter

from src.core.config import settings
from src.health.schemas import HealthResponse

router = APIRouter(prefix="/health", tags=["health"])


@router.get("", response_model=HealthResponse)
async def health_check() -> HealthResponse:
    return HealthResponse(
        status="healthy",
        app_name=settings.app_name,
        environment=settings.app_env,
    )
