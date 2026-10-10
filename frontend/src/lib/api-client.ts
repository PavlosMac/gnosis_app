import { cookies, headers } from "next/headers";
import type { ApiResult } from "@/types/api";
import type { TokenResponse } from "@/types/auth";
import { readErrorBody } from "@/lib/api-error";
import { clientIpFrom } from "@/lib/client-ip";
import {
  applyAuthCookies,
  clearAuthCookies as clearCookies,
  readAuthCookies,
} from "@/lib/auth-cookies";

/** Map HTTP status codes to safe, user-facing messages. */
const SAFE_MESSAGES: Record<number, string> = {
  400: "The request was invalid.",
  401: "Session expired. Please log in again.",
  402: "Your Oracle budget is exhausted.",
  403: "You do not have permission for this action.",
  404: "The requested resource was not found.",
  410: "This link has expired.",
  422: "The request contained invalid data.",
  429: "Too many requests. Please wait and try again.",
};

const NETWORK_ERROR_MESSAGE = "Could not reach the server. Please try again.";

const safeErrorMessage = (status: number, fallback: string): string =>
  SAFE_MESSAGES[status] ?? fallback;

const GNOSIS_API_BASE_URL = () => {
  const url = process.env.GNOSIS_API_BASE_URL;
  if (!url) throw new Error("GNOSIS_API_BASE_URL environment variable is not set");
  return url;
};

/** A 204 has no body to parse (DELETE /auth/me) */
const parseBody = async <T>(res: Response): Promise<T> =>
  res.status === 204 ? (undefined as T) : ((await res.json()) as T);

/** Read a failed response exactly once: the backend's machine-readable `code`
    when it sent one, and the raw text for local diagnostics */
const readFailure = async (
  res: Response
): Promise<{ code?: string; detail?: string; bodyText: string }> => {
  const bodyText = await res.text().catch(() => "");
  const { code, detail } = readErrorBody(bodyText);
  // detail travels only with a code: an uncoded detail is never meant for users
  return { ...(code && { code, ...(detail && { detail }) }), bodyText };
};

/**
 * Every backend call is made from this server, so the API would see one
 * address for all users and its per-IP rate limits (login, register) would be
 * global. Forward the browser's address as the edge reported it.
 */
const forwardedForHeader = async (): Promise<Record<string, string>> => {
  try {
    const ip = clientIpFrom(await headers());
    return ip ? { "X-Forwarded-For": ip } : {};
  } catch {
    // No request scope (build-time render) — nothing to forward
    return {};
  }
};

const setAuthCookies = async (tokens: TokenResponse) => {
  applyAuthCookies(await cookies(), tokens);
  console.log("[AUTH:COOKIES] Auth cookies set");
};

const clearAuthCookies = async () => {
  clearCookies(await cookies());
  console.log("[AUTH:COOKIES] Auth cookies cleared");
};

const getValidAccessToken = async (): Promise<string | null> => {
  return readAuthCookies(await cookies()).accessToken ?? null;
};

const refreshAccessToken = async (): Promise<string | null> => {
  const { refreshToken } = readAuthCookies(await cookies());

  if (!refreshToken) return null;

  console.log("[AUTH:FETCH] Attempting token refresh");

  try {
    const res = await fetch(`${GNOSIS_API_BASE_URL()}/api/v1/auth/refresh`, {
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
  console.log("[AUTH:FETCH] authenticatedFetch →", endpoint, options.method ?? "GET");

  let accessToken = await getValidAccessToken();

  // No access token — try refresh before giving up
  if (!accessToken) {
    console.log("[AUTH:FETCH] No access token — attempting refresh");
    accessToken = await refreshAccessToken();
    if (!accessToken) {
      console.log("[AUTH:FETCH] No valid token after refresh — returning 401");
      return { ok: false, status: 401, message: "Not authenticated", unauthenticated: true };
    }
  }

  const makeRequest = async (token: string) =>
    fetch(`${GNOSIS_API_BASE_URL()}${endpoint}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
        Authorization: `Bearer ${token}`,
      },
    });

  let res: Response;
  try {
    res = await makeRequest(accessToken);
  } catch (e) {
    console.log("[AUTH:FETCH] Network error", { endpoint, error: e });
    return { ok: false, status: 0, message: NETWORK_ERROR_MESSAGE };
  }

  // 401 — token expired but cookie not yet deleted; try refresh once
  if (res.status === 401) {
    console.log("[AUTH:FETCH] Got 401 — attempting refresh");
    const newToken = await refreshAccessToken();
    if (newToken) {
      let retryRes: Response;
      try {
        retryRes = await makeRequest(newToken);
      } catch (e) {
        console.log("[AUTH:FETCH] Network error on retry", { endpoint, error: e });
        return { ok: false, status: 0, message: NETWORK_ERROR_MESSAGE };
      }
      if (retryRes.ok) {
        console.log("[AUTH:FETCH] Retry after refresh succeeded", { endpoint });
        return { ok: true, data: await parseBody<T>(retryRes) };
      }
      const { code, detail } = await readFailure(retryRes);
      return {
        ok: false,
        status: retryRes.status,
        message: safeErrorMessage(retryRes.status, "Session expired. Please log in again."),
        unauthenticated: retryRes.status === 401,
        ...(code && { code }),
        ...(detail && { detail }),
      };
    }
    return { ok: false, status: 401, message: "Session expired. Please log in again.", unauthenticated: true };
  }

  if (!res.ok) {
    const { code, detail, bodyText } = await readFailure(res);
    console.log("[AUTH:FETCH] Request failed", {
      endpoint,
      status: res.status,
      // the body is only logged for local diagnostics
      ...(process.env.NODE_ENV !== "production" && { body: bodyText }),
    });
    return {
      ok: false,
      status: res.status,
      message: safeErrorMessage(res.status, "An unexpected error occurred."),
      ...(code && { code }),
      ...(detail && { detail }),
    };
  }

  console.log("[AUTH:FETCH] Request succeeded", { endpoint });
  return { ok: true, data: await parseBody<T>(res) };
};

export const publicFetch = async <T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResult<T>> => {
  console.log("[AUTH:PUBLIC_FETCH] publicFetch →", endpoint);

  // Same contract as authenticatedFetch: a network failure (or a missing base
  // URL) is a status-0 result, not a throw that escapes the calling server
  // action and replaces the form with Next's error boundary
  let res: Response;
  try {
    res = await fetch(`${GNOSIS_API_BASE_URL()}${endpoint}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(await forwardedForHeader()),
        ...options.headers,
      },
    });
  } catch (e) {
    console.log("[AUTH:PUBLIC_FETCH] Network error", { endpoint, error: e });
    return { ok: false, status: 0, message: NETWORK_ERROR_MESSAGE };
  }

  if (!res.ok) {
    const { code, detail } = await readFailure(res);
    console.log("[AUTH:PUBLIC_FETCH] Request failed", { endpoint, status: res.status, code });
    return {
      ok: false,
      status: res.status,
      message: safeErrorMessage(res.status, "An unexpected error occurred."),
      ...(code && { code }),
      ...(detail && { detail }),
    };
  }

  console.log("[AUTH:PUBLIC_FETCH] Request succeeded", { endpoint });
  return { ok: true, data: await parseBody<T>(res) };
};

export { setAuthCookies, clearAuthCookies };
