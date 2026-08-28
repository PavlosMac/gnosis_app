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
