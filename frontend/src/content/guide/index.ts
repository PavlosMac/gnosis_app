import type { ComponentType } from "react";
import type { MDXComponents } from "mdx/types";
import YourProfile from "./your-profile.mdx";
import MakingAReading from "./making-a-reading.mdx";
import SavingAReading from "./saving-a-reading.mdx";
import OracleInterpretation from "./oracle-interpretation.mdx";
import FindingReadings from "./finding-readings.mdx";
import ContactingSupport from "./contacting-support.mdx";
import AccountAndPrivacy from "./account-and-privacy.mdx";
import ReadingTheCards from "./reading-the-cards.mdx";

/** Static slug -> MDX body map (keys must match GUIDE_CHAPTERS in src/lib/guide-chapters.ts;
    a test enforces it). Static imports because Turbopack cannot resolve template-string MDX imports. */
export const GUIDE_BODIES: Record<string, ComponentType<{ components?: MDXComponents }>> = {
  "your-profile": YourProfile,
  "making-a-reading": MakingAReading,
  "saving-a-reading": SavingAReading,
  "oracle-interpretation": OracleInterpretation,
  "finding-readings": FindingReadings,
  "contacting-support": ContactingSupport,
  "account-and-privacy": AccountAndPrivacy,
  "reading-the-cards": ReadingTheCards,
};
