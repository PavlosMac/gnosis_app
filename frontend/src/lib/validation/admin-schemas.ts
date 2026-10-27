import { z } from "zod";

// These limits are a contract with the backend (AdminMessageRequest in
// backend/src/users/schemas.py) — keep in sync with
// docs/reference/admin/user-management.md
export const ADMIN_SUBJECT_MAX = 200;
export const ADMIN_MESSAGE_MAX = 5000;

// Trimmed and lower-cased to mirror the backend, which stores emails case-folded
const emailField = z
  .string()
  .trim()
  .toLowerCase()
  .email("Please enter a valid email address");

const userIdField = z.string().min(1, "Missing user");

export const inviteUserSchema = z.object({
  email: emailField,
});

export const emailUserSchema = z.object({
  userId: userIdField,
  subject: z
    .string()
    .trim()
    .min(1, "Subject is required")
    .max(ADMIN_SUBJECT_MAX, `Subject must be at most ${ADMIN_SUBJECT_MAX} characters`),
  message: z
    .string()
    .trim()
    .min(1, "Message is required")
    .max(ADMIN_MESSAGE_MAX, `Message must be at most ${ADMIN_MESSAGE_MAX} characters`),
});

export const deleteUserSchema = z.object({
  userId: userIdField,
  // Type-to-confirm, as on the user's own delete-account page
  confirm: z.literal("DELETE", { error: "Type DELETE to confirm" }),
});

export type InviteUserInput = z.infer<typeof inviteUserSchema>;
export type EmailUserInput = z.infer<typeof emailUserSchema>;
export type DeleteUserInput = z.infer<typeof deleteUserSchema>;
