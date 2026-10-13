# Platform User Guide (MDX chapters + annotated screenshots)

> **Status: Agreed, not started (2026-10-13).** `/guide` exists today but only covers reading
> philosophy; none of the chapters, the `Shot` component or the manifest below exist yet.

## Context

`/guide` ("How to Use the Oracle") covers *reading philosophy* only (intent, framing questions,
reversed cards, significators, reading as a whole). Nothing explains how to *use the platform*:
profile, choosing a spread, saving, the oracle interpretation, filtering the readings list,
contacting support. New users have no walkthrough.

Agreed decisions:
- **`/guide` becomes a hub.** The current philosophy content becomes one chapter; platform how-to
  chapters sit beside it. Existing links (`TarotLanding.tsx`, `about/page.tsx`) keep working.
- **Screenshots = raw PNG + overlay component.** Clean screenshots are captured into
  `frontend/public/guide/`; a `<Shot>` MDX component draws numbered rings from percentage
  coordinates kept in the MDX. No new dependencies, circles stay editable, a UI change only
  needs a new PNG.

Constraints found in the code:
- MDX is configured (`@next/mdx`, `frontend/next.config.ts`) with **no remark/rehype plugins**
  (Turbopack can't serialise them): no frontmatter, no GFM tables. Chapter metadata lives in a TS
  manifest instead.
- `frontend/src/mdx-components.tsx` maps only h1/h2/p/ul/ol/li/strong/code/a, inline-styled on
  purpose (ADR-008, stale dev-server Tailwind). Needs h3, blockquote, `Shot`, `Callout`.
- A comment in `next.config.ts` says `.mdx` is "only for the legal docs" — update it.
- The legal registry/loader (`frontend/scripts/generate-legal-registry.mjs`) is overkill: guide
  slugs are a small static set. Use plain static imports in a manifest.
- No i18n. CSP already allows local `'self'` images. No Playwright or screenshot tooling exists.
- Public routes: `/`, `/reading`, `/guide`, `/significators`. Behind auth (`proxy.ts`): `/user/*`.
  The guide stays **public**; chapters about authed pages are labelled "needs an account".
- Check `docs/notes/decisions.md` (ADR-008 and any MDX/content ADRs) before touching
  `mdx-components.tsx`.

## Design

### Chapters (one MDX file each, `frontend/src/content/guide/<slug>.mdx`)

| slug | Covers | Real route(s) |
|---|---|---|
| `getting-started` | what a guest can do, the free-use limit and sign-up nudge ([`free-limit-cta.md`](../reference/readings/free-limit-cta.md)), register, verify email, log in | `/reading`, `/user/register`, `/user/login` |
| `your-profile` | profile page, personal significators, consent link | `/user/profile`, `/significators` |
| `making-a-reading` | choose a spread, shuffle/draw, reversed cards on screen | `/reading` |
| `saving-a-reading` | save, question/tags, where it goes | `/reading`, `/user/readings/[id]` |
| `oracle-interpretation` | request an interpretation, login prompt for guests, usage/budget limits (wording from [`usage-and-budget-flow.md`](../reference/interpretations/usage-and-budget-flow.md)) | `/user/readings/[id]` |
| `finding-readings` | list view, search, tags, filter panel ([`search-and-tags.md`](../reference/readings/search-and-tags.md)) | `/user/readings` |
| `contacting-support` | profile support row, modal, what happens next ([`contact-support.md`](../reference/support/contact-support.md)) | `/user/profile` |
| `account-and-privacy` | manage consent, delete account | `/user/profile/manage-consent`, `/user/profile/delete-account` |
| `reading-the-cards` | **existing `/guide` philosophy content, moved** | — |

Chapter text must be verified against the running app (real button labels): use the `run` skill
during execution; do not write labels from memory.

### Routes and files

- `frontend/src/content/guide/index.ts` — manifest `{ slug, title, summary, symbol,
  requiresAccount, Component }[]` with static `import X from "./x.mdx"`. Single source for hub
  cards, `generateStaticParams` and prev/next links.
- `frontend/src/app/guide/page.tsx` — rewritten as a **server** hub: `TarotPageLayout scrollable`
  (as `/about` does), intro, grid of chapter cards from the manifest, keeps the "Consult the
  Oracle" CTA. The starfield/fonts boilerplate of the current client page goes away.
- `frontend/src/app/guide/[slug]/page.tsx` — `generateStaticParams`, `notFound()` for an unknown
  slug, `ArticleSection framed` wrapper, prev/next chapter links, "needs an account" note when
  `requiresAccount`.
- Reuse: `TarotPageLayout`, `components/ArticleSection.tsx`; `LegalPageShell.tsx` /
  `LegalDocument.tsx` as the model for MDX in a framed panel.

### MDX components (`frontend/src/mdx-components.tsx`)

Add, keeping inline layout styles per ADR-008: `h3`, `blockquote`, and
- `Callout` — replaces the gold boxed "Example Questions" / "Discover Your Significators" blocks.
- `Shot` — `frontend/src/components/guide/Shot.tsx`:
  ```mdx
  <Shot src="/guide/making-a-reading/01-spreads.png" w={1280} h={800}
        alt="Spread picker"
        marks={[{ x: 12, y: 30, w: 20, h: 14, label: "Choose a spread" },
                { x: 70, y: 82, w: 18, h: 9,  label: "Draw the cards" }]} />
  ```
  Renders `next/image` in a relative container; each mark is an absolutely positioned ellipse
  (`border-radius: 50%`, gold ring, numbered badge) sized in percentages of the image, so it
  scales on mobile. Below the image a numbered `<ol>` legend repeats the labels (readable on
  small screens, accessible text). Server component, no JS.

### Screenshot convention

- Path: `frontend/public/guide/<chapter-slug>/<nn>-<name>.png`, captured at a fixed 1280-wide
  desktop viewport from the dev stack (`make dev`) as the dev user
  ([`dev-users.md`](../reference/database/dev-users.md)).
- **No billed calls**: the dev stack uses real OpenAI and Resend. The interpretation shot uses a
  reading that already has an interpretation, or a manual capture, never a fresh request.
- Marks are authored by eye as percentages of the image and tuned in the MDX.

### Entry points

- Add a "Guide" item to `ProfileNavMenu` (`components/ProfileNav.tsx`; today only
  Profile/Readings/Login/Register).
- The landing `ArticleCard href="/guide"` already exists, unchanged.
- Possible follow-up, not in scope: contextual "?" links from `/reading` and `/user/readings`
  into the matching chapter.

### Out of scope

Playwright auto-capture, i18n, search inside the guide, video, sitemap work (the existing
`sitemap.xml` is a placeholder).

## Implementation phases (TDD)

1. **Infra** — `Shot`, `Callout`, mdx-components additions, manifest, hub + `[slug]` routes, move
   the philosophy text into `reading-the-cards.mdx`; ships with that one chapter. Update the
   `next.config.ts` comment.
2. **Chapters** — write the eight platform chapters, capture screenshots, place marks.
3. **Docs** — see below.

## Tests (vitest; pattern from `components/__tests__/AboutSections.layout.test.tsx`)

- `Shot`: one mark and one legend entry per `marks` item; mark style uses percentages; alt present.
- Manifest: every slug has an MDX file and renders; slugs unique; `generateStaticParams` matches.
- Asset guard: every `/guide/...` image referenced in `content/guide/*.mdx` exists under
  `public/`, so a missing screenshot fails CI instead of 404ing in prod.
- Hub and `[slug]` pages: unknown slug gives `notFound`; the account-required note shows only
  where flagged.

## Verification

- `npm --prefix frontend run lint`, `npm --prefix frontend test`, `make docs-check`.
- `make dev`; open `/guide` and each `/guide/<slug>`; check ring alignment at 1280 and at a narrow
  mobile width, in Chrome and Safari (restart the dev server if new Tailwind classes compute to
  nothing, see `frontend/CLAUDE.md`).
- Walk each chapter's steps in the live app to confirm button labels and flow match.
- `npm --prefix frontend run build` to confirm static generation of every slug.

## Docs on ship

Create `docs/reference/frontend/user-guide.md` (manifest, `Shot` usage, screenshot convention,
how to add a chapter); **delete this plan**; update `docs/README.md`; add a row to the root
`CLAUDE.md` "Working on → read first" table; update `docs/notes/key-facts.md` routes (`/guide`,
`/guide/[slug]`); add a dated line to `docs/notes/issues.md`; add an ADR to
`docs/notes/decisions.md` (MDX + TS manifest because Turbopack rules out plugins; screenshots are
raw PNG + overlay marks rather than baked annotations).
