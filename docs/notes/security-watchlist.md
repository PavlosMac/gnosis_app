# Security watchlist

The standing list of vulnerability classes that apply to this stack, where each one would
hide in this codebase, and how to go looking. It is the script for a recurring
**security excursion**: a dependency audit plus a code hunt against the checklist in §4.
Findings go in the log (§5); anything accepted or left open also goes in
[`known-risks.md`](known-risks.md), anything fixed in [`bugs.md`](bugs.md) or
[`issues.md`](issues.md) as usual.

Suggested cadence: §1–§3 monthly or after any dependency bump; the full §4 hunt quarterly
and whenever a new domain, endpoint, server action, or email template is added.

---

## 1. Running an excursion

1. **Dependency audit** (both sides, from the repo root):

   ```bash
   npm --prefix frontend audit
   (cd backend && uv export --frozen --no-dev --format requirements-txt --no-hashes -o /tmp/req.txt)
   uvx pip-audit -r /tmp/req.txt --no-deps -f columns
   ```

   Refresh §2 (versions) and §3 (open advisories) from the output. Judge each advisory
   by whether the vulnerable code path is one this app uses (§3 says which are).
2. **Base images and runtimes**: compare the Dockerfiles against the EOL table in §2.
3. **Code hunt**: walk §4. Each item has a grep recipe; run it, read every hit, and note
   anything that violates the "what safe looks like" line.
4. **Log it**: add a dated entry to §5 (what was checked, what was found, what was
   deferred). Open items go to `known-risks.md`; fixes go through the normal workflow.

---

## 2. Stack snapshot (2026-11-05)

Resolved versions from `frontend/package-lock.json` and `backend/uv.lock`.

| Layer | Component | Installed | Notes |
|---|---|---|---|
| Frontend | Next.js (App Router, Turbopack, `proxy.ts`) | 16.4.6 (2026-11-10) | Bundles its own React Server Components runtime (`react-server-dom-turbopack`) |
| | React / React DOM | 19.3.1 (2026-11-10) | |
| | zod | 4.6.7 (2026-11-10) | All server-action input validation |
| | sharp | 0.35.5 (2026-11-10) | Image optimisation at build and in `next/image` |
| | framer-motion, lucide-react, MDX 3 | current | MDX renders only repo-owned content (`src/content/`) |
| | Node.js runtime image | `node:24-alpine` (2026-11-10) | LTS until 2028-04 |
| Backend | FastAPI / Starlette | 0.135.1 / 0.52.1 | |
| | uvicorn / h11 | 0.42.0 / 0.16.0 | h11 ≥ 0.16.0 carries the 2025 request-smuggling fix |
| | motor / pymongo | 3.7.1 / 4.16.0 | |
| | PyJWT | 2.12.1 | HS256 only, single-entry `algorithms=[...]`, no `PyJWKClient` |
| | pwdlib[argon2] / argon2-cffi | 0.3.0 / 25.1.0 | |
| | pydantic / pydantic-settings | 2.12.5 / 2.13.1 | |
| | python-multipart | 0.0.32 | Installed but **no `Form`/`UploadFile` endpoint exists** |
| | openai / anthropic / resend / mollie | 2.30.0 / 1.2.0 / 2.44.0 / 1.10.2 | Outbound TLS depends on `certifi` |
| | certifi / urllib3 / anyio / dnspython | 2026.2.25 / 2.7.0 / 4.12.1 / 2.8.0 | |
| | Python image | `python:3.12-slim` | 3.12 supported until 2028-10 |
| Data | MongoDB | `mongo:7` | EOL 2027-08-31 (extended by MongoDB in 2025) |
| Edge | Cloudflare tunnel → Next.js → API (compose network only) | | Mongo bound to `127.0.0.1` on the Pi |

---

## 3. Open advisories as of 2026-11-05

"Reaches us" is the judgement of whether the vulnerable path is exercised here; everything
listed should still be upgraded on the next dependency pass.

### Frontend

**2026-11-10: `npm audit` reports 0 vulnerabilities** after next 16.1.6 → 16.4.6, react
19.2.4 → 19.3.1, sharp 0.34.5 → 0.35.5, zod 4.3.6 → 4.6.7, vitest → 4.1.12 and
`npm audit fix` on the build tooling. A later `minimatch` advisory (GHSA-g3hv-75wg-m249,
fixed in 11.0.1) hit the `typescript-eslint` 8.72.2 tree the same day, with no newer
`typescript-eslint` to take; `package.json` `overrides` pins that one copy to minimatch
^11.0.1. Drop the override once `typescript-eslint` ships a release that depends on a fixed
minimatch. The 2026-11-05 state, kept for the record:

