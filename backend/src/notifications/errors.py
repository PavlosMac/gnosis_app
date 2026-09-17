from src.core.exceptions import AppError


class EmailDeliveryError(AppError):
    """The single error at the EmailPort boundary — adapters map every provider/SDK
    failure to this, so no SDK exception type leaks past the port."""

    def __init__(self) -> None:
        super().__init__(status_code=502, detail="Email delivery failed")
