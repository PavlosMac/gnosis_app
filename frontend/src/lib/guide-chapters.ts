export interface GuideChapter {
  slug: string;
  title: string;
  summary: string;
  symbol: string;
  /** The chapter walks through pages that need a signed-in account */
  requiresAccount: boolean;
}

/** Reading order of the guide. The MDX bodies live in src/content/guide/<slug>.mdx */
export const GUIDE_CHAPTERS: readonly GuideChapter[] = [
  {
    slug: "your-profile",
    title: "Your Profile",
    summary: "Your dashboard: remaining Oracle budget, readings, tags and your personal significators.",
    symbol: "☉",
    requiresAccount: true,
  },
  {
    slug: "making-a-reading",
    title: "Making a Reading",
    summary: "Choose a spread, shuffle and draw your cards.",
    symbol: "✧",
    requiresAccount: false,
  },
  {
    slug: "saving-a-reading",
    title: "Saving a Reading",
    summary: "Keep a reading in your journal with a question and tags.",
    symbol: "☾",
    requiresAccount: true,
  },
  {
    slug: "oracle-interpretation",
    title: "The Oracle's Interpretation",
    summary: "Ask the Oracle to interpret your cards and understand its limits.",
    symbol: "⚝",
    requiresAccount: true,
  },
  {
    slug: "finding-readings",
    title: "Finding Your Readings",
    summary: "Search, filter and sort your journal.",
    symbol: "✦",
    requiresAccount: true,
  },
  {
    slug: "contacting-support",
    title: "Contacting Support",
    summary: "Send a message to the team from your profile.",
    symbol: "✉",
    requiresAccount: true,
  },
  {
    slug: "account-and-privacy",
    title: "Account and Privacy",
    summary: "Manage your consent and delete your account.",
    symbol: "⛨",
    requiresAccount: true,
  },
  {
    slug: "reading-the-cards",
    title: "Reading the Cards",
    summary: "Intent, framing your question, reversed cards and significators.",
    symbol: "☽",
    requiresAccount: false,
  },
];

export const getChapter = (slug: string): GuideChapter | undefined =>
  GUIDE_CHAPTERS.find((c) => c.slug === slug);

export const adjacentChapters = (slug: string): { prev: GuideChapter | null; next: GuideChapter | null } => {
  const i = GUIDE_CHAPTERS.findIndex((c) => c.slug === slug);
  if (i === -1) return { prev: null, next: null };
  return { prev: GUIDE_CHAPTERS[i - 1] ?? null, next: GUIDE_CHAPTERS[i + 1] ?? null };
};
