// Producer and validator of the login `?from=` return path live together so
// they cannot drift: the proxy and "Log in to save" build it, the login action
// checks it before redirecting.

// Only same-origin absolute paths: one "/", then anything but a second "/".
// The WHATWG parser treats "\" as "/" in http(s) URLs and strips tabs and
// newlines before parsing, so "/\evil.com" and "/\t/evil.com" both resolve to
// https://evil.com/. Rejecting backslashes and control characters up front
// closes that, so "//host" is the only form left that can leave the origin.
export const isSafeReturnPath = (value: unknown): value is string =>
  typeof value === "string" && /^\/(?![/\\])[^\\\x00-\x1f\x7f]*$/.test(value);

export const loginHrefFor = (returnPath: string): string =>
  `/user/login?from=${encodeURIComponent(returnPath)}`;
