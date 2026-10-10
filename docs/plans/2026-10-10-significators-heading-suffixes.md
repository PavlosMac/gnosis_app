# Fix: "Root / Itself / Echo" headings in significators readings

Status: Agreed, not started.

## Context
Significators interpretations head the three life-number cards as "The Empress — Life Number Root", "The Hanged Man — Life Number Itself", "The World — Life Number Echo". None of those words are in any label or config. They come from the frontend's per-card note, which the LLM copies into headings.

Cause chain (static trace; not reproduced with a live LLM call):
1. `frontend/src/lib/significator-conversion.ts:12-23` (`lifeNumberCardNote`) appends a role note to each life-number card: "bears your life number **itself**", "the single-digit **root** your life number reduces to", "reduces to the same root".
2. `frontend/src/lib/reading-payload.ts` sends all three cards with the identical position `"life number"`, so that note is the only thing distinguishing them.
3. `backend/src/llm/prompt_builder.py:310-316` renders each card as `N. Card (orientation) — life number: <description + note>`.
4. `_SIGNIFICATORS_TEMPLATE` (`prompt_builder.py:121`) only says "card-by-card sections" and gives no heading rule, so the model invents the suffix from the note's vocabulary.

## Changes
1. **Prompt heading rule (the actual fix).** In `_SIGNIFICATORS_TEMPLATE`, after "Write the portrait as card-by-card sections", add: head each section with the card name and its position exactly as given (e.g. "The Empress — Life Number"); never add role labels, qualifiers or descriptive suffixes to a heading; the position notes are for your reading, not for headings.
2. **Reword the notes to reduce the leak** in `lifeNumberCardNote`. Use plain numeric facts that don't read as labels, e.g. "Card number 20 — your life number." / "Card number 2 — your life number reduced to a single digit." / "Card number 11 — also reduces to 2." Keep the numeric reasoning so the model can still distinguish the cards. The Fool-as-22 handling stays.
3. **Tests/docs.**
   - Update the pinned strings in `frontend/src/lib/__tests__/significator-conversion.test.ts` (lines ~82-98).
   - Add a backend test in `backend/tests/llm/test_lean_prompt.py` that the significators system prompt contains the heading rule.
   - Run `make -C backend prompt-doc` to regenerate `docs/reference/prompts/prompt-reference.md`. Check `docs/reference/prompts/lean-prompt-architecture.md` for matching wording.
   - Add a bug entry to `docs/notes/bugs.md` (symptom, cause, fix, prevention) and a dated line to `docs/notes/issues.md`.

Per the notes protocol, check `docs/notes/decisions.md` for an ADR on significator descriptions before editing. No commit unless asked.

## Verification
- `npm --prefix frontend test` (or the repo's test script) and `npm --prefix frontend run lint`
- `make -C backend test`, `make -C backend lint`, `make -C backend prompt-doc-check`
- Manual: run a significators reading in the dev stack with a birth date that gives a double-digit life number. Dev uses real OpenAI, so this is one billed call; only run it with the user's go-ahead. Otherwise inspect the prompt with `backend/scripts/dump_prompts.py`.
- LLM output is non-deterministic, so one clean run is evidence, not proof.
