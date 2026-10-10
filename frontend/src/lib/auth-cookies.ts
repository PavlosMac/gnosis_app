// Single writer/reader for the three session cookies. Edge-safe: no
// `next/headers` import, so both the proxy (NextResponse.cookies /
// request.cookies) and server actions (`await cookies()`) share it.

export interface AuthTokens {
  access_token: string;
  refresh_token: string;
  access_token_expires_at: number; // unix seconds
  refresh_token_expires_at: number; // unix seconds
}

export interface AuthCookieNames {
  access: string;
  refresh: string;
  expiresAt: string;
}

export type AuthCookieOptions = {
  httpOnly: true;
  sameSite: "lax";
  path: "/";
  secure: boolean;
  maxAge: number;
};

/** Anything with a Next-style `set(name, value, options)` */
export interface CookieTarget {
  set: (name: string, value: string, options: AuthCookieOptions) => unknown;
}

/** Anything with a Next-style `get(name)` */
export interface CookieSource {
  get: (name: string) => { value: string } | undefined;
}

export interface AuthCookieValues {
  accessToken: string | undefined;
  refreshToken: string | undefined;
  expiresAt: number | undefined;
}

const BASE_NAMES: AuthCookieNames = {
  access: "access_token",
  refresh: "refresh_token",
  expiresAt: "token_expires_at",
};

/** `__Host-` pins the cookie to this exact host over HTTPS (requires Secure,
    Path=/ and no Domain), so it only applies when the cookie is secure. */
export const cookieNames = (secure: boolean): AuthCookieNames =>
  secure
    ? {
        access: `__Host-${BASE_NAMES.access}`,
        refresh: `__Host-${BASE_NAMES.refresh}`,
        expiresAt: `__Host-${BASE_NAMES.expiresAt}`,
      }
    : BASE_NAMES;

// Read lazily: the proxy runtime does not see process.env at module load
const isSecure = (): boolean => process.env.NODE_ENV === "production";

export const AUTH_COOKIES = (): AuthCookieNames => cookieNames(isSecure());

// No `domain`: host-only cookies, and a __Host- cookie with Domain is rejected
const options = (secure: boolean, maxAge: number): AuthCookieOptions => ({
  httpOnly: true,
  sameSite: "lax",
  path: "/",
  secure,
  maxAge,
});

export const applyAuthCookies = (
  target: CookieTarget,
  tokens: AuthTokens,
  now: number = Math.floor(Date.now() / 1000),
  secure: boolean = isSecure()
): void => {
  const names = cookieNames(secure);
  const accessMaxAge = Math.max(tokens.access_token_expires_at - now, 0);
  const refreshMaxAge = Math.max(tokens.refresh_token_expires_at - now, 0);

  target.set(names.access, tokens.access_token, options(secure, accessMaxAge));
  target.set(names.refresh, tokens.refresh_token, options(secure, refreshMaxAge));
  target.set(names.expiresAt, String(tokens.access_token_expires_at), options(secure, accessMaxAge));
};

/** Clears with `set(..., maxAge: 0)`, never `delete`: browsers drop the
    deletion of a `__Host-` cookie unless it carries Secure and Path=/. */
export const clearAuthCookies = (target: CookieTarget, secure: boolean = isSecure()): void => {
  const names = cookieNames(secure);
  for (const name of [names.access, names.refresh, names.expiresAt]) {
    target.set(name, "", options(secure, 0));
  }
};

export const readAuthCookies = (
  source: CookieSource,
  secure: boolean = isSecure()
): AuthCookieValues => {
  const names = cookieNames(secure);
  const value = (name: string): string | undefined => source.get(name)?.value || undefined;
  const expires = Number(value(names.expiresAt));

  return {
    accessToken: value(names.access),
    refreshToken: value(names.refresh),
    expiresAt: Number.isFinite(expires) && expires > 0 ? expires : undefined,
  };
};
