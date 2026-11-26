import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { isRegistrationEnabled } from "@/lib/feature-flags";
import { PATHNAME_HEADER } from "@/lib/onboarding";
import { readErrorBody } from "@/lib/api-error";
import {
  applyAuthCookies,
  clearAuthCookies,
  readAuthCookies,
  type AuthTokens,
} from "@/lib/auth-cookies";

const PUBLIC_AUTH_ROUTES = ["/user/login", "/user/register"];
// Pages a visitor may not see: no session means a redirect to login. Every other
// page is public and renders for visitors and users alike.
const GUARDED_PREFIXES = ["/user", "/superadmin", "/accept-terms"];
// The backend's answer to a refresh token that a parallel request rotated moments
// ago (ADR-016): a lost race, not a dead session. Several requests can carry the
// same expired cookies at once (a navigation and the router's prefetches; Next
// strips the prefetch headers before the proxy runs, so they cannot be told
// apart). The first rotates, the others get this code and keep their cookies;
// the winner's rotated pair is on its way to the browser.
const REFRESH_ROTATED_CODE = "refresh_rotated";
const GNOSIS_API_BASE_URL = () => {
  const url = process.env.GNOSIS_API_BASE_URL;
  if (!url) throw new Error("GNOSIS_API_BASE_URL environment variable is not set");
  return url;
};
const PROACTIVE_REFRESH_THRESHOLD = 10; // refresh when < 10 seconds remain

const isGuarded = (pathname: string): boolean =>
  GUARDED_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));

/** Continue to the page, telling server layouts which path is being rendered
    (layouts get no pathname). Set here, so a client-sent value is overwritten. */
const continueWithPathname = (request: NextRequest): NextResponse => {
  const headers = new Headers(request.headers);
  headers.set(PATHNAME_HEADER, request.nextUrl.pathname);
  return NextResponse.next({ request: { headers } });
};

const redirectToLogin = (request: NextRequest): NextResponse => {
  const loginUrl = new URL("/user/login", request.url);
  loginUrl.searchParams.set("from", request.nextUrl.pathname);
  return NextResponse.redirect(loginUrl);
};

const redirectToProfile = (request: NextRequest): NextResponse =>
  NextResponse.redirect(new URL("/user/profile", request.url));

type RefreshOutcome =
  | { status: "rotated"; tokens: AuthTokens }
  // The backend refused the token for good: revoked, expired, user gone or blocked
  | { status: "dead" }
  // Nothing is known: the backend is down or unreachable, or a parallel request
  // won the rotation and its cookies are on their way. The cookies stay as they are.
  | { status: "unsettled" };

