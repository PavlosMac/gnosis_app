from structlog.testing import capture_logs

SENTINEL = "S3cretPassw0rd-sentinel!"


async def test_validation_error_response_does_not_echo_the_submitted_password(client):
    resp = await client.post("/api/v1/auth/login", json={"password": SENTINEL})

    assert resp.status_code == 422
    assert SENTINEL not in resp.text
    for error in resp.json()["detail"]:
        assert "input" not in error
        assert "ctx" not in error
        assert error["loc"] and error["type"] and error["msg"]


async def test_validation_error_log_does_not_contain_the_submitted_password(client):
    with capture_logs() as logs:
        resp = await client.post("/api/v1/auth/login", json={"password": SENTINEL})

    assert resp.status_code == 422
    entries = [e for e in logs if e["event"] == "request validation error"]
    assert entries
    assert SENTINEL not in repr(entries)
    assert entries[0]["errors"]
