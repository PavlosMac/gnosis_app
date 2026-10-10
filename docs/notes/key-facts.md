# Key Facts

This file stores project constants, configuration, and frequently-needed **non-sensitive** information.

## Security Warning

**NEVER store passwords, API keys, or sensitive credentials in this file.** Store secrets in `.env` files (excluded via `.gitignore`) or environment variables.

---

## Project Information

**Repository:**
- Name: Tarot Divinations
- Framework: Next.js 16.1
- Language: TypeScript

**Docker Image:**
- Image: `pavlos888/tarot-nextjs:latest`
- Deployment: Docker Compose on Raspberry Pi

## Local Development

**Ports:**
- Next.js Dev Server: `3000`
- Backend API (compose container, project `gnosis`): `8001`
- MongoDB (compose container): `27019`

**Commands:**
- Start everything: `make dev` from the repo root (compose Mongo + API, native Next.js)
- Frontend only: `npm run dev` (needs `.env.local`, see `.env.example`)
- Build: `npm run build`
- Lint: `npm run lint` (broken: `next lint` was removed in Next 16; use `npx tsc --noEmit`)
- Tests: `npm test` (regenerates the legal registry first)

## Styling

**Theme:**
- Primary accent: `#d4af37` (golden)
- Fonts: Cinzel (headers), Crimson Pro (body)
- Style: Dark mystical with Egyptian/esoteric aesthetics

**CSS:**
- Tailwind CSS 4
- Custom animations in `src/app/tarot.css`

## Key Routes

- `/` - Landing page
- `/reading` - Interactive tarot reading oracle
- `/significators` - Birth date-based card calculator
- `/chart` - Tarot chart explanation
- `/guide` - How to use the oracle
- `/user/login`, `/user/register` - Auth pages (JWT via FastAPI backend). Register needs `REGISTRATION_ENABLED=true`; it ends at a "check your email" panel, not a session
- `/forgot-password`, `/reset-password` - Password reset (public)
- `/verify-email` - Email confirmation: Confirm button for `?token=...`, resend form otherwise (public)
- `/accept-terms` - Re-consent interstitial for a logged-in user whose accepted Terms/Privacy version is behind
- `/legal/[doc]`, `/legal/[doc]/[version]` - Terms (`terms`) and Privacy Policy (`privacy`): current version, and each dated version (public)
- `/user/profile/manage-consent` - Review / re-record acceptance at any time
- `/user/profile/delete-account` - Self-service account deletion (exempt from the onboarding gate)
- `/user/profile` - "Your Sanctum" dashboard (account + budget chalice, readings summary; `GET /api/v1/dashboard`)
- `/user/readings`, `/user/readings/[id]` - Readings journal list (filters via URL params) and detail
- `/user/manual-reading` - Manual interpretation entry
- `/superadmin` - User list (superadmin only)

## Auth Facts

- **Session cookies:** `access_token`, `refresh_token`, `token_expires_at` in dev; `__Host-access_token`, `__Host-refresh_token`, `__Host-token_expires_at` in production (`NODE_ENV=production`, needs HTTPS). httpOnly, SameSite=Lax, Path=/. Single reader/writer: `src/lib/auth-cookies.ts`
- **Access token lifetime:** 3600s (backend `JWT_ACCESS_TOKEN_EXPIRE_SECONDS`)
- **`REGISTRATION_ENABLED`:** server-only env var, must be exactly `true`. Root `make dev` exports it as `true` (override: `make dev REGISTRATION_ENABLED=false`). **Production defaults to closed** (`frontend/docker-compose.yml`, decided 2026-10-05): set `REGISTRATION_ENABLED=true` on the Pi to open sign-up. Client components read it from `useAuth().registrationEnabled`
- **Verification link:** valid 24 hours; a never-confirmed account is deleted after 7 days (`src/lib/verification-policy.ts` mirrors the backend settings)
- **Legal documents:** `src/content/legal/<doc>/<YYYY-MM-DD>.mdx`, filename = version. After adding one run `npm run legal:registry` and commit `src/lib/legal-registry.generated.ts`
- **Controller:** Pavlos Macdonald-Kosmidis as a private individual, Runsten 34, 386 94 Färjestaden, Sweden; privacy contact pavloskoz@hotmail.com; supervisory authority IMY (Box 8114, 104 20 Stockholm); Swedish law. Stated in the Terms and Privacy Policy since 2026-10-10

## Key Components

- `TarotGame.tsx` - Main reading interface
- `ShuffledDeck.tsx` - Card spread display
- `TarotCard.tsx` - Individual card display
- `TarotLanding.tsx` - Home page portal

## Important URLs

**Deployment:**
- Docker Hub: `https://hub.docker.com/r/pavlos888/tarot-nextjs`

<!-- Add new facts below this line -->

## Domain & Email

- Public domain: `tarotdivinations.com` (DNS on Cloudflare; apps served via Cloudflare tunnel)
- Inbound mail: Cloudflare Email Routing → Gmail (apex MX/SPF owned by Cloudflare)
- Transactional email: **Resend** (free tier 3,000/mo, 100/day), sent by the FastAPI backend only (ADR-009)
- From address: `Tarot Divinations <noreply@tarotdivinations.com>`
- Resend DNS: DKIM at `resend._domainkey.tarotdivinations.com`; SPF+MX at `send.tarotdivinations.com` (return-path) — coexists with Email Routing
- `RESEND_API_KEY` + `EMAIL_FROM` live in the backend env only; contract: `docs/reference/email/email-service.md`

