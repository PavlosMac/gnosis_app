from bson import ObjectId

from src.auth.repository import AuthWriteRepository


async def _insert_user(mock_db, **fields) -> str:
    oid = ObjectId()
    await mock_db["users"].insert_one({"_id": oid, "email": f"{oid}@example.com", **fields})
    return str(oid)


# --- reserve_usage: the budget gate ---


async def test_reserve_grants_a_brand_new_users_first_call_under_budget(mock_db):
    """A user with no `usage` subdocument yet (lazily created by the gate) has spent
    nothing — the very first reservation must be evaluated against the budget, not
    exempted from it."""
    write_repo = AuthWriteRepository(mock_db)
    user_id = await _insert_user(mock_db)

    granted = await write_repo.reserve_usage(user_id, amount_usd=1.0, budget_usd=3.0)

    assert granted is True
    doc = await mock_db["users"].find_one({"_id": ObjectId(user_id)})
    assert doc["usage"]["cost_usd"] == 1.0


async def test_reserve_refuses_a_brand_new_users_first_call_at_zero_budget(mock_db):
    """A zero per-user budget must block spend from the very first call — not just once
    a `usage` subdocument happens to exist."""
    write_repo = AuthWriteRepository(mock_db)
    user_id = await _insert_user(mock_db)

    granted = await write_repo.reserve_usage(user_id, amount_usd=1.0, budget_usd=0.0)

    assert granted is False
    doc = await mock_db["users"].find_one({"_id": ObjectId(user_id)})
    assert doc.get("usage") is None


async def test_reserve_refuses_when_spend_already_at_budget(mock_db):
    write_repo = AuthWriteRepository(mock_db)
    user_id = await _insert_user(mock_db, usage={"cost_usd": 3.0})

    granted = await write_repo.reserve_usage(user_id, amount_usd=0.01, budget_usd=3.0)

    assert granted is False


async def test_reserve_grants_when_still_under_budget(mock_db):
    write_repo = AuthWriteRepository(mock_db)
    user_id = await _insert_user(mock_db, usage={"cost_usd": 2.99})

    granted = await write_repo.reserve_usage(user_id, amount_usd=0.01, budget_usd=3.0)

    assert granted is True


# --- settle_usage / release_usage ---


async def test_settle_adjusts_reservation_to_actual_and_records_the_split(mock_db):
    write_repo = AuthWriteRepository(mock_db)
    user_id = await _insert_user(mock_db)
    await write_repo.reserve_usage(user_id, amount_usd=1.0, budget_usd=3.0)

    total = await write_repo.settle_usage(
        user_id,
        reserved_usd=1.0,
        actual_cost_usd=0.25,
        prompt_tokens=100,
        completion_tokens=200,
    )

    assert total == 0.25
    doc = await mock_db["users"].find_one({"_id": ObjectId(user_id)})
    assert doc["usage"]["cost_usd"] == 0.25
    assert doc["usage"]["prompt_tokens"] == 100
    assert doc["usage"]["completion_tokens"] == 200
    assert doc["usage"]["readings"] == 1


async def test_release_gives_back_the_full_reservation(mock_db):
    write_repo = AuthWriteRepository(mock_db)
    user_id = await _insert_user(mock_db)
    await write_repo.reserve_usage(user_id, amount_usd=1.0, budget_usd=3.0)

    await write_repo.release_usage(user_id, reserved_usd=1.0)

    doc = await mock_db["users"].find_one({"_id": ObjectId(user_id)})
    assert doc["usage"]["cost_usd"] == 0.0


# --- find_dashboard_fields: the projected read the dashboard uses ---


async def test_find_dashboard_fields_omits_password_hash(mock_db):
    from src.auth.repository import AuthReadRepository

    user_id = await _insert_user(
        mock_db,
        password_hash="argon2$secret",
        display_name="Pav",
        budget_usd=2.0,
        usage={"cost_usd": 0.5, "prompt_tokens": 10},
    )

    doc = await AuthReadRepository(mock_db).find_dashboard_fields(user_id)

    assert doc is not None
    assert "password_hash" not in doc
    assert doc["email"] == f"{user_id}@example.com"
    assert doc["display_name"] == "Pav"
    assert doc["budget_usd"] == 2.0
    assert doc["usage"]["cost_usd"] == 0.5


async def test_find_dashboard_fields_returns_none_for_missing_or_malformed_id(mock_db):
    from src.auth.repository import AuthReadRepository

    repo = AuthReadRepository(mock_db)
    assert await repo.find_dashboard_fields(str(ObjectId())) is None
    assert await repo.find_dashboard_fields("not-an-object-id") is None
