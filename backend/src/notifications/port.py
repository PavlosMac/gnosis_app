from abc import ABC, abstractmethod


class EmailPort(ABC):
    @abstractmethod
    async def send_password_reset(self, to: str, reset_link: str) -> None: ...

    @abstractmethod
    async def close(self) -> None: ...
