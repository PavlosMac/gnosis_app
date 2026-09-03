"""Pricing math for the usage ledger and budget gate — spec §5a."""

import pytest

from src.core.config import settings
from src.llm.pricing import cost_usd, resolve_prices, worst_case_cost_usd
from src.llm.prompt_builder import max_completion_tokens, request_word_budget
from src.llm.schemas import (
    CardInSpread,
    InterpretationRequest,
    Orientation,
)


def test_cost_is_usage_split_times_table():
    # gpt-5.4: $2.50/1M in, $15.00/1M out.
    assert cost_usd(1_000_000, 0, "gpt-5.4") == pytest.approx(2.50)
    assert cost_usd(0, 1_000_000, "gpt-5.4") == pytest.approx(15.00)
    assert cost_usd(480, 723, "gpt-5.4") == pytest.approx(480 / 1e6 * 2.50 + 723 / 1e6 * 15.00)


def test_resolved_response_ids_match_by_prefix():
    """The ledger stores the resolved id from the response (e.g. gpt-5.4-2026-…), not
    the configured alias — the table is matched by prefix."""
    assert resolve_prices("gpt-5.4-2026-01-01") == settings.model_price_table["gpt-5.4"]


def test_longest_prefix_wins():
    """gpt-5.4-mini must not be priced as gpt-5.4 just because that key also matches."""
    assert resolve_prices("gpt-5.4-mini-2026-01-01") == settings.model_price_table["gpt-5.4-mini"]


def test_a_model_merely_sharing_a_text_prefix_falls_through_to_the_fallback(monkeypatch):
    """Prefix matching must respect the dated-snapshot-suffix convention (e.g.
    `-2026-01-01`) it exists for — a genuinely different, unrelated model that happens
    to share a table key's literal text (e.g. a future `gpt-5.4-nano`) must not be
    silently priced as that shorter entry."""
    table = {
        "gpt-5.4-mini": (0.75, 4.50),
        "gpt-5.4": (2.50, 15.00),
        "gpt-6-preview": (100.0, 100.0),
    }
    monkeypatch.setattr(settings, "model_price_table", table)
    assert resolve_prices("gpt-5.4-nano-2026-01-01") == (100.0, 100.0)


def test_unknown_model_priced_at_most_expensive_entry():
    """A price-table gap must never fail a reading — it prices at the most expensive
    entry (with a warning logged) so the gate stays conservative."""
    assert resolve_prices("some-future-model") == settings.model_price_table["gpt-5.4"]


def test_zero_usage_costs_nothing_for_any_model():
    """The mock adapter reports zero-cost usage; the gate needs no special-casing."""
    assert cost_usd(0, 0, "mock") == 0.0


def test_worst_case_reservation_covers_the_full_completion_cap():
    request = InterpretationRequest(
        spread_name="Past-Present-Future",
        question="What lies ahead?",
        cards=[CardInSpread(name="The Fool", orientation=Orientation.upright)],
    )
    _, out_price = resolve_prices(settings.openai_model)
    cap = max_completion_tokens(request_word_budget(request), settings.openai_reasoning_effort)
    reserved = worst_case_cost_usd(request)
    assert reserved >= cap / 1e6 * out_price  # output side fully covered
    assert reserved < settings.user_budget_usd  # a single reading can never eat the budget


def test_worst_case_reservation_respects_the_configured_max_tokens_clamp(monkeypatch):
    """Must mirror the same `min(configured_max, derived_cap)` clamp OpenAIAdapter
    applies before calling the provider — reserving against the unclamped derived cap
    would over-reserve whenever openai_max_tokens is set below what a large/high-effort
    spread derives to."""
    request = InterpretationRequest(
        spread_name="Celtic Cross",
        cards=[CardInSpread(name=f"Card {i}", orientation=Orientation.upright) for i in range(10)],
    )
    derived_cap = max_completion_tokens(
        request_word_budget(request), settings.openai_reasoning_effort
    )
    unclamped_reserved = worst_case_cost_usd(request)

    monkeypatch.setattr(settings, "openai_max_tokens", derived_cap - 500)
    clamped_reserved = worst_case_cost_usd(request)

    assert clamped_reserved < unclamped_reserved
