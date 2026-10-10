// Wording constants that mirror backend settings (backend/src/core/config.py):
// email_verification_token_ttl_hours and pending_account_ttl_days. The backend
// enforces them; these only keep the on-screen copy honest. Change both together.
export const VERIFICATION_LINK_TTL_HOURS = 24;
export const PENDING_ACCOUNT_RETENTION_DAYS = 7;
