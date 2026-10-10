import { describe, expect, it } from "vitest";
import { loginFailureState } from "@/lib/login-errors";

describe("loginFailureState", () => {
  it("maps 401 to bad-credentials copy, not the session-expired default", () => {
    const state = loginFailureState({ ok: false, status: 401, message: "Session expired." });
    expect(state).toEqual({ success: false, error: "Incorrect email or password." });
  });

  it("maps 403 + email_not_verified to the verify copy and flag", () => {
    const state = loginFailureState({
      ok: false,
      status: 403,
      message: "You do not have permission for this action.",
      code: "email_not_verified",
    });
    expect(state.success).toBe(false);
    expect(state.emailNotVerified).toBe(true);
    expect(state.error).toMatch(/confirm your email/i);
  });

  it("leaves a 403 without the code as the generic message", () => {
    const state = loginFailureState({ ok: false, status: 403, message: "Nope." });
    expect(state).toEqual({ success: false, error: "Nope." });
  });

  it("passes other failures through (429, network)", () => {
    const state = loginFailureState({ ok: false, status: 429, message: "Too many requests." });
    expect(state).toEqual({ success: false, error: "Too many requests." });
  });
});
