from abc import ABC, abstractmethod
from typing import Generic, TypeVar

from pydantic import BaseModel

TCommand = TypeVar("TCommand", bound="BaseCommand")
TResult = TypeVar("TResult")


class BaseCommand(BaseModel):
    model_config = {"frozen": True}


class CommandHandler(ABC, Generic[TCommand, TResult]):
    @abstractmethod
    async def handle(self, command: TCommand) -> TResult: ...
