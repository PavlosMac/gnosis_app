# Bug Log

This file tracks bugs encountered and their solutions. Keep entries brief and chronological.

## Format

Each bug entry should include:
- Date (YYYY-MM-DD)
- Brief description of the bug/issue
- Solution or fix applied
- Any prevention notes (optional)

Use bullet lists for simplicity. Older entries can be manually removed when they become irrelevant.

---

## Entries

<!-- Add new bug entries below this line -->


- **2026-08-27 — New Tailwind utilities missing in dev (RelationshipLayout rendered as one column)**
  - `RelationshipLayout` (3×3 relationship spread) rendered as a single stacked pillar. Cause was not the component: `.grid-cols-3` (plus `gap-x-1`, `gap-y-4`, `text-[9px]`) were absent from the CSS the browser had loaded, so `grid-cols-3` fell back to `display: grid` with one implicit column.
  - Turbopack served the Tailwind chunk under a stable filename (`_next/static/chunks/src_app_globals_<hash>.css`) whose hash did not change when new utilities were generated, so Chrome kept serving its cached copy — even through a hard reload.
  - Fix: `rm -rf .next`, restart `npm run dev`, then load the page with a cache-busting query (`/reading?cb=1`). No code change needed.
  - Prevention: when a brand-new component's Tailwind classes appear to do nothing, probe first — `getComputedStyle` on a throwaway element with the class, and `curl` the served CSS chunk. If `curl` has the rule and the browser doesn't, it's the cache, not the markup.

- **2026-09-03 — Recurring "new code does not render" in dev: immutable cache headers applied to dev chunks**
  - Root cause of the recurring staleness (including the 2026-08-27 Tailwind-utilities incident): `next.config.ts` `headers()` set `Cache-Control: public, max-age=31536000, immutable` on `/_next/static/:path*` — and Next applies custom headers in dev too. Turbopack dev chunk filenames are module-path-hashed, NOT content-hashed (`src_app_globals_91e4631d.css` keeps its name when contents change), so `immutable` told the browser to serve year-old chunks without ever revalidating. Verified live: dev served that exact header before the fix.
  - Fix: `headers()` now returns only `securityHeaders` unless `NODE_ENV === 'production'`; all long-lived cache entries are prod-only. Dev chunks now get Next's default `no-store, must-revalidate` (verified after restart). Prod is unaffected — its chunk names are content-hashed (Next sends immutable for `/_next/static` in prod by default anyway; the custom entries mainly matter for `public/` assets).
  - One-time cleanup per browser: copies cached before the fix still carry the year-long stamp — hard refresh with DevTools "Disable cache", or Clear site data for localhost. After that, `rm -rf .next` / `?cb=1` rituals are no longer needed for this class of problem.
  - Prevention: never ship `immutable` on URLs whose content can change under the same name; gate any cache-tuning header on production.

- **2026-09-15 — Typed input wiped on a failed form submit (React 19 + `useActionState`)**
  - The Contact Support modal lost the subject/message the user had typed whenever the server action returned a validation or API error. React 19 resets every uncontrolled `<input>`/`<textarea>` in a `<form action={…}>` to its `defaultValue` after the action settles — whether or not it succeeded — so the fields went blank next to their error messages.
  - Fix: the action echoes the submitted values back on failure (`AuthFormState<TValues>.values`, typed per form — `ContactSupportFormState` uses the zod-inferred `ContactSupportInput`) and the form passes them into the `defaultValue` prop on `AuthField`/`AuthTextArea`. Login/register/forgot-password forms are equally affected and can adopt the same `values` field; never echo passwords.
  - Prevention: any `useActionState` form with uncontrolled fields needs either echoed `values` → `defaultValue` or controlled inputs; check this when adding a new auth-style form.
