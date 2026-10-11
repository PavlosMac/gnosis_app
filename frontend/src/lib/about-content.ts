/**
 * Data behind the /about page: the Tree of Life geometry and selectors that pull the
 * spread and position descriptions out of readings-config.json so the article never
 * duplicates them. Every selector takes the config as a parameter so tests can pass
 * fixtures; the default is the real file.
 */
import readingsConfig from "@/lib/readings-config.json";
import { isBirthdateSpread } from "@/lib/reading-positions";
import type { PositionConfig, ReadingConfig } from "@/types/reading";

const defaultConfig = readingsConfig.readings as ReadingConfig[];

export type Pillar = "severity" | "equilibrium" | "mercy";

export interface TreeNode {
  name: string;
  x: number;
  y: number;
  pillar: Pillar;
  /** Daath: the hidden sephira, drawn dashed and joined by no path */
  hidden?: boolean;
}

export interface TreeOfLifeNode extends TreeNode {
  description: string;
}

export type TreePath = readonly [string, string];

export const TREE_VIEWBOX_WIDTH = 300;
export const TREE_VIEWBOX_HEIGHT = 520;
export const TREE_VIEWBOX = `0 0 ${TREE_VIEWBOX_WIDTH} ${TREE_VIEWBOX_HEIGHT}`;

const SEVERITY_X = 60;
const EQUILIBRIUM_X = 150;
const MERCY_X = 240;

// Row order mirrors KabbalahLayout.tsx / SpreadPreview.TREE_ROWS: Severity on the left,
// Mercy on the right, Daath between the first two pairs.
export const TREE_NODES: readonly TreeNode[] = [
  { name: "Kether", x: EQUILIBRIUM_X, y: 40, pillar: "equilibrium" },
  { name: "Binah", x: SEVERITY_X, y: 100, pillar: "severity" },
  { name: "Chokmah", x: MERCY_X, y: 100, pillar: "mercy" },
  { name: "Daath", x: EQUILIBRIUM_X, y: 160, pillar: "equilibrium", hidden: true },
  { name: "Geburah", x: SEVERITY_X, y: 220, pillar: "severity" },
  { name: "Chesed", x: MERCY_X, y: 220, pillar: "mercy" },
  { name: "Tiphereth", x: EQUILIBRIUM_X, y: 280, pillar: "equilibrium" },
  { name: "Hod", x: SEVERITY_X, y: 340, pillar: "severity" },
  { name: "Netzach", x: MERCY_X, y: 340, pillar: "mercy" },
  { name: "Yesod", x: EQUILIBRIUM_X, y: 400, pillar: "equilibrium" },
  { name: "Malkuth", x: EQUILIBRIUM_X, y: 480, pillar: "equilibrium" },
];

/** The 22 paths of the Golden Dawn tree. Daath sits on none. */
export const TREE_PATHS: readonly TreePath[] = [
  ["Kether", "Chokmah"],
  ["Kether", "Binah"],
  ["Kether", "Tiphereth"],
  ["Chokmah", "Binah"],
  ["Chokmah", "Tiphereth"],
  ["Chokmah", "Chesed"],
  ["Binah", "Tiphereth"],
  ["Binah", "Geburah"],
  ["Chesed", "Geburah"],
  ["Chesed", "Tiphereth"],
  ["Chesed", "Netzach"],
  ["Geburah", "Tiphereth"],
  ["Geburah", "Hod"],
  ["Tiphereth", "Netzach"],
  ["Tiphereth", "Hod"],
  ["Tiphereth", "Yesod"],
  ["Netzach", "Hod"],
  ["Netzach", "Yesod"],
  ["Netzach", "Malkuth"],
  ["Hod", "Yesod"],
  ["Hod", "Malkuth"],
  ["Yesod", "Malkuth"],
];

const TREE_OF_LIFE_SPREAD = "Tree of Life";
const SIGNIFICATORS_SPREAD = "Significators";

const findSpread = (cfg: readonly ReadingConfig[], name: string): ReadingConfig => {
  const spread = cfg.find((r) => r.name === name);
  if (!spread) throw new Error(`readings-config.json has no "${name}" spread`);
  return spread;
};

const findPosition = (spread: ReadingConfig, name: string): PositionConfig => {
  const key = name.trim().toLowerCase();
  const position = spread.positions?.find((p) => p.name.trim().toLowerCase() === key);
  if (!position) throw new Error(`"${spread.name}" spread has no "${name}" position`);
  return position;
};

