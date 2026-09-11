# Make `intent` Optional and Client-Decided

Status: **superseded 2026-09-02** (implemented earlier the same day, then overtaken:
intent was subsequently **removed entirely** and the two-step preview→save flow
collapsed into one idempotent `POST /readings/{id}/interpretation` — see
`docs/prompts/lean_prompt_architecture.md` §7. Kept as history.) This amends a decision
[`docs/prompts/lean_prompt_architecture.md`](prompts/lean_prompt_architecture.md)
currently marks as settled (§7 "Decided") — see Context below for why. This file is
the working plan and base reference for iterations.

## Context

The lean prompt architecture (`docs/prompts/lean_prompt_architecture.md`) currently
treats `intent` (predictive/reflective) as the one field that survived the old
lens/depth/style system unchanged — required on every situational spread, explicitly
spec'd as staying on Tree of Life ("QUESTION_ANALYSIS, INTENT and ORIENTATION all
stay," §2) as well as the Standard template.

That assumption breaks for spreads whose *positions* already carry inherent temporal
framing. The clearest case is a Past/Present/Future-style spread: picking `predictive`
is redundant with position 3 already being "the direction events take"; picking
`reflective` directly contradicts it ("do not forecast events" beside a position
literally asking what's coming). Tree of Life has the same problem one level deeper —
its eleven zones already carry baked-in temporal framing (Chokmah = "immediate
future," Binah = "the past," Malkuth = "six months ahead"), which is in tension with
the doc's current claim that it simply "stays."

`spread_name` is not a backend-owned enum — confirmed by grep, the only place any
spread name is special-cased at all is the `_SpreadVariant` registry in
`src/llm/prompt_builder.py` (`Significators` and `Tree of Life`; everything else,
including whatever a frontend calls its PPF template, is just "Standard"). Growing a
backend allowlist of "spreads with inherent temporal framing" would need a deploy every
time the frontend adds a templated spread. The frontend already owns its spread
catalog and already knows which of its templates have baked-in temporal positions, so
the fix is to make `intent` genuinely optional and let the client decide whether to
show an intent picker at all — not to grow more backend special-casing.

**Decisions already made (asked via AskUserQuestion, confirmed):**
- Client discretion, not a backend registry — the backend just accepts `intent` as
  optional; no spread-based validation.
- Significators' existing "ignore intent" behavior folds into this — the dedicated
  exemption code for it stays exactly as-is (it never used `intent` in the prompt),
  but there's no longer a separate "intent is required but ignored" oddity, since
  intent becomes genuinely optional everywhere. No active 422 rejection if a client
  sends one anyway — same policy as everywhere else (client discretion).
- When `intent` is absent for a spread that normally uses it, the `{intent}` paragraph
  is omitted from the system prompt entirely — no neutral placeholder sentence.
- The save endpoint drops `intent` from its URL path — it becomes body-only.

This is a genuine amendment to a decision `lean_prompt_architecture.md` currently
marks as settled (§7 "Decided," no §8 open-question entry for intent), not a pure
implementation detail — the doc needs updating alongside the code, not left to drift.

## Approach

### 1. Schema: `intent` becomes truly optional

`src/llm/schemas.py` — `InterpretationSettings.intent: ReadingIntent` →
`ReadingIntent | None = Field(default=None)`. Same pattern already used for
`CardInSpread.position` and `InterpretationRequest.birth_date` in this file — an
absent/null value round-trips cleanly through Pydantic without a sentinel string.

### 2. Prompt builder: conditional intent paragraph, not a per-spread flag change

`src/llm/prompt_builder.py`, `build_system_prompt` (currently ~line 297): the
`_SpreadVariant.uses_intent` flag stays exactly as-is (it answers "does this
template have an intent slot at all," still `False` only for Significators). What
changes is the branch that fills the slot when `uses_intent=True`:

```python
intent = request.settings.intent
intent_block = f"{INTENT_BLOCKS[intent]}\n\n" if intent is not None else ""
return variant.template.format(intent=intent_block, total_words=total_words)
```

**Verified concretely against the current source** (not just "run the checker and
see"): both `_STANDARD_TEMPLATE` and `_TREE_OF_LIFE_TEMPLATE` splice `{intent}` via
the identical shared pattern `_QUESTION_ANALYSIS + "\n\n{intent}\n\n" + _REVERSAL_GUIDANCE`
— same construction, both templates, confirmed by reading the current file. Today
that literal `"\n\n{intent}\n\n"` puts one blank line on *each* side of the
placeholder inside the template text itself. Move the trailing blank line into the
substituted value instead — template literal becomes `"\n\n{intent}"`,
`intent_block` carries its own trailing `"\n\n"` when present. Traced both cases by
hand: intent present → `...agenda.\n\n<text>\n\n` + reversal-guidance text, identical
spacing to today; intent absent → `...agenda.\n\n` + reversal-guidance text, exactly
one blank line, no double gap. One shared fix covers both templates since they share
the splice point — not two hand-edits. `make prompt-doc` (regenerates
`docs/prompts/prompt_reference.md`) is still worth running afterward as a visual
sanity check, but the whitespace correctness doesn't depend on it.

The import-time `INTENT_BLOCKS`/`ReadingIntent` completeness guard is unrelated to
this change (it validates the enum↔dict mapping, not whether the field is optional)
and needs no changes.

`generate_interpretation.py`'s debug log (`intent=command.settings.intent.value`)
will `AttributeError` on `None` — change to
`intent=command.settings.intent.value if command.settings.intent else None`.

### 3. Storage: this is safe with the existing unique index — verified, not assumed

The obvious worry: MongoDB's unique indexes treat a missing field and an explicit
`null` as the same indexed value, and this codebase already got bitten by exactly that
once (migration 008's lens→intent re-key had to drop the old index *before* bulk-
nulling `settings.lens`, or the second lens-less document in a bulk transform would
E11000 on `(reading_id, lens: null)`).

That failure mode doesn't reproduce here, and the plan doesn't need a migration:
- `SaveInterpretationCommand`'s `settings.model_dump(mode="json")` includes
  `"intent": null` explicitly (Pydantic includes `None` fields by default — no
  `exclude_none=True` is used) — so every document this code path writes always has
  the key present, never omits it. `upsert_by_intent`'s filter
  (`{"settings.intent": intent}`) matches explicit `null` correctly, and MongoDB
  upserts on a simple equality filter write that same value into the new document —
  so a second save with no intent for the same reading finds and replaces the first
  one, exactly like any named intent does today. One slot, not two.
- The hazard that bit migration 008 was specifically a **bulk `$unset`** across
  pre-existing rows, which creates a genuinely *missing* field, not this codebase's
  per-document upsert path. There's no existing data with a null/missing intent to
  migrate — `intent` has always been required until now — so **no migration is
  needed** for this change; it's a pure go-forward schema relaxation.
- Add a regression test locking this in: generate + save twice with no intent for the
  same reading → one document, not two, no `E11000`. (`tests/interpretations/
  test_repository.py` already has the analogous named-intent version,
  `test_upsert_replaces_the_same_intent_and_keeps_created_at` — mirror it.)

### 4. Save endpoint: drop `intent` from the URL

`src/interpretations/router.py` — `PUT /readings/{reading_id}/interpretations/{intent}`
becomes `PUT /readings/{reading_id}/interpretation` (singular, matching the existing
`POST .../interpretation/generate` naming). Remove the `intent` path parameter and the
`if intent != body.settings.intent: raise IntentMismatchError()` check entirely — with
no path segment there's nothing to cross-check against. `IntentMismatchError` becomes
dead and should be deleted from `src/interpretations/service.py` (leave
`ModelMismatchError` — unrelated). Note this is a frontend-visible breaking change to
this one endpoint's shape, as flagged when this was decided.

`InterpretationWriteRepository.upsert_by_intent` / `InterpretationReadRepository.
find_by_intent` need no changes — they already derive the slot key from
`document["settings"]["intent"]`, which now may legitimately be `None`.

### 5. Docs: amend, don't silently diverge

- `docs/prompts/lean_prompt_architecture.md`: update the Tree of Life variant
  description (§2, currently "INTENT... stays") and the "intent kept... unchanged"
  framing in §1/§5/§6/§7 to reflect that intent is optional and client-decided; add an
  explicit decided-bullet (§7) recording this rather than leaving §8 silent on it.
- `docs/lean-prompt-migration-plan.md`: follow-up note beside the existing "Decisions
  locked" line ("intent kept (predictive/reflective); lens dropped"), same pattern as
  the existing "Implemented 2026-09-02" note this doc already carries for the
  intent-as-slot-key decision.
- `docs/database/model_references.md` and `docs/interpretations/usage-and-budget-flow.md`:
  both describe `settings: {intent: str}` and the save URL shape — update both.
  _(Done — both docs were updated/rewritten in the lean-interpretations work; this
  section is a historical TODO list, not live obligations.)_

### 6. Tests

Representative pattern, not an exhaustive file list — add "no intent" coverage
alongside the existing "with intent" coverage at each layer:
- `tests/llm/test_lean_prompt.py` — system prompt omits the `{intent}` paragraph
  cleanly (no double blank line) when `intent=None`, for both Standard and Tree of
  Life; Significators unaffected either way (already covered).
- `tests/interpretations/test_commands.py`, `test_router.py` — generate/save round-trip
  with `intent=None`; the repository test from §3 above.
- `tests/interpretations/test_repository.py` — the one-slot-not-two regression test.
- `tests/factories.py` — no change needed; `make_settings(intent=None)` already works
  once the type allows it.
- Update, don't just patch: `test_save_rejects_intent_mismatch_between_path_and_body`
  goes away with `IntentMismatchError`; the URL-building test helper in
  `test_router.py` (`_save`, currently builds the URL from `body['settings']['intent']`)
  changes to hit the new path-less URL.

## Risks

- **Frontend contract change is broader than the URL.** `settings.intent` becomes
  nullable everywhere `InterpretationSettings` is echoed, not just the save
  endpoint's path: `GeneratedInterpretationResponse.settings`, `SaveInterpretationRequest.
  settings`, and `InterpretationReadModel.settings` (surfaced via `GET /readings/{id}`)
  all can now carry `intent: null`. Any frontend code that currently assumes
  `settings.intent` is always a non-null string (a label, a toggle state) needs to
  handle the null case, not just the changed save URL. Worth confirming the frontend
  is briefed on this before shipping, since it's silent at the type level in most
  frontend stacks until it crashes on a null.
- **`PUT` without an addressable resource in the URL is non-standard REST**, by
  design here: two `PUT`s to the same `.../interpretation` URL with different
  `settings.intent` in the body create/update *different* underlying documents
  (different slots), not the same resource. Normal `PUT` semantics assume the URL
  alone identifies the resource being replaced. This was the explicit chosen
  direction (body-only, cleanest shape) — flagging it as an accepted trade-off, not
  a defect to fix here.
- **Significators' latent duplicate-slot behavior is not fixed by this change, and
  stays possible.** The prompt layer has always ignored intent for Significators
  (`uses_intent=False`); the *storage* layer keys slots by whatever intent value is
  sent regardless. A client that (by bug or inconsistency) sends different intent
  values across two Significators saves for the same reading still creates two
  slots with byte-identical prose. "Client discretion, no active rejection" — the
  chosen policy — doesn't close this; it's pre-existing today and stays open after
  this change. Out of scope to fix here, but worth knowing it doesn't go away.
- **Concurrent duplicate saves can still race into a raw `E11000`.** `update_one(...,
  upsert=True)` is atomic per-operation, but two simultaneous saves to a
  not-yet-existing slot (same reading, same intent-or-lack-of-intent) can have one
  lose to the unique index with an uncaught `DuplicateKeyError`. This is pre-existing
  behavior for named intents today, unchanged by this plan — not a new risk this
  change introduces, and out of scope to fix here.
- **Deliberately no migration file.** This is a Pydantic-level type relaxation
  (`ReadingIntent` → `ReadingIntent | None`), not an index or data-shape change —
  the unique index stays exactly `(reading_id, settings.intent)`, same field, same
  index. CLAUDE.md scopes migrations to "indexes, collection setup, data
  transforms," none of which apply here. Calling this out explicitly since a
  reviewer would reasonably expect a migration given how central they've been to
  every other change this session.

## Verification

- `uv run pytest -q` — full suite green, including the new None-intent cases.
- `uv run ruff check src/ tests/ scripts/` — lint clean.
- `make prompt-doc-check` — confirms the regenerated sample prompts (with and without
  intent) match what's checked in, and is a fast way to visually inspect the
  whitespace result from §2 before trusting it.
- Manual sanity check worth doing once implemented: generate a PPF-shaped reading with
  no intent sent, confirm the system prompt has no predictive/reflective paragraph and
  reads cleanly; save it, generate again with `intent=predictive` for the same
  reading, save again — confirm `GET /readings/{id}` shows two slots, not a collision.
