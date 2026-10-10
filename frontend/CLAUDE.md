# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Tarot Divinations is a Next.js 16.1 application that provides tarot card readings and significator calculations. The app features an interactive tarot oracle, card shuffling animations, and personalized significator analysis based on birth dates using the Taroscopic System. Also features user sign up and login with JWT authentication via an external FastAPI backend.

## Development Commands

```bash
# Normal path: from the repo root, `make dev` starts Mongo + API in compose
# and this dev server natively with GNOSIS_API_BASE_URL already exported.
# Bare `npm run dev` needs .env.local (copy .env.example).
npm run dev

# Build for production
npm run build

# Run linting
npm run lint
```

## Code style

### General
- Follow TypeScript strict mode
- Use functional components with TypeScript interfaces
- Prefer composition over inheritance
- Keep components small and focused
- Use pure functions where possible
- Make code deterministic when possible
- Use ES6 syntax and features
- Use ES6 fat arrow functions
- Use ES6 destructuring


### Styling
- Tailwind CSS 4 with custom configuration
- Dark mystical theme with Egyptian/esoteric aesthetics
- Custom fonts: Cinzel (headers), Crimson Pro (body)
- Golden accent color (#d4af37)
- Animated starfield backgrounds
- Custom CSS animations in `tarot.css`
- **All new code must be responsive** — use Tailwind breakpoint utilities (`sm:`, `md:`, `lg:`) for mobile and tablet layouts
- **All CSS should render similarly between Safari and Chrome — both browsers are supported equally.** When a rendering difference is reported, verify computed styles in the affected browser before changing code; past incidents were stale dev-server CSS (a long-running `npm run dev` misses newly-introduced Tailwind utilities — the class is in the markup but computes to nothing) rather than engine differences


## Docker Deployment

**Image:** `pavlos888/tarot-nextjs:latest`

```bash
# Build and push to Docker Hub
./deploy-to-pi.sh

# On Pi, run with docker-compose
docker-compose up -d
```

## Next.js
Follow Next.js standards for using server or client components. Most tarot components are client-side due to interactivity and animations.

## Next.js Data Fetching

Follow Next.js 16+ data fetching patterns
Use nextjs server actions for http calls

### Client Components
```typescript
// Most tarot components use client-side state
'use client'
import { useState, useCallback } from 'react'

function TarotReading() {
  const [selectedCards, setSelectedCards] = useState([])
  // Card selection and animation logic
}
```

### Patterns
```typescript
// Memoization for expensive calculations
import { useMemo } from 'react'

const stars = useMemo(() =>
  [...Array(100)].map((_, i) => ({
    left: `${(i * 7.3 + 13) % 100}%`,
    top: `${(i * 11.7 + 23) % 100}%`,
  })), [])
```

## Authentication Architecture

### Overview
JWT auth via external FastAPI backend (`GNOSIS_API_BASE_URL` env var). Tokens stored in httpOnly cookies, never exposed to client JS.

### Key Files
- `src/lib/api-client.ts` — `authenticatedFetch()` (silent 401 refresh) + `publicFetch()` for all FastAPI calls
- `src/proxy.ts` — Route guard (Next.js 16 renamed middleware → proxy; `src/proxy.ts` is the correct filename)
- `src/app/providers/auth-provider.tsx` — `AuthProvider` + `useAuth()` hook
- `src/lib/auth-cookies.ts` — The only reader/writer of the session cookies (`__Host-` names in production)
- `src/app/layout.tsx` — Root server layout: fetches the user and the `REGISTRATION_ENABLED` flag and passes both to `AuthProvider`
- `src/app/user/layout.tsx` — The onboarding gate for `/user/*`: redirects a logged-in user with stale Terms/Privacy consent to `/accept-terms` (`src/lib/onboarding.ts`)
- `src/lib/session.ts` — `getCurrentUser()`; `requireConsentedUser()` for data-creating actions
- `src/content/legal/` — Versioned Terms and Privacy Policy (MDX, filename = version); run `npm run legal:registry` after adding one
- `src/types/auth.ts` — User, token, and form state interfaces
- `src/lib/validation/auth-schemas.ts` — Zod schemas for login/register/verify/reset/delete-account

### Patterns
- All FastAPI calls go through `authenticatedFetch()` or `publicFetch()` — never raw `fetch`
- Auth pages use `useActionState` with colocated `actions.ts` server actions
- `AuthProvider` receives `initialUser` and `registrationEnabled` from the root server layout (no client-side fetch); client components read both via `useAuth()`
- Data-creating server actions call `requireConsentedUser()`; actions a user must reach while consent is stale (accept terms, delete account, contact support) call `getCurrentUser()`
- Zod validation in server actions before any API call
- **Server actions are not protected by layouts** — layouts only run for full page renders, not direct action calls. Any server action that requires a role (e.g. `isSuperadmin`) MUST call `getCurrentUser()` and check the role itself before touching the API.

### Adding Authenticated API Calls
```typescript
// In a server action or server component:
import { authenticatedFetch } from '@/lib/api-client';
const result = await authenticatedFetch<MyType>('/api/v1/endpoint', { method: 'POST', body: JSON.stringify(data) });
if (!result.ok) { /* handle error */ }
```

## Docs

All documentation lives in the monorepo root `docs/` (there is no `frontend/docs/`). The root
`CLAUDE.md` has a "Working on → read first" table; the full index is `../docs/README.md`.
Frontend-side reference docs:

- `../docs/reference/auth/frontend-auth-flow.md` — cookies, proxy, onboarding gate, server actions
- `../docs/reference/readings/search-and-tags.md` — tag editor and filter panel
- `../docs/reference/support/contact-support.md` — the support modal and its backend contract
- `src/content/legal/README.md` — how legal documents are versioned

The project notes (`../docs/notes/`: decisions, bugs, issues, key-facts, known-risks) are
repo-wide; the protocol for consulting and updating them is in the root `CLAUDE.md`.