/** The 11 sephiroth with their reading-position descriptions, in TREE_NODES order. */
export const treeOfLifeNodes = (cfg: readonly ReadingConfig[] = defaultConfig): TreeOfLifeNode[] => {
  const spread = findSpread(cfg, TREE_OF_LIFE_SPREAD);
  return TREE_NODES.map((node) => ({ ...node, description: findPosition(spread, node.name).description }));
};

/** Longer article copy per spread, keyed by the exact config name. */
export const SPREAD_BLURBS: Record<string, string> = {
  "Single Card":
    "The single card reading gives you one answer card. Less useful than a two card reading, but better than nothing.",
  "Two Card":
    "Two cards to meditate and reflect on. Enough to hold a subject in tension: one card answers the other.",
  "Three Card":
    "Three cards give adequate information on the subject at hand and a little more room for a story to unfold than two.",
  "Past, Present, Future":
    "A timeline: a look back at what has been going on in our lives, an observation of our current circumstances and what may lie ahead. This can be a really powerful reading and offer an intense 'wow' moment.",
  "Fire, Water, Air, Earth":
    "Insight into 'being' in the four worlds: passion, emotion, thought and matter. It provides rich information on where we stand within those elemental realms. A very insightful and meaningful reading for the novice and the advanced reader alike.",
  "Relationship Reading":
    "Nine cards in three pillars: you, the other person, and the relationship that stands between you. Name the two outer pillars so the reading can concern anyone, and compare how each side behaves, what each wants and where the bond is heading.",
  "Career Reading":
    "Five cards for the working life: where you stand, the challenge in front of you, the opportunity you may be missing, the likely outcome and the step to take next.",
  "Tree of Life":
    "The classic Kabbalistic spread. Eleven sephiroth, one card for each, every zone carrying its own meaning for past, present and future influences. A divination art of its own.",
  Significators:
    "Not a spread you draw but a chart you are born with. Enter a birth date and the Oracle deduces the cards that reference core character, challenges, strengths and destiny.",
};

export interface AboutSpread {
  name: string;
  description: string;
  /** Cards drawn from the deck; null for the birth-date chart */
  cardCount: number | null;
  blurb?: string;
}

/**
 * Display order for the Reading Oracle section: open-question spreads by size, then the
 * positional spreads, then the chart. Independent of readings-config.json, whose order
 * drives the oracle's picker. A spread missing from this list goes last, in config order.
 */
export const ABOUT_SPREAD_ORDER: readonly string[] = [
  "Single Card",
  "Two Card",
  "Three Card",
  "Past, Present, Future",
  "Fire, Water, Air, Earth",
  "Relationship Reading",
  "Career Reading",
  "Tree of Life",
  "Significators",
];

const displayRank = (name: string): number => {
  const i = ABOUT_SPREAD_ORDER.indexOf(name);
  return i === -1 ? ABOUT_SPREAD_ORDER.length : i;
};

/** Every configured spread, in ABOUT_SPREAD_ORDER, for the Reading Oracle section. */
export const aboutSpreads = (cfg: readonly ReadingConfig[] = defaultConfig): AboutSpread[] =>
  cfg
    .map((r, configIndex) => ({ r, configIndex }))
    .sort((a, b) => displayRank(a.r.name) - displayRank(b.r.name) || a.configIndex - b.configIndex)
    .map(({ r }) => {
      const blurb = SPREAD_BLURBS[r.name];
      if (!blurb) throw new Error(`SPREAD_BLURBS has no blurb for the "${r.name}" spread`);
      return {
        name: r.name,
        description: r.description ?? "",
        cardCount: isBirthdateSpread(r) ? null : (r.cards ?? null),
        blurb,
      };
    });

/** Symbols and titles as SignificatorsLayout.tsx shows them, in its display order. */
export const SIGNIFICATOR_SYMBOLS: readonly { key: string; symbol: string; title: string }[] = [
  { key: "day number", symbol: "☾", title: "Day Number" },
  { key: "star sign", symbol: "☉", title: "Astrological Sign" },
  { key: "life number", symbol: "∞", title: "Life Numbers" },
  { key: "decanate", symbol: "⚶", title: "Decanate" },
  { key: "court royal", symbol: "♛", title: "Court Royal" },
];

export interface SignificatorPosition {
  key: string;
  symbol: string;
  title: string;
  description: string;
}

/** The five significator positions with their config descriptions. */
export const significatorPositions = (
  cfg: readonly ReadingConfig[] = defaultConfig
): SignificatorPosition[] => {
  const spread = findSpread(cfg, SIGNIFICATORS_SPREAD);
  return SIGNIFICATOR_SYMBOLS.map((s) => ({ ...s, description: findPosition(spread, s.key).description }));
};
