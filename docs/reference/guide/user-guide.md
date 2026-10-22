# User guide (`/guide`)

How the public guide is built and how to add a chapter or a screenshot. Frontend only; no backend involvement.

## Shape

- `/guide` — hub (`frontend/src/app/guide/page.tsx`): one card per chapter, from `GUIDE_CHAPTERS`.
- `/guide/<slug>` — one chapter per page (`frontend/src/app/guide/[slug]/page.tsx`): framed `ArticleSection`, previous / next links, an "needs an account" note when `requiresAccount`. Unknown slug → 404 (`dynamicParams = false`). All pages are public.
- Entry points: the landing "How to use the Oracle" card and the link on `/about` (both open to everyone), and the `Guide` item in the ☥ menu (`ProfileNavMenu`), shown to signed-in users only. The guide itself is public (outside the proxy matcher).

| File | Role |
|---|---|
| `frontend/src/lib/guide-chapters.ts` | Chapter order and metadata (`slug`, `title`, `summary`, `symbol`, `requiresAccount`); `getChapter`, `adjacentChapters` |
| `frontend/src/content/guide/<slug>.mdx` | Chapter body |
| `frontend/src/content/guide/index.ts` | `GUIDE_BODIES`: static slug → MDX import map |
| `frontend/src/components/guide/Shot.tsx` | Screenshot with numbered rings |
| `frontend/src/lib/guide-shots.ts` | `shotExists()`: does the PNG exist under `public/` (answer cached in production only, so a new file shows in dev without a restart) |
| `frontend/src/mdx-components.tsx` | Shared MDX typography used by the legal documents and the chapters; in-site links go through `next/link` |
| `frontend/src/components/guide/guide-components.tsx` | Guide-only elements (`Gold`, `Callout`, `Shot`, `h3`, `blockquote`), passed to a chapter as its `components` prop so the legal documents never pick them up |

Metadata sits in TS, not MDX frontmatter, because `next.config.ts` uses no remark/rehype plugins (Turbopack cannot serialise them). The MDX map uses static imports because Turbopack cannot resolve template-string MDX imports. Tests (`guide-chapters.test.ts`) fail if a slug has no MDX file, an MDX file has no slug, or `index.ts` misses a slug.

## Adding a chapter

1. Add the entry to `GUIDE_CHAPTERS` (position = reading order).
2. Create `content/guide/<slug>.mdx`. Use `##` for sections (the chapter title is rendered by the page).
3. Import it in `content/guide/index.ts` and add it to `GUIDE_BODIES`.
4. Check every button label against the running app.

## Screenshots

```mdx
<Shot
  src="/guide/making-a-reading/01-setup.png"
  w={1280}
  h={900}
  alt="The Reading Oracle setup screen"
  marks={[{ x: 28, y: 20, w: 44, h: 12, label: "Choose Your Reading: pick a spread" }]}
/>
```

- Each mark is an ellipse by default (good for buttons and icons); add `shape: "rect"` for a rounded rectangle around a wide block such as a card or a row of text. `x`, `y` = top-left, `w`, `h` = size, all **percent of the image**. Rings scale with the image. A numbered legend below repeats the labels (readable on phones).
- Narrow or portrait captures (a few hundred pixels wide) would be stretched to the panel width and make buttons look huge; give those a display cap, e.g. `maxWidth={420}` on the `<Shot>`, which centres the figure. Wide captures need nothing.
- Until the PNG exists, `Shot` shows a dashed "Screenshot pending" box plus the legend, so chapters never show a broken image.
- File path: `frontend/public/guide/<chapter-slug>/<nn>-<name>.png`. `w`/`h` should be the real pixel size of the file (a mismatch only affects layout before the image loads).
- Capture at a desktop window about **1280 pixels wide** (a wider or retina capture works: set `w`/`h` to the file's real size, as `your-profile/01-profile.png` does at 1746 × 1252), raw (no annotation), signed in as the dev user ([`dev-users.md`](../database/dev-users.md)). No billed calls: for the interpretation shots use a reading that already has an interpretation (the dev stack calls real OpenAI).
- Mark coordinates are measured from the real captures; re-check them whenever a screenshot or the page layout changes.

### Replacing or adding a screenshot

All 12 screenshots are captured and their rings placed from the real images (2026-10-22). To retake one:

1. Run the app (`make dev`), sign in as the dev user, set up the page state, capture raw at a desktop width (a Chrome DevTools device toolbar at 1280 with pixel ratio 1 works). Never press a button that sends something real: interpretation requests are billed, support messages and account deletion are real.
2. Overwrite the PNG at the same path under `frontend/public/guide/<chapter>/` and set `w`/`h` on the `<Shot>` to the file's real size.
3. **Clear the image cache.** The site caches resized copies of every image for a year, keyed by file name and not contents, so an overwritten file can keep showing the old picture at some sizes. In development stop the dev server, delete `frontend/.next/dev/cache/images`, restart and hard-reload (Cmd+Shift+R). In production give the new file a new name (for example `01-profile-v2.png`) and update `src` in the MDX, because browsers and the server both hold the old one.
4. Reload the chapter and nudge each mark's `x/y/w/h` until its ring sits on the right control. Keep personal names and real data out of the capture (question text, tags and the profile all show up).

Known cosmetic point: the numbered badge sits at each ring's top-left corner and can cover the first letter of a label that the ring includes (for example "SUBJECT" in the support window).
