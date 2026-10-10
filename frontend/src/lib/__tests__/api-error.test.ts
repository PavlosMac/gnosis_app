import { describe, expect, it } from "vitest";
import { readErrorBody, readErrorCode } from "@/lib/api-error";

describe("readErrorCode", () => {
  it("returns the code when the body carries a string code", () => {
    expect(readErrorCode('{"detail":"x","code":"email_not_verified"}')).toBe(
      "email_not_verified"
    );
  });

  it("is undefined for a body without a string code", () => {
    expect(readErrorCode('{"detail":"x"}')).toBeUndefined();
    expect(readErrorCode('{"code":42}')).toBeUndefined();
    expect(readErrorCode('{"code":""}')).toBeUndefined();
    expect(readErrorCode("[1,2]")).toBeUndefined();
    expect(readErrorCode("null")).toBeUndefined();
  });

  it("is undefined for a non-JSON body (proxy error pages)", () => {
    expect(readErrorCode("<html>502 Bad Gateway</html>")).toBeUndefined();
    expect(readErrorCode("")).toBeUndefined();
  });
});

describe("readErrorBody", () => {
  it("returns the code and the string detail together", () => {
    expect(readErrorBody('{"detail":"Too common.","code":"weak_password"}')).toEqual({
      code: "weak_password",
      detail: "Too common.",
    });
  });

  it("drops a non-string detail (FastAPI validation errors are a list)", () => {
    expect(readErrorBody('{"detail":[{"loc":["body"]}]}')).toEqual({});
  });

  it("is empty for a non-JSON body", () => {
    expect(readErrorBody("<html>")).toEqual({});
  });
});
