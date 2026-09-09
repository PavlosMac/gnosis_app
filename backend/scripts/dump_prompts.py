"""Regenerate the generated regions of docs/prompts/prompt_reference.md from the real
prompt code.

The doc has two marker-delimited regions:

    <!-- BEGIN GENERATED: blocks (make prompt-doc) --> ... <!-- END GENERATED: blocks -->
    <!-- BEGIN GENERATED: sample (make prompt-doc) --> ... <!-- END GENERATED: sample -->

Everything outside the markers is hand-written and preserved.

Usage:
    python -m scripts.dump_prompts          # rewrite the doc in place
    python -m scripts.dump_prompts --check  # exit 1 if the doc is stale, write nothing
"""

import argparse
import sys
from pathlib import Path

from src.llm.prompt_builder import (
    REASONING_HEADROOM,
    build_system_prompt,
    build_user_prompt,
    max_completion_tokens,
    request_word_budget,
)
from src.llm.schemas import (
    CardInSpread,
    InterpretationRequest,
    LeanReading,
    Orientation,
)

DOC_PATH = Path(__file__).resolve().parent.parent / "docs" / "prompts" / "prompt_reference.md"

SAMPLE_REQUEST = InterpretationRequest(
    spread_name="Past-Present-Future",
    question="Should I take the job offer in Lisbon?",
    cards=[
        CardInSpread(
            name="The Lovers",
            position="Past",
            orientation=Orientation.upright,
            position_description="What shaped the situation and is now receding.",
        ),
        CardInSpread(
            name="Five of Pentacles",
            position="Present",
            orientation=Orientation.reversed,
            position_description="The heart of the matter as it stands now.",
        ),
        CardInSpread(name="Queen of Cups", position="Future", orientation=Orientation.upright),
    ],
)

# Realistic card counts so the rendered word budgets are representative: a 4-position
# chart (4 × 100 × 1.5 = 600 words) and a full 11-zone Tree (11 × 100 = 1,100 words).
# Position meanings arrive from the frontend as position/position_description — the
# system prompts rendered below carry none of them.
_SIGNIFICATORS_REQUEST = InterpretationRequest(
    spread_name="Significators",
    cards=[
        CardInSpread(name="The Emperor", position="Day number", orientation=Orientation.upright),
        CardInSpread(name="Strength", position="Life number", orientation=Orientation.upright),
        CardInSpread(name="The Sun", position="Star sign", orientation=Orientation.upright),
        CardInSpread(name="Six of Pentacles", position="Decanate", orientation=Orientation.upright),
    ],
)

_TREE_REQUEST = InterpretationRequest(
    spread_name="Tree of Life",
    question="How do I rebuild my life after the divorce?",
    cards=[
        CardInSpread(name="The Star", position="Kether", orientation=Orientation.upright),
        CardInSpread(name="The Magician", position="Chokmah", orientation=Orientation.upright),
        CardInSpread(name="The Empress", position="Binah", orientation=Orientation.reversed),
        CardInSpread(name="Ten of Cups", position="Chesed", orientation=Orientation.upright),
        CardInSpread(name="Five of Swords", position="Geburah", orientation=Orientation.upright),
        CardInSpread(name="The Sun", position="Tiphareth", orientation=Orientation.upright),
        CardInSpread(name="Two of Cups", position="Netzach", orientation=Orientation.reversed),
        CardInSpread(name="Eight of Pentacles", position="Hod", orientation=Orientation.upright),
        CardInSpread(name="The Moon", position="Yesod", orientation=Orientation.reversed),
        CardInSpread(name="The World", position="Malkuth", orientation=Orientation.upright),
        CardInSpread(name="The High Priestess", position="Daath", orientation=Orientation.upright),
    ],
)


