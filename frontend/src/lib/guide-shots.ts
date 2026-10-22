import fs from "node:fs";
import path from "node:path";

// Production files never change under a running server, so the answer is kept; in
// development a screenshot dropped into public/ must show up without a restart.
const cache = new Map<string, boolean>();

/** True when a screenshot referenced as "/guide/..." exists under public/ (server-side only) */
export const shotExists = (src: string): boolean => {
  if (!src.startsWith("/")) return false;
  const cached = cache.get(src);
  if (cached !== undefined) return cached;
  const found = fs.existsSync(path.join(process.cwd(), "public", src));
  if (process.env.NODE_ENV === "production") cache.set(src, found);
  return found;
};
