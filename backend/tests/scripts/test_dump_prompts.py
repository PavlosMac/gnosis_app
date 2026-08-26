import pytest

from scripts.dump_prompts import DOC_PATH, render_doc, replace_between_markers

_DOC = (
    "intro\n"
    "<!-- BEGIN GENERATED: blocks (make prompt-doc) -->\n"
    "old\n"
    "<!-- END GENERATED: blocks -->\n"
    "outro\n"
)


def test_replace_between_markers_replaces_only_the_region():
    out = replace_between_markers(_DOC, "blocks", "new body")
    assert out.startswith("intro\n<!-- BEGIN GENERATED: blocks (make prompt-doc) -->\nnew body\n")
    assert out.endswith("<!-- END GENERATED: blocks -->\noutro\n")
    assert "old" not in out


def test_replace_between_markers_raises_when_marker_missing():
    with pytest.raises(ValueError):
        replace_between_markers(_DOC, "sample", "body")


def test_prompt_reference_doc_is_current():
    """Drift protection: prompt code changed without `make prompt-doc`."""
    current = DOC_PATH.read_text(encoding="utf-8")
    assert render_doc(current) == current, "docs/prompt_reference.md is stale — run make prompt-doc"
