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

// Token refresh is handled exclusively by the proxy (writable context).
// This function only reads whatever token is currently in cookies.
const getValidAccessToken = async (): Promise<string | null> => {
  const cookieStore = await cookies();
  return cookieStore.get("access_token")?.value ?? null;
};

export const authenticatedFetch = async <T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResult<T>> => {
  console.log("[AUTH:FETCH] authenticatedFetch →", endpoint);

  const accessToken = await getValidAccessToken();

  if (!accessToken) {
    console.log("[AUTH:FETCH] No valid access token — returning 401");
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

  const res = await makeRequest(accessToken);

  // 401 means token is invalid — don't try to refresh here (render context can't write cookies).
  // The proxy will handle refresh/cleanup on the next navigation.
  if (res.status === 401) {
    console.log("[AUTH:FETCH] Got 401 for", endpoint);
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
