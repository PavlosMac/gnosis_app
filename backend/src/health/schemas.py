from src.core.base_schema import AppSchema


class HealthResponse(AppSchema):
    status: str
    app_name: str
    environment: str
