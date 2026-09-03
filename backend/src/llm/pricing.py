"""Pricing math for the usage ledger and budget gate.

Cost is computed from the actual usage split and the config price table at the moment
of the call — never re-derived later, so a price-table change doesn't rewrite history.
"""

import structlog

from src.core.config import settings
from src.llm.prompt_builder import (
    build_system_prompt,
    build_user_prompt,
    clamped_completion_cap,
    request_word_budget,
)
from src.llm.schemas import InterpretationRequest

logger = structlog.stdlib.get_logger(__name__)

# Rough chars-per-token for the prompt-side estimate in the worst-case reservation.
_CHARS_PER_TOKEN = 3


def _is_dated_snapshot_of(model: str, key: str) -> bool:
    """True if `model` is exactly `key`, or `key` followed by a dated-snapshot suffix
    (e.g. `gpt-5.4-2026-01-01`) — the actual shape of a resolved response id.

    A plain `model.startswith(key)` would also match a genuinely different, unrelated
    future model that merely shares a table key's literal text (e.g. a `gpt-5.4-nano`
    sharing the `gpt-5.4` prefix) — the dated-suffix check tells the two apart.
    """
    if model == key:
        return True
    rest = model[len(key) :]
    return model.startswith(key) and rest.startswith("-") and rest[1:2].isdigit()


def resolve_prices(model: str) -> tuple[float, float]:
    """($/1M input, $/1M output) for a model id.

    Resolved response ids (e.g. `gpt-5.4-2026-…`) are matched against table keys by
    prefix, longest key winning. An id matching no key is priced at the most expensive
    entry with a warning — a price-table gap must never fail a reading.
    """
    table = settings.model_price_table
    matches = [key for key in table if _is_dated_snapshot_of(model, key)]
    if matches:
        return table[max(matches, key=len)]
    fallback = max(table.values(), key=lambda prices: (prices[1], prices[0]))
    logger.warning(
        "model missing from price table — pricing at the most expensive entry",
        model=model,
        fallback_prices=fallback,
    )
    return fallback


def cost_usd(prompt_tokens: int, completion_tokens: int, model: str) -> float:
    in_price, out_price = resolve_prices(model)
    return prompt_tokens / 1e6 * in_price + completion_tokens / 1e6 * out_price


def worst_case_cost_usd(request: InterpretationRequest) -> float:
    """Upper bound on what a request can cost — the amount the budget gate reserves
    before the call: the full completion cap at the output price plus an estimate of
    the prompt tokens at the input price.

    Calls the same `clamped_completion_cap` OpenAIAdapter applies before calling the
    provider — reserving against the unclamped derived cap would over-reserve (and could
    false-positive the budget gate) whenever openai_max_tokens is set below what a
    large/high-effort spread derives to."""
    in_price, out_price = resolve_prices(settings.openai_model)
    prompt_chars = len(build_system_prompt(request)) + len(build_user_prompt(request))
    prompt_tokens = prompt_chars // _CHARS_PER_TOKEN
    completion_cap = clamped_completion_cap(
        request_word_budget(request), settings.openai_reasoning_effort, settings.openai_max_tokens
    )
    return prompt_tokens / 1e6 * in_price + completion_cap / 1e6 * out_price
