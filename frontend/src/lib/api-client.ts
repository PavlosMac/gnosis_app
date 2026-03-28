import { cookies } from "next/headers";
import type { ApiResult } from "@/types/api";
import type { TokenResponse } from "@/types/auth";

const FASTAPI_URL = () => {
  const url = process.env.FASTAPI_URL;
  if (!url) throw new Error("FASTAPI_URL environment variable is not set");
  return url;
};

const setAuthCookies = async (tokens: TokenResponse) => {
  const cookieStore = await cookies();
  const isProduction = process.env.NODE_ENV === "production";
  const nowSeconds = Math.floor(Date.now() / 1000);
  const accessMaxAge = Math.max(tokens.access_token_expires_at - nowSeconds, 0);
  const refreshMaxAge = Math.max(tokens.refresh_token_expires_at - nowSeconds, 0);

  console.log("[AUTH:COOKIES] Setting auth cookies", { isProduction, accessMaxAge, refreshMaxAge });

  cookieStore.set("access_token", tokens.access_token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax",
    path: "/",
    maxAge: accessMaxAge,
  });

  cookieStore.set("refresh_token", tokens.refresh_token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax",
    path: "/",
    maxAge: refreshMaxAge,
  });

  cookieStore.set("token_expires_at", String(tokens.access_token_expires_at), {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax",
    path: "/",
    maxAge: accessMaxAge,
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

const getValidAccessToken = async (): Promise<string | null> => {
  const cookieStore = await cookies();
  return cookieStore.get("access_token")?.value ?? null;
};

const refreshAccessToken = async (): Promise<string | null> => {
  const cookieStore = await cookies();
  const refreshToken = cookieStore.get("refresh_token")?.value;

  if (!refreshToken) return null;

  console.log("[AUTH:FETCH] Attempting token refresh");

  try {
    const res = await fetch(`${FASTAPI_URL()}/api/v1/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });

    if (!res.ok) {
      console.log("[AUTH:FETCH] Refresh failed", { status: res.status });
      return null;
    }

    const data: TokenResponse = await res.json();
    if (!data?.access_token || !data?.refresh_token) return null;

    console.log("[AUTH:FETCH] Refresh succeeded");

    // Persist new cookies — works in server actions; fails in render context (read-only)
    try {
      await setAuthCookies(data);
    } catch {
      console.log("[AUTH:FETCH] Could not persist cookies (render context)");
    }

    return data.access_token;
  } catch (e) {
    console.log("[AUTH:FETCH] Refresh threw", e);
    return null;
  }
};

export const authenticatedFetch = async <T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResult<T>> => {
  console.log("[AUTH:FETCH] authenticatedFetch →", endpoint);

  let accessToken = await getValidAccessToken();

  // No access token — try refresh before giving up
  if (!accessToken) {
    console.log("[AUTH:FETCH] No access token — attempting refresh");
    accessToken = await refreshAccessToken();
    if (!accessToken) {
      console.log("[AUTH:FETCH] No valid token after refresh — returning 401");
      return { ok: false, status: 401, message: "Not authenticated" };
    }
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

  const res = await makeRequest(accessToken);

  // 401 — token expired but cookie not yet deleted; try refresh once
  if (res.status === 401) {
    console.log("[AUTH:FETCH] Got 401 — attempting refresh");
    const newToken = await refreshAccessToken();
    if (newToken) {
      const retryRes = await makeRequest(newToken);
      if (retryRes.ok) {
        console.log("[AUTH:FETCH] Retry after refresh succeeded", { endpoint });
        const data: T = await retryRes.json();
        return { ok: true, data };
      }
      const body = await retryRes.json().catch(() => ({}));
      return { ok: false, status: retryRes.status, message: body?.detail ?? "Session expired. Please log in again." };
    }
    return { ok: false, status: 401, message: "Session expired. Please log in again." };
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
