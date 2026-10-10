# Legal documents

Versioned Terms and Conditions (`terms/`) and Privacy Policy (`privacy/`).
**Drafts for review by a lawyer in the operator's jurisdiction, not legal advice.**

## Versioning rule

- A document's **version is its filename**: the effective date as an ISO string
  (`2026-10-04.mdx`). Nothing else declares a version.
- The **current version** is the lexicographically last filename in the folder
  (ISO dates sort as plain strings).
- A **substantive change** is a new dated file. Never edit an older file's meaning:
  `/legal/<doc>/<date>` must always show exactly what a user accepted on that date.
- **Typo and formatting fixes** may be made in place without a new date.
- Filenames must match `YYYY-MM-DD.mdx`. Any other `.mdx` file in these folders fails
  the build, so a stray file can never become "current".

## Adding a version

1. Copy the newest file to a new date, e.g. `terms/2026-11-01.mdx`, and edit it.
2. Run `npm run legal:registry` (also runs automatically before `dev`, `build` and `test`).
   It rewrites `src/lib/legal-registry.generated.ts`, the static import map the app
   loads documents through. Commit that file with the new document.

Every user whose accepted version is now behind is sent to `/accept-terms` on their
next visit to `/user/*`, and their profile shows the new version once accepted.

## Before publishing

Filled in on 2026-10-10: controller (a private individual in Sweden), contact email,
Swedish governing law, the Swedish supervisory authority, and the transfer mechanisms
(OpenAI: Standard Contractual Clauses via OpenAI Ireland; Resend: Data Privacy Framework
plus Standard Contractual Clauses). Keep the data-processing agreements with both
providers on file. The texts remain drafts for review by a lawyer.
