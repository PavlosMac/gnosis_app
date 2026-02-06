# Architectural Decisions

This file logs architectural decisions (ADRs) for the Tarot Divinations project. Use bullet lists for clarity.

## Format

Each decision should include:
- Date and ADR number
- Context (why the decision was needed)
- Decision (what was chosen)
- Alternatives considered
- Consequences (trade-offs, implications)

---

## Entries

### ADR-001: Use Next.js 15 with Turbopack (Initial)

**Context:**
- Need a modern React framework for SSR/SSG
- Want fast development experience with hot reloading
- Require good TypeScript support

**Decision:**
- Use Next.js 15 with Turbopack for development server
- Client-side components for interactive tarot features

**Alternatives Considered:**
- Vite + React Router -> Rejected: less SSR capability out of box
- Remix -> Rejected: smaller ecosystem at time of decision

**Consequences:**
- Better SEO with server-side rendering
- Fast development iteration with Turbopack
- Good TypeScript integration
- Established ecosystem and documentation

### ADR-002: Use Cryptographically Secure Random for Card Shuffling (Initial)

**Context:**
- Card shuffling needs to feel genuinely random to users
- Math.random() has predictable patterns in some implementations
- Want to avoid any perception of biased draws

**Decision:**
- Use crypto.getRandomValues() for all card shuffling
- Implemented in `src/lib/crypto-random.ts`

**Consequences:**
- More truly random card selection
- Slightly more complex implementation
- Users can trust the randomness of readings

<!-- Add new decisions below this line -->

