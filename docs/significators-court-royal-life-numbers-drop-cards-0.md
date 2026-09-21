# Significators: add Court Royal, un-number Life Numbers, drop `cards: 0`

## Context

The Significators chart is computed entirely in the frontend from the birth date
(`frontend/src/lib/significators.ts`). The backend only stores the resulting card list and
feeds each card's `position` / `position_description` to the LLM. Three gaps:

1. The chart has no **court royal**, although the Taroscopic copy already promises one.
2. Life number cards travel as `life number 1`, `life number 2`, ... Those numbered strings
   reach the saved-reading view and the LLM. They should be un-numbered and shown as one
   group under a **Life Numbers** banner.
3. The Significators entry in `readings-config.json` carries `"cards": 0`, a sentinel that
   also produces the label "Significators (0 Cards)".

## The Golden Dawn formula (Book T)

Each Knight, Queen and King rules three decans: the last decan of one sign and the first two
of the next (20° of a sign to 20° of the next). Pages rule no decans. The repo's own court data
(`backend/src/lib/cards/court_royals.json`) fixes the naming convention: Queen rules the 2 and 3
of her suit, King the 5 and 6, Knight the 8 and 9.

The decanate pip is already computed, so the royal follows from it:

- **Rank** from the pip number: Two, Three, Ten = Queen. Four, Five, Six = King. Seven, Eight, Nine = Knight.
- **Suit**: the pip's own suit, except for third-decan pips (Four, Seven, Ten), which belong to the
  royal of the next sign's suit: Wands, Pentacles, Swords, Cups, then Wands again.

Resulting ranges with the existing `decanates.ts` boundaries:

| Royal | Dates | Royal | Dates |
|---|---|---|---|
| Queen of Wands | Mar 11 – Apr 10 | Queen of Swords | Sep 12 – Oct 12 |
| King of Pentacles | Apr 11 – May 10 | King of Cups | Oct 13 – Nov 12 |
| Knight of Swords | May 11 – Jun 10 | Knight of Wands | Nov 13 – Dec 12 |
| Queen of Cups | Jun 11 – Jul 11 | Queen of Pentacles | Dec 13 – Jan 9 |
| King of Wands | Jul 12 – Aug 11 | King of Swords | Jan 10 – Feb 8 |
| Knight of Pentacles | Aug 12 – Sep 11 | Knight of Cups | Feb 9 – Mar 10 |

Assumption: RWS King = Golden Dawn Prince (Air) and RWS Knight = Golden Dawn Knight (Fire),
as in the repo's Tsarion court data. Swapping this is a one-line change in the rank map.

## Design decisions

- **Wire format loses the numbers.** Internally `ReadingResult.positions` is a Record and needs
  unique keys, so `life number 1..N` stay as internal keys only. `buildReadingPayload` sends every
  life number card as `position: "life number"`. The backend has no uniqueness rule on positions,
  so no backend schema change. The strip is anchored (`/^life number \d+$/i`) and applied only when
  `readingType === "Significators"`, because unnamed spreads rely on generated `Card 1..N` keys.
- **Legacy saved readings keep working.** Old rows hold `life number 1/2`; new rows hold duplicate
  `life number`. A `uniquePositionKeys` helper re-suffixes duplicates when the saved page builds
  `cardVisuals`, so both shapes reach `SpreadCards` identically and are grouped by base position.
  Older readings have no court royal, so empty groups are omitted.
- **`cards` becomes optional.** Absence means a birth-date spread, expressed through one helper
  `isBirthdateSpread(reading)` and pinned by a config-invariant test.
- **Cost note:** one more distinct card adds about 150 words to each Significators interpretation
  (server-owned budget, no frontend change). Max cards becomes 7, under the caps of 11 and 12.

## Changes (frontend, paths under `frontend/src/`)

1. `lib/court-royals.ts` (new): 12-entry table `{ royal, fromSign, toSign, pips: [3] }`, an inverted
   pip-to-royal map, `getCourtRoyalName(pip)`. The rank/suit rule above lives in the test as an
   independent check of the table.
2. `lib/significators.ts`: add `getCourtRoyal(day, month)` reusing `getDecanate` and
   `findCardByName` (`services/cardLookup.ts`); add `courtRoyal: { card, rules } | null` to
   `SignificatorResult` and `calculateSignificators`.
3. `lib/significator-positions.ts` (new): `SIGNIFICATOR_POSITIONS` (now with `court royal`),
   `isSignificators`, `basePosition`, `uniquePositionKeys`. `components/Reading.tsx` imports these
   and drops its local copies.
