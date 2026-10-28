"""Live load test for `POST /api/v1/readings/{id}/interpretation`.

As close to production as a laptop gets: a real uvicorn process serving `src.main:app`
against the compose Mongo (`MONGODB_URI` from `.env`, normally `localhost:27019`), the
real OpenAI SDK — pointed by `OPENAI_BASE_URL` at `scripts/fake_openai.py`, which sleeps
instead of thinking — and real HTTP from this process. Users and readings are seeded
straight into Mongo under a per-run tag, access tokens are minted with the same
`JWT_SECRET_KEY` the API loads from `.env`, every request is fired at once, and the
ledger is read back and checked. Everything seeded is deleted in `finally`.

Usage (from `backend/`, with the compose Mongo running — `make dev` at the root, or
`docker compose up -d mongodb` here):
    uv run python -m scripts.load_interpretations            # 100 users, 2 s calls → all 200
    uv run python -m scripts.load_interpretations --max-concurrent 5 --acquire-timeout 3
                                                             # → a 200/503 mix
    uv run python -m scripts.load_interpretations --single-user --budget 0.2 --latency 0.5
                                                             # → a 200/402 mix
    uv run python -m scripts.load_interpretations --api-url http://localhost:8001
                                                             # an API you run yourself; it must
                                                             # have OPENAI_BASE_URL set

Exit status 1 when a ledger invariant is violated or any request returned 500.
"""

import argparse
import asyncio
import math
import os
import re
import statistics
import subprocess
import sys
import time
from collections import Counter
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any
from uuid import uuid4

import httpx
from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase

from src.core.config import settings
from src.core.security import create_access_token
from src.llm.pricing import worst_case_cost_usd
from src.llm.schemas import CardInSpread, InterpretationRequest, Orientation

OUTPUT_DIR = Path(__file__).parent / "output"
HEALTH_TIMEOUT_S = 30.0
ONE_CARD = {"name": "The Fool", "position": "Present", "orientation": "upright"}


# --- Pure parts (tested in tests/load/test_load_script_helpers.py) -----------------------


@dataclass(frozen=True)
class Outcome:
    user_id: str
    reading_id: str
    status: int
    latency_s: float


def host_mongo_uri(uri: str) -> str:
    """`.env` is shared with the compose `api` service, so it may name Mongo by its service
    hostname (`mongodb`), which does not resolve from the host. The compose file publishes
    the same port on localhost, so rewriting the host is enough."""
    return re.sub(r"(//(?:[^@/]*@)?)mongodb(?=[:/]|$)", r"\1localhost", uri, count=1)


def percentile(values: list[float], p: int) -> float:
    if not values:
        return 0.0
    if len(values) == 1:
        return values[0]
    if p >= 100:
        return max(values)
    return statistics.quantiles(values, n=100, method="inclusive")[p - 1]


def check_invariants(
    outcomes: list[Outcome],
    spends: dict[str, float],
    *,
    interpretation_count: int,
    worst_case: float,
    budget: float | None = None,
) -> list[str]:
    """What must hold after a burst, whatever the status mix: one stored interpretation
    per success; a user with a success was charged, a user with none was not (refused
    reservations are released); in single-user mode the spend never exceeds the budget
    by more than the one in-flight reservation the gate accepts; no 500s."""
    violations: list[str] = []
    successes = sum(1 for o in outcomes if o.status == 200)
    if interpretation_count != successes:
        violations.append(
            f"{interpretation_count} interpretations stored for {successes} successful requests"
        )
    succeeded_users = {o.user_id for o in outcomes if o.status == 200}
    for user_id in {o.user_id for o in outcomes}:
        spend = spends.get(user_id, 0.0)
        if user_id in succeeded_users and spend <= 0:
            violations.append(f"user {user_id} succeeded but was charged nothing")
        if user_id not in succeeded_users and spend != 0:
            violations.append(f"user {user_id} was refused but kept a reservation of ${spend:.4f}")
        if budget is not None and spend > budget + worst_case:
            violations.append(
                f"user {user_id} spent ${spend:.4f}, over budget ${budget:.4f} "
                f"plus one reservation ${worst_case:.4f}"
            )
    server_errors = sum(1 for o in outcomes if o.status >= 500 and o.status not in (502, 503, 504))
    if server_errors:
        violations.append(f"{server_errors} requests returned 500")
    return violations


