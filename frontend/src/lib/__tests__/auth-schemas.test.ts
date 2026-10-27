import { describe, expect, it } from "vitest";
import {
  acceptInviteSchema,
  deleteAccountSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
  resendVerificationSchema,
  verifyEmailSchema,
} from "@/lib/validation/auth-schemas";

const VALID = {
  firstName: "Ada",
  lastName: "Lovelace",
  email: "ada@example.com",
  password: "securepassword123",
  confirmPassword: "securepassword123",
  acceptTerms: "on",
  acceptPrivacy: "on",
};

const fieldErrors = (input: unknown) => {
  const parsed = registerSchema.safeParse(input);
  return parsed.success ? {} : parsed.error.flatten().fieldErrors;
};

describe("registerSchema", () => {
  it("accepts a complete form", () => {
    expect(registerSchema.safeParse(VALID).success).toBe(true);
  });

  it("trims and lower-cases the email to mirror the backend", () => {
    const parsed = registerSchema.parse({ ...VALID, email: "  Ada@Example.COM " });
    expect(parsed.email).toBe("ada@example.com");
  });

  it("requires both names, trimmed, 1-100 characters", () => {
    expect(fieldErrors({ ...VALID, firstName: "   " }).firstName).toBeDefined();
    expect(fieldErrors({ ...VALID, lastName: null }).lastName).toBeDefined();
    expect(fieldErrors({ ...VALID, firstName: "x".repeat(101) }).firstName).toBeDefined();
    expect(registerSchema.parse({ ...VALID, firstName: "  Ada " }).firstName).toBe("Ada");
  });

  it("puts an unticked box's error on its own key", () => {
    // An unticked checkbox is absent from FormData, so formData.get() is null
    const terms = fieldErrors({ ...VALID, acceptTerms: null });
    expect(terms.acceptTerms).toEqual(["You must accept the Terms and Conditions"]);
    expect(terms.acceptPrivacy).toBeUndefined();

    const privacy = fieldErrors({ ...VALID, acceptPrivacy: null });
    expect(privacy.acceptPrivacy).toEqual(["You must confirm you have read the Privacy Policy"]);
    expect(privacy.acceptTerms).toBeUndefined();
  });

  it("still reports mismatched passwords on confirmPassword", () => {
    expect(fieldErrors({ ...VALID, confirmPassword: "different123" }).confirmPassword).toEqual([
      "Passwords do not match",
    ]);
  });

  it("has no displayName field any more", () => {
    expect("displayName" in registerSchema.parse({ ...VALID, displayName: "x" })).toBe(false);
  });
});

describe("password policy on registerSchema and resetPasswordSchema", () => {
  const withPassword = (password: string) => ({ ...VALID, password, confirmPassword: password });

  it("requires 12 characters", () => {
    expect(fieldErrors(withPassword("k7#vQ2m!x9p")).password).toEqual([
      "Password must be at least 12 characters",
    ]);
    expect(registerSchema.safeParse(withPassword("k7#vQ2m!x9pZ")).success).toBe(true);
  });

  it("refuses a password containing the user's name or email, on the password key", () => {
    for (const password of ["plum-ADA-harbour-42", "my-lovelace-harbour", "ada-is-my-email-42"]) {
      expect(fieldErrors(withPassword(password)).password).toEqual([
        "Password must not contain your name or email address",
      ]);
    }
  });

  it("applies the same length to a password reset", () => {
    const reset = (password: string) =>
      resetPasswordSchema.safeParse({ token: "t", password, confirmPassword: password });
    expect(reset("k7#vQ2m!x9p").success).toBe(false);
    expect(reset("k7#vQ2m!x9pZ").success).toBe(true);
  });
});

describe("loginSchema", () => {
  it("still accepts an 8-character password, so older accounts can sign in", () => {
    expect(loginSchema.safeParse({ email: "a@b.com", password: "12345678" }).success).toBe(true);
  });

  it("normalises the email the same way", () => {
    expect(loginSchema.parse({ email: " A@B.com ", password: "12345678" }).email).toBe("a@b.com");
  });

  it("caps the password at the backend's length", () => {
    const login = (password: string) => loginSchema.safeParse({ email: "a@b.com", password });
    expect(login("x".repeat(128)).success).toBe(true);
    expect(login("x".repeat(129)).success).toBe(false);
  });
});

describe("verifyEmailSchema", () => {
  it("requires a token", () => {
    expect(verifyEmailSchema.safeParse({ token: "abc" }).success).toBe(true);
    expect(verifyEmailSchema.safeParse({ token: "" }).success).toBe(false);
    expect(verifyEmailSchema.safeParse({ token: null }).success).toBe(false);
  });
});

describe("resendVerificationSchema", () => {
  it("validates and normalises the email", () => {
    expect(resendVerificationSchema.parse({ email: "Ada@Example.com" }).email).toBe(
      "ada@example.com"
    );
    expect(resendVerificationSchema.safeParse({ email: "nope" }).success).toBe(false);
  });
});

describe("deleteAccountSchema", () => {
  it("accepts a password with the literal confirmation", () => {
    expect(
      deleteAccountSchema.safeParse({ password: "securepassword123", confirm: "DELETE" }).success
    ).toBe(true);
  });

  it("rejects any other confirmation text with a field error", () => {
    for (const confirm of ["delete", "DELETE ", "", null]) {
      const parsed = deleteAccountSchema.safeParse({ password: "securepassword123", confirm });
      expect(parsed.success).toBe(false);
      if (!parsed.success) {
        expect(parsed.error.flatten().fieldErrors.confirm).toEqual([
          "Type DELETE to confirm",
        ]);
      }
    }
  });

  it("requires the password", () => {
    const parsed = deleteAccountSchema.safeParse({ password: "", confirm: "DELETE" });
    expect(parsed.success).toBe(false);
  });
});

describe("acceptInviteSchema", () => {
  const VALID_INVITE = {
    token: "raw-token",
    firstName: "Ada",
    lastName: "Lovelace",
    password: "securepassword123",
    confirmPassword: "securepassword123",
    acceptTerms: "on",
    acceptPrivacy: "on",
  };
  const inviteErrors = (input: unknown) => {
    const parsed = acceptInviteSchema.safeParse(input);
    return parsed.success ? {} : parsed.error.flatten().fieldErrors;
  };

  it("is the register form without an email, plus the token", () => {
    expect(acceptInviteSchema.safeParse(VALID_INVITE).success).toBe(true);
    expect(inviteErrors({ ...VALID_INVITE, token: "" }).token).toBeDefined();
    expect("email" in acceptInviteSchema.shape).toBe(false);
  });

  it("keeps the register rules: names, consents, matching passwords, no personal info", () => {
    expect(inviteErrors({ ...VALID_INVITE, firstName: "  " }).firstName).toBeDefined();
    expect(inviteErrors({ ...VALID_INVITE, acceptTerms: null }).acceptTerms).toBeDefined();
    expect(inviteErrors({ ...VALID_INVITE, acceptPrivacy: null }).acceptPrivacy).toBeDefined();
    expect(inviteErrors({ ...VALID_INVITE, confirmPassword: "other-password-1" }).confirmPassword)
      .toEqual(["Passwords do not match"]);
    expect(
      inviteErrors({ ...VALID_INVITE, password: "lovelace-rocks-1", confirmPassword: "lovelace-rocks-1" })
        .password
    ).toBeDefined();
  });
});
