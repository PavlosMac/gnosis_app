import { z } from "zod";

// These limits are a contract with the backend — keep in sync with
// docs/backend-contracts/support-tickets.md (the endpoint validates the same bounds)
export const SUPPORT_SUBJECT_MAX = 200;
export const SUPPORT_MESSAGE_MAX = 5000;

const subjectField = z
  .string()
  .trim()
  .min(3, "Subject must be at least 3 characters")
  .max(SUPPORT_SUBJECT_MAX, `Subject must be at most ${SUPPORT_SUBJECT_MAX} characters`);

const messageField = z
  .string()
  .trim()
  .min(10, "Please describe your issue in at least 10 characters")
  .max(SUPPORT_MESSAGE_MAX, `Message must be at most ${SUPPORT_MESSAGE_MAX} characters`);

export const contactSupportSchema = z.object({
  subject: subjectField,
  message: messageField,
});

export type ContactSupportInput = z.infer<typeof contactSupportSchema>;