def summarise(outcomes: list[Outcome], wall_s: float, floor_s: float) -> str:
    statuses = Counter(o.status for o in outcomes)
    latencies = [o.latency_s for o in outcomes]
    status_text = "  ".join(f"{code}: {n}" for code, n in sorted(statuses.items()))
    return "\n".join(
        [
            f"requests   {len(outcomes)}",
            f"statuses   {status_text}",
            f"latency    p50 {percentile(latencies, 50):.2f}s  "
            f"p95 {percentile(latencies, 95):.2f}s  "
            f"p99 {percentile(latencies, 99):.2f}s  max {percentile(latencies, 100):.2f}s",
            f"wall       {wall_s:.2f}s  ({len(outcomes) / wall_s:.1f} req/s; "
            f"theoretical floor {floor_s:.1f}s = ceil(N / max_concurrent) × latency)",
        ]
    )


# --- Processes ---------------------------------------------------------------------------


def spawn(args: list[str], env: dict[str, str], log_path: Path) -> subprocess.Popen[bytes]:
    log = log_path.open("wb")
    return subprocess.Popen(args, env=env, stdout=log, stderr=subprocess.STDOUT)


def stop(proc: subprocess.Popen[bytes] | None) -> None:
    if proc is None or proc.poll() is not None:
        return
    proc.terminate()
    try:
        proc.wait(timeout=5)
    except subprocess.TimeoutExpired:
        proc.kill()


def _log_tail(log_path: Path) -> str:
    return "\n".join(log_path.read_text(errors="replace").splitlines()[-30:])


async def wait_for_health(url: str, proc: subprocess.Popen[bytes], log_path: Path) -> None:
    deadline = time.monotonic() + HEALTH_TIMEOUT_S
    async with httpx.AsyncClient(timeout=2.0) as client:
        while time.monotonic() < deadline:
            if proc.poll() is not None:
                raise RuntimeError(
                    f"api exited with {proc.returncode} during startup; "
                    f"log tail:\n{_log_tail(log_path)}"
                )
            try:
                if (await client.get(url)).status_code == 200:
                    return
            except httpx.HTTPError:
                pass
            await asyncio.sleep(0.25)
    raise RuntimeError(
        f"{url} not healthy after {HEALTH_TIMEOUT_S}s; log tail:\n{_log_tail(log_path)}"
    )


# --- Seeding -----------------------------------------------------------------------------


@dataclass(frozen=True)
class Job:
    user_id: str
    token: str
    reading_id: str


async def seed(
    db: AsyncIOMotorDatabase, run_id: str, *, requests: int, single_user: bool, budget: float | None
) -> list[Job]:
    now = datetime.now(UTC)
    user_count = 1 if single_user else requests
    users: list[dict[str, Any]] = []
    for i in range(user_count):
        doc: dict[str, Any] = {
            "email": f"loadtest-{run_id}-{i}@loadtest.invalid",
            "status": "active",
            "credits": 0,
            "is_superadmin": False,
            "created_at": now,
            "updated_at": now,
        }
        if budget is not None:
            doc["budget_usd"] = budget
        users.append(doc)
    inserted = await db["users"].insert_many(users)
    user_ids = [str(oid) for oid in inserted.inserted_ids]

    tokens: dict[str, str] = {}
    sessions: list[dict[str, Any]] = []
    for user_id in user_ids:
        family_id = f"loadtest-{run_id}-{uuid4().hex}"
        token, _ = create_access_token(user_id, family_id)
        tokens[user_id] = token
        sessions.append(
            {
                "jti": uuid4().hex,
                "family_id": family_id,
                "user_id": user_id,
                "used": False,
                "expires_at": now + timedelta(hours=1),
            }
        )
    await db["refresh_tokens"].insert_many(sessions)

    owners = [user_ids[0]] * requests if single_user else user_ids
    readings = [
        {
            "user_id": ObjectId(owner),
            "spread_type": "Celtic Cross",
            "question": "What does the future hold?",
            "cards": [ONE_CARD],
            "created_at": now,
        }
        for owner in owners
    ]
    inserted_readings = await db["readings"].insert_many(readings)
    return [
        Job(user_id=owner, token=tokens[owner], reading_id=str(rid))
        for owner, rid in zip(owners, inserted_readings.inserted_ids, strict=True)
    ]


