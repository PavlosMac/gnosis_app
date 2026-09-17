# Contact Support Form + Manual Interpretation Relocation

## Context

Building on ADR-009 (transactional email via Resend, sent only by the FastAPI backend), Pavlos wants a lightweight support-ticket channel:

1. A **Contact Support** form (subject + message) for logged-in users, opened as a themed **modal from the profile page**, replacing the "Get manual interpretation" row in `AccountPanel`. The backend attaches the requester's email + user_id from the JWT (never client input) and relays the ticket as an email to Pavlos via the existing `send_email()` contract, with `reply_to` set to the user so a plain inbox Reply reaches them.
2. The **Manual Interpretation entry point moves to the readings list**: a small round `ClipboardPlus` icon button beside the centered "◇ Filter Readings ◇" toggle, tooltip "Enter existing reading" (`.sanctum-tip` pattern), linking to `/user/manual-reading`.
3. A **backend contract spec** (`docs/backend-contracts/support-tickets.md`) telling the backend session exactly what to implement — no backend code is written from this repo.

No ticket storage/threading — email relay only; revisit if volume grows (ADR-010 records this).

## Implementation steps

### 1. Schema — new `src/lib/validation/support-schemas.ts`
Mirror `auth-schemas.ts` structure. Export `SUPPORT_SUBJECT_MAX = 200`, `SUPPORT_MESSAGE_MAX = 5000`; `contactSupportSchema = z.object({subject, message})` with trimmed fields: subject 3–200, message 10–5000, user-facing error copy; `ContactSupportInput` inferred type. Limits are a contract with the backend doc — comment says so.

### 2. Type — `src/types/auth.ts`
Add `export interface ContactSupportFormState extends AuthFormState {}` next to the existing aliases (L37-39). Reuse `MessageResponse` for the response.