| Package | Fix in | Reached us | What |
|---|---|---|---|
| next 16.1.6 | > 16.4.0 | Yes | ~40 advisories since 16.1.6, among them: middleware/proxy bypass (segment-prefetch routes, dynamic-route param injection, Turbopack single locale); null-origin bypass of Server Actions CSRF check; Server Actions DoS and unbounded payload; RSC DoS (CVE-2026-23869 family, bundled runtime); cache poisoning of RSC responses and self-hosted SSG/ISR; Image Optimization: DoS, SSRF, and unauthenticated RCE via SVG and AVIF; HTTP request smuggling in rewrites; `use cache` RCE |
| react / react-dom 19.2.4 | 19.2.5 | Partly | RSC DoS fixes; the runtime that matters is the one bundled in `next` |
| sharp 0.34.5 | 0.35.5 | Yes | libvips, libheif, librsvg CVEs in the image loaders used by `next/image` |
| zod 4.3.6 | 4.6.6 | Yes | Memory exhaustion validating oversized constrained collections |
| vitest, vite, postcss, browserslist, brace-expansion, minimatch, picomatch, js-yaml, flatted, nanoid, source-map-js, ajv, @babel/core | various | Dev/build only | DoS and file-read classes in tooling |

### Backend (`pip-audit`)

| Package | Fix in | Reaches us | What |
|---|---|---|---|
| **starlette 0.52.1** | 1.3.1 (needs a FastAPI release that allows it) | Partly | `Host` header and request path used unvalidated in `request.url` (we never read `request.url` or `url_for`; links come from `frontend_base_url`); `request.form()` limits ignored (no form endpoints); Windows-only `StaticFiles` SSRF (n/a) |
| **pyjwt 2.12.1** | 2.15.0 | Low | Nearly all advisories are in `PyJWKClient` or mixed symmetric/asymmetric `algorithms=` lists, neither used here. Still relevant: non-Base64URL characters accepted in signature segments; `is_pem_format` ReDoS on attacker-supplied keys (ours is a fixed secret) |
| **pymongo 4.16.0** | 4.18.3 | Low | BSON decoder out-of-bounds on regex elements and integer overflow on encode (data comes from our own server); connection-string percent-decoding (URI is operator-controlled); GridFS and KMS paths unused |
| pydantic-settings 2.13.1 | 2.14.2 | No | `secrets_dir` nested traversal; we use env vars only |
| **certifi 2026.2.25** | 2026.10.19 | **Yes** | Compromised eMudhra intermediates under a bundled root; affects every outbound TLS call (OpenAI, Resend, Mollie). Rebuild the API image after bumping |
| urllib3 2.7.0 | 2.8.0 | Low | Streaming-API memory issues and proxy TLS config; used indirectly by SDKs |
| anyio 4.12.1 | 4.14.2 | Low | IDN TLS hostname handling; process-pool stderr pipe |
| dnspython 2.8.0 | 2.9.0 | No | Only used by `email-validator` for deliverability lookups if enabled |

### Base images

| Image | Status | Action |
|---|---|---|
| `node:24-alpine` (all three frontend stages) | Supported (LTS to 2028-04) | Was `node:20-alpine` (EOL 2026-04-30) until 2026-11-10 |
| `ghcr.io/astral-sh/uv:latest` | Unpinned | Pin a version tag so a build is reproducible and a compromised tag cannot land silently |
| `python:3.12-slim`, `mongo:7` | Supported | Re-check at each excursion |

---

## 4. Hunting checklist

Each item: **why it applies here → where to look → what safe looks like → recipe**. The
recipes are zsh-safe (`--include` values quoted). Run them from the repo root.

### 4.1 Frontend (Next.js 16, App Router)

**F1. Authorisation that leans on the proxy.** Next.js middleware/proxy bypasses recur
(three in 2026 alone, see §3), so `src/proxy.ts` is a convenience, not the boundary.
Every page under `/user` and `/superadmin`, and every server action, must establish the
user itself (`getCurrentUser()` / `requireConsentedUser()`, and the role check for
superadmin actions — `frontend/CLAUDE.md` already states this rule).
Safe: no `"use server"` file touches `authenticatedFetch` without a session call first.

