import { describe, it, expect } from "vitest";
import cfg from "@/lib/readings-config.json";
import type { ReadingConfig } from "@/types/reading";
import {
  TREE_NODES,
  TREE_PATHS,
  SPREAD_BLURBS,
  treeOfLifeNodes,
  aboutSpreads,
  significatorPositions,
} from "@/lib/about-content";

const readings = cfg.readings as ReadingConfig[];
const treeSpread = readings.find((r) => r.name === "Tree of Life")!;

describe("TREE_NODES", () => {
  it("lists the 11 sephiroth with only Daath hidden", () => {
    expect(TREE_NODES).toHaveLength(11);
    expect(TREE_NODES.filter((n) => n.hidden).map((n) => n.name)).toEqual(["Daath"]);
  });

  it("puts Binah, Geburah and Hod on the left pillar and Chokmah, Chesed, Netzach on the right", () => {
    const x = Object.fromEntries(TREE_NODES.map((n) => [n.name, n.x]));
    for (const name of ["Binah", "Geburah", "Hod"]) expect(x[name]).toBeLessThan(150);
    for (const name of ["Chokmah", "Chesed", "Netzach"]) expect(x[name]).toBeGreaterThan(150);
    for (const name of ["Kether", "Daath", "Tiphereth", "Yesod", "Malkuth"]) expect(x[name]).toBe(150);
  });

  it("descends row by row in the KabbalahLayout order", () => {
    const y = Object.fromEntries(TREE_NODES.map((n) => [n.name, n.y]));
    expect(y.Binah).toBe(y.Chokmah);
    expect(y.Geburah).toBe(y.Chesed);
    expect(y.Hod).toBe(y.Netzach);
    const rows = [y.Kether, y.Binah, y.Daath, y.Geburah, y.Tiphereth, y.Hod, y.Yesod, y.Malkuth];
    for (let i = 1; i < rows.length; i++) expect(rows[i]).toBeGreaterThan(rows[i - 1]);
  });
});

describe("TREE_PATHS", () => {
  it("has the 22 paths between real sephiroth, none through Daath, no duplicates", () => {
    expect(TREE_PATHS).toHaveLength(22);
    const names = new Set(TREE_NODES.map((n) => n.name));
    const seen = new Set<string>();
    for (const [a, b] of TREE_PATHS) {
      expect(names.has(a)).toBe(true);
      expect(names.has(b)).toBe(true);
      expect(a).not.toBe("Daath");
      expect(b).not.toBe("Daath");
      const key = [a, b].sort().join("-");
      expect(seen.has(key)).toBe(false);
      seen.add(key);
    }
  });
});

describe("treeOfLifeNodes", () => {
  it("attaches each sephira's description from readings-config", () => {
    const nodes = treeOfLifeNodes();
    expect(nodes.map((n) => n.name)).toEqual(TREE_NODES.map((n) => n.name));
    const desc = (name: string) => treeSpread.positions!.find((p) => p.name === name)!.description;
    expect(nodes.find((n) => n.name === "Kether")!.description).toBe(desc("Kether"));
    expect(nodes.find((n) => n.name === "Malkuth")!.description).toBe(desc("Malkuth"));
    for (const n of nodes) expect(n.description.length).toBeGreaterThan(0);
  });

  it("throws when the config is missing a sephira", () => {
    const broken: ReadingConfig[] = [
      { ...treeSpread, positions: treeSpread.positions!.filter((p) => p.name !== "Daath") },
    ];
    expect(() => treeOfLifeNodes(broken)).toThrow(/Daath/);
  });
});

describe("aboutSpreads", () => {
  it("returns every configured spread, open-question spreads first, with its card count", () => {
    const spreads = aboutSpreads();
    expect(spreads.map((s) => s.name)).toEqual([
      "Single Card",
      "Two Card",
      "Three Card",
      "Past, Present, Future",
      "Fire, Water, Air, Earth",
      "Relationship Reading",
      "Career Reading",
      "Tree of Life",
      "Significators",
    ]);
    expect(spreads.find((s) => s.name === "Tree of Life")!.cardCount).toBe(11);
    expect(spreads.find((s) => s.name === "Significators")!.cardCount).toBeNull();
    for (const s of spreads) expect(s.description.length).toBeGreaterThan(0);
  });

  it("throws when a configured spread has no blurb, so a rename cannot silently drop copy", () => {
    const extra: ReadingConfig = { name: "Mystery Spread", cards: 2, description: "Not in the order" };
    expect(() => aboutSpreads([extra, ...readings])).toThrow(/no blurb for the "Mystery Spread"/);
  });

  it("only carries blurbs for spreads that exist, including Relationship and Career", () => {
    const names = new Set(readings.map((r) => r.name));
    for (const key of Object.keys(SPREAD_BLURBS)) expect(names.has(key)).toBe(true);
    const spreads = aboutSpreads();
    expect(spreads.find((s) => s.name === "Relationship Reading")!.blurb).toBeTruthy();
    expect(spreads.find((s) => s.name === "Career Reading")!.blurb).toBeTruthy();
  });
});

describe("significatorPositions", () => {
  it("returns the five positions in display order with their symbols and config descriptions", () => {
    const positions = significatorPositions();
    expect(positions.map((p) => p.key)).toEqual([
      "day number",
      "star sign",
      "life number",
      "decanate",
      "court royal",
    ]);
    expect(positions.map((p) => p.symbol)).toEqual(["☾", "☉", "∞", "⚶", "♛"]);
    const sig = readings.find((r) => r.name === "Significators")!;
    for (const p of positions) {
      expect(p.description).toBe(sig.positions!.find((c) => c.name === p.key)!.description);
      expect(p.title.length).toBeGreaterThan(0);
    }
  });

  it("throws when a position is missing from the config", () => {
    const sig = readings.find((r) => r.name === "Significators")!;
    const broken: ReadingConfig[] = [
      { ...sig, positions: sig.positions!.filter((p) => p.name !== "decanate") },
    ];
    expect(() => significatorPositions(broken)).toThrow(/decanate/);
  });
});
