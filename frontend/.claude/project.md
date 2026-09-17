---
name: Tarot Divinations
created: 2026-03-20
status: draft
---

# Project: Tarot Divinations

## Vision

Tarot Divinations is a consumer-facing tarot reading platform that combines the unique Taroscopic System of significator calculation with AI-powered reading interpretations, offering a deeply personalized spiritual experience with premium features via a credit-based monetization model.

## Goals

1. Provide interactive, visually immersive tarot readings with the dark Egyptian/esoteric aesthetic
2. Differentiate through the Taroscopic System — personalized significators derived from birth data
3. Integrate OpenAI for rich, narrative reading interpretations that weave all drawn cards into a coherent story
4. Monetize via Stripe-powered credit purchases (credits consumed per AI reading)
5. Build a persistent user experience — accounts, saved reading history, and personalized profiles

## Target Users

- **Spiritual Seekers**: Casual users exploring tarot for personal guidance, drawn by the mystical aesthetic
- **Tarot Enthusiasts**: Practitioners interested in the Taroscopic System's unique astrological/numerological approach
- **Premium Users**: Willing to pay for AI-generated personalized interpretations and advanced features

## Constraints

- Solo developer — keep architecture simple, avoid over-engineering
- Self-hosted on Raspberry Pi via Docker — resource-constrained deployment
- Backend API (FastAPI) developed in parallel — frontend must be resilient to API unavailability
- OpenAI API costs must be offset by credits — each AI interpretation has a real per-call cost

## Tech Stack

- **Frontend**: Next.js 16.1, TypeScript, Tailwind CSS 4, React 19
- **Backend**: External FastAPI API (separate repo), JWT auth with token rotation
- **AI**: OpenAI API for reading interpretations
- **Payments**: Stripe (credit purchases)
- **Deployment**: Docker on Raspberry Pi

## Non-Functional Requirements

- **Security**: httpOnly cookies for JWT storage, server-side token handling via Server Actions, no token exposure to browser. Input validation with Zod.
- **Performance**: Client-side rendering for interactive card features (shuffling, flipping), server actions for all API calls to FastAPI/OpenAI/Stripe
- **Resilience**: Core tarot features (card selection, significator calculation) work without backend. AI interpretations and saved readings degrade gracefully when API is unavailable.
- **Deployment**: Docker image under 500MB, runs on Raspberry Pi 4 (4GB RAM)

## Auth API Contract

Base URL: `/api/v1/auth`

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/register` | POST | None | Create account, returns access + refresh tokens |
| `/login` | POST | None | Authenticate, returns access + refresh tokens |
| `/refresh` | POST | None (body: refresh_token) | Token rotation, returns new token pair |
| `/logout` | POST | Bearer | Revokes access token |
| `/me` | GET | Bearer | Returns user profile (email, display_name, credits) |

### Token Strategy
- Access tokens: short-lived (15 min), stored in httpOnly Secure cookie
- Refresh tokens: longer-lived (7 days), stored in path-scoped httpOnly cookie
- Token rotation on every refresh call
- Silent refresh on 401 via `authenticatedFetch` utility
