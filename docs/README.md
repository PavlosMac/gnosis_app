# Docs index

This is a monorepo: backend and frontend keep their own docs trees.

- [`backend/docs/`](../backend/docs/) — API, database, migrations, prompts,
  deployment. Start at `backend/CLAUDE.md`.
- [`frontend/docs/`](../frontend/docs/) — UI/UX and feature docs. Start at
  `frontend/CLAUDE.md`.

Cross-cutting docs that span both sides live here:

- [`user_accounting.md`](user_accounting.md): how a user's LLM spend is priced, reserved,
  debited and displayed; every file involved, known gaps, and the agreed direction. Read before
  any ledger or budget work.
