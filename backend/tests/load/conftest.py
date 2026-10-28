"""Load-test reporting: scenarios hand their one-line latency summary to `report`, and
the terminal summary prints them together at the end — readable without `-s`, which
would otherwise bury them under one access-log line per request."""

from collections.abc import Callable

import pytest

_SUMMARY_KEY = pytest.StashKey[list[str]]()


@pytest.fixture
def report(request: pytest.FixtureRequest) -> Callable[[str], None]:
    lines = request.config.stash.setdefault(_SUMMARY_KEY, [])
    return lines.append


def pytest_terminal_summary(terminalreporter, exitstatus, config: pytest.Config) -> None:
    lines = config.stash.get(_SUMMARY_KEY, [])
    if not lines:
        return
    terminalreporter.section("interpretation load summary")
    for line in lines:
        terminalreporter.write_line(line)
