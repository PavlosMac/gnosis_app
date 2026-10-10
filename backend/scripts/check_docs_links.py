"""Fail if any relative Markdown link in docs/ or the CLAUDE.md files points at a missing
file. Keeps the docs index and the root CLAUDE.md "read first" table honest.

    uv run python -m scripts.check_docs_links   # from backend/, or root `make docs-check`
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent.parent
EXTRA_FILES = [REPO / "CLAUDE.md", REPO / "backend" / "CLAUDE.md", REPO / "frontend" / "CLAUDE.md"]
# Inline links only: [text](target). Skips absolute URLs and mailto.
LINK_RE = re.compile(r"\]\(([^)\s]+)\)")
# Backticked repo paths such as `docs/reference/x.md`: must exist too.
PATH_RE = re.compile(r"`(docs/[A-Za-z0-9_./-]+\.md)`")
HEADING_RE = re.compile(r"^#{1,6}\s+(.*?)\s*#*\s*$")
SKIP_PREFIXES = ("http://", "https://", "mailto:")


def links_in(path: Path) -> list[tuple[int, str]]:
    found: list[tuple[int, str]] = []
    in_fence = False
    for lineno, line in enumerate(path.read_text(encoding="utf-8").splitlines(), start=1):
        if line.lstrip().startswith("```"):
            in_fence = not in_fence
            continue
        if in_fence:
            continue
        for target in LINK_RE.findall(line):
            if target.startswith(SKIP_PREFIXES):
                continue
            found.append((lineno, target))
    return found


def slug(heading: str) -> str:
    text = re.sub(r"[`*_]", "", heading.lower())
    text = re.sub(r"[^\w\s-]", "", text)
    return re.sub(r"\s", "-", text.strip())


def anchors_in(path: Path) -> set[str]:
    return {
        slug(m.group(1))
        for line in path.read_text(encoding="utf-8").splitlines()
        if (m := HEADING_RE.match(line))
    }


def main() -> int:
    files = sorted((REPO / "docs").rglob("*.md")) + [p for p in EXTRA_FILES if p.exists()]
    broken: list[str] = []
    for md in files:
        for lineno, target in links_in(md):
            file_part, _, anchor = target.partition("#")
            dest = md if not file_part else md.parent / file_part
            if not dest.exists():
                broken.append(f"{md.relative_to(REPO)}:{lineno}: {target}")
            elif anchor and dest.suffix == ".md" and anchor not in anchors_in(dest):
                broken.append(f"{md.relative_to(REPO)}:{lineno}: {target} (no such heading)")
        if "reference" not in md.relative_to(REPO).parts and md.name != "CLAUDE.md":
            continue  # notes are historical logs, plans name docs not yet written
        for lineno, line in enumerate(md.read_text(encoding="utf-8").splitlines(), start=1):
            for ref in PATH_RE.findall(line):
                if not (REPO / ref).exists():
                    broken.append(f"{md.relative_to(REPO)}:{lineno}: `{ref}` (stale path)")
    if broken:
        print("Broken relative links:")
        print("\n".join(f"  {b}" for b in broken))
        return 1
    print(f"docs links OK ({len(files)} files)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
