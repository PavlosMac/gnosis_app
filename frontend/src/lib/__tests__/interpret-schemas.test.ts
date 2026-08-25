import { describe, it, expect } from "vitest";
import {
  interpretationSettingsSchema,
  saveInterpretationSchema,
} from "@/lib/validation/interpret-schemas";

const validSettings = { lens: "traditional", intent: "reflective", depth: 60 };

describe("interpretationSettingsSchema", () => {
  it("accepts every lens and intent", () => {
    for (const lens of ["traditional", "psychological", "esoteric", "alchemical"])
      for (const intent of ["reflective", "predictive"])
        expect(
          interpretationSettingsSchema.safeParse({ lens, intent, depth: 0 }).success
        ).toBe(true);
  });

  it("rejects unknown lenses and intents (including the old style values)", () => {
    expect(
      interpretationSettingsSchema.safeParse({ ...validSettings, lens: "practical" }).success
    ).toBe(false);
    expect(
      interpretationSettingsSchema.safeParse({ ...validSettings, intent: "spiritual" }).success
    ).toBe(false);
  });

  it("bounds depth to integer 0–100", () => {
    expect(interpretationSettingsSchema.safeParse({ ...validSettings, depth: 100 }).success).toBe(true);
    expect(interpretationSettingsSchema.safeParse({ ...validSettings, depth: -1 }).success).toBe(false);
    expect(interpretationSettingsSchema.safeParse({ ...validSettings, depth: 101 }).success).toBe(false);
    expect(interpretationSettingsSchema.safeParse({ ...validSettings, depth: 60.5 }).success).toBe(false);
  });
});

describe("saveInterpretationSchema", () => {
  const interpretation = {
    card_interpretations: [
      {
        card_name: "The Fool",
        position: "Past",
        orientation: "upright",
        interpretation: "A leap.",
      },
    ],
    synthesis: "The path is clear.",
    model: "test-model",
    tokens_used: 100,
    settings: validSettings,
  };

  it("accepts a full interpretation", () => {
    expect(saveInterpretationSchema.safeParse(interpretation).success).toBe(true);
  });

  it("requires settings", () => {
    const { settings: _settings, ...withoutSettings } = interpretation;
    expect(saveInterpretationSchema.safeParse(withoutSettings).success).toBe(false);
  });
});
