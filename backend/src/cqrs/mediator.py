from typing import Any

import structlog

from src.core.exceptions import AppError
from src.cqrs.commands import BaseCommand, CommandHandler
from src.cqrs.queries import BaseQuery, QueryHandler

logger = structlog.stdlib.get_logger(__name__)


class Mediator:
    def __init__(self) -> None:
        self._command_handlers: dict[type[BaseCommand], CommandHandler] = {}
        self._query_handlers: dict[type[BaseQuery], QueryHandler] = {}

    def register_command(self, command_type: type[BaseCommand], handler: CommandHandler) -> None:
        self._command_handlers[command_type] = handler

    def register_query(self, query_type: type[BaseQuery], handler: QueryHandler) -> None:
        self._query_handlers[query_type] = handler

    async def send(self, command: BaseCommand) -> Any:
        handler = self._command_handlers.get(type(command))
        if handler is None:
            raise ValueError(f"No handler registered for {type(command).__name__}")
        name = type(command).__name__
        logger.info("dispatching command", command=name)
        try:
            return await handler.handle(command)
        except AppError:
            raise
        except Exception:
            logger.exception("command failed", command=name)
            raise

    async def query(self, query: BaseQuery) -> Any:
        handler = self._query_handlers.get(type(query))
        if handler is None:
            raise ValueError(f"No handler registered for {type(query).__name__}")
        name = type(query).__name__
        logger.info("dispatching query", query=name)
        try:
            return await handler.handle(query)
        except AppError:
            raise
        except Exception:
            logger.exception("query failed", query=name)
            raise
