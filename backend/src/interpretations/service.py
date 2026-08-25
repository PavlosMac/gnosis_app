from src.core.exceptions import AppError


class LensMismatchError(AppError):
    def __init__(self) -> None:
        super().__init__(
            status_code=422,
            detail="settings.lens does not match the lens in the URL",
        )
