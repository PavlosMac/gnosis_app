# Multi-Lens Interpretations — Backend

**Status:** Implemented — base reference for iteration

> Current prompt wording and the composed pipeline: [prompt_reference.md](prompt_reference.md) (regenerate with `make prompt-doc`).
**Date:** 2026-08-21
**Branch:** `update-interpreter`
**Frontend counterpart:** `front-end-interpreter-design.md` (removed — its contract is captured in this doc)

## Context

The frontend interpreter design specified a reworked interpretation UI: a lens picker, an
intent toggle, and a depth slider, with a reading holding several saved interpretations side by
side. It names the backend contract as blocking for most of its work. This plan implements that
contract, plus the composed prompt architecture from the supplied `build_prompt` module.

Four things change:

1. **Vocabulary.** `ReadingStyle` (`practical | reflective | spiritual | esoteric`,
   `src/llm/schemas.py:14-18`) becomes `InterpretationLens`
   (`traditional | psychological | esoteric | alchemical`), and the wire field is `lens`, not
   `style`.
2. **Intent.** New required `reflective | predictive` field. Frontend-supplied.
3. **Multiple interpretations per reading.** The unique index on `reading_id`
   (`src/migrations/versions/005_interpretations_indexes.py`) becomes a compound key. Both `005`
   and `006` are edited in place rather than superseded; see §8.
4. **Composed prompt.** The supplied ordered blocks —
   `BASE → CARD_TYPES → ORIENTATION → LENS[lens] → INTENT[intent] → SYNTHESIS → OUTPUT` —
   replace `_SYSTEM_PROMPT`, `_STYLE_WEIGHTS` and the tone bands. `SYNTHESIS` is new; see §3.

`tone` and `context` are both dropped — the frontend doc lists them under "Dropped controls".

**Out of scope:** the `gnosis/` prototype (ignore entirely), the `OBSERVER` block, the
`spiritual` lens, per-card `analysis`/`selected`/`declined` output, per-user default settings,
credit deduction.

### Decisions taken

| Question | Decision |
|---|---|
| Call shape | **One batched call.** At 2–5 cards, ~2,250 input tokens vs ~5,900 for per-card, and synthesis stays in the same call — no stub, no deferred prompt |
| Slot key | **`(reading_id, lens)`** — max 4 slots, as the doc specifies. Intent is stored and badged, not part of slot identity |
| `spiritual` lens | Dropped. It never enters the data — `005`/`006` are edited in place, so there is nothing to remap |
| Debug fields | Dropped from `output_block` this round |
| Synthesis | New `SYNTHESIS` block — the supplied module has none and forbids synthesis outright |
| Reasoning | `openai_reasoning_effort` → `medium`, `openai_max_tokens` → `8000` |
| Migrations | **Edit `005`/`006` in place.** Both are unmerged and have never run outside dev — no `007` |

### Frontend contract notes

The doc's contract stands as written — `PUT /api/v1/readings/{id}/interpretations/{lens}`, the
`// 0–4, at most one per lens` shape, and the existing confirm-dialog copy all hold. Two
non-blocking observations:

- The doc's `cards: 1–11` is narrower than the backend's existing `max_length=12`. No change
  needed; the backend is the more permissive of the two.