async def cleanup(db: AsyncIOMotorDatabase, run_id: str) -> None:
    users = (
        await db["users"]
        .find({"email": {"$regex": f"^loadtest-{run_id}-"}}, {"_id": 1})
        .to_list(None)
    )
    oids = [u["_id"] for u in users]
    ids = [str(oid) for oid in oids]
    await db["interpretations"].delete_many({"user_id": {"$in": oids}})
    await db["readings"].delete_many({"user_id": {"$in": oids}})
    await db["refresh_tokens"].delete_many({"user_id": {"$in": ids}})
    await db["users"].delete_many({"_id": {"$in": oids}})


async def read_back(db: AsyncIOMotorDatabase, jobs: list[Job]) -> tuple[dict[str, float], int]:
    user_ids = {j.user_id for j in jobs}
    spends: dict[str, float] = {}
    async for doc in db["users"].find({"_id": {"$in": [ObjectId(u) for u in user_ids]}}):
        spends[str(doc["_id"])] = float(doc.get("usage", {}).get("cost_usd", 0.0))
    stored = await db["interpretations"].count_documents(
        {"reading_id": {"$in": [ObjectId(j.reading_id) for j in jobs]}}
    )
    return spends, stored


# --- Firing ------------------------------------------------------------------------------


async def fire(api_url: str, jobs: list[Job], timeout_s: float) -> tuple[list[Outcome], float]:
    async with httpx.AsyncClient(base_url=api_url, timeout=timeout_s) as client:

        async def one(job: Job) -> Outcome:
            started = time.perf_counter()
            response = await client.post(
                f"/api/v1/readings/{job.reading_id}/interpretation",
                headers={"Authorization": f"Bearer {job.token}"},
            )
            return Outcome(
                job.user_id, job.reading_id, response.status_code, time.perf_counter() - started
            )

        started = time.perf_counter()
        outcomes = await asyncio.gather(*(one(job) for job in jobs))
        return list(outcomes), time.perf_counter() - started


# --- Main --------------------------------------------------------------------------------


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    parser.add_argument(
        "--requests", type=int, default=100, help="concurrent requests (default 100)"
    )
    parser.add_argument(
        "--latency", type=float, default=2.0, help="fake provider latency in seconds"
    )
    parser.add_argument("--max-concurrent", type=int, default=settings.openai_max_concurrent)
    parser.add_argument(
        "--acquire-timeout", type=float, default=settings.openai_acquire_timeout_seconds
    )
    parser.add_argument(
        "--fail-rate", type=float, default=0.0, help="fraction of provider calls that 429"
    )
    parser.add_argument(
        "--single-user", action="store_true", help="all readings belong to one user"
    )
    parser.add_argument("--budget", type=float, default=None, help="per-user budget_usd override")
    parser.add_argument("--api-port", type=int, default=8002)
    parser.add_argument("--fake-port", type=int, default=8099)
    parser.add_argument(
        "--api-url", default=None, help="target a running API instead of spawning one"
    )
    parser.add_argument(
        "--mongo-uri",
        default=host_mongo_uri(settings.mongodb_uri),
        help="Mongo to seed and read back (default: .env MONGODB_URI, compose host → localhost)",
    )
    return parser.parse_args()


