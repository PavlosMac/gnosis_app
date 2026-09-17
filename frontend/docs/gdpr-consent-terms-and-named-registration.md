# GDPR Consent, Terms & Conditions, and Named Registration

**Date:** 2026-09-16 · **Branch:** `add-gdpr-signup-and-terms`

| Feature | Status |
|---|---|
| 1. MDX tooling + public legal pages | not started |
| 2. Registration: names + consent checkboxes | not started |
| 3. Re-consent gate for existing users | not started |
| Housekeeping (ADR, key_facts, issues, auth-flow docs) | not started |
| Backend contract (`docs/backend-contracts/consent-and-names.md`) | not started |

This document is the reference point for the feature; update the status table as work lands.

## Context

The app has no legal documents, no record of user consent, and registration collects only an optional display name. We need:

1. A **Terms & Conditions** document that states the service is for entertainment only, is not guidance, psychic services or fortune telling, and does not replace therapy or medical/legal/financial advice.
2. A **Privacy Policy** (the GDPR-facing document: what we store, why, how long, how to reach us).
3. Proof that each user accepted both, and a way to re-ask when a document changes.
4. First and last name at registration.

Decisions taken in the design conversation (2026-09-16):

- Scope is **consent at signup + re-consent gate** only. Account deletion, data export, and gating Google Analytics behind cookie consent are separate later features (the GA tag in `src/app/layout.tsx` loads unconditionally and is the remaining live exposure).
- Not two bare booleans. Each document acceptance is stored as **`{version, accepted_at}`**, so we can prove what was accepted and re-prompt only when a version changes. Field names are `terms` and `privacy` (not "gdpr").
- **Version is the MDX filename.** Each document is a folder of dated files (`src/content/legal/terms/2026-09-16.mdx`); the newest filename is the current version, and every accepted version stays renderable at `/legal/<doc>/<date>`. Nothing else declares a version. (Amended 2026-09-16 from "version as an MDX export".)
- **Users can see what they agreed to** on the profile `AccountPanel`: one read-only row per document with a checkmark, accepted date and a link to the exact dated version. Public footer links point at the current documents; the nav dropdown carries nothing legal.
- Registration: `first_name` + `last_name` **required**; backend derives `display_name = "First Last"` so every existing consumer of `displayName` keeps working.
- Signup UX: two required, unticked checkboxes; each label has a link that opens the full document in the existing `SanctumModal` (`size="lg"`) without leaving the form.
- Re-consent: a **blocking interstitial** for `/user/*` (and `/superadmin/*`) when the stored version of either document is behind the current one. Public pages stay usable. Data-creating server actions check consent too (layouts don't protect actions, per CLAUDE.md).

## Architecture

```
src/content/legal/
  terms/2026-09-16.mdx           ── filename = version; optional `export const meta = { title }`
  terms/2026-11-01.mdx           ── a later version: add a file, edit nothing else
  privacy/2026-09-16.mdx
            │ listed (fs.readdirSync, server-only) + dynamic import() by
            ▼
src/lib/legal-documents.ts       ── listVersions(id), currentVersion(id), CURRENT_VERSIONS, loadDocument(id, version)
src/lib/consent.ts               ── pure: staleConsents(userConsents, currentVersions) → LegalDocumentId[]
            │ used by
            ├── /legal/[doc]            → newest version   (public)
            ├── /legal/[doc]/[version]  → that dated file or 404 (public; what a user accepted)
            ├── register page (server) → RegisterForm (client) with checkboxes + modals
            ├── src/app/user/layout.tsx  → redirect("/accept-terms") when stale
            ├── src/app/superadmin/layout.tsx → same check
            ├── /accept-terms page + action → POST /api/v1/auth/consent
            ├── profile AccountPanel "Agreements" rows → link to /legal/[doc]/[accepted version]
            └── requireConsentedUser() in src/lib/session.ts → used by data-creating actions
```

### Sequence: registration with names and consent

`CURRENT_VERSIONS` comes from the newest filename in each document folder; in the diagram both documents are at `"2026-09-16"`.

```
 Browser              RegisterForm (client)   register() action       FastAPI /auth/register     Mongo users
   │                        │                        │                        │                     │
   │  open /user/register   │                        │                        │                     │
   │───────────────────────>│  server page passes    │                        │                     │
   │                        │  <LegalDocument/> nodes│                        │                     │
   │  click "Terms" link    │                        │                        │                     │
   │───────────────────────>│ SanctumModal(lg) shows │                        │                     │
   │                        │ terms.mdx (no request) │                        │                     │
   │  tick both boxes,      │                        │                        │                     │
   │  submit                │                        │                        │                     │
   │───────────────────────>│ FormData ─────────────>│                        │                     │
   │                        │  firstName, lastName,  │ zod registerSchema     │                     │
   │                        │  email, password,      │  acceptTerms  = "on"   │                     │
   │                        │  confirmPassword,      │  acceptPrivacy= "on"   │                     │
   │                        │  acceptTerms="on",     │  (missing → fieldError,│                     │
   │                        │  acceptPrivacy="on"    │   no request made)     │                     │
   │                        │                        │                        │                     │
   │                        │                        │ POST body ────────────>│                     │
   │                        │                        │ {                      │                     │
   │                        │                        │   email, password,     │                     │
   │                        │                        │   first_name,          │                     │
   │                        │                        │   last_name,           │                     │
   │                        │                        │   consents: {          │                     │
   │                        │                        │     terms:  "2026-09-16",                    │
   │                        │                        │     privacy:"2026-09-16"                     │
   │                        │                        │   }                    │                     │
   │                        │                        │ }                      │ insert ────────────>│
   │                        │                        │                        │                     │
   │                        │                        │        ┌───────────────┴─────────────────────┴──────┐
   │                        │                        │        │ MODEL CHANGE ① user document created        │
   │                        │                        │        │ {                                           │
   │                        │                        │        │   email, password_hash,                     │
   │                        │                        │        │   first_name: "Ada", last_name: "Lovelace", │
   │                        │                        │        │   display_name: "Ada Lovelace",  ← derived  │
   │                        │                        │        │   consents: {                               │
   │                        │                        │        │     terms:   {version:"2026-09-16",         │
   │                        │                        │        │               accepted_at: now},            │
   │                        │                        │        │     privacy: {version:"2026-09-16",         │
   │                        │                        │        │               accepted_at: now}             │
   │                        │                        │        │   }, created_at, updated_at, ...            │
   │                        │                        │        │ }                                           │
   │                        │                        │        └─────────────────────────────────────────────┘
   │                        │                        │<── 201 TokenResponse ──│                     │
   │                        │                        │ setAuthCookies()       │                     │
   │<─────────────── redirect /user/profile ─────────│                        │                     │
   │                        │                        │                        │                     │
   │  GET /user/profile     │   root layout: getCurrentUser() ──> GET /auth/me ───────────────────>│
   │                        │                        │<── MeResponse incl. first_name, last_name,  │
   │                        │                        │    consents{terms,privacy}                   │
   │                        │   mapMeResponseToUser → User{firstName,lastName,consents}             │
   │                        │   user/layout: staleConsents(user.consents, CURRENT) = []  → render   │
```

### Sequence: existing user meets a bumped Terms version

A new file `terms/2026-11-01.mdx` was added; Privacy unchanged at `"2026-09-16"`. The user accepted both on 2026-09-16.

```
 Browser            src/app/user/layout.tsx     /accept-terms page+action   FastAPI /auth/consent    Mongo users
   │                        │                        │                        │                     │
   │  GET /user/readings    │                        │                        │                     │
   │───────────────────────>│ getCurrentUser()       │                        │                     │
   │                        │  (cached per request)  │                        │                     │
   │                        │                        │        ┌───────────────┴─────────────────────┴──────┐
   │                        │                        │        │ STATE BEFORE (stored)                       │
   │                        │                        │        │ consents: {                                 │
   │                        │                        │        │   terms:   {version:"2026-09-16", ...},     │
   │                        │                        │        │   privacy: {version:"2026-09-16", ...}      │
   │                        │                        │        │ }                                           │
   │                        │                        │        └─────────────────────────────────────────────┘
   │                        │ staleConsents(         │                        │                     │
   │                        │   user.consents,       │                        │                     │
   │                        │   CURRENT_VERSIONS     │                        │                     │
   │                        │ ) → ["terms"]          │                        │                     │
   │<── redirect ───────────│                        │                        │                     │
   │   /accept-terms        │                        │                        │                     │
   │                        │                        │                        │                     │
   │  GET /accept-terms     │                        │                        │                     │
   │────────────────────────┼───────────────────────>│ getCurrentUser(); no   │                     │
   │                        │                        │ user → /user/login     │                     │
   │                        │                        │ stale = ["terms"]      │                     │
   │<─── page: only Terms (v2026-11-01) rendered,    │                        │                     │
   │     link "previously accepted: 2026-09-16"      │                        │                     │
   │     one checkbox, Continue, Log out link        │                        │                     │
   │                        │                        │                        │                     │
   │  tick, Continue        │                        │                        │                     │
   │────────────────────────┼───────────────────────>│ acceptTerms() action   │                     │
   │                        │                        │  getCurrentUser() guard│                     │
   │                        │                        │  zod: acceptTerms="on" │                     │
   │                        │                        │ POST ─────────────────>│                     │
   │                        │                        │ { terms: "2026-11-01" }│ upsert consents.terms
   │                        │                        │  (privacy key omitted, │ ───────────────────>│
   │                        │                        │   still current)       │                     │
   │                        │                        │        ┌───────────────┴─────────────────────┴──────┐
   │                        │                        │        │ MODEL CHANGE ② consents.terms replaced      │
   │                        │                        │        │ consents: {                                 │
   │                        │                        │        │   terms:   {version:"2026-11-01",           │
   │                        │                        │        │             accepted_at: now},   ← new      │
   │                        │                        │        │   privacy: {version:"2026-09-16", ...}      │
   │                        │                        │        │ }                                 unchanged │
   │                        │                        │        │ updated_at: now                             │
   │                        │                        │        └─────────────────────────────────────────────┘
   │                        │                        │<── 200 UserResponse ───│                     │
   │<──────────── redirect /user/profile ────────────│                        │                     │
   │                        │                        │                        │                     │
   │  GET /user/profile     │ getCurrentUser() → staleConsents(...) = [] → render                   │
```

Two side paths not drawn:

- **Server action without a page render** (e.g. `generateInterpretation` called from an already-open modal after a version bump): `requireConsentedUser()` runs the same `staleConsents` check and returns `null`, so the action replies with the existing not-authenticated shape and the next full render hits the layout redirect.
- **Old backend** (`consents` key absent from `MeResponse`): `staleConsents(undefined, …)` returns `[]`, so no redirect and no model change; registration still succeeds because unknown body keys are ignored.

### Versioning rule

`version` is the effective date as an ISO string (`"2026-09-16"`) and is the MDX filename inside the document folder. The current version is the lexicographically last filename (ISO dates sort as plain strings, so no parsing). String equality is the only comparison: stored `!==` current means stale.

- A substantive change = a new dated file; the old file is never edited again, so `/legal/<doc>/<date>` always shows exactly what a user accepted.
- Typo or formatting fixes may be made in place without a new date; that tolerance is stated in a `README.md` inside `src/content/legal/`.
- Filenames must match `^\d{4}-\d{2}-\d{2}\.mdx$`; the registry throws at build time on anything else so a stray file can't become "current".

### Graceful degradation (backend not yet shipped)

- `MeResponse.consents` **absent** (`undefined`) → backend predates this feature → gate is skipped and `requireConsentedUser` behaves like `getCurrentUser`. Present but stale → gate fires.
- Registration sends the new fields; an older backend ignores unknown JSON keys, so registration keeps working (names and consent are simply not stored until the backend lands).
- `/accept-terms` against an old backend surfaces the mapped 404 copy from `SAFE_MESSAGES` in `src/lib/api-client.ts`, same as ADR-010.

## Backend contract (request to the backend session)

To be written to `docs/backend-contracts/consent-and-names.md` in the same format as `support-tickets.md`. This repo never edits `gnosis-esoterica-api`.

**User document / `UserResponse` additions**

```json
"first_name": "Ada",
"last_name": "Lovelace",
"consents": {
  "terms":   { "version": "2026-09-16", "accepted_at": "2026-09-16T10:12:00Z" },
  "privacy": { "version": "2026-09-16", "accepted_at": "2026-09-16T10:12:00Z" }
}
```

- `consents` is always present in `GET /api/v1/auth/me` once the backend ships (`{}` for legacy users), so the frontend can distinguish "old backend" from "never accepted".
- `first_name`/`last_name` are `null` for legacy users. `display_name` keeps its meaning; when both names are given and no explicit display name, the backend sets `display_name = f"{first} {last}"`.

**`POST /api/v1/auth/register`** body gains `first_name` (1–100), `last_name` (1–100), and `consents: {"terms": "<version>", "privacy": "<version>"}`. The backend records `accepted_at = now` for each key. Once the backend enforces it, missing `consents` → 422 (frontend zod fires first).

**`POST /api/v1/auth/consent`** (auth required) body `{"terms": "<version>", "privacy": "<version>"}` — any subset of keys; each key upserts `{version, accepted_at: now}` under `consents`. Returns `UserResponse`. Identity from the JWT only (2026-09-14 rule).

No version validation on the backend: the frontend owns the current version (MDX export); the backend stores whatever string it receives so a document edit needs no backend deploy.

## Implementation steps

### Feature 1 — MDX tooling + public legal pages

- `npm i @next/mdx @mdx-js/loader @mdx-js/react @types/mdx` (`@next/mdx` 16.3.x matches Next 16). Wrap `next.config.ts` with `createMDX()` (no remark/rehype plugins, so Turbopack works) and add `pageExtensions: ["ts","tsx","md","mdx"]`.
- `mdx-components.tsx` at repo root: map `h1/h2/p/ul/li/a` to tarot-theme classes (Cinzel headings, Crimson Pro body, gold links). Layout-critical spacing as inline styles per the dev-server CSS trap (ADR-008).
- `src/content/legal/terms/2026-09-16.mdx` and `privacy/2026-09-16.mdx` (+ `src/content/legal/README.md` with the versioning rule): optional `export const meta = { title }`, then draft content. Terms must include: entertainment-only purpose; no psychic, fortune-telling or guidance service; not a substitute for medical, mental-health, legal or financial advice; AI-generated interpretations may be inaccurate; 18+; limitation of liability; governing-law placeholder. Privacy must list: data stored (email, names, password hash, readings, interpretations, usage ledger), purpose, retention, third parties (Resend for email, Google Analytics, the LLM provider for interpretations), contact address, rights (access/erasure via the support contact until self-service exists). **Content is a draft for legal review, not legal advice.**
- `src/lib/legal-documents.ts` (server-only, `import "server-only"`): `LEGAL_DOCUMENT_IDS = ["terms","privacy"] as const`, `DOCUMENT_TITLES`, `listVersions(id)` (readdir of `src/content/legal/<id>`, validated against the date regex, sorted ascending), `currentVersion(id)`, `CURRENT_VERSIONS` (computed once at module load), `loadDocument(id, version)` → `import(\`@/content/legal/${id}/${version}.mdx\`)` returning `{ Component, meta }` or `null` when the version is not listed (never a raw path from user input into `import()`). Pure helpers `isLegalDocumentId`, `isVersionString`, `newestVersion(list)` live in `src/lib/legal-versions.ts` so they are unit-testable without fs or MDX.
- `src/lib/consent.ts` (pure, unit-tested): `type ConsentRecord = {version:string; accepted_at:string}`, `staleConsents(consents: Partial<Record<LegalDocumentId, ConsentRecord>> | undefined, current) → LegalDocumentId[]` (returns `[]` when `consents === undefined`).
- Routes `src/app/legal/[doc]/page.tsx` (newest version) and `src/app/legal/[doc]/[version]/page.tsx` (that dated file; `notFound()` for unknown doc or version): server components rendering shared `src/components/LegalDocument.tsx` = title, "Version / effective date" line, an "older versions" list of dated links, MDX body, inside the existing page chrome (`OrnateFrame`/starfield as other public pages do). `generateStaticParams` from `listVersions` so every version is prerendered; `generateMetadata` per page.
- Links: a "Terms · Privacy" line under the landing page footer glyph row in `TarotLanding.tsx`, and as a second `AuthFootnote` on login and register.
- Verification: `npm run build` compiles MDX and prerenders every dated version; `/legal/terms`, `/legal/privacy`, `/legal/terms/2026-09-16` render in Chrome (desktop + 400px); `/legal/terms/1999-01-01` and `/legal/nope` 404; `npm test` passes `consent.test.ts` and `legal-versions.test.ts` (newest-of-list, regex rejects `terms.mdx` / `2026-9-1.mdx`).

### Feature 2 — Registration: names + consent checkboxes

- `src/types/auth.ts`: `User` gains `firstName: string|null`, `lastName: string|null`, `consents?: Partial<Record<LegalDocumentId, ConsentRecord>>` (optional = old backend). `MeResponse`/`UserResponse`/`DashboardUserResponse` gain the wire fields; mappers pass them through. `RegisterFormState extends AuthFormState<RegisterEchoValues>` echoing `firstName/lastName/email` on failure (never password), per the existing `values` convention.
- `src/lib/validation/auth-schemas.ts`: `registerSchema` gains `firstName`, `lastName` (trim, 1–100, required) and `acceptTerms: z.literal("on", {message})`, `acceptPrivacy: z.literal("on", …)` (checkbox FormData arrives as `"on"` or `null`). `displayName` removed from the schema and form.
- `src/app/user/register/actions.ts`: read the new fields; body becomes `{email, password, first_name, last_name, consents: {terms: CURRENT_VERSIONS.terms, privacy: CURRENT_VERSIONS.privacy}}`. Versions are taken server-side from the registry, never from the form.
- Split the page like login: `register/page.tsx` becomes a server component rendering `<RegisterForm terms={<LegalDocument id="terms"/>} privacy={<LegalDocument id="privacy"/>} />`; `register/register-form.tsx` (client) holds `useActionState`, the fields, and two `AuthCheckbox` rows. Clicking "Terms and Conditions" / "Privacy Policy" in a label opens `SanctumModal size="lg"` with the passed node and a "Close" button at the foot. `AuthCheckbox` is a new small component in `src/components/AuthField.tsx` (reuses `AuthFieldFrame` error rendering; gold check styling; label as `ReactNode`).
- Field order: First name, Last name, Email, Password, Confirm, checkboxes, submit. `autoComplete="given-name"` / `"family-name"`.
- `AccountPanel` "Name" row becomes `displayName || [firstName,lastName].filter(Boolean).join(" ") || "Seeker"` (no visual change for existing users).
- `AccountPanel` gains an **Agreements** block (new `AgreementRows` server component in `src/app/user/profile/AgreementRows.tsx`, one `ProfileRow`-styled line per document, placed above the Contact Support row): a gold ✓ when `user.consents[id]` exists, the title as a link to `/legal/<id>/<accepted version>`, and "accepted <date>" formatted like other dates on the page. No record → hollow box, title as a link to the current document, and "Not yet recorded". Props are `consents` from `getCurrentUser()` on the profile page, so no extra fetch. Pure `agreementRowModel(consents)` in `src/lib/profile-dashboard.ts` (unit-tested) decides label/href per document.
- Verification: unit tests for `registerSchema` (unticked box → field error on the right key; names required); manual: register in Chrome with boxes unticked → errors; ticked → account created and profile shows the name. Against the current backend the extra body keys are ignored — confirm 201 still returns.

### Feature 3 — Re-consent gate for existing users

- `src/lib/session.ts`: add `requireConsentedUser()` = `getCurrentUser()` then `staleConsents(user.consents, CURRENT_VERSIONS).length === 0 ? user : null`. The cached `getCurrentUser` means no extra request.
- `src/app/user/layout.tsx`: make it `async`; `const user = await getCurrentUser(); if (user && staleConsents(...).length) redirect("/accept-terms")`. Unauthenticated visitors (login/register) have `user === null` so they are untouched. Same check in `src/app/superadmin/layout.tsx` after the role checks. Update the stale CLAUDE.md and `docs/auth/auth-flow.md` sentence about this layout to describe what it now actually does.
- `src/app/accept-terms/page.tsx` (outside `/user` so the gate can't loop; the proxy matcher does not cover it, the page redirects to login when there is no user). Server page: lists only the stale documents with version/effective date, renders each via `LegalDocument` (or the same modal pattern), a "previously accepted: <date>" link to `/legal/<id>/<old version>` when a record exists, one checkbox per stale document, "Continue" button. Client form + `acceptTerms` server action in `accept-terms/actions.ts`: `getCurrentUser()` guard → zod (`z.literal("on")` per required document) → `authenticatedFetch("/api/v1/auth/consent", {method:"POST", body: versions for the ticked documents})` → `redirect("/user/profile")`. Also a "Log out" link for users who decline.
- Guard data-creating actions with `requireConsentedUser()` instead of `getCurrentUser()`: `createReading` and `generateInterpretation` (`src/app/user/interpret/actions.ts`), `updateReadingTags` (`src/app/user/readings/[id]/actions.ts`), the manual-reading save action, `contactSupport` (`src/app/user/profile/actions.ts`). Read-only actions (`getReadings`, `getReading`, `getDashboard`) stay on `getCurrentUser` so the interstitial and dashboard can still render. Return the existing "not authenticated" shape; the UI already handles it and the layout redirect fires on the next full render.
- The `from` param is deliberately not threaded (ADR-007 known issue).
- Verification: unit test `staleConsents` (undefined → [], `{}` → both, one current one stale → the stale one, both current → []); manual with a stubbed `consents` in `mapMeResponseToUser` until the backend lands: visiting `/user/profile` redirects to `/accept-terms`; accepting returns to profile; `/` and `/reading` unaffected.

### Housekeeping (last step)

- `docs/project_notes/decisions.md`: ADR-011 "Versioned legal-document consent stored per document; version = dated MDX filename, old versions stay renderable" (context, decision, alternatives: booleans / single file with version export / backend-owned versions / global modal, consequences incl. GA still ungated, agreements shown on the profile).
- `docs/project_notes/key_facts.md`: add `/legal/[doc]`, `/legal/[doc]/[version]`, `/accept-terms`.
- `docs/project_notes/issues.md`: work-log entry. `docs/auth/auth-flow.md`: registration sequence gains names + consents; new consent sequence.
- Update the status table at the top of this document.

## Files touched (summary)

New: `src/content/legal/README.md`, `src/content/legal/{terms,privacy}/2026-09-16.mdx`, `mdx-components.tsx`, `src/lib/legal-documents.ts`, `src/lib/legal-versions.ts` (+ test), `src/lib/consent.ts` (+ test), `src/components/LegalDocument.tsx`, `src/app/legal/[doc]/page.tsx`, `src/app/legal/[doc]/[version]/page.tsx`, `src/app/user/register/register-form.tsx`, `src/app/user/profile/AgreementRows.tsx`, `src/app/accept-terms/{page.tsx,actions.ts,accept-form.tsx}`, `docs/backend-contracts/consent-and-names.md`.

Modified: `next.config.ts`, `package.json`, `src/types/auth.ts`, `src/lib/validation/auth-schemas.ts` (+ test), `src/app/user/register/{page.tsx,actions.ts}`, `src/components/AuthField.tsx`, `src/lib/session.ts`, `src/app/user/layout.tsx`, `src/app/superadmin/layout.tsx`, `src/app/user/interpret/actions.ts`, `src/app/user/readings/[id]/actions.ts`, `src/app/user/manual-reading/actions.ts`, `src/app/user/profile/{actions.ts,AccountPanel.tsx}`, `src/components/TarotLanding.tsx`, login/register footnotes, docs listed above, the CLAUDE.md layout sentence.

## Out of scope (recorded for later)

Account deletion endpoint + profile row; data export; cookie-consent banner gating gtag; editing names/display name from the profile; consent history beyond the latest acceptance per document.
