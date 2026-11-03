import { z } from "zod";
import { isValidDate } from "@/lib/dateValidation";
import {
  MAX_PASSWORD_LENGTH,
  MIN_PASSWORD_LENGTH,
  PERSONAL_INFO_MESSAGE,
  containsPersonalInfo,
} from "@/lib/password-policy";

// Shared field rules — every auth schema draws from these so a policy change
// (length, message) lands in one place and login/register/reset can't drift
// Trimmed and lower-cased to mirror the backend, which stores and looks up
// emails case-folded
const emailField = z
  .string()
  .trim()
  .toLowerCase()
  .email("Please enter a valid email address");

const nameField = (label: string) =>
  z
    .string({ error: `${label} is required` })
    .trim()
    .min(1, `${label} is required`)
    .max(100, `${label} must be at most 100 characters`);

// Required at sign-up; the backend applies the same rules (BirthDate in
// backend/src/auth/schemas.py) but the frontend drops its 422 detail, so every
// message the user sees comes from here. A date input posts "YYYY-MM-DD".
export const MIN_ACCOUNT_AGE_YEARS = 18;
export const MIN_BIRTH_YEAR = 1900;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const UNDERAGE_MESSAGE = `You must be ${MIN_ACCOUNT_AGE_YEARS} or older to create an account`;

const dateParts = (iso: string) => {
  const [year, month, day] = iso.split("-").map(Number);
  return { year, month, day };
};

// Local calendar dates, so the comparison matches what the user typed rather
// than a UTC shift of it. Born on Feb 29: comes of age on Mar 1 of a common year
// (new Date rolls Feb 29 forward on its own).
const isUnderage = (iso: string, today: Date) => {
  const { year, month, day } = dateParts(iso);
  const eighteenth = new Date(year + MIN_ACCOUNT_AGE_YEARS, month - 1, day);
  return eighteenth > today;
};

// One check reporting the first problem: zod 4 runs every check even after an
// earlier one failed, and a blank field must show one message, not five
export const birthDateProblem = (iso: string, today = new Date()): string | null => {
  if (!iso) return "Date of birth is required";
  if (!ISO_DATE.test(iso)) return "Enter your date of birth as a full date";
  const { year, month, day } = dateParts(iso);
  // Before isValidDate: new Date(50, 0, 1) is 1950, so years 0001-0099 would
  // otherwise be reported as "not a real date"
  if (year < MIN_BIRTH_YEAR) return `Year must be ${MIN_BIRTH_YEAR} or later`;
  if (!isValidDate(day, month, year)) return "That is not a real date";
  if (new Date(year, month - 1, day) > today) return "Date of birth cannot be in the future";
  if (isUnderage(iso, today)) return UNDERAGE_MESSAGE;
  return null;
};

const birthDateField = z
  .string({ error: "Date of birth is required" })
  .superRefine((iso, ctx) => {
    const message = birthDateProblem(iso);
    if (message) ctx.addIssue({ code: "custom", message });
  });

// A ticked checkbox posts "on"; an unticked one is absent (null from FormData)
const tickedBox = (message: string) => z.literal("on", { error: message });

// New passwords only (register, reset). The backend applies the same length and
// adds a common-password blocklist — see lib/password-policy.ts
const passwordField = z
  .string()
  .min(MIN_PASSWORD_LENGTH, `Password must be at least ${MIN_PASSWORD_LENGTH} characters`)
  .max(MAX_PASSWORD_LENGTH, `Password must be at most ${MAX_PASSWORD_LENGTH} characters`);

const passwordsMatch = (data: { password: string; confirmPassword: string }) =>
  data.password === data.confirmPassword;
const PASSWORDS_MATCH = { message: "Passwords do not match", path: ["confirmPassword"] };

export const loginSchema = z.object({
  email: emailField,
  // Login only checks the old 8-character floor, never the current policy —
  // accounts created before the minimum rose to 12 must still be able to sign in.
  // The cap matches the backend's, which rejects anything longer with a 422
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(MAX_PASSWORD_LENGTH, `Password must be at most ${MAX_PASSWORD_LENGTH} characters`),
});

export const registerSchema = z
  .object({
    firstName: nameField("First name"),
    lastName: nameField("Last name"),
    birthDate: birthDateField,
    email: emailField,
    password: passwordField,
    confirmPassword: z.string(),
    acceptTerms: tickedBox("You must accept the Terms and Conditions"),
    // An acknowledgement of notice, not consent: the lawful basis for account
    // data is the contract, so the wording is "read", never "consent to"
    acceptPrivacy: tickedBox("You must confirm you have read the Privacy Policy"),
  })
  .refine(passwordsMatch, PASSWORDS_MATCH)
  .refine((data) => !containsPersonalInfo(data.password, data), {
    message: PERSONAL_INFO_MESSAGE,
    path: ["password"],
  });

// The invite's address is fixed by the token on the backend, so the form has no
// email field; the token is the credential (like reset-password).
export const acceptInviteSchema = z
  .object({
    token: z.string().min(1, "Missing invitation token"),
    firstName: nameField("First name"),
    lastName: nameField("Last name"),
    birthDate: birthDateField,
    password: passwordField,
    confirmPassword: z.string(),
    acceptTerms: tickedBox("You must accept the Terms and Conditions"),
    acceptPrivacy: tickedBox("You must confirm you have read the Privacy Policy"),
  })
  .refine(passwordsMatch, PASSWORDS_MATCH)
  .refine((data) => !containsPersonalInfo(data.password, data), {
    message: PERSONAL_INFO_MESSAGE,
    path: ["password"],
  });

export const forgotPasswordSchema = z.object({
  email: emailField,
});

export const resetPasswordSchema = z
  .object({
    token: z.string().min(1, "Missing reset token"),
    password: passwordField,
    confirmPassword: z.string(),
  })
  .refine(passwordsMatch, PASSWORDS_MATCH);

export const verifyEmailSchema = z.object({
  token: z.string().min(1, "Missing verification token"),
});

export const resendVerificationSchema = z.object({
  email: emailField,
});

export const deleteAccountSchema = z.object({
  password: z
    .string()
    .min(1, "Enter your password to confirm")
    .max(MAX_PASSWORD_LENGTH, `Password must be at most ${MAX_PASSWORD_LENGTH} characters`),
  // Type-to-confirm: deletion is irreversible, so a checkbox is not enough
  confirm: z.literal("DELETE", { error: "Type DELETE to confirm" }),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type AcceptInviteInput = z.infer<typeof acceptInviteSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type VerifyEmailInput = z.infer<typeof verifyEmailSchema>;
export type ResendVerificationInput = z.infer<typeof resendVerificationSchema>;
export type DeleteAccountInput = z.infer<typeof deleteAccountSchema>;
