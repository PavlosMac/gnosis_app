"""Concurrency load tests for `POST /api/v1/readings/{id}/interpretation`.

Everything but the provider is real: routing, JWT auth and the refresh-family check,
the mediator, the generate handler, the atomic budget reservation, `OpenAIAdapter` with
its semaphore and acquire timeout, persist and settle. Only the `AsyncOpenAI` client is
swapped for `LatencyFakeClient`, which sleeps instead of calling OpenAI and records how
many calls were in flight at once.

Marked `load` and excluded from the default run (`addopts` in pyproject.toml); run with
`make test-load` (`pytest -m load -s`) to see the latency summary each scenario prints.

Limits, so nobody over-reads a green run: mongomock executes `find_one_and_update` in one
process, so these prove the gate's logic under concurrency, not real Mongo contention —
`scripts/load_interpretations.py` does that against the compose Mongo. The semaphore is
per process, which matches production's single uvicorn worker.
"""

import asyncio
import statistics
import time
from collections import Counter
from dataclasses import dataclass, field
from datetime import UTC, datetime, timedelta
from typing import Any
from unittest.mock import AsyncMock, MagicMock
from uuid import uuid4

import httpx
import pytest
from bson import ObjectId
from httpx import ASGITransport

from src.auth.repository import RefreshTokenRepository
from src.core.security import create_access_token
from src.cqrs.mediator import Mediator
from src.llm.openai_adapter import OpenAIAdapter
from src.llm.port import LLMPort
from src.llm.pricing import cost_usd, worst_case_cost_usd
from src.llm.schemas import CardInSpread, InterpretationRequest, LeanReading, Orientation
from src.main import _wire_mediator, app
from src.notifications.mock_adapter import MockEmailAdapter

pytestmark = pytest.mark.load

# A priced model id (Settings.model_price_table) so settle produces a real, non-zero cost
# and no "unknown model" warning per request.
MODEL = "gpt-5.4"
PROMPT_TOKENS = 480
COMPLETION_TOKENS = 700
REASONING_TOKENS = 300
USERS = 100
BURST_TIMEOUT_S = 120.0


# --- Provider stand-in -----------------------------------------------------------------


def _completion() -> MagicMock:
    """The slice of a ParsedChatCompletion the adapter reads (see tests/llm/test_adapter.py)."""
    message = MagicMock()
    message.parsed = LeanReading(reading="A woven narrative naming The Fool under load.")
    choice = MagicMock()
    choice.message = message
    usage = MagicMock()
    usage.prompt_tokens = PROMPT_TOKENS
    usage.completion_tokens = COMPLETION_TOKENS
    usage.completion_tokens_details = MagicMock(reasoning_tokens=REASONING_TOKENS)
    completion = MagicMock()
    completion.choices = [choice]
    completion.model = MODEL
    completion.usage = usage
    return completion


class LatencyFakeClient:
    """Stands in for AsyncOpenAI: every `parse()` waits on `gate` (if given), sleeps
    `latency_s`, and records the peak number of concurrent calls — the number the
    adapter's semaphore must cap."""

    def __init__(self, latency_s: float, gate: asyncio.Event | None = None) -> None:
        self.latency_s = latency_s
        self.gate = gate
        self.calls = 0
        self.in_flight = 0
        self.peak_in_flight = 0
        self.mock = MagicMock()
        self.mock.beta.chat.completions.parse = AsyncMock(side_effect=self._parse)
        self.mock.close = AsyncMock()

    async def _parse(self, **_: Any) -> MagicMock:
        self.calls += 1
        self.in_flight += 1
        self.peak_in_flight = max(self.peak_in_flight, self.in_flight)
        try:
            if self.gate is not None:
                await self.gate.wait()
            await asyncio.sleep(self.latency_s)
        finally:
            self.in_flight -= 1
        return _completion()


def make_adapter(
    client: LatencyFakeClient, *, max_concurrent: int, acquire_timeout: float
) -> OpenAIAdapter:
    return OpenAIAdapter(
        client=client.mock,
        model=MODEL,
        max_tokens=10000,
        reasoning_effort="none",
        max_concurrent=max_concurrent,
        timeout=30.0,
        acquire_timeout=acquire_timeout,
    )


# --- Wiring and seeding ----------------------------------------------------------------


@pytest.fixture
def rewire(mock_db):
    """Wire the app around a given adapter. The generate handler captures its LLM at
    construction inside `_wire_mediator`, so swapping `app.state.llm` alone would not
    reach this route."""

    def _rewire(llm: LLMPort) -> httpx.AsyncClient:
        mediator = Mediator()
        email = MockEmailAdapter()
        _wire_mediator(mediator, llm, email, mock_db)
        app.state.mediator = mediator
        app.state.refresh_token_repo = RefreshTokenRepository(mock_db)
        app.state.llm = llm
        app.state.email = email
        return httpx.AsyncClient(transport=ASGITransport(app=app), base_url="http://test")

    return _rewire


