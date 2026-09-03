import { describe, it, expect } from "vitest";
import {
  interpretRequestSchema,
  readingIdSchema,
} from "@/lib/validation/interpret-schemas";

describe("readingIdSchema", () => {
  it("accepts a Mongo ObjectId", () => {
    expect(readingIdSchema.safeParse("6a991d61c00f6ed3f7412044").success).toBe(true);
  });

  it("rejects anything else (ids are interpolated into backend URLs)", () => {
    for (const bad of [
      "",
      "not-an-id",
      "6a991d61c00f6ed3f741204", // 23 chars
      "6a991d61c00f6ed3f74120445", // 25 chars
      "6A991D61C00F6ED3F7412044", // uppercase
      "../readings/6a991d61c00f",
    ])
      expect(readingIdSchema.safeParse(bad).success).toBe(false);
  });
});

describe("interpretRequestSchema", () => {
  const card = {
    name: "The Fool",
    position: "Past",
    orientation: "upright",
  };

  const request = {
    spread_name: "Past, Present, Future",
    question: "What lies ahead for me?",
    cards: [card],
  };

  it("accepts a valid request", () => {
    expect(interpretRequestSchema.safeParse(request).success).toBe(true);
  });

  it("accepts an optional position_description up to 500 chars", () => {
    const withDescription = {
      ...request,
      cards: [{ ...card, position_description: "a".repeat(500) }],
    };
    expect(interpretRequestSchema.safeParse(withDescription).success).toBe(true);

    const tooLong = {
      ...request,
      cards: [{ ...card, position_description: "a".repeat(501) }],
    };
    expect(interpretRequestSchema.safeParse(tooLong).success).toBe(false);
  });

  it("bounds the question to 5–500 chars when present, allows absence", () => {
    expect(interpretRequestSchema.safeParse({ ...request, question: "Hm?" }).success).toBe(false);
    expect(
      interpretRequestSchema.safeParse({ ...request, question: "a".repeat(501) }).success
    ).toBe(false);
    const { question: _question, ...withoutQuestion } = request;
    expect(interpretRequestSchema.safeParse(withoutQuestion).success).toBe(true);
  });

  it("requires 1–11 cards", () => {
    expect(interpretRequestSchema.safeParse({ ...request, cards: [] }).success).toBe(false);
    expect(
      interpretRequestSchema.safeParse({ ...request, cards: Array(11).fill(card) }).success
    ).toBe(true);
    expect(
      interpretRequestSchema.safeParse({ ...request, cards: Array(12).fill(card) }).success
    ).toBe(false);
  });

  it("validates birth_date format when present", () => {
    expect(
      interpretRequestSchema.safeParse({ ...request, birth_date: "1990-03-12" }).success
    ).toBe(true);
    expect(
      interpretRequestSchema.safeParse({ ...request, birth_date: "12/03/1990" }).success
    ).toBe(false);
  });
});
