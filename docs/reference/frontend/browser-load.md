# Browser load: what the frontend must not do

Why: a colleague's older laptop span its fan up on the app. A static audit in October 2026
found the cost came from always-on animation and compositing that added nothing a user needs.
Everything below was removed on 2026-10-29 (commits 1734478 to the thumbnails commit) and
must stay removed. There is no measured before/after figure; see "Measuring" to get one.

## Rules

- **Nothing animates while the page is idle.** The only infinite animations left run while
  something is happening: the card shuffle, the Oracle wait (`ShuffleOrbit`), the deck card
  back's float during a game. Decorative loops (twinkle, border shimmer, pulses, spinners)
  are gone, with their keyframes. Do not add a new one; use a one-shot entrance
  (`animate-fadeIn`) if something must move.
- **The background is static.** `src/components/Starfield.tsx` draws 40 stars with
  deterministic position and brightness, as a server component, once per page. The five
  pages that used to carry their own starfield render it.
- **No `backdrop-blur`.** Scrims and panels are near-opaque tints instead (`/85` to `/95`).
  Blur over a full-screen background is the single most expensive effect in the app.
- **No resting `will-change`** on repeated elements. The 78 deck cards used to pin a
  compositor layer each. Now only a hovered, pressed or flipped card gets one (`tarot.css`,
  next to `.card-flip-inner`). A deck card mounts its front face and glow shadow only once
  chosen, and `ShuffledDeck` preloads the card image on pointer enter/down so the face
  is not empty while it flips.
- **Hover effects transition one property.** Landing cards use `transition-shadow
  duration-300` with a 40-50 px shadow, not `transition-all duration-700` at 80-100 px.
- **Reveal with mount/unmount, not animated layout.** The readings filter panel shows the
  birth-date field with `animate-fadeIn` when the Significators pill is on, instead of
  animating `grid-template-rows` and a negative margin.
- **Small images where cards are drawn small.** The manual picker (`FaceUpDeck`) shows all
  78 cards from `public/cards/thumbs/` (144x240 WebP, 834 KB in all) through
  `cardThumbUrl()` in `src/lib/cards.ts`. The full 320x533 images stay for reading-size
  display. A test fails if a card has no thumbnail. Regenerate after changing the deck:

  ```bash
  npm --prefix frontend run cards:thumbs
  ```

- **`prefers-reduced-motion`** has one appended block at the end of `tarot.css` for the
  remaining decorative classes and one-shot entrances; add new classes there.

## The empty slot on the profile

The Tally panel (`AccountPanel.tsx`) keeps a card-proportioned, `aria-hidden` empty frame
where the budget chalice stood (five infinite SVG animations under a `drop-shadow` filter).
A tarot card visual is planned for it. `AccountPanel` still receives `budget` from the
dashboard fetch and the pure helpers in `src/lib/profile-dashboard.ts` remain as inputs;
delete them if the visual does not use them. The guide's profile screenshot
(`public/guide/your-profile/01-profile.webp`) still shows the chalice and needs a retake.
See the amendment under ADR-008 in [`decisions.md`](../../notes/decisions.md).

## Measuring

Production build only (`npm run build && npm start`); dev mode is not representative.
Chrome Task Manager with the GPU Process row showing, idle for 30 seconds on `/`, a reading
page and the profile. Tab CPU should sit at zero. For memory, open the manual picker
(`/user/manual-reading`) and compare the tab before and after scrolling the grid. Baseline
before the change, one click-through: tab memory 25 / 56 / 120 MB, peak 251 MB seen once,
CPU 0.1 to 20 percent. The colleague should also say whether they run `make dev`, since
Docker and the Next dev server spin the fan on their own.

## Tests

`Starfield.test.tsx`, `TarotLanding.layout.test.tsx` (idle-cost blocks for the landing and
404 pages), `AccountPanel.test.tsx`, `card-thumbs.test.ts`.
