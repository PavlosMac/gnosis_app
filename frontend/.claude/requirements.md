---
project: Tarot Divinations
created: 2026-03-20
updated: 2026-03-22
---

# Requirements

## Must Have

- [x] JWT auth flow — Wire login/register server actions to FastAPI, httpOnly cookie storage, token refresh on 401 (completed 2026-03-22)
- [x] Auth middleware — Protect authenticated routes, redirect unauthenticated users to login (completed 2026-03-22)
- [x] Auth context provider — Server-fetched user DTO in client context for UI state (display name, credits) (completed 2026-03-22)
- [x] Logout — Server action to revoke token + clear cookies (completed 2026-03-22)
- [x] User profile page — `/user/profile` showing display name, email, credits balance (completed 2026-03-22)
- [x] Authenticated fetch utility — `authenticatedFetch()` with silent refresh, used by all server actions calling FastAPI (completed 2026-03-22)
- [ ] Stripe credit purchases — Checkout session for buying credits, webhook handler for fulfillment
- [ ] OpenAI reading interpretation — Server action that sends drawn cards + positions + question to OpenAI, returns narrative, deducts a credit
- [ ] Save readings to backend — POST completed readings (cards, positions, interpretation) to FastAPI for persistence
- [ ] Reading history page — `/user/readings` listing saved readings with date, spread type, ability to view details
- [x] Style auth pages — Apply dark mystical theme (TarotPageLayout, golden accents) to login/register/profile (completed 2026-03-22)

## Should Have

- [ ] Daily card draw — One free daily card with basic interpretation (no credit cost)
- [ ] Question input before reading — User types their question before drawing cards, included in AI prompt
- [ ] Error boundary for API failures — Graceful degradation when backend is unavailable (core tarot still works)
- [ ] Loading states and animations — Shimmer/skeleton states for AI interpretation generation
- [ ] Consistent TarotPageLayout usage — Refactor `reading/page.tsx` and auth pages to use shared layout

## Could Have

- [ ] Reading journal notes — Users add personal reflections to saved readings
- [ ] Card frequency analytics — "The Tower has appeared 4 times this month"
- [ ] Multiple deck aesthetics — Let users choose between 2-3 visual deck styles
- [ ] Social sharing — Generate shareable reading summary images
- [ ] Onboarding flow — Intent selection + birth date collection on first visit

## Won't Have (This Release)

- Live human reader marketplace — requires trust/safety infrastructure
- Mobile native app — web-first, responsive design covers mobile
- Subscription model — credit system first, subscriptions later if warranted
- Blog/CMS system — editor API exists but not prioritized for MVP
- Multi-language support

## Build Order

1. **Auth foundation** (vertical slice) — covers: JWT auth flow, auth middleware, auth context provider, logout, authenticated fetch utility, style auth pages
   - Proves end-to-end: login → authenticated API call → user profile display
   - Files: `src/app/user/login/actions.ts`, `src/app/user/register/actions.ts`, `src/lib/api-client.ts`, `src/app/providers/auth-provider.tsx`, `src/middleware.ts`

2. **Payments** — covers: Stripe credit purchases, user profile page (credits display)
   - Depends on: step 1 (need authenticated user to purchase credits)
   - Files: `src/app/api/stripe/checkout/route.ts`, `src/app/api/stripe/webhook/route.ts`, `src/app/user/profile/page.tsx`

3. **AI interpretations** — covers: OpenAI reading interpretation, credit deduction
   - Depends on: step 2 (need credits system to gate AI calls)
   - Files: `src/app/actions/interpret.ts`, updates to `Reading` component

4. **Reading persistence** — covers: save readings to backend, reading history page
   - Depends on: steps 1 + 3 (need auth + readings with AI interpretation)
   - Files: `src/app/actions/readings.ts`, `src/app/user/readings/page.tsx`

5. **Polish & engagement** — covers: daily card draw, question input, error boundaries, loading states, layout consistency
   - Depends on: steps 1-4 (core features must work first)

## Cross-Cutting Concerns

- **Security**: All API calls via server actions (never expose tokens to client), input validation with Zod
- **Error handling**: Backend unavailability must not break card selection/significators — only AI and persistence features degrade
- **Environment config**: `FASTAPI_URL`, `OPENAI_API_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` in `.env`
- **Testing**: Server action integration tests for auth flow, unit tests for token refresh logic
