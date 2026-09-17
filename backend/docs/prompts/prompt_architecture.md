> **Historical (superseded 2026-08-25).** Describes the original `create()` / `temperature=0.7` design. The current pipeline is documented in [prompt_reference.md](prompt_reference.md).

# LLM Port & Adapter (OpenAI) for Tarot Interpretation

## Context

The app needs an LLM integration to generate tarot reading interpretations. Following hexagonal architecture, we create a **port** (abstract interface) that the application depends on, and an **adapter** (OpenAI implementation) that fulfills it. This keeps the LLM concern decoupled from any domain — a future `readings` domain will consume the port via DI without knowing about OpenAI.

This mirrors how `src/database/` abstracts MongoDB — the LLM adapter is an equivalent infrastructure concern.

## New Files

```
src/llm/
├── __init__.py            # empty
├── port.py                # ABC: LLMPort with generate_interpretation() + close()
├── schemas.py             # Pydantic DTOs: InterpretationRequest/Response, CardInSpread, Orientation
├── errors.py              # LLMError hierarchy (502), LLMRateLimitError (429), CardNotFoundError (422)
├── card_catalog.py        # Loads JSON from src/lib/cards/, provides get_card_meaning() lookups
├── prompt_builder.py      # Pure functions: build_system_prompt(), build_user_prompt()
├── openai_adapter.py      # OpenAIAdapter(LLMPort) — only file that imports `openai`
```

## Modified Files

| File | Change |
|------|--------|
| `pyproject.toml` | Add `openai>=1.60.0` to dependencies |
| `src/core/config.py` | Add `openai_api_key`, `openai_model`, `openai_max_tokens` settings |
| `src/main.py` | Create `AsyncOpenAI` client + `OpenAIAdapter` in lifespan, store on `app.state.llm`, close on shutdown |
| `src/core/dependencies.py` | Add `get_llm()` factory + `LLMDep = Annotated[LLMPort, Depends(get_llm)]` |

## Design Details

### Port (`port.py`)
```python
class LLMPort(ABC):
    async def generate_interpretation(self, request: InterpretationRequest) -> InterpretationResponse: ...
    async def close(self) -> None: ...
```
Typed with domain DTOs, not raw strings. The port is purpose-built for interpretation — if a second LLM use case appears, extend or add a new port.

### Schemas (`schemas.py`)
- `Orientation` — `StrEnum` (upright/reversed)
- `CardInSpread` — frozen `BaseModel` with `name`, `position`, `orientation`
- `InterpretationRequest` — frozen `BaseModel` with `question` + `cards` list (input validation: min/max lengths, 1-10 cards)
- `InterpretationResponse` — frozen `BaseModel` with `interpretation`, `model`, `tokens_used`

All extend `BaseModel` (not `AppSchema`) since they're infrastructure DTOs, following the convention for `BaseCommand`/`BaseQuery`.

### Card Catalog (`card_catalog.py`)
- Module-level `_load_cards()` at import time (files are small, static, always needed)
- Loads all 4 JSON files from `src/lib/cards/`:
  - `major_arcana.json` — 22 cards, `data["major_arcana"]` → dict keyed by card name
  - `minor_arcana.json` — 40 pip cards (Ace–10 × 4 suits), `data["suits"][suit]` → flattened dict keyed by card name
  - `court_royals.json` — 16 court cards (Knight/Queen/Prince/Princess × 4 suits), same `data["suits"][suit]` structure as minor arcana, same field schema (`upright`, `negative`, `reversed`, `reversed_positive`), plus `meta` with kabbalah/elemental/psyche info
  - `suits.json` — suit definitions (element, temporal, description)
- Court royals stored in same lookup dict as minor arcana (both are "minor" cards with identical field schemas)
- `is_court_card(name)` helper to distinguish court cards when formatting (they have richer `meta` than pip cards)
- Exposes: `get_card_meaning(name)`, `get_suit_info(name)`, `is_major_arcana(name)`, `is_court_card(name)`, `get_all_card_names()`

**Normalised JSON field types** (all meaning fields are `list[str]`):
- Major arcana: `upright.positive` (list), `upright.negative` (list), `reversed.positive` (list), `reversed.negative` (list); `meta.archetype` (str), `meta.keywords` (list)
- Minor arcana & court royals: `upright` (list), `negative` (list | null), `reversed` (list), `reversed_positive` (list | null); court royals also carry `meta` (kabbalah, elemental, psyche)

