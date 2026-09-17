// Producer and validator of the login `?from=` return path live together so
// they cannot drift: the proxy and "Log in to save" build it, the login action
// checks it before redirecting.

// Only same-origin absolute paths — never protocol-relative (//host) or external URLs
export const isSafeReturnPath = (value: unknown): value is string =>
  typeof value === "string" && /^\/(?!\/)/.test(value);

export const loginHrefFor = (returnPath: string): string =>
  `/user/login?from=${encodeURIComponent(returnPath)}`;
