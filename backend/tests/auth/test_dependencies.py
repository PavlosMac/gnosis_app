from starlette.requests import Request

from src.core.config import settings
from src.core.dependencies import get_client_ip


def _request(headers: dict[str, str], peer: str = "10.0.0.5") -> Request:
    raw = [(k.lower().encode(), v.encode()) for k, v in headers.items()]
    return Request({"type": "http", "headers": raw, "client": (peer, 1234)})


def test_client_ip_prefers_the_first_forwarded_address():
    request = _request({"X-Forwarded-For": "203.0.113.9, 10.0.0.1"})
    assert get_client_ip(request) == "203.0.113.9"


def test_client_ip_falls_back_to_the_socket_peer():
    assert get_client_ip(_request({})) == "10.0.0.5"


def test_client_ip_ignores_the_header_when_forwarding_is_not_trusted(monkeypatch):
    monkeypatch.setattr(settings, "rate_limit_trust_forwarded_for", False)
    request = _request({"X-Forwarded-For": "203.0.113.9"})
    assert get_client_ip(request) == "10.0.0.5"
