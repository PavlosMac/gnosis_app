"""The pure parts of `scripts/load_interpretations.py`: the ledger invariants it checks
after a burst and the percentile maths in its report. The orchestration (spawning
uvicorn, seeding Mongo) is exercised by running the script itself."""

from scripts.load_interpretations import Outcome, check_invariants, percentile


def _ok(user: str, reading: str = "r") -> Outcome:
    return Outcome(user_id=user, reading_id=reading, status=200, latency_s=0.5)


def _refused(user: str, status: int) -> Outcome:
    return Outcome(user_id=user, reading_id="r", status=status, latency_s=0.3)


def test_percentile_interpolates_inclusively():
    values = [0.1, 0.2, 0.3, 0.4, 0.5]
    assert percentile(values, 50) == 0.3
    assert percentile(values, 100) == 0.5
    assert percentile([0.7], 95) == 0.7
    assert percentile([], 95) == 0.0


def test_clean_run_has_no_violations():
    outcomes = [_ok("a"), _ok("b"), _refused("c", 503)]
    spends = {"a": 0.01, "b": 0.01, "c": 0.0}
    assert check_invariants(outcomes, spends, interpretation_count=2, worst_case=0.05) == []


def test_each_violation_is_named():
    outcomes = [_ok("a"), _refused("b", 503), _refused("c", 500)]
    spends = {"a": 0.0, "b": 0.02, "c": 0.0}
    violations = check_invariants(outcomes, spends, interpretation_count=3, worst_case=0.05)
    assert any("interpretations" in v for v in violations)  # 3 stored, 1 success
    assert any("a" in v and "charged nothing" in v for v in violations)
    assert any("b" in v and "kept" in v for v in violations)
    assert any("500" in v for v in violations)


def test_single_user_spend_is_capped_at_budget_plus_one_reservation():
    outcomes = [_ok("u", "r1"), _ok("u", "r2"), _refused("u", 402)]
    within = check_invariants(
        outcomes, {"u": 0.14}, interpretation_count=2, worst_case=0.05, budget=0.1
    )
    assert within == []
    over = check_invariants(
        outcomes, {"u": 0.16}, interpretation_count=2, worst_case=0.05, budget=0.1
    )
    assert any("budget" in v for v in over)


def test_compose_mongo_hostname_is_rewritten_for_the_host():
    from scripts.load_interpretations import host_mongo_uri

    # .env carries the compose service name; from the host the published port is on localhost
    assert host_mongo_uri("mongodb://mongodb:27019") == "mongodb://localhost:27019"
    assert host_mongo_uri("mongodb://mongodb:27017/gnosis") == "mongodb://localhost:27017/gnosis"
    assert host_mongo_uri("mongodb://localhost:27019") == "mongodb://localhost:27019"
    assert host_mongo_uri("mongodb://user:pw@db.example.com:27017") == (
        "mongodb://user:pw@db.example.com:27017"
    )
