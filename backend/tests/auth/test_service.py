from src.auth.service import remaining_budget_usd
from src.core.config import settings


def test_remaining_budget_uses_default_when_no_override_and_no_usage():
    assert remaining_budget_usd({}) == settings.user_budget_usd


def test_remaining_budget_subtracts_spend_from_override():
    user = {"budget_usd": 5.0, "usage": {"cost_usd": 1.25}}
    assert remaining_budget_usd(user) == 3.75


def test_remaining_budget_zero_override_is_zero_not_default():
    """`0 or default` would silently hand a $0-capped user the default budget."""
    assert remaining_budget_usd({"budget_usd": 0}) == 0.0


def test_remaining_budget_floors_at_zero_when_overspent():
    user = {"budget_usd": 1.0, "usage": {"cost_usd": 1.5}}
    assert remaining_budget_usd(user) == 0.0


def test_remaining_budget_uses_precomputed_budget_over_user_field():
    """A caller-supplied budget wins so both reported figures derive from one
    resolution — even a precomputed 0 must not fall through to the user field."""
    user = {"budget_usd": 5.0, "usage": {"cost_usd": 1.0}}
    assert remaining_budget_usd(user, budget_usd=3.0) == 2.0
    assert remaining_budget_usd(user, budget_usd=0.0) == 0.0
