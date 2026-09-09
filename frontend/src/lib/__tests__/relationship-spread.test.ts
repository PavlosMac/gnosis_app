import { describe, it, expect } from "vitest";
import cfg from "@/lib/readings-config.json";
import {
  buildNamedRelationshipPositions,
  extractPillarNames,
  positionCaption,
  displayPositionName,
  autoTagNames,
  isRelationship,
  groupByPillar,
  type PillarNameOverrides,
} from "@/lib/relationship-spread";

const relationship = cfg.readings.find((r) => r.name === "Relationship Reading")!;
const configPositions = relationship.positions!;
const defaultNames = configPositions.map((p) => p.name);

const overrides: PillarNameOverrides = { querent: "Alice", other: "Maria" };

const named = buildNamedRelationshipPositions(configPositions, overrides);
const namedPositions = named.map((p) => p.name);

// The stored format of rounds 1-2, still present on old saved readings
const legacyPositions = defaultNames.map((n) =>
  n.replace(/\s*-\s*(querent|other)\s*$/i, (m, key) =>
    ` (${key.toLowerCase() === "querent" ? "Alice" : "Maria"}) - ${key}`
  )
);

describe("buildNamedRelationshipPositions", () => {
  it("templates keyword-free positions and descriptions for named pillars", () => {
    expect(namedPositions).toContain("Current behaviour - Alice");
    expect(namedPositions).toContain("What is desired - Maria");
    expect(namedPositions).toContain("How to proceed - Alice");
    expect(named.find((p) => p.name === "Current behaviour - Alice")!.description).toBe(
      "What is Alice's current behaviour?"
    );
    expect(named.find((p) => p.name === "What is desired - Maria")!.description).toBe(
      "What is desired by Maria?"
    );
    expect(named.find((p) => p.name === "How to proceed - Maria")!.description).toBe(
      "How should Maria proceed?"
    );
  });

  it("emits no querent/other keyword anywhere in names or descriptions", () => {
    const everything = named.flatMap((p) => [p.name, p.description]).join(" ");
    expect(everything).not.toMatch(/querent/i);
    expect(everything).not.toMatch(/\bother\b/i);
  });

  it("keeps the relationship pillar's config entries untouched, in place", () => {
    for (const original of configPositions.filter((p) => /relationship$/i.test(p.name))) {
      expect(named[configPositions.indexOf(original)]).toEqual(original);
    }
  });

  it("keeps an un-renamed pillar's config entries with a partial override", () => {
    const partial = buildNamedRelationshipPositions(configPositions, { other: "Maria" });
    expect(partial.map((p) => p.name)).toContain("Current behaviour - querent");
    expect(partial.map((p) => p.name)).toContain("Current behaviour - Maria");
  });
});

describe("groupByPillar / isRelationship on named positions", () => {
  it("still detects the spread and keeps every cell in its pillar/row", () => {
    expect(isRelationship(namedPositions)).toBe(true);
    expect(groupByPillar(namedPositions)).toEqual(groupByPillar(defaultNames));
  });

  it("assigns the first-appearing name to the left pillar", () => {
    const groups = groupByPillar(namedPositions);
    const leftIdx = groups[0][0]!;
    expect(namedPositions[leftIdx]).toBe("Current behaviour - Alice");
  });

  it("handles a partial override", () => {
    const partial = buildNamedRelationshipPositions(configPositions, { other: "Maria" })
      .map((p) => p.name);
    expect(isRelationship(partial)).toBe(true);
    expect(groupByPillar(partial)).toEqual(groupByPillar(defaultNames));
  });

  it("still detects legacy round-1/2 positions", () => {
    expect(isRelationship(legacyPositions)).toBe(true);
    expect(groupByPillar(legacyPositions)).toEqual(groupByPillar(defaultNames));
  });

  it("degrades gracefully when both pillars share a name", () => {
    const dup = buildNamedRelationshipPositions(configPositions, {
      querent: "Alex",
      other: "Alex",
    }).map((p) => p.name);
    expect(isRelationship(dup)).toBe(false);
  });

  it.each(["Mother", "Brother", "Grandmother", "Stepmother"])(
    "does not misclassify a custom name ending in 'other' (%s) as the other-pillar keyword",
    (name) => {
      const positions = buildNamedRelationshipPositions(configPositions, { other: name })
        .map((p) => p.name);
      const groups = groupByPillar(positions);
      // The name pillar (index 2) should carry the templated positions, not
      // be left empty because the name matched the "other" keyword suffix.
      expect(groups[2].every((idx) => idx !== undefined)).toBe(true);
      expect(positions).toContain(`Current behaviour - ${name}`);
      expect(extractPillarNames(positions)).toEqual({ other: name });
    }
  );

  it("keeps a custom name that starts with '- ' intact", () => {
    const positions = buildNamedRelationshipPositions(configPositions, { other: "- Bob" })
      .map((p) => p.name);
    expect(extractPillarNames(positions)).toEqual({ other: "- Bob" });
  });
});

