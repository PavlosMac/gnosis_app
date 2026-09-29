from typing import Generic, TypeVar

from pydantic import BaseModel

T = TypeVar("T")

# Upper bound on page numbers: page and page_size come straight off the query string,
# and an unbounded skip overflows BSON's int64 (a 500) long before any real list gets
# there. 10k pages × 100 per page covers a million items.
MAX_PAGE = 10_000


class PaginatedResponse(BaseModel, Generic[T]):
    items: list[T]
    total: int
    page: int
    page_size: int
