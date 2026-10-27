import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// The action talks to the API through publicFetch and reads the legal registry
// (a server-only module); both are replaced so the test exercises only the
// action's own decisions.
const publicFetch = vi.fn();
vi.mock("@/lib/api-client", () => ({ publicFetch: (...args: unknown[]) => publicFetch(...args) }));
vi.mock("@/lib/legal-documents", () => ({
  CURRENT_VERSIONS: { terms: "2026-10-04", privacy: "2026-10-13" },
}));

const { acceptInvite } = await import("@/app/accept-invite/actions");

const form = (overrides: Record<string, string | null> = {}) => {
  const data = new FormData();
  const fields: Record<string, string | null> = {
    token: "raw-token",
    firstName: "Ada",
    lastName: "Lovelace",
    password: "securepassword123",
    confirmPassword: "securepassword123",
    acceptTerms: "on",
    acceptPrivacy: "on",
    ...overrides,
  };
  for (const [key, value] of Object.entries(fields)) if (value !== null) data.set(key, value);
  return data;
};

describe("acceptInvite", () => {
  let registrationFlag: string | undefined;
  beforeEach(() => {
    registrationFlag = process.env.REGISTRATION_ENABLED;
    publicFetch.mockReset();
  });
  afterEach(() => {
    if (registrationFlag === undefined) delete process.env.REGISTRATION_ENABLED;
    else process.env.REGISTRATION_ENABLED = registrationFlag;
  });

  it("works with public registration closed: the flag is not consulted", async () => {
    process.env.REGISTRATION_ENABLED = "false";
    publicFetch.mockResolvedValue({ ok: true, data: { detail: "ready" } });

    const state = await acceptInvite({ success: false }, form());

    expect(state).toEqual({ success: true });
    expect(publicFetch).toHaveBeenCalledWith(
      "/api/v1/auth/accept-invite",
      expect.objectContaining({ method: "POST" })
    );
    const body = JSON.parse(publicFetch.mock.calls[0][1].body);
    expect(body).toEqual({
      token: "raw-token",
      password: "securepassword123",
      first_name: "Ada",
      last_name: "Lovelace",
      consents: { terms: "2026-10-04", privacy: "2026-10-13" },
    });
  });

  it("maps 400 and 410 to the dead-link panel", async () => {
    publicFetch.mockResolvedValueOnce({ ok: false, status: 400, message: "x" });
    expect(await acceptInvite({ success: false }, form())).toMatchObject({ tokenProblem: "invalid" });
    publicFetch.mockResolvedValueOnce({ ok: false, status: 410, message: "x" });
    expect(await acceptInvite({ success: false }, form())).toMatchObject({ tokenProblem: "expired" });
  });

  it("puts the backend's weak-password verdict on the password field", async () => {
    publicFetch.mockResolvedValue({
      ok: false,
      status: 422,
      message: "x",
      code: "weak_password",
      detail: "That password is too common.",
    });
    const state = await acceptInvite({ success: false, }, form());
    expect(state.fieldErrors?.password).toEqual(["That password is too common."]);
    expect(state.values).toEqual({ firstName: "Ada", lastName: "Lovelace", acceptTerms: true, acceptPrivacy: true });
  });

  it("fails validation locally without calling the API", async () => {
    const state = await acceptInvite({ success: false }, form({ acceptTerms: null }));
    expect(state.fieldErrors?.acceptTerms).toBeDefined();
    expect(publicFetch).not.toHaveBeenCalled();
  });
});