4. `lib/readings-config.json`: delete `"cards": 0`; add a `court royal` position last, with a
   description kept short enough that description plus suffix stays under the 500-char cap.
5. `types/reading.ts`: `cards?: number`.
6. `lib/reading-positions.ts`: add `isBirthdateSpread`; use `reading.cards ?? 0`.
7. `lib/significator-conversion.ts`: add the `court royal` position and description; always use
   indexed internal life number keys (the single-card branch is dead, life numbers are always 2 or 3).
8. `lib/reading-payload.ts`: the anchored strip; keep looking up descriptions by internal key.
9. `components/SignificatorsLayout.tsx`: banner becomes "Life Numbers"; add a "Court Royal" section.
10. `app/significators/page.tsx` (lines ~186-260): replace the duplicated JSX with `<SignificatorsLayout>`.
11. `components/SpreadCards.tsx`: significators branch that groups by base position under compact
    banners (Day Number, Star Sign, Life Numbers, Decanate, Court Royal), small cards, no per-card
    caption, responsive `flex-wrap`.
12. `app/user/readings/[id]/page.tsx`: build `cardVisuals` keys through `uniquePositionKeys`.
13. `components/TarotGame.tsx`: `numCards = selectedReading.cards ?? 0`; manual filter and
    birth-date branch use `isBirthdateSpread`; option label reads "Significators (Birth Date)".
14. `components/SpreadPreview.tsx`: note condition uses `isBirthdateSpread`.
15. Copy: add a Court Royal line to `components/TarotChart.tsx` and `app/guide/page.tsx`.

## Changes (backend)

- `scripts/dump_prompts.py` (~56-68): add a Court royal card to the sample request; then
  `make -C backend prompt-doc` to regenerate `docs/prompts/prompt_reference.md`.
- `tests/llm/test_lean_prompt.py`: fixtures use un-numbered `"life number"`; add "Court royal"
  to the positions asserted absent from the system prompt.
- No schema or prompt-template change.

## Docs

- `frontend/docs/manual-entry-flow.md`: update the `cards === 0` mention.
- `frontend/docs/project_notes/issues.md`: log the work.
- `frontend/docs/project_notes/decisions.md`: new ADR for the Golden Dawn convention
  (RWS King = Book T Prince), duplicate wire positions, and the legacy key shape.

## Tests (vitest, `renderToStaticMarkup`, following `components/__tests__/Reading.layout.test.tsx`)

New:
- `lib/__tests__/court-royals.test.ts`: all 36 decan pips resolve; rule matches table; three pips per
  royal; all 12 names resolve via `findCardByName`; boundary dates (Mar 10/11, Apr 10/11, Jul 11/12,
  Dec 12/13, Jan 9/10, Feb 8/9, Feb 29, Dec 31/Jan 1).
- `lib/__tests__/significator-conversion.test.ts`: keys and order for 2 and 3 life numbers; court
  royal present; every description is 500 chars or fewer for all 12 royals; payload passes
  `interpretRequestSchema`.
- `lib/__tests__/significator-positions.test.ts`: `basePosition` leaves "Card 1" alone;
  `uniquePositionKeys` for duplicates, legacy shape, and no-op.
- `lib/__tests__/reading-positions.test.ts`: `isBirthdateSpread`; only Significators lacks `cards`.
- `components/__tests__/SpreadCards.layout.test.tsx`: one "Life Numbers" banner with N cards; no
  "life number 1" text; legacy keys render the same; no Court Royal banner when absent; other
  spreads unchanged.

Update: `reading-payload.test.ts` (duplicate "life number" positions, "Card 1" untouched),
`SpreadPreview.layout.test.tsx` (5 slots including "court royal"), `Reading.layout.test.tsx`
(renders "Life Numbers" and "Court Royal"), `useGameReducer.test.ts` (`BIRTHDATE_SUBMIT` yields a
court royal position).

## Verification

```bash
npm --prefix frontend test
cd frontend && npx tsc --noEmit      # `next lint` is recorded as broken under Next 16 in issues.md
make -C backend test lint typecheck prompt-doc-check
```

Manual with `make dev`, in Chrome and Safari at 375px and desktop: `/significators`; the reading
flow through save and interpretation; the interpretation modal; one saved reading from before the
change and one new one; the manual-entry spread picker still excludes Significators. No commit
until asked.