describe("extractPillarNames", () => {
  it("reads names from templated positions", () => {
    expect(extractPillarNames(namedPositions)).toEqual({ querent: "Alice", other: "Maria" });
  });

  it("reads names from legacy positions", () => {
    expect(extractPillarNames(legacyPositions)).toEqual({ querent: "Alice", other: "Maria" });
  });

  it("returns a partial result when only one pillar is named", () => {
    const partial = buildNamedRelationshipPositions(configPositions, { other: "Maria" })
      .map((p) => p.name);
    expect(extractPillarNames(partial)).toEqual({ other: "Maria" });
  });

  it("returns undefined for default positions", () => {
    expect(extractPillarNames(defaultNames)).toBeUndefined();
  });
});

describe("positionCaption", () => {
  const names = extractPillarNames(namedPositions);

  it("drops the name suffix from templated positions", () => {
    expect(positionCaption("Current behaviour - Alice", names)).toBe("Current behaviour");
    expect(positionCaption("What is desired - Maria", names)).toBe("What is desired");
  });

  it("drops the legacy personalized tail", () => {
    expect(positionCaption("Current behaviour (Alice) - querent", names)).toBe(
      "Current behaviour"
    );
  });

  it("keeps default keyword suffixes and unrelated positions unchanged", () => {
    expect(positionCaption("Current behaviour - querent", names)).toBe(
      "Current behaviour - querent"
    );
    expect(positionCaption("Current situation - relationship", names)).toBe(
      "Current situation - relationship"
    );
    expect(positionCaption("Current status", names)).toBe("Current status");
  });
});

describe("displayPositionName", () => {
  it("rewrites only the legacy format; templated and default positions pass through", () => {
    expect(displayPositionName("Current behaviour (Pavlos) - querent")).toBe(
      "Current behaviour - Pavlos"
    );
    expect(displayPositionName("Current behaviour - Pavlos")).toBe("Current behaviour - Pavlos");
    expect(displayPositionName("Current behaviour - querent")).toBe("Current behaviour - querent");
  });
});

describe("autoTagNames", () => {
  it("returns lowercased names from templated positions", () => {
    expect(autoTagNames(namedPositions)).toEqual(["alice", "maria"]);
  });

  it("returns lowercased names from legacy positions", () => {
    expect(autoTagNames(legacyPositions)).toEqual(["alice", "maria"]);
  });

  it("caps tags at 25 characters", () => {
    const long = "Bartholomew Montgomery Fitzgerald";
    const positions = buildNamedRelationshipPositions(configPositions, { querent: long })
      .map((p) => p.name);
    expect(autoTagNames(positions)).toEqual([long.toLowerCase().slice(0, 25)]);
  });

  it("returns an empty array for default positions", () => {
    expect(autoTagNames(defaultNames)).toEqual([]);
  });
});
