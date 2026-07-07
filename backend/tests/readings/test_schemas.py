import pytest
from pydantic import ValidationError

from src.readings.schemas import UpdateReadingTagsRequest, parse_comma_separated_tags


def test_parses_comma_separated_string():
    result = UpdateReadingTagsRequest(tags="career, big-decision, love")
    assert result.tags == ["career", "big-decision", "love"]


def test_strips_whitespace():
    result = UpdateReadingTagsRequest(tags="  career ,love  ")
    assert result.tags == ["career", "love"]


def test_lowercases():
    result = UpdateReadingTagsRequest(tags="Career, LOVE")
    assert result.tags == ["career", "love"]


def test_dedupes_preserving_first_seen_order():
    result = UpdateReadingTagsRequest(tags="love, career, love")
    assert result.tags == ["love", "career"]


def test_drops_empty_pieces_from_trailing_comma():
    result = UpdateReadingTagsRequest(tags="career, love,")
    assert result.tags == ["career", "love"]


def test_empty_string_yields_empty_list():
    result = UpdateReadingTagsRequest(tags="")
    assert result.tags == []


def test_raises_when_over_five_tags():
    with pytest.raises(ValidationError):
        UpdateReadingTagsRequest(tags="a, b, c, d, e, f")


def test_allows_exactly_five_tags():
    result = UpdateReadingTagsRequest(tags="a, b, c, d, e")
    assert result.tags == ["a", "b", "c", "d", "e"]


def test_parse_comma_separated_tags_normalizes():
    assert parse_comma_separated_tags(" Career, love, love,") == ["career", "love"]


def test_parse_comma_separated_tags_no_cap():
    result = parse_comma_separated_tags("a, b, c, d, e, f")
    assert result == ["a", "b", "c", "d", "e", "f"]
