# Required birth date at registration + personal day card on the profile

**Status:** agreed, not started (2026-11-03). Four parts, each implemented, tested and committed in turn.


## Context

The profile's Tally panel keeps an empty, card-proportioned slot reserved for "a tarot
card visual" (ADR-008 amendment, `docs/reference/frontend/browser-load.md` §"The empty
slot on the profile"). The pasted code from another project computes a querent's personal
**year / month / day** numbers from their birth date and today's date. We want the day
number's major arcana card in that slot now, with month and year computed and ready to show
later. Nothing in the system knows a user's birth date today (it exists only on significator
readings), so registration must collect it.

Decisions already taken with Pavlos:

- Port the pasted formulas exactly (master numbers 11 and 22 kept; month rolls forward from
  the 21st). Cards: 1–21 → `TAROT_DECK[n]`, **22 → The Fool** (idx 0). No "reduce" button.
- "Today" is the **user's local date**, computed in a client component after mount.
- Birth date is **required at sign-up (register and accept-invite) only**. Optional on read:
  legacy, seeded and invited users have none and the slot stays empty for them. No edit UI,
  no backfill.
- **New privacy policy version** (2026-11-03) listing the birth date; existing users
  re-consent through the onboarding gate (ADR-012).

My calls (say if you want them changed):

- **Minimum age 18**, enforced in zod and the backend validator. Terms §6 already says you
  must be 18; the birth date lets us actually check it.
- **No new Terms version.** §7's "including your first and last name and an email address"
  is non-exhaustive and the obligation (accuracy) does not change; the data inventory belongs
  to the Privacy Policy. Noted for the lawyer review in the issues line.
- Native `<input type="date">` through the existing `AuthField`, with a static
  `min="1900-01-01"` and **no `max`** (a render-time "today" would differ between server and
  client; zod holds the upper bound). The date control gets `colorScheme: "dark"` so the
  native picker icon is visible, as `ReadingsFilterPanel.tsx:190-198` already does.
- Reuse `TarotCard` for the visual (ADR: reuse existing visuals). Its hover glow is already
  opacity-only; no change.
