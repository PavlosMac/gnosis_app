> **Historical (superseded 2026-08-25).** Describes the original `create()` / `temperature=0.7` design. The current pipeline is documented in [prompt_reference.md](prompt_reference.md).

# Structured LLM Output (1–3 Card Spreads)

## Context
The LLM endpoint works but returns unstructured text. The front-end needs predictable JSON with per-card context and a rich synthesis narrative. Scoped to **1–3 card spreads** for now — larger spreads may need different formats later.

## Design decisions
- **Synthesis is the core** of the interpretation — single cohesive narrative, the main thing the user reads
- **Per-card sections** relate the card back to the question/context, not generic textbook meanings
- **1–3 cards only** — `InterpretationRequest.cards` already has `max_length=10`, we'll tighten to 3 for now
- **OpenAI `parse()`** — SDK 2.30.0 supports passing a Pydantic model as `response_format`, returns `message.parsed` already deserialized

## Plan

### 1. Update schemas in `src/llm/schemas.py`

Tighten `InterpretationRequest.cards` max to 3:
```python
cards: list[CardInSpread] = Field(..., min_length=1, max_length=3)
```

Add LLM output schema (internal, sent to OpenAI):
```python
class CardInterpretation(BaseModel):
    card_name: str
    position: str
    interpretation: str  # 120–180 words, contextual to the question

class LLMInterpretationResult(BaseModel):
    card_interpretations: list[CardInterpretation]
    synthesis: str  # 200–300 words, the core narrative
```

Update `InterpretationResponse` (API response):
```python
class InterpretationResponse(BaseModel):
    model_config = {"frozen": True}
    card_interpretations: list[CardInterpretation]
    synthesis: str
    model: str
    tokens_used: int
```

### 2. Update system prompt in `src/llm/prompt_builder.py`

Add to `_SYSTEM_PROMPT`:
- Per-card: 120–180 words each, tied to the question context — how this card in this position speaks to what the querent is asking
- Synthesis: 200–300 words — the heart of the reading, weaving all cards into one cohesive narrative that directly addresses the question
- Emphasize: the synthesis is more important than individual card breakdowns

### 3. Switch adapter in `src/llm/openai_adapter.py`

Replace `create()` with `parse()`:
```python
completion = await self._client.chat.completions.parse(
    model=self._model,
    max_tokens=self._max_tokens,
    temperature=0.7,
    messages=[...],
    response_format=LLMInterpretationResult,
)
parsed = completion.choices[0].message.parsed
if not parsed:
    raise LLMResponseError("Empty or unparseable response from LLM")
```

Map `parsed` into `InterpretationResponse`. Existing error handling unchanged.

### Files to modify
- **Edit:** `src/llm/schemas.py` — add `CardInterpretation`, `LLMInterpretationResult`, update `InterpretationResponse`, tighten max cards to 3
- **Edit:** `src/llm/prompt_builder.py` — add format/length instructions to system prompt
- **Edit:** `src/llm/openai_adapter.py` — switch `create()` → `parse()`, map structured output

### Files unchanged
- `src/llm/port.py`, `src/llm/router.py`, `src/main.py`

## Verification
- `make lint` + `make test`
- Curl test on port 8001 — response has `card_interpretations[]` + `synthesis`
