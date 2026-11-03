import React from "react";
import { describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import AuthField, { PasswordControl } from "@/components/AuthField";

const renderField = (type: string) =>
  renderToStaticMarkup(
    <AuthField name="password" type={type} label="Password" placeholder="••••••••" />,
  );

const renderControl = (revealed: boolean) =>
  renderToStaticMarkup(
    <PasswordControl name="password" placeholder="••••••••" revealed={revealed} onToggle={vi.fn()} />,
  );

describe("AuthField password visibility", () => {
  it("renders a password field hidden by default, with a Show toggle", () => {
    const html = renderField("password");
    expect(html).toContain('type="password"');
    expect(html).toContain('aria-label="Show password"');
    expect(html).toContain('aria-pressed="false"');
  });

  it("renders no toggle on non-password fields", () => {
    const html = renderField("email");
    expect(html).toContain('type="email"');
    expect(html).not.toContain("aria-pressed");
  });

  it("shows the text and a Hide toggle once revealed", () => {
    const html = renderControl(true);
    expect(html).toContain('type="text"');
    expect(html).toContain('aria-label="Hide password"');
    expect(html).toContain('aria-pressed="true"');
  });

  it("never lets the toggle submit the form", () => {
    expect(renderControl(false)).toContain('type="button"');
    expect(renderControl(true)).toContain('type="button"');
  });

  it("turns off capitalise, autocorrect and spellcheck, hidden or revealed", () => {
    for (const html of [renderControl(false), renderControl(true)]) {
      expect(html).toContain('autoCapitalize="off"');
      expect(html).toContain('autoCorrect="off"');
      expect(html).toContain('spellCheck="false"');
    }
  });

  it("gives the toggle a tooltip matching its label", () => {
    expect(renderControl(false)).toContain('title="Show password"');
    expect(renderControl(true)).toContain('title="Hide password"');
  });

  it("points the input at the hint when one is given", () => {
    const html = renderToStaticMarkup(
      <AuthField
        name="password"
        type="password"
        label="Password"
        placeholder="x"
        hint="8 characters or more"
      />,
    );
    expect(html).toContain('aria-describedby="password-hint"');
    expect(html).toContain('id="password-hint"');
  });

  it("keeps the input name so the submitted field is unchanged when revealed", () => {
    const html = renderControl(true);
    expect(html).toContain('name="password"');
    expect(html).toContain('id="password"');
  });
});
