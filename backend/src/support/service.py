from src.core.exceptions import AppError


class TooManySupportRequestsError(AppError):
    def __init__(self) -> None:
        super().__init__(
            status_code=429,
            detail="Too many support requests, please try again later",
        )


class SupportNotConfiguredError(AppError):
    def __init__(self) -> None:
        super().__init__(status_code=503, detail="Support is not available right now")
