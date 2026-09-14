from src.notifications.port import EmailPort


class MockEmailAdapter(EmailPort):
    def __init__(self) -> None:
        self.sent_password_resets: list[dict[str, str]] = []

    async def send_password_reset(self, to: str, reset_link: str) -> None:
        self.sent_password_resets.append({"to": to, "reset_link": reset_link})

    async def close(self) -> None:
        return None
