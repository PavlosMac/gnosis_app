import React from "react";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import AuthField from "@/components/AuthField";

const html = renderToStaticMarkup(
  <AuthField
    name="birthDate"
    type="date"
    label="Date of birth"
    placeholder=""
    autoComplete="bday"
    min="1900-01-01"
    defaultValue="1990-06-15"
    required
  />,
);

describe("AuthField date input", () => {
  it("renders a native date control with the static lower bound and no max", () => {
    expect(html).toContain('type="date"');
    expect(html).toContain('min="1900-01-01"');
    // A render-time "today" would differ between server and client; zod holds
    // the upper bound instead
    expect(html).not.toContain("max=");
  });

  it("asks the browser for the birthday and keeps the posted value after a failed submit", () => {
    expect(html).toContain('autoComplete="bday"');
    expect(html).toContain('value="1990-06-15"');
  });

  it("uses the dark colour scheme so the native picker icon is visible", () => {
    expect(html).toContain("color-scheme:dark");
  });

  it("leaves text inputs without a colour scheme", () => {
    const text = renderToStaticMarkup(
      <AuthField name="firstName" type="text" label="First Name" placeholder="x" />,
    );
    expect(text).not.toContain("color-scheme");
  });
});