### Prompt Builder (`prompt_builder.py`)
- Pure functions, no I/O — trivially testable
- `build_system_prompt()` → system message string
- `build_user_prompt(request)` → user message with question, spread layout, and card meanings
- Orientation determines which fields are included — **never mix upright and reversed meanings for the same card**:
  - Upright card → show upright fields only
  - Reversed card → show reversed fields only (both positive and negative aspects); LLM deduces how to weight them
- Separate formatting functions reflect the two JSON structures:
  - `_format_major_arcana(card, orientation)` — upright: `upright.positive` (list) + `upright.negative` (list) + archetype/keywords from meta; reversed: `reversed.positive` (list) + `reversed.negative` (list)
  - `_format_minor_arcana(card, orientation)` — upright: `upright` (list) + `negative` (list, if present); reversed: `reversed` (list) + `reversed_positive` (list, if present); used for both pip cards and court royals
  - `_format_court_meta(card)` — optional enrichment for court royals appended regardless of orientation: kabbalah path, elemental combo (e.g. "Fire of Water"), psyche mapping
- All list fields joined as comma-separated values in the prompt text

### OpenAI Adapter (`openai_adapter.py`)
- Receives `AsyncOpenAI` client, model, max_tokens via constructor (does NOT create its own client)
- **Pre-call validation**: verifies all card names exist in catalog → raises `CardNotFoundError` (422)
- **API call**: `chat.completions.create()` with system + user messages, temperature=0.7
- **Error mapping**: `APIConnectionError` → `LLMConnectionError` (502), `RateLimitError` → `LLMRateLimitError` (429), `APIStatusError` → `LLMResponseError` (502)
- **Post-call validation**: checks for empty/null response content → raises `LLMResponseError`
- Returns `InterpretationResponse` with interpretation text, model name, tokens used

### Singleton Wiring (`main.py`)
```python
# In lifespan — startup
openai_client = AsyncOpenAI(api_key=settings.openai_api_key)
llm_adapter = OpenAIAdapter(client=openai_client, model=settings.openai_model, max_tokens=settings.openai_max_tokens)
app.state.llm = llm_adapter

# In lifespan — shutdown
await llm_adapter.close()
```
Mirrors the existing `connect_to_mongo()` / `close_mongo_connection()` pattern.

### DI (`dependencies.py`)
```python
def get_llm(request: Request) -> LLMPort:
    return request.app.state.llm

LLMDep = Annotated[LLMPort, Depends(get_llm)]
```
The type is `LLMPort` (interface), not `OpenAIAdapter` — swapping providers changes only `main.py`.

## Implementation Order

1. Add `openai>=1.60.0` to `pyproject.toml`, run `uv sync`
2. Create `src/llm/__init__.py` (empty)
3. Create `src/llm/schemas.py`
4. Create `src/llm/errors.py`
5. Create `src/llm/card_catalog.py`
6. Create `src/llm/port.py`
7. Create `src/llm/prompt_builder.py`
8. Create `src/llm/openai_adapter.py`
9. Update `src/core/config.py`
10. Update `src/main.py`
11. Update `src/core/dependencies.py`
12. Create tests: `tests/llm/test_card_catalog.py`, `tests/llm/test_prompt_builder.py`, `tests/llm/test_adapter.py`

## Testing Strategy

- **Card catalog**: Verify all 78 cards load (22 major + 40 pip + 16 court), lookup by name works, unknown names return `None`, `is_court_card()` distinguishes court from pip
- **Prompt builder**: Pure function tests — verify question/cards/meanings appear in output, major vs minor formatting
- **Adapter**: Mock `AsyncOpenAI` client — test success path, empty response handling, error mapping (`CardNotFoundError`, `LLMConnectionError`, `LLMRateLimitError`)
- **Future integration tests**: `FakeLLMAdapter(LLMPort)` injected into `app.state.llm` — no real API calls

## Verification
1. `make lint` passes
2. `make test` — all new tests pass
3. Manual: start app with `OPENAI_API_KEY` set, verify adapter initializes in lifespan logs
