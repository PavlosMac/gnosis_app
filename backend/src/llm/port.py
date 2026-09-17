from abc import ABC, abstractmethod

from src.llm.schemas import InterpretationRequest, InterpretationResponse


class LLMPort(ABC):
    @abstractmethod
    async def generate_interpretation(
        self, request: InterpretationRequest
    ) -> InterpretationResponse: ...

    @abstractmethod
    async def close(self) -> None: ...
