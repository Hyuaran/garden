import { describe, it, expect } from "vitest";
import { getPostLoginRedirect } from "../auth-redirect";

describe("getPostLoginRedirect", () => {
  const home = "/";
  const tree = "/tree";
  const leafKanden = "/leaf/kanden";

  it.each([
    ["super_admin", home],
    ["admin", home],
    ["manager", home],
    ["staff", home],
    ["cs", home],
    ["closer", tree],
    ["toss", tree],
    ["outsource", leafKanden],
  ])("returns %s → %s", (role, expected) => {
    expect(getPostLoginRedirect(role)).toBe(expected);
  });

  it("returns / for unknown role", () => {
    expect(getPostLoginRedirect("unknown_role")).toBe("/");
  });

  it("returns / for null", () => {
    expect(getPostLoginRedirect(null)).toBe("/");
  });

  it("returns / for undefined", () => {
    expect(getPostLoginRedirect(undefined)).toBe("/");
  });
});
