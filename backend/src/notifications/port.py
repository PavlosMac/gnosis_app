from abc import ABC, abstractmethod
from datetime import datetime


class EmailPort(ABC):
    @abstractmethod
    async def send_password_reset(self, to: str, reset_link: str) -> None: ...

    @abstractmethod
    async def send_support_request(
        self,
        to: str,
        reply_to: str,
        subject: str,
        message: str,
        user_id: str,
        submitted_at: datetime,
    ) -> None: ...

    @abstractmethod
    async def close(self) -> None: ...