- Seed the dev superadmin with a birth date so the dev account shows a card (QA, screenshot).
- The `budget` prop and chalice helpers are deleted (browser-load.md says to when the visual
  lands and doesn't use them).

**Working tree note:** another session left an uncommitted "profile page tidy" on this
branch (first name as a title, email row gone, `greetingName`). This plan builds on that
state; commit it first.

**Deploy note:** a backend with Part A against a frontend without Part B makes registration
fail with a generic error (the frontend drops pydantic 422 lists). Commit A and B before any
deploy; registration in `make dev` is broken between the two commits, which is expected.

Numerology is frontend-computed, matching the significators chart (ADR-011). The backend
only stores and returns the date.

Order: four parts, each implemented, tested and committed before the next (Pavlos's rule).

---

## Part A — Backend: `birth_date` on the user

Read first: `backend/CLAUDE.md`, `docs/reference/auth/registration-verification-and-consent.md`.

Wire format: ISO string `"YYYY-MM-DD"`, same as readings (`backend/src/readings/models.py:39-52`).
Optional fields are omitted from the document when None (never stored as null).

**Tests first** (pytest, httpx client, mongomock; bodies come from `backend/tests/factories.py`):

- `factories.py`: add `birth_date="1990-06-15"` default to `make_register_body` and
  `make_accept_invite_body`. Every authenticated fixture flows through these.
- `tests/auth/test_commands.py:23-33`, `test_email_verification_commands.py:61-68`,
  `test_password_input_limits.py:13-18`: add the field to the command/request dicts.
- `tests/auth/test_email_verification_router.py:51-56`: add `"birth_date"` to the
  required-key loop. New cases → 422: malformed (`"15/06/1990"`), impossible (`"1990-02-30"`),
  in the future, under 18 (today minus 17 years), before 1900.
- `tests/auth/test_router.py:326-353`: `/auth/me` returns `birth_date`. `:303-323` legacy raw
  doc → `birth_date` is `None`.
- `tests/auth/test_accept_invite_router.py:92,160`: assert `doc["birth_date"]` after
  acceptance; `:177` monkeypatch of `activate_invited` must match the new signature.
- `tests/auth/test_commands.py`: register handler writes `doc["birth_date"] == "1990-06-15"`
  (string, not a date object).

**Code:**

- `backend/src/auth/schemas.py`: `BirthDate = Annotated[date, AfterValidator(_check_birth_date)]`
  next to `PersonName` (41-50): not after today, year ≥ 1900, at least 18 years old (compare
  against `date.today()`; the 18th birthday itself passes). Required on `RegisterRequest`
  (74-79) and `AcceptInviteRequest` (106-111). `birth_date: date | None = None` on
  `UserReadModel` (167-175) and `UserResponse` (137-152). Leave `UserIdentity` and the admin
  `AdminUserResponse` alone (PII; nothing needs it).
- `backend/src/auth/models.py` `User`: `birth_date: date | None = None`; `to_document`
  writes `.isoformat()` when set; `from_document` parses with `date.fromisoformat` when present.
- `backend/src/auth/commands/register_user.py`: field on `RegisterUserCommand`, passed to
  `User(...)`. `accept_invite.py`: field on the command, passed to
  `AuthWriteRepository.activate_invited` (`repository.py:124-153`), which adds
  `"birth_date": birth_date.isoformat()` to its `$set`.
- `backend/src/auth/router.py`: pass `body.birth_date` into both commands (46-69, 102-117).
  `/auth/me` and `/auth/consent` pick it up through `UserResponse`.
- `backend/scripts/seed_superadmin.py:18-47`: add `"birth_date": "1990-06-15"` to the dict
  (`$setOnInsert`-style if it upserts; follow the script's existing pattern).
- No migration (readers tolerate absence; no index).

**Docs:** `registration-verification-and-consent.md` (status table line 17, endpoints
40 and 47, a "Birth date" bullet block under "Names and consent" 97-113 with the rules);
`docs/reference/database/model-references.md` users table (15-33): one row, format precedent
is the readings `birth_date` row; `docs/reference/admin/user-management.md:61-65`
(accept-invite field list); `docs/reference/database/dev-users.md` (seeded birth date).

**Verify:** `make -C backend test && make -C backend lint && make -C backend typecheck`.

---

## Part B — Frontend: registration and invite forms, types

Read first: `docs/reference/auth/frontend-auth-flow.md`.

Validation that users see must live in zod: the frontend drops pydantic 422 lists
(`frontend/src/lib/api-error.ts:16-21`), so the backend validator is defence only.

**Tests first** (vitest, no jsdom):

- `src/lib/__tests__/auth-schemas.test.ts`: add `birthDate: "1990-06-15"` to `VALID`; cases
  for both `registerSchema` and `acceptInviteSchema`: missing, `"15/06/1990"`, `"1990-02-30"`,
  future, 17 years old, exactly 18 today (passes), 1899.
- `src/app/accept-invite/__tests__/actions.test.ts`: fixture (18), expected body gains
  `birth_date` (~56), echo gains `birthDate` (79).
- New `src/app/user/register/__tests__/actions.test.ts` copied from the accept-invite one
  (mock `@/lib/api-client`, `@/lib/legal-documents` and `@/lib/feature-flags` with
  registration enabled): body carries `birth_date`, a zod failure echoes `birthDate` back.
- `src/components/__tests__/ProfileNav.menu.test.tsx`: its two `User` fixtures gain
  `birthDate: null` (the field is required on the type).
- New `src/components/__tests__/AuthField.date.test.tsx` (static markup, like
  `AuthField.password.test.tsx`): `type="date"` renders `min`, `autocomplete="bday"`,
  `color-scheme:dark` and no `max`.

**Code:**

- `src/lib/validation/auth-schemas.ts`: `birthDateField` beside `nameField` (19-24): string,
  `/^\d{4}-\d{2}-\d{2}$/`, real calendar date via `isValidDate` from `src/lib/dateValidation.ts`,
  not in the future, year ≥ 1900, age ≥ 18 ("You must be 18 or older to create an account").
  Add to `registerSchema` (51-67) and `acceptInviteSchema` (71-85).
- `src/app/user/register/register-form.tsx`: an `AuthField name="birthDate" type="date"
  label="Date of birth" autoComplete="bday" min="1900-01-01"` after Last Name (after line
  84), with `error={state.fieldErrors?.birthDate?.[0]}`, `defaultValue={state.values?.birthDate}`
  (the posted `YYYY-MM-DD` string is exactly what a date input's `defaultValue` takes, so the
  echo after a failed submit just works), `hint="You must be 18 or older. Used for your card
  of the day on your profile."`, `required`. Same in
  `src/app/accept-invite/accept-invite-form.tsx` (fields 76-118).
- `src/app/user/register/actions.ts`: echo (22-28), safeParse input (30-38), body
  `birth_date: parsed.data.birthDate` (45-56). Same in `src/app/accept-invite/actions.ts` (25-74).
- `src/types/auth.ts`: `birthDate: string | null` on `User` (9-24); `birth_date?: string | null`
  on `MeResponse` (34-48) and `UserResponse` (142-155); map it in `mapMeResponseToUser`
  (164-177) and `mapUserResponseToUser` (271-284); `birthDate: string` on
  `RegisterEchoValues` (67-73) and `AcceptInviteEchoValues` (93-98).
- `AuthField.tsx`: optional `min?: string` / `max?: string` props passed to the plain
  `<input>` (79-91); for `type="date"` the style becomes
  `{ ...AUTH_CONTROL_STYLE, colorScheme: "dark" }`. The date input already posts `YYYY-MM-DD`.

**Docs:** `frontend-auth-flow.md` (Key Files row for accept-invite line 19; diagram 10 form
fields 318 and POST body 321-322; diagram 13 body 386-389);
`registration-qa-checklist.md` (§2 field checks 37-46: add the date, the under-18 refusal and
that the date survives a failed submit; §3 line 57; §6 77-85 nothing about the profile yet).

**Verify:** `npm --prefix frontend test` and `npx --prefix frontend tsc --noEmit -p frontend`
(`issues.md` says `npm run lint` is broken under Next 16; confirm before relying on it).
Then `make dev`: register with a birth date, check the 17-year-old refusal and the kept
value after a bad password.

---

## Part C — Legal: new privacy version

Read first: `frontend/src/content/legal/README.md` (version = filename, never edit an old
file's meaning, run the registry script).

- Copy `frontend/src/content/legal/privacy/2026-10-13.mdx` → `privacy/2026-11-03.mdx`. The
  section-2 intro becomes "Your email address, name, date of birth and password are required
  to create an account." In the account-data list (line 14 area) add: **Date of birth.** Used
  to work out the tarot cards that represent you on your profile and to confirm you are old
  enough to hold an account. Legal basis: performance of the contract. Kept until you delete
  your account. Keep the existing readings line (significator charts still send a birth
  date to OpenAI); in the OpenAI bullet (line 37) say the account birth date is **not** sent.
  Do not touch `2026-10-13.mdx`. Terms unchanged (see Context).
- `npm --prefix frontend run legal:registry`; commit `src/lib/legal-registry.generated.ts`.
  No consent code changes: `staleConsents` compares strings and `CURRENT_VERSIONS` picks the
  newest filename, so the gate fires on its own (ADR-012).
- Tests: `src/lib/__tests__/legal-registry.test.ts` pins the registry to the directory (a
  forgotten regenerate fails); `legal-versions.test.ts` may pin version strings; update.
- Docs: `registration-qa-checklist.md` line ~77 names a specific version; change to "the
  current version". `key-facts.md` if it lists current legal versions (grep `2026-10-13`).

**Verify:** tests; `make dev`, sign in as the dev user → redirected to `/accept-terms`
showing only the Privacy Policy, accept, profile Agreements rows show 2026-11-03.

---

## Part D — Numerology helper + personal day card in the Tally slot

Read first: `docs/reference/frontend/browser-load.md` (nothing animates idle; one-property
hover transitions; the slot section 42-50).

**Pure helper, tests first:** `src/lib/personal-numbers.ts` + `src/lib/__tests__/personal-numbers.test.ts`.

```ts
export const sumDigits = (n: number) => ...            // digit sum
export const reduceKeepingMasters = (n: number) => ... // while n > 9 && n !== 11 && n !== 22
export const personalYear  = (birth: DateParts, today: DateParts) => reduce(sum(birth.day) + sum(birth.month) + sum(today.year))
export const personalMonth = (birth, today) => reduce(personalYear + m)  // m = today.month, or next month (12 → 1) when today.day >= 21
export const personalDay   = (birth, today) => reduce(today.day + personalMonth)
export const cardForPersonalNumber = (n: number): TarotCardData => n === 22 ? getCardByIndex(0) : getCardByIndex(n)
export const personalNumbers = (birthDateIso: string, today: DateParts): PersonalNumbers | null  // {year, month, day}: each {number, card}; null on an unparsable date
```

`DateParts` comes from `src/lib/dateValidation.ts`; `getCardByIndex` from
`src/services/cardLookup.ts`. Do **not** reuse `reduceToMajorArcana`/`getDayNumber` in
`lib/significators.ts`: they map 22 to `TAROT_DECK[22]` (Ace of Pentacles). Log that as an
open bug in `docs/notes/bugs.md`; not fixed here.

Test cases: digit sums; 10 → 1, 19 → 1, 29 → 11 (kept), 22 kept, 38 → 11, 11 → Justice,
22 → The Fool, 1 → The Magician; the 21st rollover (20th uses the month, 21st uses the next,
December 21st wraps to 1); a full worked example for a fixed birth date and fixed today for
each of year/month/day; `personalNumbers` returns null for `""` and garbage.

**Client component:** `src/app/user/profile/TallyCard.tsx` (`"use client"`). Two exports:
a pure `TallyCardView({ birthDate, today })` that tests can render in both states, and the
default `TallyCard({ birthDate })` that owns the state.

- `TallyCard`: `const [today, setToday] = useState<DateParts | null>(null)`; `useEffect`
  sets it from `new Date()` (local `getFullYear/getMonth()+1/getDate()`). No `Date.now()` or
  `typeof window` in render.
- `TallyCardView`: when `today` is null, or `birthDate` is null or unparsable, return
  **exactly the existing empty slot markup** (`aria-hidden`, `data-testid="tally-card-slot"`,
  `aspect-[2/3] w-full max-w-[200px] ...`). The server render and the first client render
  are therefore identical: no hydration mismatch, no dependence on the server's timezone.
  Otherwise a `data-testid="tally-card"` column: a small Cinzel caption "Card of the Day ·
  {number}" above `<TarotCard card={day.card} showMeaning={false} />` (160×256 fits the
  200px slot; `imageUrl` stays full-size per the thumbnails rule). No new CSS, no new
  animation; `TarotCard`'s `cardAppear` entrance is one-shot and already in the
  reduced-motion block.
- Month and year are computed in the same `personalNumbers` call and ignored by the render
  (comment says so); showing them later is a render change only.
- `src/components/TarotCard.tsx:53`: `transition-all duration-500` → `transition-transform
  duration-500` (that wrapper only ever changes `rotate-180`; browser-load's one-property
  rule, no visual change). The hover glow already transitions opacity only.

**Wire-up and cleanup:**

- `AccountPanel.tsx`: prop `birthDate: string | null` replaces `budget`; the slot `<div>` is
  replaced by `<TallyCard birthDate={birthDate} />` inside the same `flex-1 ...
  justify-center py-8` wrapper. Remove the `void budget` comment block.
- `page.tsx`: pass `birthDate={user.birthDate}`; drop the `budget` object (keep `dash` for
  the readings summary).
- `src/lib/profile-dashboard.ts`: delete `chaliceFill`, `chaliceState`, `chaliceCaption`,
  `chaliceTitle`, `DRY_CAPTION` and their tests in `profile-dashboard.test.ts`. The
  dashboard action and `mapDashboardResponse` keep the budget fields (API contract unchanged).
- Tests: `__tests__/AccountPanel.test.tsx` renders with `birthDate` instead of `budget`; the
  empty-slot assertions still hold for the static render (today is null on the server) both
  with and without a date, which is the hydration-safety guarantee. New
  `__tests__/TallyCard.test.tsx` (static markup): `TallyCardView` with
  `birthDate "1990-05-01"` and `today {2026,11,3}` contains "The Empress" (worked example
  from the helper test) inside `data-testid="tally-card"`; with `today: null`, or
  `birthDate: null`, renders the exact empty-slot `<div>`; the default `TallyCard` rendered
  statically (effects never run) renders the empty slot regardless of `birthDate`.

**Docs:**

- `browser-load.md` §"The empty slot on the profile": rewrite to describe the card (client
  component, nothing animates, budget and chalice helpers gone, screenshot retake pending).
- `docs/notes/decisions.md`: short ADR (next number) "Personal day card from the account
  birth date": formulas, masters kept, 22 → Fool, computed client-side on the user's local
  date, month/year computed but unshown, birth date required at sign-up + 18 check; and a
  one-line note under the ADR-008 amendment that the slot is now filled.
- `docs/notes/key-facts.md` line 64 (profile description); `frontend/src/content/guide/your-profile.mdx`
  (the slot mark label and a short "Your card of the day" paragraph; screenshot
  `public/guide/your-profile/01-profile.webp` still needs a retake per `user-guide.md` §Screenshots,
  signed in as the dev user, who now has a birth date).
- `docs/notes/bugs.md`: open entry for the significators 22 → Ace of Pentacles mapping.
- `docs/notes/issues.md`: dated completion line at the end (covers A–D, the no-Terms-version
  decision for the lawyer review, and the follow-ups: screenshot retake, birth-date editing
  for legacy accounts, month/year cards exported but unrendered).
- Root `CLAUDE.md` "Working on → read first" table: add a row "Profile card, personal
  numbers → browser-load.md, the new ADR" only if it feels needed (Pavlos keeps that table current).

**Verify:** `npm --prefix frontend test`, tsc, lint, `make docs-check`. Then `make dev`:
dev user (seeded birth date) sees a card; a user registered in Part B sees a card; a
legacy account (insert a raw doc or clear the seed's `birth_date`) sees the empty slot; the
card changes when the device date is advanced past midnight (sanity: compare the number
with the helper test's worked example for that date). Production build + idle CPU at zero
on the profile per browser-load.md §Measuring.

---

## Out of scope (say if you want any pulled in)

- Editing the birth date from settings; showing it as a row on the profile.
- Month and year cards in the UI; linking the card anywhere (no card-detail route exists).
- Pre-filling `/significators` from the account birth date.
- Admin user list exposure of birth dates; password-policy check against the birth year.
- Fixing the significators 22 mapping bug (logged only).
