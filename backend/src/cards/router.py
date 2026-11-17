from typing import Annotated

from fastapi import APIRouter, Depends, Path

from src.cards.queries.get_major_arcana_meaning_by_number import (
    GetMajorArcanaMeaningByNumberQuery,
)
from src.cards.queries.get_spread_card_meaning_by_number import (
    GetSpreadCardMeaningByNumberQuery,
)
from src.cards.schemas import MajorArcanaMeaningResponse, SpreadCardMeaningResponse
from src.core.dependencies import MediatorDep, get_current_user_id

router = APIRouter(prefix="/cards", tags=["cards"])


# The text is not per-user; the dependency only keeps the endpoint behind a session.
@router.get(
    "/major-arcana/{number}",
    response_model=MajorArcanaMeaningResponse,
    dependencies=[Depends(get_current_user_id)],
)
async def get_major_arcana_meaning(
    number: Annotated[int, Path(ge=0, le=21, description="Deck index; 0 is The Fool")],
    mediator: MediatorDep,
) -> MajorArcanaMeaningResponse:
    return await mediator.query(GetMajorArcanaMeaningByNumberQuery(number=number))


# Public on purpose: /reading is open to visitors, and the text is the same for everyone
# and holds no user data.
@router.get("/spread/{number}", response_model=SpreadCardMeaningResponse)
async def get_spread_card_meaning(
    number: Annotated[int, Path(ge=0, le=77, description="Deck index; 0 is The Fool")],
    mediator: MediatorDep,
) -> SpreadCardMeaningResponse:
    return await mediator.query(GetSpreadCardMeaningByNumberQuery(number=number))
