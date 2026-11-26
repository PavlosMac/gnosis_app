import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

process.env.GNOSIS_API_BASE_URL = "http://api.test";

const { proxy } = await import("@/proxy");

const NOW = Math.floor(Date.now() / 1000);
const ROTATED = {
  access_token: "A2",
  refresh_token: "R2",
  access_token_expires_at: NOW + 3600,
  refresh_token_expires_at: NOW + 86400,
};
const COOKIE_NAMES = ["access_token", "refresh_token", "token_expires_at"];

const fetchMock = vi.fn();

const request = (path: string, cookie?: string) =>
  new NextRequest(`http://localhost:3000${path}`, {
    headers: cookie ? { cookie } : {},
  });

const json = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const refreshSucceeds = () => fetchMock.mockResolvedValue(json(ROTATED, 200));
const refreshDead = () => fetchMock.mockResolvedValue(json({ detail: "Token has been revoked" }, 401));
const refreshLostRace = () =>
  fetchMock.mockResolvedValue(json({ detail: "Token has been rotated", code: "refresh_rotated" }, 401));
const refreshDown = () => fetchMock.mockResolvedValue(new Response("Bad Gateway", { status: 502 }));
const refreshThrows = () => fetchMock.mockRejectedValue(new TypeError("fetch failed"));

const isPassThrough = (res: Response) => res.headers.get("x-middleware-next") === "1";
const expectRotatedCookies = (res: Awaited<ReturnType<typeof proxy>>) => {
  expect(res.cookies.get("access_token")?.value).toBe("A2");
  expect(res.cookies.get("refresh_token")?.value).toBe("R2");
  expect(res.cookies.get("token_expires_at")?.value).toBe(String(ROTATED.access_token_expires_at));
};
const expectClearedCookies = (res: Awaited<ReturnType<typeof proxy>>) => {
  for (const name of COOKIE_NAMES) {
    expect(res.cookies.get(name)?.value).toBe("");
    expect(res.cookies.get(name)?.maxAge).toBe(0);
  }
};
const expectUntouchedCookies = (res: Awaited<ReturnType<typeof proxy>>) => {
  for (const name of COOKIE_NAMES) expect(res.cookies.get(name)).toBeUndefined();
};

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  vi.spyOn(console, "log").mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("proxy on public pages", () => {
  it("lets a visitor with no cookies through without calling the backend", async () => {
    const res = await proxy(request("/reading"));

    expect(isPassThrough(res)).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("refreshes an expired access token where the rotated cookies can be persisted", async () => {
    refreshSucceeds();

    const res = await proxy(request("/reading", "refresh_token=R1"));

    expect(isPassThrough(res)).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(
      "http://api.test/api/v1/auth/refresh",
      expect.objectContaining({ method: "POST", body: JSON.stringify({ refresh_token: "R1" }) })
    );
    expectRotatedCookies(res);
  });

  it("renders a dead session as a visitor: cookies cleared, no redirect", async () => {
    refreshDead();

    const res = await proxy(request("/reading", "refresh_token=R1"));

    expect(isPassThrough(res)).toBe(true);
    expectClearedCookies(res);
  });

  it("covers the landing page too", async () => {
    refreshSucceeds();

    const res = await proxy(request("/", "refresh_token=R1"));

    expect(isPassThrough(res)).toBe(true);
    expectRotatedCookies(res);
  });
});

describe("proxy when the refresh does not settle the question", () => {
  it("keeps the cookies when the backend is down (public page)", async () => {
    refreshDown();

    const res = await proxy(request("/reading", "refresh_token=R1"));

    expect(isPassThrough(res)).toBe(true);
    expectUntouchedCookies(res);
  });

  it("keeps the cookies when the backend is down (guarded page), without a redirect", async () => {
    refreshDown();

    const res = await proxy(request("/user/profile", "refresh_token=R1"));

    expect(isPassThrough(res)).toBe(true);
    expectUntouchedCookies(res);
  });

  it("keeps the cookies when the backend cannot be reached", async () => {
    refreshThrows();

    const res = await proxy(request("/user/profile", "refresh_token=R1"));

    expect(isPassThrough(res)).toBe(true);
    expectUntouchedCookies(res);
  });

  it("keeps the cookies when a parallel request won the rotation (refresh_rotated)", async () => {
    refreshLostRace();

    const res = await proxy(request("/user/readings", "refresh_token=R1"));

    expect(isPassThrough(res)).toBe(true);
    expectUntouchedCookies(res);
  });
});

describe("proxy on guarded pages", () => {
  it("sends a visitor with no cookies to login", async () => {
    const res = await proxy(request("/user/profile"));

    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("http://localhost:3000/user/login?from=%2Fuser%2Fprofile");
  });

  it("refreshes and continues when the refresh token is live", async () => {
    refreshSucceeds();

    const res = await proxy(request("/user/profile", "refresh_token=R1"));

    expect(isPassThrough(res)).toBe(true);
    expectRotatedCookies(res);
  });

  it("clears the cookies and redirects to login when the session is dead", async () => {
    refreshDead();

    const res = await proxy(request("/user/profile", "refresh_token=R1"));

    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("http://localhost:3000/user/login?from=%2Fuser%2Fprofile");
    expectClearedCookies(res);
  });

  it("refreshes proactively when the access token is about to expire", async () => {
    refreshSucceeds();
    const soon = NOW + 5;

    const res = await proxy(
      request("/user/profile", `access_token=A1; refresh_token=R1; token_expires_at=${soon}`)
    );

    expect(isPassThrough(res)).toBe(true);
    expectRotatedCookies(res);
  });
});

describe("proxy on the login page", () => {
  it("sends a logged-in user to the profile", async () => {
    const res = await proxy(request("/user/login", "access_token=A1; refresh_token=R1"));

    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("http://localhost:3000/user/profile");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("refreshes a user whose access token expired, then sends them to the profile", async () => {
    refreshSucceeds();

    const res = await proxy(request("/user/login", "refresh_token=R1"));

    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("http://localhost:3000/user/profile");
    expectRotatedCookies(res);
  });

  it("shows the login page to a dead session, cookies cleared", async () => {
    refreshDead();

    const res = await proxy(request("/user/login", "refresh_token=R1"));

    expect(isPassThrough(res)).toBe(true);
    expectClearedCookies(res);
  });

  it("shows the login page while the backend is down, cookies kept (no redirect loop)", async () => {
    refreshDown();

    const res = await proxy(request("/user/login", "refresh_token=R1"));

    expect(isPassThrough(res)).toBe(true);
    expectUntouchedCookies(res);
  });
});
