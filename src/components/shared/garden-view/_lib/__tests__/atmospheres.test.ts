import { describe, it, expect } from "vitest";
import { resolveAtmosphereParam, ATMOSPHERE_COUNT, ATMOSPHERES } from "../atmospheres";

describe("resolveAtmosphereParam", () => {
  it("returns 0 when undefined", () => {
    expect(resolveAtmosphereParam(undefined)).toBe(0);
  });
  it("returns 0 when not a string", () => {
    expect(resolveAtmosphereParam(["1"])).toBe(0);
  });
  it("returns 0 when not a number", () => {
    expect(resolveAtmosphereParam("abc")).toBe(0);
  });
  it("returns 0 when negative", () => {
    expect(resolveAtmosphereParam("-1")).toBe(0);
  });
  it("returns 0 when >= ATMOSPHERE_COUNT (6)", () => {
    expect(resolveAtmosphereParam("6")).toBe(0);
    expect(resolveAtmosphereParam("100")).toBe(0);
  });
  it("returns N for valid 0..5", () => {
    for (let n = 0; n < ATMOSPHERE_COUNT; n++) {
      expect(resolveAtmosphereParam(String(n))).toBe(n);
    }
  });
});

describe("ATMOSPHERES data integrity", () => {
  it("has exactly 6 entries", () => {
    expect(ATMOSPHERES).toHaveLength(6);
  });
  it("ids are sequential 0..5", () => {
    ATMOSPHERES.forEach((atm, i) => expect(atm.id).toBe(i));
  });
  it("all imagePath start with /themes/atmospheres/", () => {
    ATMOSPHERES.forEach((atm) => {
      expect(atm.imagePath).toMatch(/^\/themes\/atmospheres\/0[1-6]-.+\.webp$/);
    });
  });
});
