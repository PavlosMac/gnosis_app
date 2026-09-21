import { describe, it, expect } from "vitest";
import cfg from "@/lib/readings-config.json";
import { calculateSignificators } from "@/lib/significators";
import {
  convertSignificatorsToReadingResult,
  lifeNumberCardNote,
} from "@/lib/significator-conversion";
import { getCardByIndex } from "@/services/cardLookup";
import { buildReadingPayload } from "@/lib/reading-payload";
import { interpretRequestSchema } from "@/lib/validation/interpret-schemas";
import { COURT_ROYALS } from "@/lib/court-royals";
import { getCourtRoyal } from "@/lib/significators";

const sig = cfg.readings.find((r) => r.name === "Significators")!;
const configDescriptions = Object.fromEntries(
  sig.positions!.map((p) => [p.name, p.description])
);

const convert = (y: number, m: number, d: number) =>
  convertSignificatorsToReadingResult(
    calculateSignificators(y, m, d),
    `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`,
    configDescriptions
  );

describe("convertSignificatorsToReadingResult", () => {
  it("keys life numbers internally and appends the court royal", () => {
    const result = convert(1990, 5, 1);
    const keys = Object.keys(result.positions);
    expect(keys[0]).toBe("day number");
    expect(keys.filter((k) => k.startsWith("life number")).length).toBeGreaterThanOrEqual(2);
    expect(keys).toContain("court royal");
    expect(keys.at(-1)).toBe("court royal");
  });

  it("sends life numbers un-numbered on the wire and passes the request schema", () => {
    const result = convert(1990, 5, 1);
    const payload = buildReadingPayload(result);
    const life = payload.cards.filter((c) => c.position === "life number");
    expect(life.length).toBeGreaterThanOrEqual(2);
    expect(payload.cards.some((c) => /life number \d/.test(c.position))).toBe(false);
    // descriptions still come from the config text
    expect(life[0].position_description).toContain("numerology");
    expect(interpretRequestSchema.safeParse(payload).success).toBe(true);
  });

  it("keeps every position description within the backend limit for all 12 royals", () => {
    for (const { pips } of COURT_ROYALS) {
      // find a real date for each royal via its middle pip
      let found = false;
      for (let m = 1; m <= 12 && !found; m++) {
        for (let d = 1; d <= 31 && !found; d++) {
          const royal = getCourtRoyal(d, m);
          if (royal && pips.includes(calculateSignificators(2001, m, d).decanate?.decanateCard ?? "")) {
            const result = convert(2001, m, d);
            for (const desc of Object.values(result.positionDescriptions!)) {
              expect(desc.length).toBeLessThanOrEqual(500);
            }
            found = true;
          }
        }
      }
      expect(found).toBe(true);
    }
  });

  it("omits the court royal position when none applies", () => {
    const base = calculateSignificators(1990, 5, 1);
    const result = convertSignificatorsToReadingResult({ ...base, courtRoyal: null });
    expect(Object.keys(result.positions)).not.toContain("court royal");
  });
});

describe("life number card notes", () => {
  it("tells each card of an 18 Mar 2024 chart (life number 20) apart", () => {
    const result = convert(2024, 3, 18);
    const life = Object.entries(result.positionDescriptions!)
      .filter(([key]) => key.startsWith("life number"))
      .map(([key, desc]) => [result.positions[key].name, desc] as const);
    expect(life.map(([name]) => name)).toEqual(["The High Priestess", "Justice", "Judgement"]);
    const [priestess, justice, judgement] = life.map(([, desc]) => desc);
    expect(priestess).toContain("Your life number is 20. This card is number 2, the single-digit root");
    expect(justice).toContain("This card is number 11, which reduces to the same root, 2.");
    expect(judgement).toContain("This card, number 20, bears your life number itself.");
  });

  it("counts The Fool as 22", () => {
    const fool = getCardByIndex(0);
    expect(lifeNumberCardNote(fool, 22)).toBe("This card, number 22, bears your life number itself.");
    expect(lifeNumberCardNote(fool, 13)).toBe(
      "This card is number 22, which reduces to the same root, 4."
    );
    expect(lifeNumberCardNote(getCardByIndex(4), 22)).toContain("the single-digit root");
  });

  it("a single-digit life number is its own root", () => {
    expect(lifeNumberCardNote(getCardByIndex(7), 7)).toBe(
      "This card, number 7, bears your life number itself."
    );
  });
});
