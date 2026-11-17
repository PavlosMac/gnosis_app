# Clicking a card in a spread (frontend)

A card laid out in a drawn spread is a button. Clicking it opens a dialog with the card's
stored general meaning (all 78 cards). The text is pre-generated and the same for everyone;
the collection, endpoint and loader are in
[`model-references.md`](../database/model-references.md) § `spread_card_meanings` (ADR-021 in
[`decisions.md`](../../notes/decisions.md)). The plan that built it is
[`2026-11-17-spread-card-meanings.md`](../../plans/2026-11-17-spread-card-meanings.md), kept
until the browser check and the edit pass over the texts are done.

## Where cards are clickable

| Surface | Owner of the open-card state |
|---|---|
| `/reading` (reading phase, draw and manual modes) | `TarotGame.tsx` |
| Saved reading page, before and after the interpretation | `InterpretationSection.tsx` |

Layouts that take the handler: the default row (`Reading.tsx`, `SpreadCards.tsx`),
`KabbalahLayout.tsx` and `RelationshipLayout.tsx`. Not clickable: Significators (computed,
not drawn), and the `SpreadCards` inside the interpretation modal (no dialog over a dialog).
The dialog is open to visitors; the server action `getSpreadCardMeaning`
(`app/reading/actions.ts`) calls the public endpoint with no session.

## How it works

- **`TarotCard`** takes `position?` and `onSelect?: SpreadCardSelectHandler`. With `onSelect`
  the face is wrapped in `<button type="button" aria-haspopup="dialog">` and a click calls
  `onSelect({ card, reversed, position })`. Inside the button the face is built from `span`s
  (a button may only hold phrasing content); without `onSelect` it is the plain `div`/`h3`
  card. The accessible name is `About {name}`, plus ` (reversed)` for a reversed card.
- **One stable handler per spread.** Every card in a layout shares the same `onSelect`
  function and passes its own `position` back, so `React.memo` on `TarotCard` still holds.
  `KabbalahLayout` wraps it (`useCallback`) to hand back the spread's own position string
  (the slot is named `Chesed`, the spread may carry `" Chesed"`); `SpreadCards` builds its
  card objects once per `cardVisuals` (`useMemo`) and adds the position's stored description. Keep new layouts to this shape: no inline closure per card.
- **The card is resolved by name, never `idx`.** The draw flow and the saved layouts
  overwrite `idx` with the slot number, so `SpreadCardMeaningModal` looks the deck index up
  with `findCardByNameSafe(card.name)`; a name not in the deck yields `-1` and the action
  refuses it.
- **Dialog.** `SpreadCardMeaningModal` (title: card name, plus `(Reversed)`; subtitle:
  the position's name only; the position's description is a wrapping paragraph at the top of
  the body) uses the shared `CardMeaningDialog` pieces
  (`createMeaningLoader`, `useCardMeaning`, `CardMeaningBody`) that the profile's card-of-the-day
  modal also uses. Successful texts are cached for the page's lifetime; an error is retried on
  the next open. A card with no stored text shows the "has not been written yet" line.
- **The position description is shown whole, in the body, not the header.** The spread
  config's per-position descriptions run up to ~270 characters on the Tree of Life, and
  `SanctumModal`'s subtitle is one truncated line, so the subtitle is the name and the
  description is its own italic paragraph above the card and text. Live readings take it from
  the reading's `positionDescriptions`, saved ones from each card's `position_description`.
- The text is the same upright and reversed; the card image in the dialog is drawn as it fell.

## Tests

`components/__tests__/SpreadCardSelect.markup.test.tsx` (buttons, phrasing-only markup,
reversed label), `SpreadCardSelect.payload.test.tsx` (what each layout reports on click),
`SpreadCardMeaningModal.test.tsx`, `app/reading/__tests__/getSpreadCardMeaning.test.ts`.
