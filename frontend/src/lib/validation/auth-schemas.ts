import { z } from "zod";

// Shared field rules — every auth schema draws from these so a policy change
// (length, message) lands in one place and login/register/reset can't drift
const emailField = z.string().email("Please enter a valid email address");

const passwordField = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(128, "Password must be at most 128 characters");

const passwordsMatch = (data: { password: string; confirmPassword: string }) =>
  data.password === data.confirmPassword;
const PASSWORDS_MATCH = { message: "Passwords do not match", path: ["confirmPassword"] };

export const loginSchema = z.object({
  email: emailField,
  // Login only checks the floor — the ceiling is enforced at registration
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export const registerSchema = z
  .object({
    email: emailField,
    password: passwordField,
    confirmPassword: z.string(),
    displayName: z.string().trim().min(1, "Display name cannot be blank").max(100, "Display name must be at most 100 characters").optional(),
  })
  .refine(passwordsMatch, PASSWORDS_MATCH);

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

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
