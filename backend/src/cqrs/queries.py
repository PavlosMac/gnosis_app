from abc import ABC, abstractmethod
from typing import Generic, TypeVar

from pydantic import BaseModel

TQuery = TypeVar("TQuery", bound="BaseQuery")
TResult = TypeVar("TResult")


class BaseQuery(BaseModel):
    model_config = {"frozen": True}


class QueryHandler(ABC, Generic[TQuery, TResult]):
    @abstractmethod
    async def handle(self, query: TQuery) -> TResult: ...