```bash
grep -rL -e getCurrentUser -e requireConsentedUser $(grep -rl '"use server"' frontend/src --include='*.ts' --include='*.tsx')
grep -rn "isSuperadmin" frontend/src/app/superadmin/actions.ts   # every exported action must gate
```

Expected hits for the first recipe are the public auth flows (register, logout,
verify-email, accept-invite, forgot/reset-password) and `settings/actions.tsx`, which only
loads a legal document. Any other file under `app/user` or `app/superadmin` is a finding.

**F2. Server Actions as public endpoints.** Actions are reachable without the page; the
2026 advisories include a CSRF bypass via `Origin: null`, unbounded payloads, and
disclosure of action IDs. Safe: zod schema on every action input before any API call,
bounded sizes (`max` on strings and arrays), no action that mutates based on an
unvalidated hidden field.

```bash
grep -rn "formData.get" frontend/src --include='*.ts' --include='*.tsx' | grep -v "safeParse\|parse("   # raw reads that skip zod
grep -rn "z\.string()" frontend/src/lib/validation | grep -v "max("
```

**F3. Open redirect via return paths.** `from` on `/user/login` is user-controlled and
replayed by `redirect()` after login (`src/app/user/login/actions.ts`,
`src/lib/auth-return-path.ts`). The current test, `/^\/(?!\/)/`, rejects `//evil.com` but
accepts `/\evil.com`, which the WHATWG URL parser resolves to `https://evil.com/`
(verified with `new URL("/\\evil.com", origin)`). Safe: reject backslashes too, or parse
with `new URL(value, origin)` and require `origin` to match.

```bash
grep -rn "redirect(" frontend/src --include='*.ts' --include='*.tsx' | grep -v 'redirect("/'   # any redirect whose target is not a literal
grep -rn "searchParams" frontend/src/app --include='*.tsx' | grep -i -e from -e next -e return -e url
```

**F4. XSS and the CSP.** There is no `dangerouslySetInnerHTML` today, MDX renders only
repo-owned content, and LLM output is rendered as text (`whitespace-pre-wrap`). The CSP
still allows `'unsafe-inline' 'unsafe-eval'` for scripts, so one injection would run. Safe:
keep interpretations, questions, tags, and emails as React text; never feed LLM output
into a markdown-to-HTML renderer without sanitising; tighten the CSP when feasible.