async def seed_user(mock_db, *, budget_usd: float | None = None) -> tuple[str, str]:
    """An active user plus a live session: the access token is minted directly and its
    refresh family stored, so no register/verify/login round trips (which are
    rate-limited per IP) stand between the test and the endpoint."""
    now = datetime.now(UTC)
    doc: dict[str, Any] = {
        "email": f"load-{uuid4().hex}@example.com",
        "status": "active",
        "credits": 0,
        "is_superadmin": False,
        "created_at": now,
        "updated_at": now,
    }
    if budget_usd is not None:
        doc["budget_usd"] = budget_usd
    result = await mock_db["users"].insert_one(doc)
    user_id = str(result.inserted_id)
    family_id = uuid4().hex
    token, _ = create_access_token(user_id, family_id)
    await RefreshTokenRepository(mock_db).store(
        uuid4().hex, family_id, user_id, now + timedelta(days=1)
    )
    return user_id, token


ONE_CARD = {"name": "The Fool", "position": "Present", "orientation": "upright"}


async def seed_reading(mock_db, user_id: str) -> str:
    result = await mock_db["readings"].insert_one(
        {
            "user_id": ObjectId(user_id),
            "spread_type": "Celtic Cross",
            "question": "What does the future hold?",
            "cards": [ONE_CARD],
            "created_at": datetime.now(UTC),
        }
    )
    return str(result.inserted_id)


def one_card_request() -> InterpretationRequest:
    """The same request the handler builds from `seed_reading`, for the pricing math."""
    return InterpretationRequest(
        spread_name="Celtic Cross",
        question="What does the future hold?",
        cards=[CardInSpread(name="The Fool", position="Present", orientation=Orientation.upright)],
    )


# --- Firing and reporting ----------------------------------------------------------------


@dataclass
class LoadRun:
    statuses: Counter[int] = field(default_factory=Counter)
    latencies: list[float] = field(default_factory=list)
    bodies: list[dict[str, Any]] = field(default_factory=list)
    wall_s: float = 0.0

    def percentile(self, p: int) -> float:
        if len(self.latencies) < 2:
            return self.latencies[0] if self.latencies else 0.0
        return statistics.quantiles(self.latencies, n=100, method="inclusive")[p - 1]

    def summary(self, label: str) -> str:
        statuses = " ".join(f"{code}×{n}" for code, n in sorted(self.statuses.items()))
        return (
            f"[{label}] n={sum(self.statuses.values())} statuses={{{statuses}}} "
            f"p50={self.percentile(50):.3f}s p95={self.percentile(95):.3f}s "
            f"p99={self.percentile(99):.3f}s max={max(self.latencies):.3f}s "
            f"wall={self.wall_s:.2f}s rps={sum(self.statuses.values()) / self.wall_s:.1f}"
        )


async def fire(client: httpx.AsyncClient, jobs: list[tuple[str, str]]) -> LoadRun:
    """One concurrent burst: (token, reading_id) per request. The whole burst runs
    under a timeout so a hang fails the test rather than stalling the run."""
    run = LoadRun()

    async def one(token: str, reading_id: str) -> None:
        started = time.perf_counter()
        response = await client.post(
            f"/api/v1/readings/{reading_id}/interpretation",
            headers={"Authorization": f"Bearer {token}"},
        )
        run.latencies.append(time.perf_counter() - started)
        run.statuses[response.status_code] += 1
        run.bodies.append(response.json())

    started = time.perf_counter()
    await asyncio.wait_for(
        asyncio.gather(*(one(token, rid) for token, rid in jobs)), timeout=BURST_TIMEOUT_S
    )
    run.wall_s = time.perf_counter() - started
    return run


async def seed_users_with_readings(mock_db, n: int) -> tuple[list[str], list[tuple[str, str]]]:
    user_ids: list[str] = []
    jobs: list[tuple[str, str]] = []
    for _ in range(n):
        user_id, token = await seed_user(mock_db)
        user_ids.append(user_id)
        jobs.append((token, await seed_reading(mock_db, user_id)))
    return user_ids, jobs


async def spend_of(mock_db, user_id: str) -> float:
    doc = await mock_db["users"].find_one({"_id": ObjectId(user_id)})
    assert doc is not None
    return float(doc.get("usage", {}).get("cost_usd", 0.0))


# --- Scenarios ---------------------------------------------------------------------------