const refreshSession = async (refreshToken: string): Promise<RefreshOutcome> => {
  try {
    const res = await fetch(`${GNOSIS_API_BASE_URL()}/api/v1/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
    if (res.ok) {
      const data = await res.json();
      if (data?.access_token && data?.refresh_token) return { status: "rotated", tokens: data };
      return { status: "unsettled" };
    }
    if (res.status === 401 || res.status === 403) {
      const { code } = readErrorBody(await res.text().catch(() => ""));
      if (code === REFRESH_ROTATED_CODE) {
        console.log("[AUTH:PROXY] Refresh lost a race — keeping cookies");
        return { status: "unsettled" };
      }
      console.log("[AUTH:PROXY] Refresh refused — session is dead", { status: res.status });
      return { status: "dead" };
    }
    console.log("[AUTH:PROXY] Refresh unavailable — keeping cookies", { status: res.status });
    return { status: "unsettled" };
  } catch (e) {
    console.log("[AUTH:PROXY] Refresh threw — keeping cookies", e);
    return { status: "unsettled" };
  }
};

export const proxy = async (request: NextRequest) => {
  const { pathname } = request.nextUrl;

  // Registration gate — redirect to login when registration is disabled
  if (pathname.startsWith("/user/register") && !isRegistrationEnabled()) {
    return NextResponse.redirect(new URL("/user/login", request.url));
  }

  const { accessToken, refreshToken, expiresAt: tokenExpiresAt } = readAuthCookies(request.cookies);
  const isPublicAuthRoute = PUBLIC_AUTH_ROUTES.some((route) => pathname.startsWith(route));
  const guarded = isGuarded(pathname) && !isPublicAuthRoute;

  console.log("[AUTH:PROXY] Route guard", {
    pathname,
    hasAccessToken: Boolean(accessToken),
    hasRefreshToken: Boolean(refreshToken),
    guarded,
    isPublicAuthRoute,
  });

  // No tokens at all: a visitor. Guarded pages send them to login.
  if (!accessToken && !refreshToken) {
    if (guarded) {
      console.log("[AUTH:PROXY] No tokens — redirecting to login");
      return redirectToLogin(request);
    }
    return continueWithPathname(request);
  }

  // Logged-in user visiting login/register — redirect to profile
  if (accessToken && isPublicAuthRoute) {
    console.log("[AUTH:PROXY] Authenticated — redirecting to profile");
    return redirectToProfile(request);
  }

  // Access token gone, refresh token present. This is the one place a refresh
  // happens on a page or action request: the rotated cookies go out on this
  // response. A render cannot set cookies, so a refresh there would leave the
  // browser holding a consumed, single-use refresh token (ADR-022).
  if (!accessToken && refreshToken) {
    console.log("[AUTH:PROXY] Access token gone, refresh token present — attempting refresh", { at: new Date().toISOString() });
    const outcome = await refreshSession(refreshToken);

    if (outcome.status === "rotated") {
      console.log("[AUTH:PROXY] Refresh succeeded — setting cookies and continuing");
      const response = isPublicAuthRoute ? redirectToProfile(request) : continueWithPathname(request);
      applyAuthCookies(response.cookies, outcome.tokens);
      return response;
    }

    if (outcome.status === "dead") {
      // The session is over. A guarded page redirects to login; a public page
      // (the login page included) renders for a visitor.
      console.log("[AUTH:PROXY] Session dead — clearing cookies", { guarded });
      const response = guarded ? redirectToLogin(request) : continueWithPathname(request);
      clearAuthCookies(response.cookies);
      return response;
    }

    // Unsettled: keep the cookies and let the page render. Without an access
    // token it renders for a visitor; the next request tries again.
    return continueWithPathname(request);
  }

  // Proactive refresh: access token exists but is about to expire
  if (accessToken && refreshToken && tokenExpiresAt) {
    const nowSeconds = Math.floor(Date.now() / 1000);
    const secondsRemaining = tokenExpiresAt - nowSeconds;
    if (secondsRemaining > 0 && secondsRemaining <= PROACTIVE_REFRESH_THRESHOLD) {
      console.log("[AUTH:PROXY] Token expiring soon — proactive refresh", { secondsRemaining, at: new Date().toISOString() });
      const outcome = await refreshSession(refreshToken);
      if (outcome.status === "rotated") {
        console.log("[AUTH:PROXY] Proactive refresh succeeded");
        const response = continueWithPathname(request);
        applyAuthCookies(response.cookies, outcome.tokens);
        return response;
      }
      // Anything else: continue with the current token, it is still valid
      console.log("[AUTH:PROXY] Proactive refresh did not rotate — continuing with current token", { outcome: outcome.status });
    }
  }

  return continueWithPathname(request);
};

export const config = {
  // Every page and server action, public ones included: the root layout renders
  // the signed-in menu from the session on every page, so an expired access
  // token must be refreshed here, where the rotated cookies can be persisted,
  // before any render or action reads it. Skipped: Next internals and static
  // files by extension (card and guide images, robots.txt, sitemap.xml). A
  // dynamic segment with a dot in it still goes through.
  matcher: [
    "/((?!_next/|.*\\.(?:png|jpg|jpeg|gif|svg|webp|avif|ico|txt|xml|json|js|css|woff|woff2|map)$).*)",
  ],
};
