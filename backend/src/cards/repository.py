from typing import Any

from src.database.base_repository import BaseReadRepository
from src.database.collections.constants import (
    MAJOR_ARCANA_MEANINGS_COLLECTION,
    SPREAD_CARD_MEANINGS_COLLECTION,
)


class MajorArcanaMeaningReadRepository(BaseReadRepository):
    """Read side only: the collection is written by src.cards.loader (and the generator
    script through it), never by a request handler."""

    @property
    def collection_name(self) -> str:
        return MAJOR_ARCANA_MEANINGS_COLLECTION

    async def find_by_number(self, number: int) -> dict[str, Any] | None:
        return await self.find_one({"number": number})


class SpreadCardMeaningReadRepository(BaseReadRepository):
    """Read side only, as above: written by src.cards.loader alone."""

    @property
    def collection_name(self) -> str:
        return SPREAD_CARD_MEANINGS_COLLECTION

    async def find_by_number(self, number: int) -> dict[str, Any] | None:
        return await self.find_one({"number": number})
