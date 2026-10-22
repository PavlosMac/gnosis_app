# QA checklist: registration, consent, email verification, account deletion

**Written:** 2026-10-05 · **Covers:** the registration, consent, verification and deletion
flow described in [`registration-verification-and-consent.md`](registration-verification-and-consent.md)
plus the password policy and the Terms / Privacy Policy edits of 2026-10-05.

Run the parts in order against the local dev stack in a normal browser. Each step says
what to do and what you should see. Tick the box when it passes; note anything odd
under [Findings](#findings).

## Setup

- [ ] Restart the stack from the repo root, so the frontend picks up the sign-up flag,
      the new packages and fresh CSS:
      ```
      make dev-down && make dev
      ```
- [ ] Have a **real inbox you own** ready for the test account. The dev API sends real
      email through Resend, so the confirmation link arrives by mail and is not in the log.
- [ ] Open DevTools on Application → Cookies, and a second terminal on `make dev-logs`.
- [ ] Test in Chrome first. Repeat parts 1, 2 and 10 in Safari and at phone width.

A password that passes the rules, for use below: `plum-harbour-lantern-42`.

## 1. Public legal pages

- [ ] `/legal/terms` and `/legal/privacy` render, each with a version line dated 2026-10-04.
- [ ] `/legal/terms/2026-10-04` renders the same Terms.
- [ ] `/legal/terms/1999-01-01` and `/legal/nope` give a 404.
- [ ] On `/`, the footer shows "Begin your journey", Terms and Privacy links.
- [ ] Terms section 9 says the card imagery is the Rider-Waite deck and not the operator's own.
- [ ] The Privacy Policy has no cookie names, no "Argon2", no token expiry periods.
- [ ] The Privacy Policy says in bold that what you enter for a reading is sent to OpenAI.
- [ ] The Privacy Policy does not mention Google or analytics.
- [ ] In DevTools → Network, no request on `/` goes to a Google host.

## 2. Registration form

- [ ] The profile menu (logged out) shows only "Login" (no "Sign up", no "Guide"). The login page links to registration when it is open, and that link opens `/user/register`.
- [ ] The password field shows the hint "At least 12 characters. Avoid common passwords
      and your own name or email."
- [ ] Submit with both boxes unticked. Each box shows its own error, and the names and
      email you typed are still there.
- [ ] Click "Terms and Conditions" in the label. The document opens in a modal. Closing it
      leaves the form intact. Same for "Privacy Policy".
- [ ] Submit with mismatched passwords. The error appears on the confirm field.

## 3. Password rules

On the register form, with everything else valid:

- [ ] An 11-character password, e.g. `k7#vQ2m!x9p` → "Password must be at least 12 characters".
- [ ] `passwordpassword` → "This password is too common. Choose a less predictable one."
- [ ] `123456789012` → the same "too common" message.
- [ ] A password containing your first name, e.g. `plum-<firstname>-harbour` → "Password
      must not contain your name or email address".
- [ ] After each refusal, the names, email and ticked boxes are still there.
- [ ] `plum-harbour-lantern-42` → "Check Your Email" with the 24-hour and 7-day wording.
      No session cookies are set.

## 4. Login before confirming

- [ ] Log in with the new account. You see "Please confirm your email" and a link to send
      a new confirmation link.
- [ ] Log in with a wrong password. You see "Incorrect email or password", not the
      confirm message.

## 5. Email confirmation

- [ ] The email arrives. It mentions the 24-hour expiry and the 7-day deletion.
- [ ] Open the link. The page shows only a Confirm button.
- [ ] Click Confirm. You see "Email confirmed" and a link to login. Still no cookies.
- [ ] Open the same link again and confirm. You see the invalid-link message and a resend form.
- [ ] Register a second account. From `/verify-email`, request a resend. The new link
      works and the first one does not.

## 6. First login and profile

- [ ] Log in, typing the email in different letter case. You land on `/user/profile`.
- [ ] Cookies are `access_token`, `refresh_token` and `token_expires_at`, all HttpOnly.
- [ ] The profile shows "First Last".
- [ ] "Account settings" in the left panel opens `/user/profile/settings`.
- [ ] There, the Agreements block shows two rows with today's date. Each title opens
      version 2026-10-04 of that document in a modal; Close returns you to the page.
- [ ] "Delete account" appears at the foot of that page, set apart in red.

## 7. Self-service consent

- [ ] On `/user/profile/settings`, click "Review / change". Both boxes are pre-ticked.
- [ ] Save. You see the saved message. Back on Account settings, the accepted dates have not changed.
- [ ] Untick both and save. You see the message that unticking does not withdraw acceptance.

## 8. Re-consent gate

- [ ] Copy `frontend/src/content/legal/terms/2026-10-04.mdx` to a file dated tomorrow,
      then run `npm --prefix frontend run legal:registry`.
- [ ] `/user/profile`, `/user/readings` and `/user/manual-reading` each redirect to
      `/accept-terms`, which lists only the Terms and shows "previously accepted: 2026-10-04".
- [ ] Click "Delete my account", then "Keep my account". You are sent back to
      `/accept-terms`, not the profile.
- [ ] On `/reading`, complete a spread and try to save it. The error asks you to accept
      the updated terms.
- [ ] On `/accept-terms`, "Contact support" opens the support form and a message can be
      sent without accepting the new version.
- [ ] On `/accept-terms`, click Continue without ticking. You see an error on the box.
- [ ] Tick and continue. You reach the profile; under Account settings the Terms row shows the new version.
- [ ] Clean up: delete the test file and rerun `npm --prefix frontend run legal:registry`.

## 9. Existing accounts and password reset

- [ ] Log in as the seeded dev superadmin ([`../database/dev-users.md`](../database/dev-users.md)). You are
      sent to `/accept-terms` once, then `/superadmin` works.
- [ ] From `/forgot-password`, request a reset typing your email in different letter case.
      The mail arrives.
- [ ] On the reset page, the password field shows the same hint as registration.
- [ ] Submit `passwordpassword`. You see the "too common" message.
- [ ] Submit a good password **on the same link**. It succeeds, and you can log in with it.

## 10. Rate limits

- [ ] Enter a wrong password eleven times for one email. The eleventh attempt shows the
      too-many-requests message. (It clears after 15 minutes.)
- [ ] Request a confirmation resend six times for one email. The sixth is refused.

## 11. Account deletion

- [ ] Save one reading first, so there is data to remove. Skip the interpretation unless
      you want a billed OpenAI call.
- [ ] On Account settings, click "Delete account". Type `delete` in lower case and submit. You
      see "Type DELETE to confirm".
- [ ] Enter a wrong password with `DELETE`. You see "Incorrect password", and the account
      still works.
- [ ] Enter the right password with `DELETE`. You land on `/`, the cookies are gone, and
      logging in fails.
- [ ] Register again with the same email. It succeeds.

## Cannot be tested locally

- **`__Host-` cookies.** They need HTTPS. Check on the deployed site, after the Pi has its
  new environment variables, that the three cookies are named `__Host-access_token`,
  `__Host-refresh_token` and `__Host-token_expires_at`.
- **Seven-day purge of unconfirmed accounts.** It runs in the database on a timer. To
  spot-check it, set a pending account's `verification_deadline_at` to a past date in
  Mongo and wait about a minute; the account disappears.

## Before launch (not QA steps)

- [ ] Pi: `.env.gnosis.prod` has `RESEND_API_KEY`, `EMAIL_FROM`, `FRONTEND_BASE_URL`,
      `SUPPORT_EMAIL`; the frontend compose has `GNOSIS_API_BASE_URL`. See [`../deployment/deploy-instructions.md`](../deployment/deploy-instructions.md).
- [ ] Sign-up is closed in production by default. When you want it open, set
      `REGISTRATION_ENABLED=true` on the Pi and recreate the frontend container.
- [ ] The Terms and Privacy Policy contain no `[TO BE COMPLETED]` marker (filled in
      2026-10-10), and the OpenAI and Resend data-processing agreements are on file.
- [ ] No analytics tag is loaded (Google Analytics was removed 2026-10-10).
- [ ] The card images are the 1909 Rider-Waite edition (confirmed 2026-10-10).

## Findings

| Part | What happened | Expected |
|---|---|---|
| | | |
