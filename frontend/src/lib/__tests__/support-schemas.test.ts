import { describe, it, expect } from "vitest";
import {
  contactSupportSchema,
  SUPPORT_MESSAGE_MAX,
  SUPPORT_SUBJECT_MAX,
} from "@/lib/validation/support-schemas";

describe("contactSupportSchema", () => {
  const request = {
    subject: "Login trouble",
    message: "I cannot log in since yesterday, the page just reloads.",
  };

  it("accepts a valid request", () => {
    expect(contactSupportSchema.safeParse(request).success).toBe(true);
  });

  it("trims whitespace before validating and in the output", () => {
    const parsed = contactSupportSchema.safeParse({
      subject: "  Login trouble  ",
      message: `  ${request.message}  `,
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.subject).toBe("Login trouble");
      expect(parsed.data.message).toBe(request.message);
    }
  });

  it("bounds the subject to 3–200 chars", () => {
    expect(contactSupportSchema.safeParse({ ...request, subject: "Hi" }).success).toBe(false);
    expect(
      contactSupportSchema.safeParse({ ...request, subject: "a".repeat(SUPPORT_SUBJECT_MAX) })
        .success
    ).toBe(true);
    expect(
      contactSupportSchema.safeParse({
        ...request,
        subject: "a".repeat(SUPPORT_SUBJECT_MAX + 1),
      }).success
    ).toBe(false);
  });

  it("bounds the message to 10–5000 chars", () => {
    expect(
      contactSupportSchema.safeParse({ ...request, message: "Too short" }).success
    ).toBe(false);
    expect(
      contactSupportSchema.safeParse({ ...request, message: "a".repeat(SUPPORT_MESSAGE_MAX) })
        .success
    ).toBe(true);
    expect(
      contactSupportSchema.safeParse({
        ...request,
        message: "a".repeat(SUPPORT_MESSAGE_MAX + 1),
      }).success
    ).toBe(false);
  });

  it("rejects missing fields with per-field errors (what the action returns to the form)", () => {
    const parsed = contactSupportSchema.safeParse({});
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      const fieldErrors = parsed.error.flatten().fieldErrors;
      expect(fieldErrors.subject?.length).toBeGreaterThan(0);
      expect(fieldErrors.message?.length).toBeGreaterThan(0);
    }
  });

  it("pins the limits to the backend contract (docs/backend-contracts/support-tickets.md)", () => {
    // A change here must land in the contract doc too — the backend validates
    // the same bounds
    expect(SUPPORT_SUBJECT_MAX).toBe(200);
    expect(SUPPORT_MESSAGE_MAX).toBe(5000);
  });
});
