import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

// Every page under /user and /superadmin must call enforceOnboarding() itself —
// the layout alone misses client-side in-section navigation (see
// src/lib/onboarding-gate.ts). Nothing else catches a page that forgets the
// call, so this test is that signal: it fails loudly for a new page added
// without it, instead of silently shipping an ungated route.

const APP_DIR = join(__dirname, "..", "..", "app");

// Reachable by a user the gate would apply to, for a documented structural
// reason, so they are exempt from the enforceOnboarding() requirement:
const EXEMPT_PATHNAMES = new Set([
  // Explicitly exempt in src/lib/onboarding.ts — deleting the account must
  // stay reachable even with an outstanding consent/payment step.
  "/user/profile/delete-account",
  // The proxy (src/proxy.ts) redirects an authenticated visitor away from
  // these before the page ever renders, so a logged-in user with something
  // outstanding never reaches them.
  "/user/login",
  "/user/register",
]);

const findPageFiles = (dir: string): string[] =>
  readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return findPageFiles(full);
    return entry === "page.tsx" ? [full] : [];
  });

/** `src/app/user/profile/manage-consent/page.tsx` -> `/user/profile/manage-consent`;
    a route group or dynamic segment folder name maps through unchanged, which is
    close enough to match against EXEMPT_PATHNAMES (none of those are dynamic). */
const pathnameFor = (pageFile: string): string =>
  "/" + relative(APP_DIR, pageFile).replace(/\/page\.tsx$/, "");

describe("every /user and /superadmin page enforces onboarding", () => {
  const pages = [
    ...findPageFiles(join(APP_DIR, "user")),
    ...findPageFiles(join(APP_DIR, "superadmin")),
  ].map((file) => ({ file, pathname: pathnameFor(file) }));

  // A canary: if this list is ever empty, the glob above broke silently and
  // every other assertion in this suite would vacuously pass.
  it("found at least one page to check", () => {
    expect(pages.length).toBeGreaterThan(0);
  });

  it.each(pages.filter((p) => !EXEMPT_PATHNAMES.has(p.pathname)))(
    "$pathname calls enforceOnboarding()",
    ({ file }) => {
      const source = readFileSync(file, "utf-8");
      expect(source).toMatch(/\benforceOnboarding\s*\(\s*\)/);
    }
  );
});
