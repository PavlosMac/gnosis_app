from src.core.exceptions import AppError


class LLMError(AppError):
    def __init__(self, status_code: int = 502, detail: str = "LLM service error"):
        super().__init__(status_code=status_code, detail=detail)


class LLMConnectionError(LLMError):
    def __init__(self, detail: str = "Could not connect to LLM service"):
        super().__init__(detail=detail)


class LLMRateLimitError(LLMError):
    def __init__(self, detail: str = "LLM rate limit exceeded"):
        super().__init__(status_code=429, detail=detail)


class LLMResponseError(LLMError):
    def __init__(self, detail: str = "LLM returned an invalid response"):
        super().__init__(detail=detail)


class LLMTimeoutError(LLMError):
    def __init__(self, detail: str = "LLM request timed out") -> None:
        super().__init__(status_code=504, detail=detail)


class LLMBusyError(LLMError):
    def __init__(self, detail: str = "LLM service is at capacity, try again shortly") -> None:
        super().__init__(status_code=503, detail=detail)
