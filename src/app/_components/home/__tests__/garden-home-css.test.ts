import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(join(process.cwd(), "src/app/_components/home/garden-home.module.css"), "utf8");

describe("Garden series card home CSS", () => {
  it("keeps equal card rows and vertically stacked names", () => {
    expect(css).toMatch(/\.grid\s*\{[^}]*grid-auto-rows:1fr/);
    expect(css).toMatch(/\.card\s*\{[^}]*height:100%/);
    expect(css).toMatch(/\.cardName\s*\{[^}]*flex-direction:column/);
  });

  it("keeps a fixed full-page background and a separate dark heading color", () => {
    expect(css).toMatch(/--heading:#10233f/);
    expect(css).toMatch(/--heading:#c8d6ea/);
    expect(css).toMatch(/\.pageShell::before\s*\{[^}]*position:fixed[^}]*background:var\(--bg\)/);
  });
});
