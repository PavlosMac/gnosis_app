# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Tarot Divinations is a Next.js 16.1 application that provides tarot card readings and significator calculations. The app features an interactive tarot oracle, card shuffling animations, and personalized significator analysis based on birth dates using the Taroscopic System. Also features user sign up and login with JWT authentication via an external FastAPI backend.

## Development Commands

```bash
# Start development server with Turbopack
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
JWT auth via external FastAPI backend (`FASTAPI_URL` env var). Tokens stored in httpOnly cookies, never exposed to client JS.

### Key Files
- `src/lib/api-client.ts` — `authenticatedFetch()` (silent 401 refresh) + `publicFetch()` for all FastAPI calls
- `src/proxy.ts` — Route guard for `/user/*` (except login/register)
- `src/app/providers/auth-provider.tsx` — `AuthProvider` + `useAuth()` hook
- `src/app/user/layout.tsx` — Server layout that fetches user and passes to AuthProvider
- `src/types/auth.ts` — User, token, and form state interfaces
- `src/lib/validation/auth-schemas.ts` — Zod schemas for login/register

### Patterns
- All FastAPI calls go through `authenticatedFetch()` or `publicFetch()` — never raw `fetch`
- Auth pages use `useActionState` with colocated `actions.ts` server actions
- `AuthProvider` receives `initialUser` prop from server layout (no client-side fetch)
- Zod validation in server actions before any API call
- **Server actions are not protected by layouts** — layouts only run for full page renders, not direct action calls. Any server action that requires a role (e.g. `isSuperadmin`) MUST call `getCurrentUser()` and check the role itself before touching the API.

### Adding Authenticated API Calls
```typescript
// In a server action or server component:
import { authenticatedFetch } from '@/lib/api-client';
const result = await authenticatedFetch<MyType>('/api/v1/endpoint', { method: 'POST', body: JSON.stringify(data) });
if (!result.ok) { /* handle error */ }
```

## Project Memory System

This project maintains institutional knowledge in `docs/project_notes/` for consistency across sessions.

### Memory Files

- **bugs.md** - Bug log with dates, solutions, and prevention notes
- **decisions.md** - Architectural Decision Records (ADRs) with context and trade-offs
- **key_facts.md** - Project configuration, ports, important URLs
- **issues.md** - Work log with descriptions and status

### Memory-Aware Protocols

**Before proposing architectural changes:**
- Check `docs/project_notes/decisions.md` for existing decisions
- Verify the proposed approach doesn't conflict with past choices
- If it does conflict, acknowledge the existing decision and explain why a change is warranted

**When encountering errors or bugs:**
- Search `docs/project_notes/bugs.md` for similar issues
- Apply known solutions if found
- Document new bugs and solutions when resolved

**When looking up project configuration:**
- Check `docs/project_notes/key_facts.md` for ports, URLs, service accounts
- Prefer documented facts over assumptions

**When completing work:**
- Log completed work in `docs/project_notes/issues.md`
- Include date, brief description, and status

**When user requests memory updates:**
- Update the appropriate memory file (bugs, decisions, key_facts, or issues)
- Follow the established format and style (bullet lists, dates, concise entries)