async def test_hundred_users_all_succeed_within_concurrency_cap(rewire, mock_db, report):
    """100 users, one reading each, provider latency 0.2 s, cap 10: every request
    succeeds, the provider never sees more than 10 calls at once, and each user is
    charged exactly the settled cost of their one call."""
    latency, cap = 0.2, 10
    fake = LatencyFakeClient(latency)
    user_ids, jobs = await seed_users_with_readings(mock_db, USERS)

    async with rewire(make_adapter(fake, max_concurrent=cap, acquire_timeout=30.0)) as client:
        run = await fire(client, jobs)
    report(run.summary("100 users / cap 10"))

    assert run.statuses == Counter({200: USERS})
    assert fake.calls == USERS
    assert fake.peak_in_flight <= cap
    assert fake.peak_in_flight >= cap // 2, "the cap was never approached — no real concurrency"
    # Serial would take 100 × 0.2 s = 20 s; the cap allows ~10 batches ≈ 2 s plus overhead
    assert run.wall_s < USERS * latency / 2
    assert await mock_db["interpretations"].count_documents({}) == USERS
    expected = cost_usd(PROMPT_TOKENS, COMPLETION_TOKENS, MODEL)
    for user_id in user_ids:
        assert await spend_of(mock_db, user_id) == pytest.approx(expected)


async def test_saturation_returns_503_and_releases_reservations(rewire, mock_db, report):
    """Cap 5 with a 0.3 s acquire timeout against 0.5 s calls: the first five succeed,
    the rest give up waiting and get 503 — with their reservation handed back, so a
    refused user is charged nothing."""
    fake = LatencyFakeClient(0.5)
    user_ids, jobs = await seed_users_with_readings(mock_db, USERS)

    async with rewire(make_adapter(fake, max_concurrent=5, acquire_timeout=0.3)) as client:
        run = await fire(client, jobs)
    report(run.summary("saturation / cap 5"))

    assert set(run.statuses) <= {200, 503}, run.statuses
    assert run.statuses[200] + run.statuses[503] == USERS
    assert run.statuses[503] > 0
    assert fake.peak_in_flight <= 5
    assert await mock_db["interpretations"].count_documents({}) == run.statuses[200]
    succeeded = {str(d["user_id"]) for d in await mock_db["interpretations"].find().to_list(None)}
    for user_id in user_ids:
        spend = await spend_of(mock_db, user_id)
        if user_id in succeeded:
            assert spend > 0
        else:
            assert spend == 0.0, f"refused user {user_id} kept a reservation of ${spend}"


async def test_single_user_budget_caps_spend(rewire, mock_db, report):
    """One user fires 100 readings at once with a budget of three reservations: the gate
    admits at least three, refuses the rest with 402, and the final spend never exceeds
    the budget by more than the one in-flight reservation the design accepts."""
    worst_case = worst_case_cost_usd(one_card_request())
    budget = 3 * worst_case
    fake = LatencyFakeClient(0.2)
    user_id, token = await seed_user(mock_db, budget_usd=budget)
    jobs = [(token, await seed_reading(mock_db, user_id)) for _ in range(USERS)]

    async with rewire(make_adapter(fake, max_concurrent=10, acquire_timeout=30.0)) as client:
        run = await fire(client, jobs)
    report(run.summary(f"one user / budget {budget:.4f}"))

    assert set(run.statuses) <= {200, 402}, run.statuses
    assert run.statuses[200] >= 3
    assert run.statuses[402] > 0
    assert fake.calls == run.statuses[200]
    assert await mock_db["interpretations"].count_documents({}) == run.statuses[200]
    assert await spend_of(mock_db, user_id) <= budget + worst_case
    refused = [b for b in run.bodies if b.get("detail") == "Usage budget exhausted"]
    assert len(refused) == run.statuses[402]


async def test_idempotent_storm_leaves_one_document(rewire, mock_db, report):
    """100 requests for the same reading, all held past the existence check: the
    reading_id-keyed upsert leaves exactly one document and every caller gets the same
    narrative back. (Each racing call is charged — the documented accepted race — so
    the budget is raised to keep that from masking the storage behaviour.)"""
    gate = asyncio.Event()
    fake = LatencyFakeClient(0.05, gate=gate)
    user_id, token = await seed_user(mock_db, budget_usd=1000.0)
    reading_id = await seed_reading(mock_db, user_id)

    async with rewire(make_adapter(fake, max_concurrent=10, acquire_timeout=30.0)) as client:
        burst = asyncio.create_task(fire(client, [(token, reading_id)] * USERS))
        await asyncio.sleep(0.1)  # let every request pass the existence check
        gate.set()
        run = await burst
    report(run.summary("idempotent storm"))

    assert run.statuses == Counter({200: USERS})
    assert fake.calls == USERS
    assert (
        await mock_db["interpretations"].count_documents({"reading_id": ObjectId(reading_id)}) == 1
    )
    narratives = {b["interpretation"]["reading"] for b in run.bodies}
    assert len(narratives) == 1
