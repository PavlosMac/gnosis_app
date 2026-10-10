import { readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { LEGAL_REGISTRY } from "@/lib/legal-registry.generated";
import { LEGAL_DOCUMENT_IDS, versionFromFilename } from "@/lib/legal-versions";

const contentDir = path.resolve(__dirname, "../../content/legal");

// The registry is generated (scripts/generate-legal-registry.mjs, run before
// dev/build/test). This pins it to the directory listing, so a dated document
// committed without regenerating can never silently fail to become current.
describe("generated legal registry", () => {
  it.each(LEGAL_DOCUMENT_IDS)("lists exactly the dated files of %s", (id) => {
    const files = readdirSync(path.join(contentDir, id)).filter((f) => f.endsWith(".mdx"));
    const versions = files.map(versionFromFilename);

    expect(versions).not.toContain(null);
    expect(Object.keys(LEGAL_REGISTRY[id]).sort()).toEqual([...versions].sort());
    expect(versions.length).toBeGreaterThan(0);
  });

  it("has an entry for every document id and nothing else", () => {
    expect(Object.keys(LEGAL_REGISTRY).sort()).toEqual([...LEGAL_DOCUMENT_IDS].sort());
  });
});