# The full 9-card payload with both pillars personalized ("Pavlos"/"Maria") — the names
# are substituted by the frontend into the position strings and pass through verbatim;
# no question is ever sent for this spread.
_RELATIONSHIP_REQUEST = InterpretationRequest(
    spread_name="Relationship Reading",
    cards=[
        CardInSpread(
            name="The Magician",
            position="Current behaviour (Pavlos) - querent",
            orientation=Orientation.upright,
            position_description="What is Pavlos's current behaviour?",
        ),
        CardInSpread(
            name="Two of Cups",
            position="What is desired (Pavlos) - querent",
            orientation=Orientation.upright,
            position_description="What is desired by Pavlos?",
        ),
        CardInSpread(
            name="The Hierophant",
            position="How to proceed (Pavlos) - querent",
            orientation=Orientation.reversed,
            position_description="How should Pavlos proceed?",
        ),
        CardInSpread(
            name="The Lovers",
            position="Current situation - relationship",
            orientation=Orientation.upright,
            position_description="What is the current state of the relationship?",
        ),
        CardInSpread(
            name="Temperance",
            position="What is desired - relationship",
            orientation=Orientation.upright,
            position_description="What does the relationship need — where can compromise and "
            "equal ground be found?",
        ),
        CardInSpread(
            name="The Star",
            position="How to proceed - relationship",
            orientation=Orientation.upright,
            position_description="How is the relationship advised to proceed?",
        ),
        CardInSpread(
            name="Queen of Wands",
            position="Current behaviour (Maria) - other",
            orientation=Orientation.upright,
            position_description="What is Maria's current behaviour?",
        ),
        CardInSpread(
            name="Nine of Cups",
            position="What is desired (Maria) - other",
            orientation=Orientation.reversed,
            position_description="What is desired by Maria?",
        ),
        CardInSpread(
            name="Six of Swords",
            position="How to proceed (Maria) - other",
            orientation=Orientation.upright,
            position_description="How should Maria proceed?",
        ),
    ],
)


def _begin(name: str) -> str:
    return f"<!-- BEGIN GENERATED: {name} (make prompt-doc) -->"


def _end(name: str) -> str:
    return f"<!-- END GENERATED: {name} -->"


def replace_between_markers(text: str, name: str, body: str) -> str:
    """Replace the region between the `name` markers with `body`, keeping the markers."""
    begin, end = _begin(name), _end(name)
    start = text.find(begin)
    stop = text.find(end)
    if start == -1 or stop == -1 or stop < start:
        raise ValueError(f"marker pair for '{name}' not found in document")
    return text[: start + len(begin)] + "\n" + body.strip("\n") + "\n" + text[stop:]


def _fence(text: str) -> str:
    return "```text\n" + text.strip("\n") + "\n```"


def render_blocks() -> str:
    out: list[str] = [
        "_Generated from `src/llm/prompt_builder.py` and `src/llm/schemas.py` — "
        "edit the source, then run `make prompt-doc`._",
        "",
    ]
    variants = [
        ("Standard system prompt", SAMPLE_REQUEST),
        ("Significators variant (portrait chart)", _SIGNIFICATORS_REQUEST),
        ("Tree of Life variant (zones baked in)", _TREE_REQUEST),
        ("Relationship Reading variant (3×3 pillars, no question)", _RELATIONSHIP_REQUEST),
    ]
    for label, request in variants:
        out += [f"#### {label}", "", _fence(build_system_prompt(request)), ""]

    schema = LeanReading.model_json_schema()
    out += [
        "",
        "#### Response-format field descriptions (`LeanReading`)",
        "",
        "Sent to OpenAI as `response_format`; the model reads these alongside the system prompt.",
        "",
        f"- `reading` — {schema['properties']['reading']['description']}",
    ]
    return "\n".join(out)


def render_sample() -> str:
    request = SAMPLE_REQUEST
    total_words = request_word_budget(request)
    caps = ", ".join(
        f"{effort}: {max_completion_tokens(total_words, effort)}" for effort in REASONING_HEADROOM
    )
    card_lines = [
        f"- {c.name} ({c.orientation.value}) — {c.position}"
        + (f" — {c.position_description}" if c.position_description else "")
        for c in request.cards
    ]
    out = [
        "_Generated by `scripts/dump_prompts.py` from a fixed sample request — "
        "one major, one pip, one court._",
        "",
        f"- Spread: {request.spread_name}",
        f"- Question: {request.question}",
        *card_lines,
        f"- Word budget: {total_words} words total (server-owned, `llm_words_per_card` × cards)",
        f"- `max_completion_tokens` by reasoning effort: {caps}",
        "",
        "#### System prompt",
        "",
        _fence(build_system_prompt(request)),
        "",
        "#### User prompt",
        "",
        _fence(build_user_prompt(request)),
    ]
    return "\n".join(out)


def render_doc(text: str) -> str:
    text = replace_between_markers(text, "blocks", render_blocks())
    return replace_between_markers(text, "sample", render_sample())


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--check", action="store_true", help="exit 1 if the doc is stale; write nothing"
    )
    args = parser.parse_args(argv)

    current = DOC_PATH.read_text(encoding="utf-8")
    rendered = render_doc(current)
    if args.check:
        if rendered == current:
            print(f"{DOC_PATH.name}: up to date")
            return 0
        print(f"{DOC_PATH.name}: stale — run `make prompt-doc`")
        return 1
    DOC_PATH.write_text(rendered, encoding="utf-8")
    print(f"{DOC_PATH.name}: regenerated")
    return 0


if __name__ == "__main__":
    sys.exit(main())
