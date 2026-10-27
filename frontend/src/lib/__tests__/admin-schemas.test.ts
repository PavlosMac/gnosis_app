import { describe, expect, it } from "vitest";
import {
  ADMIN_MESSAGE_MAX,
  ADMIN_SUBJECT_MAX,
  deleteUserSchema,
  emailUserSchema,
  inviteUserSchema,
} from "@/lib/validation/admin-schemas";

const USER_ID = "64b7f0c2e4b0a1b2c3d4e5f6";

describe("inviteUserSchema", () => {
  it("trims and lower-cases the email to mirror the backend", () => {
    expect(inviteUserSchema.parse({ email: "  Guest@Example.COM " })).toEqual({
      email: "guest@example.com",
    });
  });

  it("rejects a non-address", () => {
    expect(inviteUserSchema.safeParse({ email: "not-an-email" }).success).toBe(false);
  });
});

describe("emailUserSchema", () => {
  const VALID = { userId: USER_ID, subject: "A word", message: "Hello there." };

  it("accepts a subject and a message for a user", () => {
    expect(emailUserSchema.safeParse(VALID).success).toBe(true);
  });

  it("requires a non-blank subject and message within the backend's limits", () => {
    const errors = (input: unknown) => {
      const parsed = emailUserSchema.safeParse(input);
      return parsed.success ? {} : parsed.error.flatten().fieldErrors;
    };
    expect(errors({ ...VALID, subject: "   " }).subject).toBeDefined();
    expect(errors({ ...VALID, message: "" }).message).toBeDefined();
    expect(errors({ ...VALID, subject: "x".repeat(ADMIN_SUBJECT_MAX + 1) }).subject).toBeDefined();
    expect(errors({ ...VALID, message: "x".repeat(ADMIN_MESSAGE_MAX + 1) }).message).toBeDefined();
    expect(errors({ ...VALID, userId: "" }).userId).toBeDefined();
  });
});

describe("deleteUserSchema", () => {
  it("is type-to-confirm, like self-service deletion", () => {
    expect(deleteUserSchema.safeParse({ userId: USER_ID, confirm: "DELETE" }).success).toBe(true);
    const parsed = deleteUserSchema.safeParse({ userId: USER_ID, confirm: "delete" });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.flatten().fieldErrors.confirm).toEqual(["Type DELETE to confirm"]);
    }
  });
});
