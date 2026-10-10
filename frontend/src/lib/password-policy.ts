// The part of the password policy the frontend can check on its own. The full
// policy (including the common-password blocklist) lives in the backend,
// backend/src/core/password_policy.py, which answers 422 with code
// "weak_password" and a user-facing message. Keep these constants in step with it.

export const MIN_PASSWORD_LENGTH = 12;
export const MAX_PASSWORD_LENGTH = 128;

/** Error code of a backend refusal whose `detail` is safe to show the user */
export const WEAK_PASSWORD = "weak_password";

export const PASSWORD_HINT = `At least ${MIN_PASSWORD_LENGTH} characters. Avoid common passwords and your own name or email.`;

export const PERSONAL_INFO_MESSAGE = "Password must not contain your name or email address";

// Shorter name parts ("Li", an initial) would match almost any password
const MIN_PERSONAL_PART_LENGTH = 3;

interface PersonalContext {
  email?: string | null;
  firstName?: string | null;
  lastName?: string | null;
}

/** True when the password contains the email's local part or either name
    (case-insensitive) — mirrors the backend rule */
export const containsPersonalInfo = (
  password: string,
  { email, firstName, lastName }: PersonalContext
): boolean => {
  const folded = password.toLowerCase();
  return [(email ?? "").split("@")[0], firstName ?? "", lastName ?? ""]
    .map((part) => part.trim().toLowerCase())
    .filter((part) => part.length >= MIN_PERSONAL_PART_LENGTH)
    .some((part) => folded.includes(part));
};