```bash
grep -rn -e dangerouslySetInnerHTML -e "innerHTML" -e "react-markdown" -e "rehype-raw" frontend/src
grep -rn "href={" frontend/src --include='*.tsx' | grep -v 'href="/\|href={`/'   # dynamic hrefs: javascript: or external?
```

**F5. Session cookies.** `src/lib/auth-cookies.ts` is the only reader/writer: `__Host-`
names in production, `httpOnly`, `sameSite: lax`, `secure`. Safe: no other file calls
`cookies().set`; no token ever reaches a client component, a `NEXT_PUBLIC_` variable, or a
`console.log`. The proxy logs only booleans about tokens; keep it that way.

```bash
grep -rn "cookies()" frontend/src | grep -v auth-cookies.ts | grep "\.set("
grep -rn "console.log" frontend/src/proxy.ts frontend/src/lib frontend/src/app --include='*.ts' | grep -i -e token -e password -e refresh
grep -rn NEXT_PUBLIC_ frontend/src frontend/.env.example
```

**F6. Image optimisation surface.** `next.config.ts` allows `remotePatterns` for
`steve-p.org`; 2026 Next.js advisories cover DoS, SSRF, and RCE (SVG, AVIF) in this API.
Safe: drop `remotePatterns` if those images are no longer used, keep `dangerouslyAllowSVG`
unset, and prefer `unoptimized` for static assets already sized (as `Shot.tsx` does).

```bash
grep -rn -e remotePatterns -e dangerouslyAllowSVG -e "steve-p.org" frontend/next.config.ts frontend/src
```

**F7. Caching and cross-user content.** Self-hosted SSG/ISR cache poisoning and RSC
cache confusion advisories mean any route that renders user data must not be statically
cached. Safe: pages that read the session are dynamic (they call `cookies()`), no
`use cache` or `revalidate` on user-specific data, and `Cache-Control: immutable` only on
content-hashed assets (as configured).

```bash
grep -rn -e '"use cache"' -e "revalidate" -e "unstable_cache" frontend/src
```

**F8. Server-side fetches.** All API calls go through `api-client.ts` to
`GNOSIS_API_BASE_URL`. Safe: no `fetch()` whose URL contains user input; no server action
proxies an arbitrary URL.

```bash
grep -rn "fetch(" frontend/src --include='*.ts' --include='*.tsx' | grep -v "authenticatedFetch\|publicFetch\|api-client.ts\|proxy.ts"
```

### 4.2 Backend (FastAPI)

**B1. Missing or wrong auth dependency.** Every non-public route must take `CurrentUser`,
`CurrentUserId`, or `IsSuperAdmin`. The public set is: register, verify-email,
resend-verification, invite lookup, accept-invite, login, refresh, forgot-password,
reset-password, health. Safe: anything else without one of those deps is a bug.

```bash
# Joins each decorator + signature and prints the routes with no auth dependency.
awk '/@router\./{collect=1; sig=""} collect{sig=sig" "$0; if ($0 ~ /->/){collect=0; if (sig !~ /CurrentUser|IsSuperAdmin|CurrentUserId/) print FILENAME": "sig}}' backend/src/*/router.py | sed 's/  */ /g' | cut -c1-120
```

The output must be exactly the public set above (nine auth routes plus health).

**B2. IDOR: queries not scoped to the caller.** Repositories must filter by `user_id`
for any user-owned document (readings, interpretations, tags, dashboard). Safe: no
`find_one({"_id": ...})` on a user-owned collection without `user_id` in the same filter,
and handlers never take a `user_id` from the request body.

```bash
grep -rn -e 'find_one({"_id"' -e 'update_one({"_id"' -e 'delete_one({"_id"' backend/src --include='repository.py' | grep -v user_id
grep -rn "user_id: " backend/src/*/schemas.py   # a user_id in a *request* schema is a red flag
```

**B3. NoSQL operator injection and query shape.** Pydantic types stop `{"$gt": ""}`
tricks as long as fields are `str`, not `Any`/`dict`. Sort fields are whitelisted
(`ReadingSortField`), the one `$regex` uses `re.escape`. Safe: no `dict`/`Any` request
field reaches a filter; no `$where`; every regex on user input is escaped; every sort key
comes from a `Literal`.

```bash
grep -rn -e '\$regex' -e '\$where' -e '\$expr' -e '\$function' backend/src --include='*.py'
grep -rn -e ": dict" -e ": Any" backend/src/*/schemas.py
grep -rn "\.sort(" backend/src --include='*.py'
```

**B4. JWT handling.** `src/core/security.py` encodes HS256 with the secret from settings
and decodes with a single-entry `algorithms` list; `dependencies.py` checks `type ==
"access"` and that the refresh family is live. Safe: `jwt_algorithm` never becomes a list
or `none`; no `verify_signature=False`; no second decode path; the secret has no default
(config refuses to start without it). Also check: logout and password reset revoke the
family; refresh reuse revokes the family (`service.py`).

```bash
grep -rn -e "jwt.decode" -e "verify_signature" -e "algorithms=" backend/src --include='*.py'
grep -rn "jwt_secret_key\|JWT_SECRET" backend/src backend/.env.example backend/docker-compose*.yml
```

**B5. Rate-limit keys and the forwarded address.** `get_client_ip` trusts the first
`X-Forwarded-For` entry because the API is reached only through the Next.js server
(no `ports:` on the API in prod compose). This is already in `known-risks.md`. Safe: the
API stays off the public network; if it is ever exposed, `RATE_LIMIT_TRUST_FORWARDED_FOR`
flips to false. Also confirm every credential-adjacent endpoint is throttled: login,
register, forgot-password, resend-verification, invite lookup, support.

```bash
grep -n -A3 "api:" backend/docker-compose.prod.yml | grep -i ports
grep -rn "ThrottleRepository\|rate_limit" backend/src --include='*.py' | grep -v config.py
```

**B6. Account enumeration and pre-hijacking.** Forgot-password and resend-verification
return a constant response; registration of an existing email must not differ in timing
or body in a way that reveals the account. Pre-hijacking (register someone else's email,
wait for them to verify) is a known open risk. Safe: constant responses, and any future
change to verification keeps "verifying also resets the password set by the registrant"
or equivalent on the table.

```bash
grep -rn -A6 "async def forgot_password\|async def resend_verification\|async def register" backend/src/auth/router.py
```

**B7. Email injection and content.** User text goes into emails in two places: the
support relay (subject, message, `Reply-To`) and admin messages. Templates escape with
`html.escape`; `Reply-To` is the validated user email. Safe: subjects have a length cap
and no newlines reach a header; every new template escapes; links are built from
`frontend_base_url`, never from `request.url` or the `Host` header (Starlette advisory in §3).

```bash
grep -rn -e "html.escape" -e 'f"' backend/src/notifications/templates.py | grep -v escape
grep -rn -e "request.url" -e "url_for" -e "base_url" -e 'headers\["host"\]' backend/src --include='*.py'
grep -n "subject" backend/src/support/schemas.py backend/src/users/schemas.py
```

**B8. Mass assignment and schema strictness.** `AppSchema` does not set
`extra="forbid"`, so unknown fields are ignored (fine) but a model used for both input
and persistence would accept `is_superadmin`. Safe: request schemas never include
privilege or ownership fields; domain models are built in handlers from explicit fields.

```bash
grep -rn -e "is_superadmin" -e "status" -e "budget_usd" backend/src/*/schemas.py | grep -v "Response\|ReadModel\|Summary"
```

**B9. LLM boundary (OWASP LLM01/LLM05/LLM10).** User text enters the prompt via
`question` (≤500 chars) and card/spread names (`prompt_builder.py`); output is returned
verbatim to the UI and stored. Costs are bounded by the per-user budget and the
`openai_max_tokens` ceiling. Safe: the system prompt treats the question as data (it does:
"the Oracle" rules); user text never reaches a tool call, a URL, or a shell; output is
rendered as text (F4); the raw `/llm/interpret` endpoint stays superadmin-only; the
`debug` body log never runs at INFO in prod. Watch for any new field that flows into the
prompt without a length cap.

```bash
grep -n "max_length" backend/src/llm/schemas.py backend/src/readings/schemas.py backend/src/interpretations/schemas.py
grep -rn "logger.debug.*body" backend/src --include='*.py'
grep -rn "IsSuperAdmin" backend/src/llm/router.py
```

**B10. Secrets, config, and logs.** `Settings` refuses to start without
`MONGODB_URI` and `JWT_SECRET_KEY`; `.env` files are git-ignored; the logging rule bans
PII and tokens except the dev-only console email adapter. Safe: no new secret gets a
default in `config.py`; no `.env*` other than examples is tracked; no log field carries
an email, token, or link.

```bash
git ls-files | grep -e '\.env' -e '\.pem' -e '\.key$'
grep -rn -e "api_key: str = \"[^\"]" -e "secret.*= \"[^\"]" backend/src/core/config.py
grep -rn "logger\.\(info\|warning\|error\)" backend/src --include='*.py' | grep -i -e "email=" -e "token=" -e "link=" -e "password"
```

**B11. Resource exhaustion.** No request body limit is set in uvicorn; Cloudflare caps
the request size at the edge, but the dev and any direct path do not. Pydantic bounds the
expensive fields (`cards` ≤ 12, `question` ≤ 500). Safe: every list field has
`max_length`; every string that reaches Mongo or the LLM has one; the OpenAI semaphore
and acquire timeout remain in place.

```bash
# Request-side list fields without an explicit cap (read models and default_factory fields are noise).
grep -rn "list\[" backend/src/*/schemas.py | grep -v -e max_length -e default_factory -e "def " -e ReadModel -e Response
```

Expected hit: `UpdateReadingTagsRequest.tags`, which is capped by its `field_validator`
(`MAX_TAGS_PER_READING`, `MAX_TAG_LENGTH`) rather than by `Field`.

**B12. Deletion cascade and new collections.** Any collection storing a `user_id` must
be covered by `DeleteUserHandler` (backend `CLAUDE.md` checklist). Safe: the constants
file and the delete handler agree.

```bash
cat backend/src/database/collections/constants.py                       # every collection
grep -n "Repository" backend/src/auth/commands/delete_user.py            # every one the cascade touches
```

Compare by eye: each collection that stores a `user_id` (today: readings,
interpretations, user_tags, refresh_tokens, password_reset_tokens,
email_verification_tokens, users) needs a repository call in the cascade.

### 4.3 Data and infrastructure

**I1. Mongo exposure.** Prod binds `127.0.0.1:27017` with `--auth` and a scoped
`readWrite` app user (`mongo/init-user.js`). Dev compose binds `27019` on all interfaces
without the loopback prefix: acceptable on a trusted LAN only. Safe: the prod mapping
keeps its `127.0.0.1:` prefix (the compose file says why); the app user never gets
`root` or `dbAdminAnyDatabase`.

```bash
grep -n -A1 "ports:" backend/docker-compose.prod.yml backend/docker-compose.yml
grep -n "role" backend/mongo/init-user.js
```

**I2. Containers.** Frontend runs as `nextjs` (non-root). The API Dockerfile sets no
`USER`, so uvicorn runs as root inside the container. `uv:latest` is unpinned. Safe: a
non-root user in both images, pinned base-image tags, images rebuilt after every
dependency fix (`certifi` in particular).

```bash
grep -n -e "^FROM" -e "^USER" backend/Dockerfile frontend/Dockerfile
```

**I3. Edge and headers.** Cloudflare tunnel fronts the Next.js server; the API is on the
compose network only. Security headers live in `next.config.ts` (HSTS, nosniff,
frame-ancestors, CSP). Safe: no new `ports:` on the API, CSP not loosened further, and
`REGISTRATION_ENABLED` still gates `/user/register` both in the proxy and server-side.

**I4. Backups.** `docs/reference/deployment/mongodb-backup.md`: confirm the dump is
encrypted at rest at the off-site target and the restore test still runs.

### 4.4 Process and supply chain

**P1. No automated audit.** CI (`.github/workflows/ci.yml`) runs backend lint and tests
only: no `npm audit`, no `pip-audit`, no frontend lint or tests, and no Dependabot or
Renovate. Everything in §3 was invisible until run by hand. Safe: an audit step on both
sides in CI (allowing dev-only tooling advisories to be triaged, not auto-failed) and a
weekly dependency-update bot.

**P2. Lockfile discipline.** `npm ci` and `uv sync --frozen` are used in the images:
good. Safe: no `npm install` in Dockerfiles or CI; no `--no-verify`; `pre-commit` hook
versions bumped alongside tools.

**P3. Pinned actions and tools.** `actions/checkout@v4`, `astral-sh/setup-uv@v5` are
major-tag pinned. Pinning to a commit SHA removes the tag-retargeting risk.

---

## 5. Excursion log

### 2026-11-10 — Part 1 of the baseline fixes: frontend upgrade

Upgraded next 16.1.6 → 16.4.6, react/react-dom → 19.3.1, sharp → 0.35.5, zod → 4.6.7,
`@next/mdx` and `eslint-config-next` → 16.4.6, vitest → 4.1.12; `npm audit fix` cleared
the tooling advisories. `npm audit` now reports 0. Frontend Docker stages moved from
`node:20-alpine` to `node:24-alpine`; `@types/node` → ^24 and `engines.node >=24` so
local, CI and the image agree. One `next.config.ts` change: `agentRules: false` (new in
16.4; without it `next dev` writes a managed block into `frontend/AGENTS.md`, which this
repo deliberately does not have). Remove it if Next is ever downgraded below 16.4. Verified: `tsc` clean, 487 vitest tests,
`next build`, and the live stack (anonymous redirect, public pages, authenticated profile,
readings and superadmin pages, proxy refresh-cookie path). Production needs the image
rebuilt and pushed (`frontend/deploy-to-pi.sh`) to pick this up.

### 2026-11-05 — baseline (document created)

Checked: §1 audit on both lockfiles; §4 recipes F1, F3, F4, F5, F8, B1 (spot), B2, B3,
B4, B5, B7, B10, I1, I2, P1.

Found:

- **Next.js 16.1.6 is ~40 advisories behind** (critical: RCE in Image Optimization via
  SVG/AVIF, null-origin Server Actions CSRF bypass, three proxy bypasses). Fix: upgrade
  `next` past 16.4.0, `react`/`react-dom` to ≥ 19.2.5, `sharp` to 0.35.5, `zod` to ≥ 4.6.6.
- **Node 20 base image is end of life** (2026-04-30). Fix: `node:22-alpine` or newer.
- **certifi 2026.2.25** ships a compromised root chain. Fix: bump to ≥ 2026.10.19 and
  rebuild the API image.
- Backend libraries behind: starlette (via fastapi), pyjwt, pymongo, pydantic-settings,
  urllib3, anyio, dnspython. Low direct exposure (§3), upgrade on the next pass.
- **Open redirect** in `isSafeReturnPath` (`/\evil.com` accepted, resolves off-site).
  Low-to-medium: post-login phishing hop. Fix: reject `\` or compare parsed origin.
- API container runs as root; `uv:latest` unpinned (I2).
- No dependency audit in CI (P1).

Clean: no raw `fetch` to user-controlled URLs; no `dangerouslySetInnerHTML`; cookies
written in one file with `__Host-`/httpOnly/secure; all user-owned repository reads scoped
by `user_id`; the only `$regex` is escaped; sort fields whitelisted; JWT decode single-
algorithm with type and family checks; email templates escape user text; no secret has a
default; no `.env` tracked.

Deferred to the user: which fixes to take first (suggested order: Next.js + Node image,
certifi, open redirect, CI audit step, backend bumps).

---

## 6. Sources

Advisory data came from `npm audit` and `pip-audit` run on 2026-11-05 against the
lockfiles, plus:

- Next.js advisories: [GHSA-6gpp-xcg3-4w24](https://github.com/advisories/GHSA-6gpp-xcg3-4w24) (Turbopack single-locale proxy bypass), [CVE-2026-44575](https://advisories.gitlab.com/npm/next/CVE-2026-44575/) and [CVE-2026-45109](https://advisories.gitlab.com/npm/next/CVE-2026-45109/) (segment-prefetch bypass and incomplete fix), [CVE-2026-44574](https://advisories.gitlab.com/npm/next/CVE-2026-44574/) (dynamic-route param injection), [Next.js July 2026 release notes via Netlify](https://www.netlify.com/changelog/2026-07-21-nextjs-security-vulnerabilities/), [September 2026 pre-announcement](https://nextjs.org/blog/upcoming-nextjs-security-release-september-2026), [CVE-2025-59471](https://corgea.com/advisories/vulnerabilities/CVE-2025-59471) (remotePatterns DoS)
- React Server Components: [CVE-2025-55182 / GHSA-fv66-9v8q-g76r](https://github.com/advisories/GHSA-fv66-9v8q-g76r) (RCE), [GHSA-479c-33wc-g2pg](https://github.com/react/react/security/advisories/GHSA-479c-33wc-g2pg) (DoS), [NVD CVE-2025-55182](https://nvd.nist.gov/vuln/detail/cve-2025-55182)
- Starlette: [CVE-2025-54121 / GHSA-2c2j-9gv5-cj73](https://github.com/advisories/GHSA-2c2j-9gv5-cj73), [CVE-2024-47874](https://advisories.gitlab.com/pkg/pypi/starlette/CVE-2024-47874/)
- h11 / uvicorn: [CVE-2025-43859](https://nvd.nist.gov/vuln/detail/CVE-2025-43859)
- PyJWT: [CVE-2026-48526](https://advisories.gitlab.com/pypi/pyjwt/CVE-2026-48526/), [CVE-2026-32597](https://www.sentinelone.com/vulnerability-database/cve-2026-32597/), [disputed CVE-2025-45768](https://github.com/advisories/GHSA-xpf8-484v-j9w6)
- PyMongo: [CVE-2024-5629](https://nvd.nist.gov/vuln/detail/CVE-2024-5629), [PYSEC-2026-1826](https://osv.dev/vulnerability/PYSEC-2026-1826), [CVE-2026-96749](https://vulert.com/vuln-db/CVE-2026-96749)
- sharp / libvips: [GHSA-f88m-g3jw-g9cj](https://github.com/lovell/sharp/security/advisories/GHSA-f88m-g3jw-g9cj)
- Node.js 20 EOL: [endoflife.ai](https://endoflife.ai/nodejs/20), [HeroDevs](https://www.herodevs.com/blog-posts/node-js-v20-is-reaching-end-of-life)
- MongoDB lifecycle: [MongoDB support lifecycles](https://www.mongodb.com/legal/support-policy/lifecycles), [longer lifecycles for 7.0 and 8.0](https://www.mongodb.com/products/updates/longer-lifecycles-for-mongodb-7-0-and-8-0/)
- OWASP Top 10 for LLM Applications 2025: [HackerOne summary](https://www.hackerone.com/ai/owasp-top-10-llms-2025), [Aembit summary](https://aembit.io/blog/owasp-top-10-llm-risks-explained/)