- `spread_type` vs `spread_name` (the doc's own open question): keep `spread_type` in responses,
  since unifying touches endpoints outside this work.

One thing the backend owns and the frontend must mirror: `SYNTHESIS_SHARE` (§1). If the
frontend's `estimatedWordsPerCard` helper omits it, the live hint drifts from what the backend
actually asks the model for.

---

## 1. Depth → word budget

The doc's model replaces `_DEPTH_BANDS` and `_synthesis_target_words` outright. Its own
arithmetic doesn't reconcile — `lerp(150, 1200, 0.6) = 780`, but its worked example reads
"60% · ≈180 words per card in a 3-card spread", i.e. 540. Reserving a synthesis share closes the
gap exactly:

```python
MIN_TOTAL_WORDS, MAX_TOTAL_WORDS = 150, 1200   # the doc's proposed constants
SYNTHESIS_SHARE = 0.3

total = MIN_TOTAL_WORDS + (MAX_TOTAL_WORDS - MIN_TOTAL_WORDS) * depth / 100
synthesis_words = round(total * SYNTHESIS_SHARE)
words_per_card = round(total * (1 - SYNTHESIS_SHARE) / card_count)
```

At depth 60, 3 cards: `780 × 0.7 ÷ 3 = 182` — matching the doc's ≈180. `SYNTHESIS_SHARE` must be
mirrored in the frontend's `estimatedWordsPerCard` helper (its Step 3) or the live hint will
drift from what the backend actually asks for.

`_distinct_card_count` (`prompt_builder.py`) still supplies `card_count` — it dedupes repeated
cards for the Significators spread, which would otherwise shrink the per-card budget for a
Life Number chart that legitimately repeats a card.

## 2. Schemas — `src/llm/schemas.py`

```python
class InterpretationLens(StrEnum):
    traditional = "traditional"
    psychological = "psychological"
    esoteric = "esoteric"
    alchemical = "alchemical"

class ReadingIntent(StrEnum):
    reflective = "reflective"
    predictive = "predictive"

class InterpretationSettings(BaseModel):
    model_config = {"frozen": True}
    lens: InterpretationLens
    intent: ReadingIntent
    depth: int = Field(..., ge=0, le=100)
```

`DEFAULT_SETTINGS` is **deleted**. The doc requires all three fields on every generate call, "no
server-side defaults, so stored settings always reflect the user's actual choice" — so
`InterpretationSettings` becomes required on `InterpretationRequest`, and
`InterpretationSettingsOverride` plus `_resolve_settings`
(`commands/generate_interpretation.py:26-33`) are deleted rather than extended.

`context` is removed from `InterpretationRequest`, `GenerateInterpretationRequest` and
`SaveInterpretationRequest`.

`LLMInterpretationResult(card_interpretations, synthesis)` is **unchanged** — batching plus
dropping the debug fields means the existing structured-output schema still fits.

## 3. Prompt components — new `src/llm/prompt_components.py`

The supplied module lands here with three adaptations:

- Key `LENS` and `INTENT` by the enums, so an unknown lens fails at the schema boundary rather
  than as a `KeyError` mid-request. Drop the `spiritual` entry. Assert at import that
  `set(LENS) == set(InterpretationLens)`.
- **`output_block` is rewritten for the batch.** It currently says "Interpret this one card
  only. Do not reference other cards, and do not conclude or sum up the reading", and describes
  a single-card JSON object. It becomes: one entry per card in spread order, `interpretation`
  approximately `words_per_card` words each, plus a `synthesis` of approximately
  `synthesis_words`. The `analysis`, `selected` and `declined` fields are dropped.
- **A `SYNTHESIS` block is added**, sitting between `INTENT` and `OUTPUT`. The supplied module
  has none — `output_block` says "Interpret this one card only… do not conclude or sum up the
  reading", because it assumed a separate synthesis stage. Batching means synthesis comes out of
  the same call, so the guidance currently in `_SYSTEM_PROMPT`'s FORMAT INSTRUCTIONS
  (`prompt_builder.py:135-145`) must be carried across rather than deleted with it. Three things
  to preserve:
  - Integrated insight, not a recap of the individual cards.
  - **Single-card variant:** do not restate the card interpretation; give a practical takeaway —
    guidance, a reflective question, or a concrete step.
  - **Significators variant:** a cohesive character portrait — how day number, life path, star
    sign and decanate interact, reinforce or temper each other.

  Reword while porting. The old text calls synthesis "the most substantial part of the
  response", which `SYNTHESIS_SHARE = 0.3` contradicts — at 3 cards it is 234 words against 546
  across the cards. It is the largest single block, not the bulk of the reading.

- **Significators variant.** `_SIGNIFICATORS_SYSTEM_PROMPT` (`prompt_builder.py:170-184`)
  becomes a `BASE` variant rather than a parallel prompt: its framing (day number, life number,
  star sign, decanate) replaces `BASE`, and `ORIENTATION` is omitted since that spread has no
  reversed guidance. `build_prompt` takes `spread_name` and selects the variant.

Keep the block comments from the supplied module. They're the rationale for text that otherwise
looks arbitrary — the court-card clause and the missing-reversed-positive clause especially.

## 4. Card data — `src/llm/prompt_builder.py`

Delete `_SYSTEM_PROMPT`, `_SIGNIFICATORS_SYSTEM_PROMPT`, `_STYLE_WEIGHTS`, `_STYLE_RULES`,
`_style_guidance`, `_DEPTH_BANDS`, `_depth_guidance`, `_TONE_BANDS`, `_tone_guidance`,
`_SYNTHESIS_BASE_WORDS` and `_synthesis_target_words`. All are superseded.

Keep every `_format_*` function (`prompt_builder.py:275-388`) untouched — they render the card
JSON that the new `BASE` block instructs the model to read, and their upright/reversed field
exclusivity is exactly what `ORIENTATION` assumes.

`build_system_prompt(request)` delegates to `prompt_components.build_prompt(...)`.
`build_user_prompt(request, meanings)` keeps its all-cards shape and gains the per-card and
synthesis word budgets.

## 5. Adapter — `src/llm/openai_adapter.py`

Structurally unchanged: one `beta.chat.completions.parse` call, `response_format=
LLMInterpretationResult`, same error mapping, same token accounting. Only the two prompt
builders behind it change. `MockLLMAdapter` needs no shape change either.

This is the payoff of batching plus dropping the debug fields — the whole adapter layer stays
as it is.

## 6. Persistence

**Key:** `(reading_id, settings.lens)`, max 4 rows per reading. Re-saving a lens replaces
that slot whatever its intent — the doc's slot model.

`src/interpretations/repository.py` — replace both methods:

```python
async def upsert_by_lens(
    self, reading_id: str, lens: str, document: dict[str, Any]
) -> None:
    query = {"reading_id": ObjectId(reading_id), "settings.lens": lens}
    # same created_at-preserving replace_one(upsert=True) as today

async def find_all_by_reading_id(self, reading_id: str) -> list[dict[str, Any]]:
    return await self.find_many(
        {"reading_id": ObjectId(reading_id)}, limit=4, sort=[("created_at", 1)]
    )
```

`find_many` with `sort` already exists on `BaseReadRepository` — reuse it rather than reaching
for `self._collection`. Sort ascending by `created_at`: the doc's journal tabs order that way.
`Interpretation` (`src/interpretations/models.py`) needs no structural change — `settings` is
already a free-form dict.

**Reading detail** — `ReadingReadModel.interpretation: InterpretationReadModel | None` becomes
`interpretations: list[InterpretationReadModel] = []`; `get_reading_by_id.py:33-35` calls
`find_all_by_reading_id`. `ReadingListItem` stays free of interpretations — adding them would be
an N+1 across the paginated list. (The doc floats an optional has-interpretations badge for the
journal list; deferred, as it marks it.)

## 7. API surface

- `POST /readings` — unchanged.
- `POST /readings/{id}/interpretation/generate` — body `{"settings": {lens, intent, depth}}`,
  all required. Returns the unsaved interpretation with `settings` echoed verbatim. Still does
  not persist.
- `PUT /readings/{id}/interpretations/{lens}` — **replaces**
  `POST /readings/{id}/interpretation`. Validates that body `settings.lens` matches the path,
  else `422`. Returns `{"interpretations": [...]}`, the full array, so the
  client refreshes without a second GET.
- `GET /readings/{id}` — returns `interpretations: []` instead of a single nested object.

`SaveInterpretationCommand` gains `lens` from the path; `intent` rides along in `settings`.
`src/main.py` mediator wiring needs no change — no new handlers, no changed constructor
signatures.

## 8. Migrations — edit `005` and `006` in place

`main` carries only `001`–`004`. Both `005` and `006` are new on this branch and have never run
anywhere but a dev database, so they are edited rather than superseded. A `007` would record a
rename-and-remap in the migration history that no deployed database ever needed.

**`005_interpretations_indexes.py`** — create the right index from the start:

```python
await db[INTERPRETATIONS_COLLECTION].create_index(
    [("reading_id", 1), ("settings.lens", 1)], unique=True
)
```

**`006_backfill_interpretations.py`** — write the new vocabulary directly. `_DEFAULT_SETTINGS`
becomes `{"lens": "traditional", "intent": "reflective", "depth": 60}`; `tone` is gone and
`style` never appears.

`lens: "traditional"` is a judgement call worth naming. These legacy rows predate settings
entirely — they were generated by the old monolithic `_SYSTEM_PROMPT`, which opens on "esoteric
symbolism, Kabbalah, and Jungian archetypes" and so matches no lens cleanly. `traditional` is
chosen because it is the frontend's default and the least-claiming label, not because it
describes how they were produced.

Everything `007` was going to do disappears: no index drop, no `$rename`, no value remap, no
`$unset` of `tone`/`context`. `spiritual` never enters the data, so the question of collapsing it
onto `esoteric` does not arise either.

**Dev-database reset — superseded.** This plan originally required a manual
`db.interpretations.drop()` before restarting (the runner skips by version, so edited files
would not re-run). Migration `007_repair_legacy_interpretation_settings.py` now repairs
legacy rows automatically; no manual reset is needed.

## 8b. Config — `src/core/config.py`

- `openai_reasoning_effort`: `"none"` → ``"medium"``.
- `openai_max_tokens`: `4000` → `8000`.

The second follows from the first: reasoning tokens are drawn from the same
`max_completion_tokens` budget as the prose. At depth 100 the model is asked for ~1,200 words
(~1,600 tokens) *plus* medium reasoning, and overrunning 4,000 truncates the response — which
`beta.chat.completions.parse` returns unparseable, surfacing as `LLMResponseError`
(`openai_adapter.py`). The cap is a ceiling, not a reservation, so only actual usage is billed.

## 9. Files touched

| file | change |
|---|---|
| `src/llm/prompt_components.py` | **new** — supplied blocks, enum-keyed, batched `output_block`, significators variant |
| `src/llm/schemas.py` | `InterpretationLens` + `ReadingIntent`, settings required, `DEFAULT_SETTINGS`/`context`/`tone` deleted |
| `src/llm/prompt_builder.py` | delete superseded prompt text and banding; keep card formatters; word-budget maths |
| `src/llm/openai_adapter.py` | unchanged apart from the prompt builders it calls |
| `src/interpretations/repository.py` | `upsert_by_lens`, `find_by_lens`, `find_all_by_reading_id` |
| `src/interpretations/{schemas,commands/*,router}.py` | `lens`/`intent`, PUT slot route, override resolver deleted, `InterpretationsResponse` added |
| `src/interpretations/service.py` | **new** — `LensMismatchError` (422) |
| `src/readings/{schemas.py,queries/get_reading_by_id.py}` | `interpretation` → `interpretations: list[...]` |
| `src/core/config.py` | reasoning effort `medium`, max tokens `8000` |
| `src/migrations/versions/005_*.py` | **edited** — compound unique index |
| `src/migrations/versions/006_*.py` | **edited** — backfill writes `lens`/`intent`, no `tone` |
| `tests/llm/test_prompt_builder.py` | style/tone/banding assertions out, block-composition and budget assertions in |
| `tests/interpretations/*`, `tests/readings/*` | slot upserts, list-shaped `interpretations`, new route |
| `tests/migrations/test_interpretation_migrations.py` | **new** — index shape, backfill vocabulary, idempotency |

## 10. Verification

1. `make lint && make test`. `tests/conftest.py` wires `MockLLMAdapter` and `mongomock-motor`,
   so router tests exercise the whole path without network or a live DB.
2. **Word budget:** assert `depth=60, card_count=3` yields 182 words per card and 234 for
   synthesis — the numbers the frontend's live hint promises. Assert the per-card share shrinks
   as card count grows at fixed depth.
3. **Repository:** save `traditional` then `esoteric` on one reading → `count == 2`. Re-save
   `traditional` with a different intent → still 2, the row's `settings.intent` updated and its
   `created_at` preserved. That last case is the whole slot model in one assertion.
4. **Migrations:** run `005` then `006` against a database seeded with legacy readings that
   carry embedded `card_interpretations`. Assert the compound unique index exists, that the
   backfilled rows carry `settings.lens`/`settings.intent`/`settings.depth` and no `style` or
   `tone`, and that re-running `006` is a no-op (it is `$setOnInsert` + `upsert`).
5. **Synthesis block:** assert it is present for a multi-card spread, that the single-card
   variant replaces it for a one-card spread, and that the Significators variant carries the
   character-portrait framing. Assert a depth-100 twelve-card request stays inside the 8,000
   completion budget rather than truncating.
6. **Prompt composition:** assert each of the four lenses and both intents emit their block;
   assert block order (`LENS` before `INTENT` before `OUTPUT` — the module's premise is that
   later text carries more weight, and `SYNTHESIS` must land after `INTENT`); assert no output
   contains "Tone:" or the old style weights; assert the Significators variant omits
   `ORIENTATION`.
7. **Route:** `PUT .../interpretations/esoteric` with a mismatched body `settings.lens` →
   `422`. Cross-user reading → `404`.
8. **End-to-end** (`make docker-up`, migrations run on startup): `POST /readings` → generate
   with `{"lens": "alchemical", "intent": "predictive", "depth": 60}` → `PUT` the slot → repeat
   with a different lens → `GET /readings/{id}` returns both in `interpretations`. Then re-`PUT`
   `alchemical` as `reflective` → still two, with the intent badge changed.

---

## Implementation notes

167 tests pass, `ruff` clean. Routes as registered:

```
POST /api/v1/readings
POST /api/v1/readings/{reading_id}/interpretation/generate
PUT  /api/v1/readings/{reading_id}/interpretations/{lens}
GET  /api/v1/readings/{reading_id}
```

Three things worth knowing that the plan did not anticipate:

- **`_SIGNIFICATORS_SYSTEM_PROMPT` had to be reflowed, not just moved.** A test asserts
  `"life themes"` appears in the significators prompt; the original line wrapped between the two
  words. Composed blocks are matched by substring in tests, so line breaks inside a phrase are
  now load-bearing.
- **`InterpretationRequest.settings` becoming required broke `tests/llm/test_adapter.py`,**
  which built requests without it. That is the intended consequence of dropping
  `DEFAULT_SETTINGS` — there is no longer any way to construct a request that does not state
  its lens and intent.
- **`created_at` comparisons in migration tests must be timezone-naive.** BSON carries no
  timezone, so Mongo returns naive UTC datetimes and a `datetime.now(UTC)` comparison fails.

Still outstanding, flagged during planning and unchanged by the implementation:

- The frontend must mirror `SYNTHESIS_SHARE = 0.3` in its `estimatedWordsPerCard` helper, or the
  slider's "≈180 words per card" hint will not match what the backend asks the model for.

(The dev-database manual reset originally listed here is superseded by migration `007` — see §8.)
