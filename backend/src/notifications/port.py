from abc import ABC, abstractmethod
from datetime import datetime


class EmailPort(ABC):
    @abstractmethod
    async def send_password_reset(self, to: str, reset_link: str) -> None: ...

    @abstractmethod
    async def send_email_verification(self, to: str, verify_link: str) -> None: ...

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
    async def send_invite(self, to: str, invite_link: str) -> None: ...

    @abstractmethod
    async def send_admin_message(self, to: str, subject: str, message: str) -> None:
        """One-way note from the superadmin to one user: no Reply-To on purpose."""
        ...

    @abstractmethod
    async def close(self) -> None: ...
