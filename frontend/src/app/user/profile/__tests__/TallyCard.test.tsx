import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

// next/image needs the Next runtime; a plain <img> is enough for markup checks
vi.mock("next/image", () => ({
  default: (props: Record<string, unknown>) =>
    React.createElement("img", { alt: String(props.alt ?? "") }),
}));

// TallyCard's dialog calls a server action; the action module pulls in server-only
// code, so it is replaced (the action has its own test)
vi.mock("@/app/user/profile/actions", () => ({ getMajorArcanaMeaning: vi.fn() }));

const { default: TallyCard, TallyCardView } = await import("@/app/user/profile/TallyCard");

const TODAY = { year: 2026, month: 11, day: 3 };
const EMPTY_SLOT =
  /^<div aria-hidden="true" data-testid="tally-card-slot" class="aspect-\[2\/3\] w-full max-w-\[200px\][^"]*"><\/div>$/;

describe("TallyCardView", () => {
  it("shows the personal day card with its number once today is known", () => {
    const html = renderToStaticMarkup(<TallyCardView birthDate="1990-05-01" today={TODAY} />);
    expect(html).toMatch(/data-testid="tally-card"/);
    expect(html).toContain("Card of the Day");
    expect(html).toContain("The Hanged Man");
    expect(html).not.toContain("tally-card-slot");
  });

  it("makes the card a button that opens the meaning dialog", () => {
    const html = renderToStaticMarkup(<TallyCardView birthDate="1990-05-01" today={TODAY} />);
    expect(html).toMatch(
      /<button type="button"[^>]*aria-haspopup="dialog"[^>]*aria-label="About The Hanged Man"/
    );
    expect(html).toContain("Tap the card to read it");
  });

  it("renders exactly the empty slot before today is known (the server render)", () => {
    expect(renderToStaticMarkup(<TallyCardView birthDate="1990-05-01" today={null} />)).toMatch(
      EMPTY_SLOT,
    );
  });

  it("renders the empty slot for an account without a birth date", () => {
    expect(renderToStaticMarkup(<TallyCardView birthDate={null} today={TODAY} />)).toMatch(
      EMPTY_SLOT,
    );
    expect(renderToStaticMarkup(<TallyCardView birthDate="nope" today={TODAY} />)).toMatch(
      EMPTY_SLOT,
    );
  });
});

describe("TallyCard", () => {
  it("renders the empty slot on the server whatever the birth date, so hydration matches", () => {
    // Effects never run in a static render, so `today` stays null
    expect(renderToStaticMarkup(<TallyCard birthDate="1990-05-01" />)).toMatch(EMPTY_SLOT);
    expect(renderToStaticMarkup(<TallyCard birthDate={null} />)).toMatch(EMPTY_SLOT);
  });
});
