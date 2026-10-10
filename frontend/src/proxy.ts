import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { isRegistrationEnabled } from "@/lib/feature-flags";
import { PATHNAME_HEADER } from "@/lib/onboarding";
import { applyAuthCookies, clearAuthCookies, readAuthCookies } from "@/lib/auth-cookies";

const PUBLIC_AUTH_ROUTES = ["/user/login", "/user/register"];
const GNOSIS_API_BASE_URL = () => {
  const url = process.env.GNOSIS_API_BASE_URL;
  if (!url) throw new Error("GNOSIS_API_BASE_URL environment variable is not set");
  return url;
};
const PROACTIVE_REFRESH_THRESHOLD = 10; // refresh when < 10 seconds remain

/** Continue to the page, telling server layouts which path is being rendered
    (layouts get no pathname). Set here, so a client-sent value is overwritten. */
const continueWithPathname = (request: NextRequest): NextResponse => {
  const headers = new Headers(request.headers);
  headers.set(PATHNAME_HEADER, request.nextUrl.pathname);
  return NextResponse.next({ request: { headers } });
};

export const proxy = async (request: NextRequest) => {
  const { pathname } = request.nextUrl;

  // Registration gate — redirect to login when registration is disabled
  if (pathname.startsWith("/user/register") && !isRegistrationEnabled()) {
    return NextResponse.redirect(new URL("/user/login", request.url));
  }

  const { accessToken, refreshToken, expiresAt: tokenExpiresAt } = readAuthCookies(request.cookies);
  const isPublicAuthRoute = PUBLIC_AUTH_ROUTES.some((route) => pathname.startsWith(route));

  console.log("[AUTH:PROXY] Route guard", {
    pathname,
    hasAccessToken: Boolean(accessToken),
    hasRefreshToken: Boolean(refreshToken),
    isPublicAuthRoute,
  });

  // Unauthenticated (no tokens at all) — redirect to login
  if (!accessToken && !refreshToken && !isPublicAuthRoute) {
    console.log("[AUTH:PROXY] No tokens — redirecting to login");
    const loginUrl = new URL("/user/login", request.url);
    loginUrl.searchParams.set("from", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // No access_token but HAS refresh_token — try to refresh here in the proxy
  if (!accessToken && refreshToken && !isPublicAuthRoute) {
    console.log("[AUTH:PROXY] Access token gone, refresh token present — attempting refresh", { at: new Date().toISOString() });
    try {
      const res = await fetch(`${GNOSIS_API_BASE_URL()}/api/v1/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data?.access_token && data?.refresh_token) {
          console.log("[AUTH:PROXY] Refresh succeeded — setting cookies and continuing");
          const response = continueWithPathname(request);
          applyAuthCookies(response.cookies, data);
          return response;
        }
      }

      // Refresh failed
      console.log("[AUTH:PROXY] Refresh failed — clearing cookies and redirecting to login");
    } catch (e) {
      console.log("[AUTH:PROXY] Refresh threw — clearing cookies", e);
    }

    // Clear cookies via response and redirect
    const loginUrl = new URL("/user/login", request.url);
    loginUrl.searchParams.set("from", pathname);
    const response = NextResponse.redirect(loginUrl);
    clearAuthCookies(response.cookies);
    return response;
  }

  // Proactive refresh: access token exists but is about to expire
  if (accessToken && refreshToken && !isPublicAuthRoute) {
    if (tokenExpiresAt) {
      const nowSeconds = Math.floor(Date.now() / 1000);
      const secondsRemaining = tokenExpiresAt - nowSeconds;
      if (secondsRemaining > 0 && secondsRemaining <= PROACTIVE_REFRESH_THRESHOLD) {
        console.log("[AUTH:PROXY] Token expiring soon — proactive refresh", { secondsRemaining, at: new Date().toISOString() });
        try {
          const res = await fetch(`${GNOSIS_API_BASE_URL()}/api/v1/auth/refresh`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ refresh_token: refreshToken }),
          });

          if (res.ok) {
            const data = await res.json();
            if (data?.access_token && data?.refresh_token) {
              console.log("[AUTH:PROXY] Proactive refresh succeeded");
              const response = continueWithPathname(request);
              applyAuthCookies(response.cookies, data);
              return response;
            }
          }
          // Proactive refresh failed — continue with current token, it's still valid
          console.log("[AUTH:PROXY] Proactive refresh failed — continuing with current token", { status: res.status });
        } catch (e) {
          console.log("[AUTH:PROXY] Proactive refresh threw — continuing with current token", e);
        }
      }
    }
  }

  // Authenticated user visiting login/register — redirect to profile
  if (isPublicAuthRoute && (accessToken || refreshToken)) {
    console.log("[AUTH:PROXY] Authenticated — redirecting to profile");
    return NextResponse.redirect(new URL("/user/profile", request.url));
  }

  return continueWithPathname(request);
};

export const config = {
  // /accept-terms is included so an expired access token is refreshed here, where
  // the rotated cookies can be persisted. Refreshing during a page render cannot
  // set cookies, which would leave the browser holding a consumed refresh token.
  matcher: ["/user/:path*", "/superadmin/:path*", "/accept-terms"],
};
