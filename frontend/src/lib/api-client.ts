import { cookies } from "next/headers";
import type { ApiResult } from "@/types/api";

const ACCESS_TOKEN_MAX_AGE = 60 * 15; // 15 minutes
const REFRESH_TOKEN_MAX_AGE = 60 * 60 * 24 * 7; // 7 days
const PROACTIVE_REFRESH_THRESHOLD = 60 * 2; // refresh when < 2 minutes remain

const FASTAPI_URL = () => {
  const url = process.env.FASTAPI_URL;
  if (!url) throw new Error("FASTAPI_URL environment variable is not set");
  return url;
};

const setAuthCookies = async (accessToken: string, refreshToken: string) => {
  const cookieStore = await cookies();
  const isProduction = process.env.NODE_ENV === "production";
  const expiresAt = Math.floor(Date.now() / 1000) + ACCESS_TOKEN_MAX_AGE;

  console.log("[AUTH:COOKIES] Setting auth cookies", { isProduction });

  cookieStore.set("access_token", accessToken, {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax",
    path: "/",
    maxAge: ACCESS_TOKEN_MAX_AGE,
  });

  cookieStore.set("refresh_token", refreshToken, {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax",
    path: "/",
    maxAge: REFRESH_TOKEN_MAX_AGE,
  });

  // Non-sensitive timestamp for proactive refresh checks
  cookieStore.set("token_expires_at", String(expiresAt), {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax",
    path: "/",
    maxAge: ACCESS_TOKEN_MAX_AGE,
  });

  console.log("[AUTH:COOKIES] Auth cookies set successfully");
};

const clearAuthCookies = async () => {
  console.log("[AUTH:COOKIES] Clearing auth cookies");
  const cookieStore = await cookies();
  cookieStore.delete("access_token");
  cookieStore.delete("refresh_token");
  cookieStore.delete("token_expires_at");
  console.log("[AUTH:COOKIES] Auth cookies cleared");
};

const isTokenExpiringSoon = async (): Promise<boolean> => {
  const cookieStore = await cookies();
  const expiresAt = cookieStore.get("token_expires_at")?.value;
  if (!expiresAt) return true;

  const nowSeconds = Math.floor(Date.now() / 1000);
  return nowSeconds >= Number(expiresAt) - PROACTIVE_REFRESH_THRESHOLD;
};

const tryRefresh = async (): Promise<boolean> => {
  console.log("[AUTH:REFRESH] Attempting token refresh");
  const cookieStore = await cookies();
  const refreshToken = cookieStore.get("refresh_token")?.value;

  if (!refreshToken) {
    console.log("[AUTH:REFRESH] No refresh token found — aborting");
    return false;
  }

  const res = await fetch(`${FASTAPI_URL()}/api/v1/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token: refreshToken }),
  });

  if (!res.ok) {
    console.log("[AUTH:REFRESH] Refresh failed", { status: res.status });
    return false;
  }

  const data = await res.json();

  if (!data?.access_token || !data?.refresh_token) {
    console.log("[AUTH:REFRESH] Malformed refresh response — missing tokens");
    return false;
  }

  await setAuthCookies(data.access_token, data.refresh_token);
  console.log("[AUTH:REFRESH] Token refresh successful");
  return true;
};

const getValidAccessToken = async (): Promise<string | null> => {
  const cookieStore = await cookies();
  let accessToken: string | undefined = cookieStore.get("access_token")?.value;

  // Proactive refresh: token exists but is about to expire
  if (accessToken && (await isTokenExpiringSoon())) {
    console.log("[AUTH:FETCH] Token expiring soon — proactive refresh");
    const refreshed = await tryRefresh();
    if (refreshed) {
      const newCookieStore = await cookies();
      accessToken = newCookieStore.get("access_token")?.value;
    }
    // If proactive refresh fails, continue with current token — it may still be valid
  }

  // No access token at all — attempt refresh (browser may have expired the cookie)
  if (!accessToken) {
    console.log("[AUTH:FETCH] No access token — attempting refresh");
    const refreshed = await tryRefresh();
    if (!refreshed) return null;

    const newCookieStore = await cookies();
    accessToken = newCookieStore.get("access_token")?.value;
  }

  return accessToken ?? null;
};

export const authenticatedFetch = async <T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResult<T>> => {
  console.log("[AUTH:FETCH] authenticatedFetch →", endpoint);

  const accessToken = await getValidAccessToken();

  if (!accessToken) {
    console.log("[AUTH:FETCH] No valid access token — returning 401");
    await clearAuthCookies();
    return { ok: false, status: 401, message: "Not authenticated" };
  }

  const makeRequest = async (token: string) =>
    fetch(`${FASTAPI_URL()}${endpoint}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
        Authorization: `Bearer ${token}`,
      },
    });

  let res = await makeRequest(accessToken);

  // Silent refresh on 401 (token may have been revoked server-side)
  if (res.status === 401) {
    console.log("[AUTH:FETCH] Got 401 — attempting silent refresh for", endpoint);
    const refreshed = await tryRefresh();
    if (!refreshed) {
      console.log("[AUTH:FETCH] Silent refresh failed — clearing cookies");
      await clearAuthCookies();
      return { ok: false, status: 401, message: "Session expired. Please log in again." };
    }

    const newCookieStore = await cookies();
    const newToken = newCookieStore.get("access_token")?.value;
    if (!newToken) {
      return { ok: false, status: 401, message: "Session expired. Please log in again." };
    }

    res = await makeRequest(newToken);
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    console.log("[AUTH:FETCH] Request failed", { endpoint, status: res.status });
    return { ok: false, status: res.status, message: body?.detail ?? "An unexpected error occurred." };
  }

  console.log("[AUTH:FETCH] Request succeeded", { endpoint });
  const data: T = await res.json();
  return { ok: true, data };
};

export const publicFetch = async <T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResult<T>> => {
  console.log("[AUTH:PUBLIC_FETCH] publicFetch →", endpoint);
  const res = await fetch(`${FASTAPI_URL()}${endpoint}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    console.log("[AUTH:PUBLIC_FETCH] Request failed", { endpoint, status: res.status });
    return { ok: false, status: res.status, message: body?.detail ?? "An unexpected error occurred." };
  }

  console.log("[AUTH:PUBLIC_FETCH] Request succeeded", { endpoint });
  const data: T = await res.json();
  return { ok: true, data };
};

export { setAuthCookies, clearAuthCookies };
