from fastapi import APIRouter, Query

from src.core.dependencies import CurrentUserId, MediatorDep
from src.core.pagination import PaginatedResponse
from src.readings.commands.create_reading import CreateReadingCommand
from src.readings.queries.get_reading_by_id import GetReadingByIdQuery
from src.readings.queries.list_user_readings import ListUserReadingsQuery
from src.readings.schemas import CreateReadingRequest, ReadingListItem, ReadingReadModel

router = APIRouter(prefix="/readings", tags=["readings"])


@router.post("", response_model=ReadingReadModel, status_code=201)
async def create_reading(
    body: CreateReadingRequest,
    user_id: CurrentUserId,
    mediator: MediatorDep,
) -> ReadingReadModel:
    command = CreateReadingCommand(
        user_id=user_id,
        spread_name=body.spread_name,
        question=body.question,
        cards=body.cards,
    )
    return await mediator.send(command)


@router.get("", response_model=PaginatedResponse[ReadingListItem])
async def list_readings(
    user_id: CurrentUserId,
    mediator: MediatorDep,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
) -> PaginatedResponse[ReadingListItem]:
    return await mediator.query(
        ListUserReadingsQuery(user_id=user_id, page=page, page_size=page_size)
    )


@router.get("/{reading_id}", response_model=ReadingReadModel)
async def get_reading(
    reading_id: str,
    user_id: CurrentUserId,
    mediator: MediatorDep,
) -> ReadingReadModel:
    return await mediator.query(
        GetReadingByIdQuery(reading_id=reading_id, user_id=user_id)
    )
