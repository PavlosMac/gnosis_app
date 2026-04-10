from src.core.exceptions import NotFoundError


class ReadingNotFoundError(NotFoundError):
    def __init__(self) -> None:
        super().__init__(detail="Reading not found")
