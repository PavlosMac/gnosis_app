import { describe, expect, it } from "vitest";
import {
  MIN_PASSWORD_LENGTH,
  PASSWORD_HINT,
  containsPersonalInfo,
} from "@/lib/password-policy";

const ADA = { email: "ada.byron@example.com", firstName: "Ada", lastName: "Lovelace" };

describe("containsPersonalInfo", () => {
  it("finds the first name, last name or email local part, in any case", () => {
    expect(containsPersonalInfo("plum-ADA-harbour-42", ADA)).toBe(true);
    expect(containsPersonalInfo("lovelace-plum-harbour", ADA)).toBe(true);
    expect(containsPersonalInfo("xx-Ada.Byron-harbour", ADA)).toBe(true);
  });

  it("is false for an unrelated password", () => {
    expect(containsPersonalInfo("plum-harbour-lantern-42", ADA)).toBe(false);
  });

  it("ignores parts shorter than three characters", () => {
    expect(containsPersonalInfo("plum-lilac-harbour-42", { firstName: "Li" })).toBe(false);
  });

  it("checks only the local part of the email", () => {
    expect(containsPersonalInfo("plum-example.com-harbour", { email: "ada@example.com" })).toBe(
      false
    );
  });

  it("tolerates missing or blank context", () => {
    expect(containsPersonalInfo("plum-harbour-lantern-42", {})).toBe(false);
    expect(containsPersonalInfo("plum-harbour", { email: "", firstName: "  ", lastName: null })).toBe(
      false
    );
  });
});

describe("policy constants", () => {
  it("mirror the backend minimum and state it in the hint", () => {
    expect(MIN_PASSWORD_LENGTH).toBe(12);
    expect(PASSWORD_HINT).toContain("12");
  });
});
