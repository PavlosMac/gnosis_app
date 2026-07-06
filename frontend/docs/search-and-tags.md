# Reading Tags & Search/Filter — Design

## Problem

`/user/readings` (`src/app/user/readings/page.tsx`) lists a user's past readings with
only page-based pagination (`?page=`) — no way to label a reading for later recall, and
no way to narrow the list by spread type, a label, or the birth date used for a
significator reading.

## Goal

1. Let a user attach up to 5 freeform tags to a reading, edited from the reading detail
   page.
2. Add a collapsible filter panel on `/user/readings` to narrow the list by spread type
   (multi-select), tag (substring search), and birth date (exact match).

## Scope

This spans two repos:
- `gnosis-esoterica-api` (FastAPI backend) — new `tags` field, a tag-update endpoint,
  and filter query params on the list endpoint.
- `tarot-divinations` (this repo) — the tag editor UI and the filter panel UI.

## Approaches considered (tag storage)

- **A — `tags: list[str]` embedded on the reading document (chosen).** Matches how
  `cards`/`card_interpretations` are already stored as arrays directly on the document
  (`src/readings/models.py:12-13`). No relational modeling needed for freeform strings.
- **B — client-side only (localStorage).** Rejected: tags wouldn't sync across
  devices/browsers and would be lost if storage is cleared. This app already avoids
  localStorage by convention (see `docs/superpowers/specs/2026-07-02-login-to-interpret-design.md`,
  "Why no temp storage is needed").
- **C — separate `tags` collection (many-to-many).** Rejected as over-engineering: no
  current need for tag reuse/autocomplete/analytics across users; a plain string array
  is enough.

## Non-Goals