async def main() -> int:
    args = parse_args()
    run_id = uuid4().hex[:8]
    OUTPUT_DIR.mkdir(exist_ok=True)
    api_log = OUTPUT_DIR / f"load-api-{run_id}.log"
    fake_log = OUTPUT_DIR / f"load-fake-openai-{run_id}.log"

    fake_proc: subprocess.Popen[bytes] | None = None
    api_proc: subprocess.Popen[bytes] | None = None
    # Fail fast on a wrong URI instead of the driver's 30 s default
    mongo = AsyncIOMotorClient(args.mongo_uri, serverSelectionTimeoutMS=5000)
    db = mongo[settings.mongodb_database]
    worst_case = worst_case_cost_usd(
        InterpretationRequest(
            spread_name="Celtic Cross",
            question="What does the future hold?",
            cards=[
                CardInSpread(name="The Fool", position="Present", orientation=Orientation.upright)
            ],
        )
    )
    uvicorn = [sys.executable, "-m", "uvicorn", "--host", "127.0.0.1", "--log-level", "warning"]

    try:
        api_url = args.api_url
        if api_url is None:
            fake_env = {
                **os.environ,
                "FAKE_OPENAI_LATENCY_S": str(args.latency),
                "FAKE_OPENAI_FAIL_RATE": str(args.fail_rate),
            }
            fake_proc = spawn(
                [*uvicorn, "scripts.fake_openai:app", "--port", str(args.fake_port)],
                fake_env,
                fake_log,
            )
            api_env = {
                **os.environ,
                # Any non-empty key selects OpenAIAdapter; the SDK reads the base URL from the env
                "OPENAI_API_KEY": "load-test",
                "OPENAI_BASE_URL": f"http://127.0.0.1:{args.fake_port}/v1",
                "OPENAI_MAX_CONCURRENT": str(args.max_concurrent),
                "OPENAI_ACQUIRE_TIMEOUT_SECONDS": str(args.acquire_timeout),
                "MONGODB_URI": args.mongo_uri,
                "LOG_LEVEL": "WARNING",
            }
            api_proc = spawn(
                [*uvicorn, "src.main:app", "--port", str(args.api_port)], api_env, api_log
            )
            api_url = f"http://127.0.0.1:{args.api_port}"
            await wait_for_health(f"{api_url}/api/v1/health", api_proc, api_log)
            print(f"api {api_url} up (log {api_log}); fake openai on :{args.fake_port}")

        jobs = await seed(
            db, run_id, requests=args.requests, single_user=args.single_user, budget=args.budget
        )
        mode = "one user" if args.single_user else f"{len(jobs)} users"
        print(
            f"seeded {len(jobs)} readings for {mode} (run {run_id}); "
            f"firing {args.requests} requests at latency {args.latency}s, "
            f"cap {args.max_concurrent}, acquire timeout {args.acquire_timeout}s"
        )

        batches = math.ceil(args.requests / args.max_concurrent)
        floor_s = batches * args.latency
        outcomes, wall_s = await fire(api_url, jobs, timeout_s=args.acquire_timeout + floor_s + 60)
        print(summarise(outcomes, wall_s, floor_s))

        spends, stored = await read_back(db, jobs)
        violations = check_invariants(
            outcomes,
            spends,
            interpretation_count=stored,
            worst_case=worst_case,
            budget=args.budget if args.single_user else None,
        )
        if violations:
            print("ledger invariants VIOLATED:")
            for violation in violations:
                print(f"  - {violation}")
            return 1
        print(
            f"ledger ok: {stored} interpretations stored, "
            f"${sum(spends.values()):.4f} charged across {len(spends)} users"
        )
        return 0
    finally:
        # Seeded rows go first, but the processes must stop even if Mongo is unreachable
        try:
            await cleanup(db, run_id)
            print(f"cleaned up run {run_id}")
        except Exception as exc:  # noqa: BLE001 — report and keep tearing down
            print(
                f"cleanup of run {run_id} failed ({exc!r}); rows tagged loadtest-{run_id}- remain"
            )
        finally:
            mongo.close()
            stop(api_proc)
            stop(fake_proc)


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
