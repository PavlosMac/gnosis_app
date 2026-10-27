# Admin User Management

**Status: Live (implemented 2026-10-25).** What the superadmin can do to accounts from
`/superadmin`: invite an address, send one user a one-way email, delete an account. Rationale
is ADR-017 in [`../../notes/decisions.md`](../../notes/decisions.md). Registration and the
status model: [`../auth/registration-verification-and-consent.md`](../auth/registration-verification-and-consent.md).
Email plumbing: [`../email/email-service.md`](../email/email-service.md). Frontend
sequence: [`../auth/frontend-auth-flow.md`](../auth/frontend-auth-flow.md) §13–14.

There is one admin: the account with `is_superadmin: true`. No roles beyond that.
`account_type` (free trial / subscription) was deliberately not added: it has no use until
the payment step exists.

## The page

`/superadmin` (layout redirects anyone else to `/user/profile`; the ☥ menu shows the link to
the superadmin only). Above the table, one field: **Invite a seeker**. The table lists every
account with Email, Name, Status (Invited / Pending verification / Active), Joined, and the
row actions **Resend invite** (invited rows only), **Email** and **Delete** (not on the
admin's own row). Email and Delete open a `SanctumModal`; Delete is type-`DELETE`-to-confirm.

Every server action in `src/app/superadmin/actions.ts` re-checks `isSuperadmin` itself
(layouts do not protect actions) and `revalidatePath("/superadmin")` after a change.

## Endpoints

All under `/api/v1`. The three admin ones need a superadmin bearer token (`IsSuperAdmin`);
the two invitee ones are public and authenticated by the token in the link, like
verify-email.

| Endpoint | Request | Success | Errors |
|---|---|---|---|
| `POST /users/invite` | `{email}` | `200 {detail: "Invitation sent"}` | 401, 403; 409 the address has an account that is not `invited`; **502 the email could not be sent** |
| `POST /users/{id}/email` | `{subject ≤200, message ≤5000}` | `200 {detail: "Email sent"}` | 401, 403, 404, 422; **502** |
| `DELETE /users/{id}` | | `204` | 401, 403, 404; 409 when `{id}` is the admin's own account |
| `GET /auth/invite?token=` | | `200 {email}` | 400 unknown, used, or not an invite token; 410 expired; 429 per-IP throttle |
| `POST /auth/accept-invite` | `{token, password, first_name, last_name, consents: {terms, privacy}}` | `200 {detail}`, no tokens | 400, 410, 429 per-IP throttle; `422 {detail, code: "weak_password"}` (the link is not consumed) |
| `GET /users` | | items now carry `status` | |

## The invite flow

```
Admin                 FastAPI                                   Invitee
  POST /users/invite   find_by_email
  {email}               none          -> insert users doc: status "invited",
                                          no password_hash, no consents,
                                          verification_deadline_at = now + INVITE_TTL_DAYS
                        "invited"     -> extend_invite: bump verification_deadline_at, guarded on
                                          status "invited" (lost race with an accept -> 409)
                        insert hits the unique email index (double-click, concurrent
                          sign-up) -> re-read and take the resend / 409 branch
                        anything else -> 409
                       rotate token in email_verification_tokens (invalidate_all_for_user,
                         store hash, expires_at = now + INVITE_TTL_DAYS)
                       send_invite(to, {FRONTEND_BASE_URL}/accept-invite?token=RAW)
                         EmailDeliveryError -> 502 (the account stays; admin resends)
  <- 200
                                                                 opens the link
                       GET /auth/invite?token=   peek (never consumes) -> {email} / 400 / 410
                                                                 page shows "Invitation for <email>"
                                                                 types names, password, ticks consents
                       POST /auth/accept-invite
                         load_invite (peek, expiry, status must be "invited")
                         validate_new_password            -> 422 keeps the link usable
                         activate_invited: password_hash, names, display_name, consents
                           (accepted_at = now), status "active", email_verified_at = now,
                           $unset verification_deadline_at   (guarded on status "invited":
                           this is what makes the link single-use; -> 400 if raced)
                         delete_all_for_user (tokens)  -- only after activation, so a
                           failed activation leaves the invitee a working link
                       <- 200 {detail}, no session
                                                                 "Your account is ready" -> /user/login
```

What makes an invited account different, and where that is enforced:

| Situation | Behaviour | Where |
|---|---|---|
| Login with the invited address | 401, same as a wrong password | `AuthService.authenticate`: `password_hash is None` short-circuits before `verify_password` |
| Forgot-password for the address | 200, nothing sent | `RequestPasswordResetHandler` returns on `status == "invited"` |
| Resend-verification for the address | 200, nothing sent | already: only `pending_verification` sends |
| Public registration with the address | 409 | `RegisterUserHandler`, any existing email. The admin deletes the invite if the person should self-register instead |
| A sign-up verification token on the accept page | 400 | `load_invite` requires the token's user to be `invited` (both token kinds share one collection) |
| An invite token posted to `/auth/verify-email` | 400, the invite stays usable | `VerifyEmailHandler` peeks, and `mark_email_verified` only matches `pending_verification` |
| Lookup / accept hammered from one address | 429 | `GetInviteByTokenHandler` and `AcceptInviteHandler`: per-IP throttle, key `invite:<ip>`, reuses `login_rate_limit_*` (900s / 10) |
| Never accepted | purged after `INVITE_TTL_DAYS` | migration 015: the `pending_users_ttl` partial index now matches `status in [pending_verification, invited]` |
| Re-invite | new link, old one dead, purge clock restarted | `InviteUserHandler` resend branch |
| Delete the invite | `DELETE /users/{id}` | ordinary admin delete; the cascade handles a doc with no password |

`invite_ttl_days` (env `INVITE_TTL_DAYS`, default 7) is one clock for the link and the
account: a link that still opens always has an account behind it.

## Deletion

Both entry points run the same cascade, `DeleteUserHandler`
(`src/auth/commands/delete_user.py`, order of operations in
[`../auth/registration-verification-and-consent.md`](../auth/registration-verification-and-consent.md#account-deletion)):

- `DELETE /auth/me` — the user, after re-entering the password (ADR-014, unchanged).
- `DELETE /users/{id}` — the superadmin, via `AdminDeleteUserHandler`
  (`src/users/commands/admin_delete_user.py`), which adds only the existence check (404) and
  the not-yourself check (409: the self-service path re-verifies the password, this one does
  not, so it must not be a way around that).

**A step that must run before an account disappears (a future subscription cancellation,
for instance) goes into `DeleteUserHandler` once** and both paths get it.

## Email

Two port methods, implemented on Resend, Console and Mock:

| Method | Template | Notes |
|---|---|---|
| `send_invite(to, invite_link)` | `invite_subject/_text/_html(link, ttl_days)` | Same chrome as the verification mail; wording derived from `invite_ttl_days` |
| `send_admin_message(to, subject, message)` | `admin_message_subject/_text/_html` | Plain text from the admin; subject CR/LF collapsed; body HTML-escaped inside `<pre>`; **no Reply-To** (one-way by design) |

Unlike registration, both admin endpoints send on the request path and let
`EmailDeliveryError` through as 502: the admin is looking at the response and the fix is to
press the button again. Local dev uses the console adapter; with `APP_ENV=development` the
invite link is in the API log (`invite email (console)`), the admin message logs nothing but
the event.

## Logging

`user invited` / `invite resent` / `admin message sent` / `account deleted by admin`, each
with `user_id` and `admin_id`; `invite accepted` with `user_id`. Never the address, subject
or body.

## File map

| Concern | File |
|---|---|
| Status `invited`, optional `password_hash` | `backend/src/auth/models.py` |
| `issue_invite_email`, `load_invite`, invite errors | `backend/src/auth/service.py` |
| `activate_invited` | `backend/src/auth/repository.py` |
| Invite, admin message, admin delete | `backend/src/users/commands/{invite_user,send_admin_message,admin_delete_user}.py`, `backend/src/users/router.py`, `backend/src/users/schemas.py` |
| Lookup and accept | `backend/src/auth/queries/get_invite_by_token.py`, `backend/src/auth/commands/accept_invite.py`, `backend/src/auth/router.py` |
| Purge index | `backend/src/migrations/versions/015_invited_users_ttl.py` (needs MongoDB 6.0+ for `$in` in the partial filter; restores 014's index if the create fails) |
| Email | `backend/src/notifications/{port,templates,resend_adapter,console_adapter,mock_adapter}.py` |
| Backend tests | `backend/tests/users/`, `backend/tests/auth/test_accept_invite_router.py`, `test_invited_user_guards.py`, `backend/tests/migrations/test_invited_users_ttl_migration.py` |
| Admin page | `frontend/src/app/superadmin/{page,UsersTable,InviteUserForm,EmailUserModal,DeleteUserModal}.tsx`, `actions.ts` |
| Accept page (public, app root) | `frontend/src/app/accept-invite/{page,accept-invite-form}.tsx`, `actions.ts` |
| Schemas, types | `frontend/src/lib/validation/admin-schemas.ts`, `acceptInviteSchema` in `auth-schemas.ts`, `AdminUser` / `mapAdminUserResponse` in `frontend/src/types/auth.ts` |
| Frontend tests | `frontend/src/lib/__tests__/admin-schemas.test.ts`, `admin-users.test.ts`, `auth-schemas.test.ts`, `frontend/src/app/accept-invite/__tests__/actions.test.ts`, `components/__tests__/ProfileNav.menu.test.tsx` |
