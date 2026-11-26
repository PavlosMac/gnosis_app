import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// A cookie jar standing in for `await cookies()`. In the render phase Next seals
// the jar: `set` throws "Cookies can only be modified in a Server Action or Route
// Handler". In a server action it writes.
const jar = new Map<string, string>();
let renderPhase = false;
const cookieStore = {
  get: (name: string) => (jar.has(name) ? { value: jar.get(name)! } : undefined),
  set: (name: string, value: string) => {
    if (renderPhase)
      throw new Error("Cookies can only be modified in a Server Action or Route Handler.");
    jar.set(name, value);
  },
};
vi.mock("next/headers", () => ({
  cookies: async () => cookieStore,
  headers: async () => new Headers(),
}));

process.env.GNOSIS_API_BASE_URL = "http://api.test";
const { authenticatedFetch } = await import("@/lib/api-client");

const NOW = Math.floor(Date.now() / 1000);
const ROTATED = {
  access_token: "A2",
  refresh_token: "R2",
  access_token_expires_at: NOW + 3600,
  refresh_token_expires_at: NOW + 86400,
};

const fetchMock = vi.fn();
const calledUrls = () => fetchMock.mock.calls.map(([url]) => String(url));
const REFRESH = "http://api.test/api/v1/auth/refresh";
const ME = "http://api.test/api/v1/auth/me";

beforeEach(() => {
  jar.clear();
  jar.set("refresh_token", "R1");
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  vi.spyOn(console, "log").mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

// The proxy refreshes an expired access cookie before any render or server
// action runs (every page and action request passes through it). A missing
// access cookie here therefore means the proxy already decided there is no
// session, so the client never spends the single-use refresh token itself.
describe("authenticatedFetch with no access cookie", () => {
  it("answers unauthenticated without touching the refresh token (render)", async () => {
    renderPhase = true;

    const result = await authenticatedFetch("/api/v1/auth/me");

    expect(result).toMatchObject({ ok: false, status: 401, unauthenticated: true });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(jar.get("refresh_token")).toBe("R1");
  });

  it("answers unauthenticated without touching the refresh token (server action)", async () => {
    renderPhase = false;

    const result = await authenticatedFetch("/api/v1/readings", { method: "POST" });

    expect(result).toMatchObject({ ok: false, status: 401, unauthenticated: true });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

// The access cookie is present but the backend refuses it: the token expired in
// the moments since the proxy saw it. That is the one refresh the client makes.
describe("authenticatedFetch when the backend answers 401 to the access token", () => {
  beforeEach(() => jar.set("access_token", "A1"));

  it("in a server action: refreshes, persists the rotated cookies and retries", async () => {
    renderPhase = false;
    fetchMock
      .mockResolvedValueOnce(new Response("", { status: 401 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(ROTATED), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ _id: "u1" }), { status: 200 }));

    const result = await authenticatedFetch<{ _id: string }>("/api/v1/auth/me");

    expect(result).toEqual({ ok: true, data: { _id: "u1" } });
    expect(calledUrls()).toEqual([ME, REFRESH, ME]);
    expect(jar.get("access_token")).toBe("A2");
    expect(jar.get("refresh_token")).toBe("R2");
  });

  // A render cannot send Set-Cookie. A refresh that cannot be persisted must not
  // be presented as a session: the page would say "logged in" with a token the
  // browser will never hold.
  it("in a render: a refresh that cannot be persisted is no session", async () => {
    renderPhase = true;
    fetchMock
      .mockResolvedValueOnce(new Response("", { status: 401 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(ROTATED), { status: 200 }));

    const result = await authenticatedFetch("/api/v1/auth/me");

    expect(result).toMatchObject({ ok: false, status: 401, unauthenticated: true });
    expect(calledUrls()).toEqual([ME, REFRESH]);
    expect(jar.get("refresh_token")).toBe("R1");
  });

  it("when the refresh is refused too: unauthenticated", async () => {
    renderPhase = false;
    fetchMock
      .mockResolvedValueOnce(new Response("", { status: 401 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ detail: "revoked" }), { status: 401 }));

    const result = await authenticatedFetch("/api/v1/auth/me");

    expect(result).toMatchObject({ ok: false, status: 401, unauthenticated: true });
  });
});

describe("authenticatedFetch with a valid access cookie", () => {
  it("calls the API with the bearer token and no refresh", async () => {
    renderPhase = true;
    jar.set("access_token", "A1");
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ _id: "u1" }), { status: 200 }));

    const result = await authenticatedFetch<{ _id: string }>("/api/v1/auth/me");

    expect(result).toEqual({ ok: true, data: { _id: "u1" } });
    expect(calledUrls()).toEqual([ME]);
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe("Bearer A1");
  });

  it("reports a backend outage as a plain failure, not as a lost session", async () => {
    jar.set("access_token", "A1");
    fetchMock.mockResolvedValueOnce(new Response("Bad Gateway", { status: 502 }));

    const result = await authenticatedFetch("/api/v1/auth/me");

    expect(result).toMatchObject({ ok: false, status: 502 });
    expect(result).not.toHaveProperty("unauthenticated");
  });
});