- No tag autocomplete or a "manage my tags" screen — tags are freeform text, typed fresh
  each time (though the input is pre-filled with a reading's current tags for editing).
- No per-tag network call (no dedicated add/remove-single-tag endpoint) — the UI lets
  you add/remove chips freely while editing, but Save commits the whole edited list as
  one `PATCH` (full replace), not one call per change.
- No "distinct spread types this user has used" query — the filter checkboxes list every
  spread type from `readings-config.json`, whether or not the user has used it.
- No client-side instant filtering — the filter panel is server-side (URL query params),
  matching the existing pagination pattern.
- No birth-date range filter — exact date match only, consistent with `birth_date` being
  a single specific date per significator reading, not a range someone filters by.
- No multi-tag filtering (AND/OR across several tags at once) — the Tags filter field is
  one substring search.

---

## Backend (`gnosis-esoterica-api`)

### 1. Data model — `src/readings/models.py`

Add `tags: list[str] | None = None` to `Reading.__init__` (alongside `question`,
`birth_date`, lines 17-18), following the exact same optional-field pattern already used
there:
- `to_document()` (lines 34-51): only add `doc["tags"] = self.tags` if `self.tags is not
  None` (mirrors the `birth_date` guard at lines 49-50).
- `from_document()` (lines 53-67): `tags=doc.get("tags", [])` — always returns a list,
  never `None`, so downstream code never has to null-check it.

### 2. Tag update — new endpoint + command

- **Schema** (`src/readings/schemas.py`): new `UpdateReadingTagsRequest(AppSchema)` with
  a single field `tags: str` (the raw comma-separated string as typed in the UI — no
  JSON array over the wire). A `field_validator` normalizes it: split on `,`, strip each
  piece, drop empties, lowercase, dedupe preserving order, and enforce two named
  constants defined alongside the schema: `MAX_TAGS_PER_READING = 5` and
  `MAX_TAG_LENGTH = 15` (raise `ValueError` if either is exceeded — FastAPI turns this
  into a 422 with the message, same as any other Pydantic validation error). New
  `UpdateReadingTagsResponse(AppSchema) { id: PyObjectId; tags: list[str] }` for the
  endpoint response. `ReadingReadModel`/`ReadingListItem` (schemas.py:30-51) each gain
  `tags: list[str] = Field(default_factory=list)`, matching `from_document`'s `doc.get("tags",
  [])` fallback so a reading with no tags yet is `[]`, never `None`.
- **Command** (`src/readings/commands/update_reading_tags.py`, new file, following
  `create_reading.py`'s `BaseCommand`/`CommandHandler` shape): `UpdateReadingTagsCommand
  { reading_id: str, user_id: str, tags: list[str] }`. Handler takes both
  `ReadingReadRepository` and `ReadingWriteRepository`:
  1. Ownership + existence check, copying `GetReadingByIdHandler`'s pattern exactly
     (`queries/get_reading_by_id.py:19-26`): `find_one({"_id": oid, "user_id":
     ObjectId(user_id)})`, raise `ReadingNotFoundError` if `None`.
  2. `write_repo.update(reading_id, {"tags": tags})` — reuses
     `BaseWriteRepository.update()` (`src/database/base_repository.py:21-23`), which is
     defined but currently has zero callers anywhere in the codebase.
  3. Return the updated `tags` (and `id`) so the frontend can update its local view
     immediately without waiting on a full page refresh.
- **Endpoint** (`src/readings/router.py`): `PATCH /readings/{reading_id}/tags`, body
  `UpdateReadingTagsRequest`, response `UpdateReadingTagsResponse`. Registered in
  `src/main.py` alongside the other readings commands (pattern at main.py:57-59).

### 3. List filters — `src/readings/queries/list_user_readings.py` + `router.py`

- `ListUserReadingsQuery` (lines 11-14) gains three optional fields: `spread_types:
  list[str] | None`, `tag: str | None`, `birth_date: date | None`.
- `ListUserReadingsHandler.handle` (lines 23-34) builds the extra filter conditions and
  passes them down — `repository.py`'s `find_by_user_id`/`count_by_user_id` (lines
  20-34) currently hardcode `{"user_id": ObjectId(user_id)}` as the whole filter; extend
  both to accept an already-built dict of extra conditions and merge it in, e.g.
  `{"user_id": ObjectId(user_id), **extra_filter}`.
  - `spread_type` filter (OR across checked types): `{"spread_type": {"$in":
    spread_types}}`.
  - `tag` filter (case-insensitive substring, matches if any array element matches):
    `{"tags": {"$regex": re.escape(tag), "$options": "i"}}`.
  - `birth_date` filter (exact): `{"birth_date": birth_date.isoformat()}`.
- **Router** (`router.py:29-38`): `list_readings` gains `spread_type:
  list[str] | None = Query(default=None)` (repeatable query param), `tag: str | None =
  Query(default=None)`, `birth_date: date | None = Query(default=None)`.

### 4. Migration

New `src/migrations/versions/003_reading_tags_index.py` (following `002_readings_indexes.py`'s
shape exactly): `db[READINGS_COLLECTION].create_index("tags")`.

### 5. Testing

Follow the existing 3-tier pattern in `tests/readings/`:
- `tests/readings/test_commands.py` — new case for `UpdateReadingTagsCommandHandler`
  (found-and-owned, not-found, wrong-owner → `ReadingNotFoundError`).
- `tests/readings/test_queries.py` — extend `ListUserReadingsQuery` tests for each new
  filter field, individually and combined.
- `tests/readings/test_router.py` — HTTP-level cases for the new `PATCH .../tags`
  endpoint (success, >5 tags → 422, tag too long → 422, wrong owner → 404) and the new
  list query params.
- Register `UpdateReadingTagsCommand`/`Handler` in `tests/conftest.py`'s mediator
  wiring, same place `CreateReadingCommand` is registered.

---

## Frontend (`tarot-divinations`)

### 1. Types — `src/types/reading.ts`

- `ReadingListItem` (lines 26-34) gains `tags: string[]`.
- New result type mirroring `LoginFormState`/`InterpretResult`'s ok/error shape:
  `UpdateTagsResult = { ok: true; data: { tags: string[] } } | { ok: false; error:
  string }`.

### 2. Tag editor — reading detail page

New client component `src/components/ReadingTags.tsx`, rendered in
`src/app/user/readings/[id]/page.tsx` between the header block and the interpretation
panel — right after the header `<div>` closes (line 91) and before the `{/* Interpretation
content */}` comment (line 94). Props: `readingId: string`, `initialTags: string[]`.

- **View mode**: tags rendered as small pill chips (see Visual design below, plain, no
  remove control), plus a round `+` button.
- **Edit mode** (toggled by the `+` button; ✕ discards changes and reverts to view mode):
  local component state holds a working copy of the tag array (starting from
  `initialTags`). Each existing tag renders as a chip with a small `×` that removes it
  from the working array immediately (local state only, not yet saved). A small text
  input alongside the chips lets the user type a new tag; pressing Enter or `,` commits
  the current text as a new chip and clears the input (pasting text containing commas
  splits into multiple chips at once). A round ✓ button replaces `+` and persists the
  current working array on click.
  - Once the working array reaches 5 tags, the add-input is disabled with an inline
    "Max 5 tags" hint (removing a chip re-enables it).
  - A new tag longer than 15 characters is rejected at commit time (Enter/`,`/paste)
    with an inline "15 characters max" hint — the input keeps whatever was typed so the
    user can trim it, rather than silently truncating.
  - Removing every chip down to zero and saving is allowed — this is how a reading's
    tags get cleared entirely (`PATCH` body `{"tags": ""}`, which the backend validator
    normalizes to `[]`).
- Both checks above (≤5 tags, ≤15 chars) are enforced twice: instantly client-side as
  described (no round trip), and again by the backend validator on Save as the
  authoritative check (in case client and server constants ever drift, or client JS is
  bypassed) — mirrors the existing pattern of pre-validating with zod before hitting the
  network (e.g. `loginSchema` in `src/lib/validation/auth-schemas.ts`). Add a small
  `src/lib/validation/reading-schemas.ts` with `MAX_TAGS_PER_READING = 5` and
  `MAX_TAG_LENGTH = 15` constants (mirroring the backend's) and an `updateTagsSchema`
  used at Save time as a final safety net over the working array.
- **Server action** `updateReadingTags(readingId, tags)` in
  `src/app/user/readings/[id]/actions.ts` (new export in the existing file; `tags:
  string[]` — the component's working array, not a raw string): validates via
  `updateTagsSchema`, then `PATCH`es `/api/v1/readings/${readingId}/tags` via
  `authenticatedFetch` with body `{"tags": tags.join(", ")}`. Returns `UpdateTagsResult`.
- On success: update the component's own local `tags` state directly from the response
  (`data.tags`), and separately call `router.refresh()` in the background to keep the
  server-rendered page in sync. Using the response data for the immediate UI update —
  rather than relying on `router.refresh()` alone — avoids the same stale-prop flicker
  class of bug found and fixed in the login-to-interpret flow
  (`docs/superpowers/specs/2026-07-02-login-to-interpret-design.md`).
- On failure (e.g. backend 422 for >5 tags or a too-long tag): show the returned error
  message inline under the input; edit mode stays open, nothing is lost.

### 3. Filter panel — readings list page

- `page.tsx`'s `searchParams` type (line 24) expands to include `spread_type?: string |
  string[]`, `tag?: string`, `birth_date?: string`.
- `getReadings` (`src/app/user/readings/actions.ts:7-29`) gains a `filters?: {
  spreadTypes?: string[]; tag?: string; birthDate?: string }` parameter, appending
  `&spread_type=...` (repeated), `&tag=...`, `&birth_date=...` to the query string built
  at lines 20-23.
- New client component `src/components/ReadingsFilterPanel.tsx`, rendered near the page
  header (after line 63, before the results list at line 65). Receives the current
  filter values (parsed server-side from `searchParams`) and the static spread-type list
  imported from `readings-config.json` (same import already used in `TarotGame.tsx:10`).
  - Collapsed by default; auto-expanded if any filter param is already present in the
    URL on load.
  - Toggle control styled like the existing "◆ About Our Oracle ◆" disclosure link
    (`TarotGame.tsx:311-318`): "◆ Filter Readings ◆".
  - Spread types: toggle pills (see Visual design), not native checkboxes.
  - Tag: single text input, styled like `AuthField`.
  - Birth date: a native `<input type="date">`, not the DD/MM/YYYY three-input pattern
    used elsewhere (`TarotGame.tsx:338-366`). A native date input can't produce a
    partial value — its `.value` is either a complete valid date or empty — which
    sidesteps the "what if only Day is filled in" question entirely; a half-picked date
    just reads as no filter. Trade-off: its calendar popup is browser-chrome and can't
    be fully reskinned to the mystical theme (only the text/background/icon can be
    styled via CSS, e.g. `color-scheme: dark` and an inverted calendar icon) — accepted
    as reasonable for a secondary filter control, unlike the main reading-creation
    birthdate flow which stays as the existing themed DD/MM/YYYY inputs.
  - **Apply**: builds a `URLSearchParams` from local state (omitting `page`, so it
    resets to 1) and navigates via `router.push('/user/readings?' + params)`.
  - **Clear**: collapses the panel (`setExpanded(false)`) and navigates to plain
    `/user/readings`.
- List item cards (`page.tsx:95-159`) show `reading.tags` as small read-only pills
  (same chip style as the detail page's view mode), placed after the birth-date line
  (after line 141), only rendered when `tags.length > 0`.
- Pagination links (`page.tsx:163-206`, currently `?page=${currentPage Â± 1}`) are
  rewritten to carry forward whatever filter params are currently active, so paging
  through a filtered result set doesn't silently drop the filter.

### 4. Visual design (mystical theme)

Chips — view mode / list page (read-only, no remove control):

```jsx
<span
  className="px-3 py-1 rounded-full border border-[#d4af37]/30 bg-[#1a0033]/60
             text-[#e6d5b8]/80 text-xs tracking-wide"
  style={{ fontFamily: "'Crimson Pro', serif" }}
>
  {tag}
</span>
```

Chips — edit mode (adds a small `×` that removes the chip from the working array):

```jsx
<span
  className="flex items-center gap-1.5 pl-3 pr-1.5 py-1 rounded-full border border-[#d4af37]/30
             bg-[#1a0033]/60 text-[#e6d5b8]/80 text-xs tracking-wide"
  style={{ fontFamily: "'Crimson Pro', serif" }}
>
  {tag}
  <button
    onClick={() => removeTag(tag)}
    aria-label={`Remove ${tag}`}
    className="w-4 h-4 rounded-full text-[#d4af37]/60 hover:text-[#d4af37]
               hover:bg-[#d4af37]/10 flex items-center justify-center leading-none"
  >
    ×
  </button>
</span>
```

Round `+`/✓/✕ buttons (detail page tag editor):

```jsx
<button
  className="w-7 h-7 rounded-full border border-[#d4af37]/50 text-[#d4af37]/70
             hover:text-[#d4af37] hover:border-[#d4af37]
             hover:shadow-[0_0_10px_rgba(212,175,55,0.4)]
             transition-all duration-300 flex items-center justify-center text-sm"
>
  +
</button>
```

Spread-type filter pills (multi-select, independently toggleable — adapted from the
"Upright Only / With Reversals" segmented control at `TarotGame.tsx:256-282`, but each
pill toggles on its own rather than being mutually exclusive):

```jsx
<button
  aria-pressed={selected}
  className={`px-4 py-2 rounded-full border text-xs tracking-wide transition-all duration-300
    ${selected
      ? 'bg-gradient-to-br from-[#d4af37] to-[#b8942f] text-[#1a0033] border-[#d4af37] font-bold'
      : 'border-[#d4af37]/30 text-[#e6d5b8]/60 hover:border-[#d4af37]/60 hover:text-[#e6d5b8]/90'}`}
  style={{ fontFamily: "'Cinzel', serif" }}
>
  Single Card
</button>
```

Apply / Clear buttons: Apply reuses the solid gold CTA style (`TarotGame.tsx:301-309`);
Clear reuses the ghost/ text-button style of "Try Again" in
`InterpretationModal.tsx:208-214` (bordered, transparent, visually secondary to Apply).

---

## Data flow (end-to-end)

**Adding tags:** user clicks `+` on the detail page → edit mode shows existing tags as
removable chips plus an add-input → user types `career`, presses Enter (new chip
appears), removes an old chip via its `×`, types `big decision`, presses Enter → clicks
✓ → client-side check (≤5 tags, ≤15 chars each, already enforced per-chip as they were
added) → `updateReadingTags` server action → `PATCH /api/v1/readings/{id}/tags` with
`{"tags": "career, big decision"}` → backend validator normalizes to `["career", "big
decision"]`, ownership check via `GetReadingByIdHandler`-style lookup, `$set` via
`BaseWriteRepository.update` → `UpdateReadingTagsResponse { id, tags: ["career", "big
decision"] }` → component updates its own state from the response (chips re-render
immediately) → `router.refresh()` fires in the background to keep the server-rendered
page data consistent.

**Filtering:** user expands "◆ Filter Readings ◆" → checks "Significators", types
`career` in Tags, fills in a birth date → clicks Apply → `router.push('/user/readings?
spread_type=Significators&tag=career&birth_date=1990-05-02')` → `page.tsx` re-runs
server-side with the new `searchParams` → `getReadings` appends the params to the `GET
/api/v1/readings` call → backend `ListUserReadingsHandler` builds the combined Mongo
filter (`user_id` AND spread_type `$in` AND tags `$regex` AND birth_date exact) →
paginated, filtered results render; Prev/Next links keep the same three params attached.

## Error handling

- Tag save failure (network, 422, 404 if the reading was deleted mid-edit): inline error
  under the input, edit mode stays open, no data loss.
- Filter panel: no client-side network calls — Apply just navigates, so failures surface
  the same way any `getReadings` failure already does today (`page.tsx:65-70`'s existing
  error branch).
- Invalid `birth_date` in the URL (e.g. hand-edited to garbage): parsed defensively in
  `page.tsx` the same way `page` is today (`page.tsx:27`); an unparseable date is treated
  as "no birth date filter" rather than erroring the whole page.

## Testing approach

- Backend: standard 3-tier suite as described above (`make test-docker` per this
  project's testing convention for anything importing the full app).
- Frontend: no automated test suite exists in this repo (confirmed: no
  jest/vitest/testing-library in `package.json`) — verification is `npm run lint`
  (currently broken in this environment for unrelated reasons — Next 16 / ESLint 9
  flat-config incompatibility, tracked separately) plus manual browser verification via
  `npm run dev`.

## Decisions confirmed during design

- Both repos in scope (tags/filtering need real backend support, not a frontend-only
  mock).
- Tags: freeform, multiple per reading, no fixed vocabulary.
- Tags sent to the backend as one comma-separated string (max 5), not a JSON array —
  parsing/normalizing happens backend-side.
- Tag editing lives only on the reading detail page (list page shows tags read-only).
- Tag editor sits between the reading's header (title/date) and the interpretation
  panel, entered via a round `+` button.
- Spread-type filter options are the full static list from `readings-config.json`, not
  limited to spread types the user has actually used.
- Filtering is server-side via URL query params, matching the existing pagination
  pattern — not instant client-side filtering.
- Spread-type filter uses toggle pills (not native checkboxes), to fit the app's
  mystical visual language.
- Tag editing is chip-based: existing tags are removable one-by-one via a small `×`
  while editing, and new tags are added by typing + Enter/comma — still saved as one
  full-replace `PATCH`, not a call per change.
- Removing every tag and saving clears a reading's tags entirely (empty string →
  `[]` backend-side).
- Tag casing: normalized to lowercase server-side; re-opening the editor shows the
  normalized (lowercase) form, not whatever casing was originally typed.
- Max tag length is 15 characters (not the initially-assumed 30), enforced both
  client-side (per tag, at add time) and backend-side (authoritative).
- Birth-date filter uses a native `<input type="date">`, not the themed DD/MM/YYYY
  group used for reading creation — deliberately, since a native date input can't hold
  a partial value (it's either a complete date or empty), sidestepping the
  incomplete-date-entry question entirely. Accepted trade-off: its calendar popup can't
  be fully reskinned to the theme.
- Clicking Clear on the filter panel also collapses it (not just resetting the URL).
