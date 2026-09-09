import React from "react";
import { describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import PillarNameInputs from "@/components/PillarNameInputs";

const render = (names = { querent: "Querent", other: "Other" }) =>
  renderToStaticMarkup(<PillarNameInputs names={names} onChange={vi.fn()} />);

describe("PillarNameInputs", () => {
  it("renders both pillar names as locked (read-only) inputs", () => {
    const html = render();
    expect(html.match(/readonly/gi)).toHaveLength(2);
    expect(html).toMatch(/value="Querent"/);
    expect(html).toMatch(/value="Other"/);
  });

  it("renders an unlock button per field, not pressed while locked", () => {
    const html = render();
    expect(html).toContain('aria-label="Unlock left pillar name"');
    expect(html).toContain('aria-label="Unlock right pillar name"');
    expect(html.match(/aria-pressed="false"/g)).toHaveLength(2);
  });

  it("shows custom names when provided", () => {
    const html = render({ querent: "Alice", other: "Maria" });
    expect(html).toMatch(/value="Alice"/);
    expect(html).toMatch(/value="Maria"/);
  });

  it("caps names at 30 characters", () => {
    expect(render().match(/maxlength="30"/gi)).toHaveLength(2);
  });

  it("warns when both pillars share a name", () => {
    expect(render({ querent: "Alex", other: "alex" })).toContain(
      "The two souls need different names"
    );
  });

  it("warns when a name is a reserved word", () => {
    expect(render({ querent: "Relationship", other: "Other" })).toContain("reserved");
  });

  it("shows no warning for valid or default names", () => {
    expect(render()).not.toMatch(/different names|reserved/);
    expect(render({ querent: "Alice", other: "Maria" })).not.toMatch(/different names|reserved/);
  });
});
