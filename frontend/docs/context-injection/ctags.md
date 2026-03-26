# CODE_INDEX Design — LLM-Optimized Codebase Routing

## Purpose

CODE_INDEX.md is injected into every LLM prompt via a Claude Code hook. It serves as a **routing table** — the LLM reads it to decide which files to open, not to understand file internals.

## Design Principles

### 1. Exports over symbols

Only `export` statements are indexed from source. An LLM navigating a codebase asks "where do I import X from?" — not "what local variables exist inside function Y?"

The previous ctags-based approach dumped every symbol: local `const data`, `const res`, `const body` appeared dozens of times. These waste context tokens and provide zero routing value.

### 2. Two-pass extraction

| Pass | Source | What it captures |
|------|--------|-----------------|
| 1 — Source parsing | Direct regex on `.ts`/`.tsx` files | `export` declarations, `'use client'`/`'use server'` directives |
| 2 — ctags (stdin) | Universal Ctags with `--fields=+nS` | Non-exported top-level declarations (UPPER_CASE constants, PascalCase components, interfaces) |

Pass 1 is authoritative. Pass 2 fills gaps for internal-but-important declarations that ctags finds via scope analysis (skipping anything with `tag.scope` set — i.e., nested/local).

### 3. Directive tagging

Every file header shows `(client)` or `(server)` when the directive is present. For Next.js, this is a critical routing decision — the LLM needs to know rendering context before suggesting imports or patterns.

### 4. Semantic grouping

Files are grouped by architectural layer, not alphabetically:

- **Components** — reusable UI (`src/components/`)
- **Pages & Layouts** — Next.js routing (`src/app/**/page.tsx`, `layout.tsx`)
- **Providers** — React context providers
- **Server Actions** — `actions.ts` files with `'use server'`
- **Libraries** — shared logic (`src/lib/`)
- **Services** — domain services (`src/services/`)
- **Types** — TypeScript type definitions (`src/types/`)
- **Constants** — shared constants (`src/constants/`)
- **Infrastructure** — middleware, proxy, config

This mirrors how a developer thinks about the codebase, making it faster for the LLM to locate the right layer.

### 5. Kind classification

Constants are classified by naming convention:
- `UPPER_CASE` → `constant` (module-level config/data)
- `PascalCase` → `component` (React component)
- `camelCase` → `function` (utility/helper)

This tells the LLM what a symbol *is* without reading the file.

### 6. Noise elimination

Filtered out entirely:
- **Interface properties** (`tag.kind === 'property'`) — the LLM reads the file for field details
- **Nested declarations** (`tag.scope` set) — local variables inside functions
- **Anonymous ctags artifacts** (`anonymousObject...`)
- **Short names** (1-2 chars: `i`, `j`, `e`)
- **Non-src files** — config files (`eslint.config.mjs`, `postcss.config.mjs`) add no routing value
- **Duplicate names** — deduplicated per file

## Pipeline

```
ctags (JSON + scope fields) ──stdin──▶ ctags-to-markdown.js ──▶ CODE_INDEX.md
                                             │
                                    also reads source files
                                    directly for exports +
                                    directives
```

Triggered by:
- `npm run code-index` — manual regeneration
- `.claude/hooks/post-write-regen.js` — auto-regenerates after every file edit
- `.claude/hooks/code-index-injector.js` — injects into every prompt

## Result

~245 lines of high-signal routing data vs ~270 lines of ctags noise. The token savings come from eliminating ~150 useless symbol entries (local vars, properties) and replacing them with ~25 lines of previously-missing component/page entries with directive context.
