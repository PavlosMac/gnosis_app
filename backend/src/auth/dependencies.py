from typing import Annotated

from fastapi import Depends

from src.auth.queries.get_user_by_id import GetUserByIdQuery
from src.auth.read_models import UserReadModel
from src.core.dependencies import CurrentUserId, MediatorDep


async def get_current_user(
    user_id: CurrentUserId,
    mediator: MediatorDep,
) -> UserReadModel:
    return await mediator.query(GetUserByIdQuery(user_id=user_id))


CurrentUser = Annotated[UserReadModel, Depends(get_current_user)]
