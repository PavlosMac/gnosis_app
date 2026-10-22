import React from "react";
import { describe, it, expect, vi } from "vitest";

vi.mock("@/components/LegalDocument", () => ({ default: () => null }));
vi.mock("@/lib/legal-documents", () => ({
  listVersions: (id: string) => (id === "terms" ? ["2026-10-04", "2026-10-13"] : ["2026-10-04"]),
}));

const { default: LegalDocument } = await import("@/components/LegalDocument");
const { loadAgreementDocument } = await import("@/app/user/profile/settings/actions");

const rendered = async (id: string, version: string | null) => {
  const node = await loadAgreementDocument(id, version);
  return node as React.ReactElement<{ id: string; version?: string }>;
};

describe("loadAgreementDocument", () => {
  it("renders the accepted version when it has a file", async () => {
    const node = await rendered("terms", "2026-10-04");
    expect(node.type).toBe(LegalDocument);
    expect(node.props).toMatchObject({ id: "terms", version: "2026-10-04" });
  });

  it("falls back to the current version when none is recorded", async () => {
    const node = await rendered("privacy", null);
    expect(node.props.id).toBe("privacy");
    expect(node.props.version).toBeUndefined();
  });

  it("falls back to the current version when the recorded one has no file", async () => {
    const node = await rendered("terms", "1999-01-01");
    expect(node.props.version).toBeUndefined();
  });

  it("renders nothing for an unknown document id", async () => {
    expect(await loadAgreementDocument("../../etc/passwd", null)).toBeNull();
    expect(await loadAgreementDocument("constructor", null)).toBeNull();
  });
});
