import { beforeEach, describe, expect, it, vi } from "vitest";

// The action talks to the API through publicFetch, reads the legal registry (a
// server-only module) and the registration flag; all three are replaced so the
// test exercises only the action's own decisions.
const publicFetch = vi.fn();
vi.mock("@/lib/api-client", () => ({ publicFetch: (...args: unknown[]) => publicFetch(...args) }));
vi.mock("@/lib/legal-documents", () => ({
  CURRENT_VERSIONS: { terms: "2026-10-04", privacy: "2026-10-13" },
}));
vi.mock("@/lib/feature-flags", () => ({ isRegistrationEnabled: () => true }));

const { register } = await import("@/app/user/register/actions");

const form = (overrides: Record<string, string | null> = {}) => {
  const data = new FormData();
  const fields: Record<string, string | null> = {
    firstName: "Ada",
    lastName: "Lovelace",
    birthDate: "1990-06-15",
    email: "ada@example.com",
    password: "securepassword123",
    confirmPassword: "securepassword123",
    acceptTerms: "on",
    acceptPrivacy: "on",
    ...overrides,
  };
  for (const [key, value] of Object.entries(fields)) if (value !== null) data.set(key, value);
  return data;
};

describe("register", () => {
  beforeEach(() => publicFetch.mockReset());

  it("posts the birth date with the names and the registry's consent versions", async () => {
    publicFetch.mockResolvedValue({ ok: true, data: { detail: "created" } });

    const state = await register({ success: false }, form());

    expect(state).toEqual({ success: true });
    expect(publicFetch).toHaveBeenCalledWith(
      "/api/v1/auth/register",
      expect.objectContaining({ method: "POST" })
    );
    const body = JSON.parse(publicFetch.mock.calls[0][1].body);
    expect(body).toEqual({
      email: "ada@example.com",
      password: "securepassword123",
      first_name: "Ada",
      last_name: "Lovelace",
      birth_date: "1990-06-15",
      consents: { terms: "2026-10-04", privacy: "2026-10-13" },
    });
  });

  it("echoes the typed birth date back on a validation failure, without calling the API", async () => {
    const state = await register({ success: false }, form({ acceptTerms: null }));

    expect(state.fieldErrors?.acceptTerms).toBeDefined();
    expect(state.values).toEqual({
      firstName: "Ada",
      lastName: "Lovelace",
      birthDate: "1990-06-15",
      email: "ada@example.com",
      acceptTerms: false,
      acceptPrivacy: true,
    });
    expect(publicFetch).not.toHaveBeenCalled();
  });

  it("puts a refused birth date on its own key", async () => {
    const state = await register({ success: false }, form({ birthDate: "1899-01-01" }));

    expect(state.fieldErrors?.birthDate).toBeDefined();
    expect(state.values?.birthDate).toBe("1899-01-01");
    expect(publicFetch).not.toHaveBeenCalled();
  });
});
