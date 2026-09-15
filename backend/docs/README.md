# Docs Index

Status legend: **Live** — describes shipped behavior, kept current · **Plan** — design
for work not (fully) built · **Historical** — superseded or archived, kept for design
history · **Snapshot** — generated output frozen in time.

## Live references

| Doc | What it covers |
|---|---|
| [`database/model_references.md`](database/model_references.md) | Current collections, fields, indexes, relationships |
| [`database/db_migrations.md`](database/db_migrations.md) | Migration runner, writing migrations |
| [`database/configure_db.md`](database/configure_db.md) | MongoDB auth setup (dev + Pi prod), backups overview |
| [`database/production_mongo_commands.md`](database/production_mongo_commands.md) | Shell access to prod Mongo + ready-made queries |
| [`database/dev-users.md`](database/dev-users.md) | Seeded local dev superadmin |
| [`deployment/deploy_instructions.md`](deployment/deploy_instructions.md) | Build/push and Pi deploy runbook |
| [`email/email_service.md`](email/email_service.md) | `EmailPort` + adapters, Resend setup, password-reset flow end to end |
| [`interpretations/usage-and-budget-flow.md`](interpretations/usage-and-budget-flow.md) | Generate flow, usage ledger, budget gate |
| [`prompts/prompt_reference.md`](prompts/prompt_reference.md) | Current prompts (partly generated — `make prompt-doc`) |
| [`prompts/lean_prompt_architecture.md`](prompts/lean_prompt_architecture.md) | Design rationale for the lean prompt architecture (implemented) |

## Plans (not built)

| Doc | Status |
|---|---|
| [`auth/password-reset-flow.md`](auth/password-reset-flow.md) | Unimplemented plan |
| [`payment/braintree-recurring-subscription.md`](payment/braintree-recurring-subscription.md) | Design only — supersedes the Mollie plan |
| [`sse-streaming-interpretations-and-call-time-logging.md`](sse-streaming-interpretations-and-call-time-logging.md) | Planned, not started |

## Implemented plans / historical

| Doc | Status |
|---|---|
| [`lean-prompt-migration-plan.md`](lean-prompt-migration-plan.md) | Implemented through Phase 4; Phase 5 (frontend) pending |
| [`deployment/mongodb-backup-design.md`](deployment/mongodb-backup-design.md) | Implemented; doubles as the backup runbook |
| [`database/migration-strategy.md`](database/migration-strategy.md) | Archived — fully implemented |
| [`prompts/prompt_architecture.md`](prompts/prompt_architecture.md) | Historical (superseded 2026-08-25) |
| [`prompts/scalable-openai.md`](prompts/scalable-openai.md) | Superseded — folded into the migration plan |
| [`make-intent-optional-and-client-decided.md`](make-intent-optional-and-client-decided.md) | Superseded same-day by full intent removal |

## Snapshots

- [`prompts/experiments/`](prompts/experiments/) — measured sample readings from the
  2026-09-01 lean-prompt experiment; the harness overwrites them in place if re-run.
- [`cards/`](cards/) — a 9-of-78 **sample** of generated card write-ups (mirror output
  of `scripts/card_meanings.py`), not a complete or hand-maintained set. The generator's
  JSON output files (`src/lib/cards/card_meanings/*.json`) were committed empty and have
  since been removed; a full card-meanings pipeline is in-progress work.
