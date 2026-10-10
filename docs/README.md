# Docs index

One tree for the whole monorepo, sorted by **status** first and topic second. The root
[`CLAUDE.md`](../CLAUDE.md) has a task-oriented "Working on → read first" table; this file
is the complete list.

| Folder | Holds | Rule |
|---|---|---|
| [`reference/`](reference/) | How the shipped code works | Must match the code. Change it in the same PR as the code. No status banners needed: being here means live. |
| [`plans/`](plans/) | Work agreed but not built | `YYYY-MM-DD-<topic>.md`. `Status:` near the top. When it ships, update or create the reference doc and delete the plan. |
| [`notes/`](notes/) | Living logs | Append-only in spirit: decisions (ADRs), bugs, work log, key facts, known risks. |

Conventions: kebab-case for every file and folder (`README.md` is the only exception); no
status, version or `final` in filenames; git history is the archive, so nothing is kept
"for reference" once superseded. `make docs-check` fails on any broken relative link here
or in the three `CLAUDE.md` files, and CI runs it.

## Reference

| Doc | Side | Covers |
|---|---|---|
| [`auth/registration-verification-and-consent.md`](reference/auth/registration-verification-and-consent.md) | backend | Registration with names + consent, `UserStatus` and the verification gate, re-consent, rate limits, account deletion |
| [`auth/frontend-auth-flow.md`](reference/auth/frontend-auth-flow.md) | frontend | JWT in httpOnly cookies, the proxy, onboarding gate, server actions, `/accept-terms`, `/verify-email` |
| [`auth/registration-qa-checklist.md`](reference/auth/registration-qa-checklist.md) | both | Manual QA script for the registration flow against the local stack |
| [`database/model-references.md`](reference/database/model-references.md) | backend | Every collection, field, index and relationship |
| [`database/db-migrations.md`](reference/database/db-migrations.md) | backend | The migration runner and how to write a migration |
| [`database/configure-db.md`](reference/database/configure-db.md) | ops | MongoDB auth setup (dev and Pi), init script |
| [`database/dev-users.md`](reference/database/dev-users.md) | ops | The seeded local superadmin |
| [`database/production-mongo-commands.md`](reference/database/production-mongo-commands.md) | ops | Shell access to prod Mongo and ready-made queries |
| [`deployment/deploy-instructions.md`](reference/deployment/deploy-instructions.md) | ops | ARM64 build, push and Pi deploy runbook |
| [`deployment/mongodb-backup.md`](reference/deployment/mongodb-backup.md) | ops | Backup container, cron line, restore test, B2 + Atlas targets |
| [`email/email-service.md`](reference/email/email-service.md) | backend | `EmailPort` and adapters, Resend setup, reset / verification / support flows end to end |
| [`interpretations/usage-and-budget-flow.md`](reference/interpretations/usage-and-budget-flow.md) | backend | The generate flow step by step, usage ledger, budget gate |
| [`interpretations/user-accounting.md`](reference/interpretations/user-accounting.md) | both | Map of everything that prices, reserves, debits or displays LLM spend; data shapes; known gaps |
| [`prompts/lean-prompt-architecture.md`](reference/prompts/lean-prompt-architecture.md) | backend | Design reasoning for the lean prompt (implemented), with amendments |
| [`prompts/prompt-reference.md`](reference/prompts/prompt-reference.md) | backend | The current prompts. Sections 3–4 are generated (`make -C backend prompt-doc`; CI fails if stale) |
| [`prompts/experiments/`](reference/prompts/experiments/) | backend | Frozen sample readings from `scripts/lean_prompt_test.py`, cited by the architecture doc |
| [`readings/search-and-tags.md`](reference/readings/search-and-tags.md) | both | Reading tags and the filter panel, with dated amendments |
| [`support/contact-support.md`](reference/support/contact-support.md) | both | The support endpoint contract and the profile-page modal |
| [`frontend/src/content/legal/README.md`](../frontend/src/content/legal/README.md) | frontend | How Terms / Privacy versions are named and registered (lives next to the content) |

## Plans

| Doc | Status |
|---|---|
| [`2026-08-31-mollie-recurring-subscription.md`](plans/2026-08-31-mollie-recurring-subscription.md) | Design only, not started. The only payment plan. |
| [`2026-09-10-sse-streaming-interpretations.md`](plans/2026-09-10-sse-streaming-interpretations.md) | Not started. Stream the interpretation; add request duration and `request_id` logging. |
| [`2026-09-21-user-accounting-ledger.md`](plans/2026-09-21-user-accounting-ledger.md) | Agreed, not started. Price source, monthly budget period, superadmin ledger UI. |
| [`2026-09-29-readings-sort-index.md`](plans/2026-09-29-readings-sort-index.md) | Deferred. Compound index for spread + tags + date sort; trigger inside. |
| [`2026-10-10-about-page.md`](plans/2026-10-10-about-page.md) | Draft copy, no route yet. |
| [`2026-10-10-reading-limit-cta.md`](plans/2026-10-10-reading-limit-cta.md) | Spec, not started. Sign-up nudge after three free shuffles. |

## Notes

| Doc | What goes in it |
|---|---|
| [`decisions.md`](notes/decisions.md) | ADRs for both sides, numbered, dated, with trade-offs. Proposed-but-undecided designs go here as "Proposed" |
| [`bugs.md`](notes/bugs.md) | Symptom, cause, fix, prevention |
| [`issues.md`](notes/issues.md) | Dated work log: what shipped, status |
| [`key-facts.md`](notes/key-facts.md) | Ports, routes, URLs, env flags, accounts (non-secret) |
| [`known-risks.md`](notes/known-risks.md) | Accepted or unmitigated risks in shipped code; move to Resolved when fixed |
