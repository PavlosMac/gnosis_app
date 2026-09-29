from datetime import date

from fastapi import APIRouter, Query

from src.core.dependencies import CurrentUserId, MediatorDep
from src.core.pagination import MAX_PAGE
from src.readings.commands.create_reading import CreateReadingCommand
from src.readings.commands.update_reading_tags import UpdateReadingTagsCommand
from src.readings.queries.get_reading_by_id import GetReadingByIdQuery
from src.readings.queries.list_user_readings import ListUserReadingsQuery
from src.readings.schemas import (
    MAX_SPREAD_TYPE_LENGTH,
    MAX_TAG_FILTER_LENGTH,
    CreateReadingRequest,
    ReadingListResponse,
    ReadingReadModel,
    ReadingSortField,
    SortOrder,
    UpdateReadingTagsRequest,
    parse_comma_separated_tags,
)

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
        birth_date=body.birth_date,
        cards=body.cards,
    )
    return await mediator.send(command)


@router.get("", response_model=ReadingListResponse)
async def list_readings(
    user_id: CurrentUserId,
    mediator: MediatorDep,
    page: int = Query(default=1, ge=1, le=MAX_PAGE),
    page_size: int = Query(default=20, ge=1, le=100),
    spread_type: str | None = Query(default=None, max_length=MAX_SPREAD_TYPE_LENGTH),
    birth_date: date | None = Query(default=None),
    tags: str | None = Query(default=None, max_length=MAX_TAG_FILTER_LENGTH),
    sort: ReadingSortField | None = Query(default=None),
    order: SortOrder = Query(default="desc"),
) -> ReadingListResponse:
    return await mediator.query(
        ListUserReadingsQuery(
            user_id=user_id,
            page=page,
            page_size=page_size,
            spread_type=spread_type,
            birth_date=birth_date,
            tags=parse_comma_separated_tags(tags) if tags else None,
            sort=sort,
            order=order,
        )
    )


@router.get("/{reading_id}", response_model=ReadingReadModel)
async def get_reading(
    reading_id: str,
    user_id: CurrentUserId,
    mediator: MediatorDep,
) -> ReadingReadModel:
    return await mediator.query(GetReadingByIdQuery(reading_id=reading_id, user_id=user_id))


@router.patch("/{reading_id}/tags", response_model=ReadingReadModel)
async def update_reading_tags(
    reading_id: str,
    body: UpdateReadingTagsRequest,
    user_id: CurrentUserId,
    mediator: MediatorDep,
) -> ReadingReadModel:
    command = UpdateReadingTagsCommand(
        reading_id=reading_id,
        user_id=user_id,
        tags=body.tags,
    )
    return await mediator.send(command)
