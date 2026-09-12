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

**Commands:**
- Start dev: `npm run dev`
- Build: `npm run build`
- Lint: `npm run lint`

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
- `/user/login`, `/user/register` - Auth pages (JWT via FastAPI backend)
- `/user/profile` - "Your Sanctum" dashboard (account + budget chalice, readings summary; `GET /api/v1/dashboard`)
- `/user/readings`, `/user/readings/[id]` - Readings journal list (filters via URL params) and detail
- `/user/manual-reading` - Manual interpretation entry
- `/superadmin` - User list (superadmin only)

## Key Components

- `TarotGame.tsx` - Main reading interface
- `ShuffledDeck.tsx` - Card spread display
- `TarotCard.tsx` - Individual card display
- `TarotLanding.tsx` - Home page portal

## Important URLs

**Deployment:**
- Docker Hub: `https://hub.docker.com/r/pavlos888/tarot-nextjs`

<!-- Add new facts below this line -->

