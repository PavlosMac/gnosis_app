# Login to Get Interpretation — Design

## Problem

On `/reading`, once a reading is complete, the "Oracle Interpretation" button only
renders if the user is logged in (`TarotGame.tsx:437`, `{user && (...)}`). Logged-out
users have no way to request an interpretation without abandoning the reading,
navigating to `/login`, logging in, and starting over.

## Goal

When logged out, show a "Login to get interpretation" button in place of "Oracle
Interpretation". Clicking it opens an inline login modal (no page navigation). On
successful login, the modal closes and the interpretation is fetched automatically —
same reading, no extra click, nothing lost.

## Why no temp storage is needed

The original ask assumed we'd need to temporarily persist reading details across a
navigation to `/login` and back. Because this design does login **inline in a modal**
with no navigation away from `/reading`, the completed reading — held in
`useGameReducer` and exposed as `completedReading` in `TarotGame.tsx:65` — never
leaves memory. No localStorage/sessionStorage is introduced (this codebase currently
has none: `grep -rn "localStorage\|sessionStorage" src` returns zero matches).

## Architecture

### 1. Shared login logic (refactor, behavior-preserving)

`src/app/user/login/actions.ts` currently does validation → `publicFetch` →
`setAuthCookies` → `redirect("/user/profile")` all in one `login` server action
(lines 8-42). Extract the validate/fetch/set-cookies part into a helper,
`authenticateWithCredentials(formData): Promise<LoginFormState | { success: true }>`,
that never redirects.

- `login` (existing action, used by `/user/login`) becomes: call the helper, return
  early on failure, otherwise `redirect("/user/profile")` — identical behavior to
  today.
- `loginInline` (new export, same file): calls the helper and returns its result
  directly — no redirect. Used only by the new modal.

This avoids duplicating validation/API/cookie logic between the two entry points.

### 2. New component: `LoginToInterpretModal`

`src/components/LoginToInterpretModal.tsx` — a client component, portal-based modal
matching `InterpretationModal.tsx`'s chrome (backdrop, `OrnateFrame`, sticky header,
Escape-to-close, body scroll lock). Body contains just email/password fields, reusing
the existing `AuthField` component, bound via `useActionState(loginInline, initialState)`.

- No register link (login only — a user without an account can register separately
  and redo the reading).
- On credential failure: inline error/field errors via `state.error` /
  `state.fieldErrors`, same pattern as `LoginForm` — no navigation, modal stays open,
  reading untouched.
- Props: `onClose: () => void`, `onSuccess: () => void`.
- On successful login (`state.success === true`, observed via `useEffect`), calls
  `onSuccess()`.

### 3. `TarotGame.tsx` changes

- New state `showLoginModal` (near `showInterpretModal`, line 52).
- Line 437's `{user && (<Oracle Interpretation button/>)}` gets a sibling
  else-branch: `{!user && (<Login to get interpretation button
  onClick={() => setShowLoginModal(true)}/>)}`. Same button styling family as the
  existing two buttons (gold "New Reading", purple "Oracle Interpretation") — this
  one uses the purple treatment since it leads to the same destination.
- New handler `handleLoginSuccess`:
  1. `setShowLoginModal(false)`
  2. `router.refresh()` (from `next/navigation`) — re-runs the server component
     (`src/app/reading/page.tsx`) so the `user` prop passed into `TarotGame` becomes
     accurate for the rest of the session (e.g. if the user clicks "New Reading"
     afterward, the real "Oracle Interpretation" button now shows). This does not
     reset `TarotGame`'s local state — App Router refresh re-fetches server data
     without remounting client components.
  3. `setShowInterpretModal(true)` — reuses the existing modal exactly as today;
     since `interpretResult` is still `null`, it auto-fetches on mount
     (`InterpretationModal.tsx:116-121`).
- `<LoginToInterpretModal>` rendered conditionally near the other modals (~line 505),
  gated on `showLoginModal && completedReading`.

## Data flow

No new data shapes. `completedReading` is passed to `InterpretationModal` exactly as
it is today; the interpretation payload construction
(`InterpretationModal.tsx:68-93`) is untouched.

## Error handling

- Wrong credentials in the login modal: inline error, retry in place.
- Network/API failure fetching the interpretation after login: already handled by
  `InterpretationModal`'s existing "error" state and "Try Again" button — untouched.

## Out of scope

- Register flow from this modal.
- Redirect-based (`/login` page) login for this entry point.
- Any change to `proxy.ts`'s unused `from` query param scaffold.
- Making `TarotGame`'s `user` prop reactive via `useAuth()` context generally — only
  the `router.refresh()` call needed for this flow is added.