### 3. Server action — `src/app/user/profile/actions.ts`
Append `contactSupport(_prevState, formData)` following `requestPasswordResetForCurrentUser` (L42-53): `getCurrentUser()` first (server actions aren't layout-protected — CLAUDE.md), session-expired error if absent; zod `safeParse` → `flatten().fieldErrors` (register-action pattern); then `authenticatedFetch<MessageResponse>("/api/v1/support/contact", {method:"POST", body: JSON.stringify(parsed.data)})`. Send **only** `{subject, message}` — identity comes from the JWT server-side. Log with a `[SUPPORT]` tag (userId only).

### 4. Textarea primitive — new `src/components/AuthTextArea.tsx`
Near-verbatim copy of `AuthField.tsx` with `<textarea>` (same label/input/error markup and classes, `resize-y`, `rows` default 6, optional `maxLength`). Also add an optional `maxLength?: number` pass-through prop to `AuthField` (backwards-compatible) for the subject field.

### 5. Modal — new `src/app/user/profile/ContactSupportModal.tsx`
Client component colocated under profile/ (like `ResetPasswordRequestButton`). Copy `src/components/LoginToInterpretModal.tsx` skeleton: `createPortal`, body scroll-lock + Escape effect, `fixed inset-0 z-[10000] isolate`, click-to-close backdrop `bg-black/80 backdrop-blur-sm`, `max-w-md` panel with inline gradient bg + `OrnateFrame size="sm" corners="top"`, `✦ Seek Counsel ✦` header + `×` close. Props `{onClose}`. `useActionState(contactSupport, {success:false})`:
- success → confirmation paragraph replaces the form ("Your message has been sent. The keeper of the sanctum will reply to your email."), one-shot like `ResetPasswordRequestButton`
- else → error banner (LoginToInterpretModal's banner markup) + `<form action={formAction} className="space-y-6">` with `AuthField` subject (maxLength 200) and `AuthTextArea` message (rows 6, maxLength 5000), submit button label `pending ? "Sending..." : "Send"`.

### 6. Trigger row — new `src/app/user/profile/ContactSupportRow.tsx`
Client component: full-width `<button>` reproducing `ProfileLinkRow`'s visuals (`pt-4 border-t border-[#d4af37]/10` wrapper, `flex items-center justify-between group`, Cinzel uppercase label "Contact support", icon span with `LifeBuoy size={18} strokeWidth={1.75}` — verified exported by installed lucide-react). `useState` open → renders `<ContactSupportModal onClose={...}/>`.

### 7. `src/app/user/profile/AccountPanel.tsx`
Replace the manual-reading `ProfileLinkRow` (L118-122) with `<ContactSupportRow />`. Delete now-unused `ProfileLinkRow` (L26-51) and the `ClipboardPlus`/`Link` imports. `ResetPasswordRequestButton` block untouched. AccountPanel stays a server component (it already imports client children).

### 8. `src/components/ReadingsFilterPanel.tsx` — round manual-reading button
Wrap the toggle (L86-93) in a `<div style={{position:"relative"}}>`; toggle unchanged (`block mx-auto` keeps it centered). Add beside it:
```tsx
<Link href="/user/manual-reading" aria-label="Enter existing reading"
  className="sanctum-tip w-9 h-9 rounded-full border border-[#d4af37]/50 text-[#d4af37]/70 hover:text-[#d4af37] hover:border-[#d4af37] hover:shadow-[0_0_10px_rgba(212,175,55,0.4)] transition-all duration-300 flex items-center justify-center"
  style={{ position: "absolute", right: 0, top: "50%", transform: "translateY(-50%)", borderRadius: "9999px" }}>
  <ClipboardPlus size={18} strokeWidth={1.75} aria-hidden="true" />
  <span className="sanctum-tip__label" aria-hidden="true" style={{ left: "auto", right: "-0.25rem", transform: "none" }}>Enter existing reading</span>
</Link>
```
- Positioning inline (stale-dev-CSS rule; `w-9 h-9 rounded-full` etc. already served via the detail page's adjacent buttons); inline `borderRadius` also covers the open Chrome rounded-full finding (issues.md 2026-09-11).
- Tooltip label right-aligned inline so it can't clip off a 375px viewport (shared `.sanctum-tip__label` centers, which would overflow at right:0) — verify visually and drop the override if the default fits.
- Imports: `Link` from next/link, `ClipboardPlus` from lucide-react.

### 9. Backend contract — new `docs/backend-contracts/support-tickets.md`
Mirror email-service.md's structure (Status/Date, Decision summary → ADR-010, numbered sections, Verification):
- **Endpoint:** `POST /api/v1/support/contact`, bearer JWT required. Body `{"subject": "3–200 chars", "message": "10–5000 chars"}` (trimmed; limits mirror `contactSupportSchema` — keep in sync). Backend MUST ignore any identity fields in the body and resolve email + user_id from the authenticated user.
- **Config:** new env `SUPPORT_EMAIL` (destination inbox — e.g. `support@tarotdivinations.com` routed via Cloudflare Email Routing, or the Gmail directly). Not `EMAIL_FROM` — that's the From identity.
- **Email composition:** `send_email(to=SUPPORT_EMAIL, subject=f"[Support] {subject}", ...)`, body = HTML-escaped message + metadata block (user email, user_id, timestamp). Extend `send_email()` with `reply_to: str | None = None`, set to the requester's email. Rationale: From must stay `noreply@tarotdivinations.com` for DKIM/DMARC alignment; `reply_to` makes inbox Reply reach the user with zero infra (anticipated in email-service.md §5).
- **Responses:** 200 `{"message": "Your message has been received."}`; 401 unauth; 422 limit violations (unreachable — zod validates first); 429 rate-limited (frontend already maps it). On `send_email()` failure return 5xx — never a fake 200 (no enumeration concern here, unlike forgot-password; the user must know it failed).
- **Notes:** per-user rate limit ~5/hour (on-demand email = spam-relay vector); free-tier 100/day ceiling shared with password resets.
- **Verification list:** curl 200 + email with Reply-To; reply round-trip; 401 unauth; 429 on 6th/hour; frontend e2e.

### 10. Tests — new `src/lib/__tests__/support-schemas.test.ts`
Pure schema tests (vitest, no jsdom): valid input accepted + trimmed; rejects 2-char/201-char subject, 9-char/5001-char message, missing fields; `flatten().fieldErrors` carries field names; pins `SUPPORT_SUBJECT_MAX === 200` / `SUPPORT_MESSAGE_MAX === 5000` with a comment pointing at the contract doc. Optional cheap `renderToStaticMarkup` test asserting ReadingsFilterPanel markup contains `aria-label="Enter existing reading"` + `href="/user/manual-reading"`.

### 11. Docs/memory
- `decisions.md`: **ADR-010 — Support Tickets as Backend Email Relay** (context, decision incl. JWT-only identity + reply_to, no-persistence trade-off).
- `issues.md`: dated entry (status: FE complete; submit path pending backend).
- `CODE_INDEX.md`: hand-update (never run `npm run code-index` — BSD ctags empties it): add the new files/exports, remove `ProfileLinkRow`.

## Verification

1. `npx tsc --noEmit` clean; `npm test` (124+ existing + new) green; `npm run build` green. (`npm run lint` is broken repo-wide — pre-existing, skip.)
2. Restart `npm run dev` (stale-CSS rule), then in real Chrome:
   - `/user/profile`: "Contact support" row (LifeBuoy) above Reset Password; manual-interpretation row gone. Modal opens/closes (×, Escape, backdrop), scroll locks. Check 375px + 1400px.
   - Empty submit → zod field errors, no network. Valid submit against today's backend → 404 → mapped "The requested resource was not found." banner, form stays filled — that IS the graceful degradation until the backend ships (copy improves automatically once the endpoint exists).
   - `/user/readings`: round button right of the still-centered toggle; tooltip on hover **and** keyboard focus, not clipped at ~400px; click lands on `/user/manual-reading`; button visually round in Chrome (Computed tab: filter "radius", not "border-radius").
   - Safari parity pass on both pages.
3. Hand `docs/backend-contracts/support-tickets.md` to a gnosis-esoterica-api session; afterwards run the contract's own verification list end-to-end (email arrives with Reply-To, reply round-trip, 429).
