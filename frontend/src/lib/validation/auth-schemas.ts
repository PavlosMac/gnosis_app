import { z } from "zod";
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
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type VerifyEmailInput = z.infer<typeof verifyEmailSchema>;
export type ResendVerificationInput = z.infer<typeof resendVerificationSchema>;
export type DeleteAccountInput = z.infer<typeof deleteAccountSchema>;
