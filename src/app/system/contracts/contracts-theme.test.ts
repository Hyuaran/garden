import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(resolve(process.cwd(), "src/app/system/contracts/contracts.module.css"), "utf8");

describe("contracts theme CSS", () => {
  it("uses the shared System dark palette for page surfaces and text", () => {
    expect(css).toMatch(/\[data-theme="dark"\][^{]*\.pageShell\{/);
    for (const declaration of [
      "--bg:#0c1726",
      "--card:#152438",
      "--field:#0f1e30",
      "--line:#31435a",
      "--ink:#edf4fb",
      "--navy:#c8d6ea",
      "--sub:#b7c5d4",
    ]) {
      expect(css).toContain(declaration);
    }
  });

  it("routes every light surface through theme variables", () => {
    expect(css).toContain(".folder,.file{");
    expect(css).toContain("background:var(--card);color:var(--ink)");
    expect(css).toContain("background:var(--field);color:var(--ink)");
    expect(css).toContain("background:var(--drop);color:var(--ink)");
    expect(css).toContain("background:var(--tealSoft)");
    expect(css).not.toMatch(/\.folder,.file\{[^}]*background:#fff/);
    expect(css).not.toMatch(/\.dialog\{[^}]*background:#fff/);
    expect(css).not.toMatch(/\.dropZone\{[^}]*background:#f7f8fa/);
  });

  it("preserves the existing light palette values", () => {
    for (const declaration of [
      "--bg:#f4f5f7",
      "--card:#fff",
      "--field:#fff",
      "--drop:#f7f8fa",
      "--tealSoft:#e9f7f6",
      "--strongLine:#cbd7e5",
    ]) {
      expect(css).toContain(declaration);
    }
  });
});
