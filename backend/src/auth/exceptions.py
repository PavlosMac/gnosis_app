from src.core.exceptions import ConflictError, UnauthorizedError


class EmailAlreadyExistsError(ConflictError):
    def __init__(self) -> None:
        super().__init__(detail="A user with this email already exists")


class InvalidCredentialsError(UnauthorizedError):
    def __init__(self) -> None:
        super().__init__(detail="Invalid email or password")
