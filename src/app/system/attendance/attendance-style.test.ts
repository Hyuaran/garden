import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(join(process.cwd(), "src/app/system/attendance/attendance.module.css"), "utf8");
const source = readFileSync(join(process.cwd(), "src/app/system/attendance/AttendanceClient.tsx"), "utf8");
const colors = ["#267346", "#31527b", "#a26322", "#6d4c88"];

function contrastWithWhite(hex: string) {
  const channels = hex.slice(1).match(/../g)!.map((part) => parseInt(part, 16) / 255).map((value) => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4);
  const luminance = .2126 * channels[0] + .7152 * channels[1] + .0722 * channels[2];
  return 1.05 / (luminance + .05);
}

describe("attendance Shacho styling", () => {
  it("keeps four distinguishable punch colors with readable white labels", () => {
    for (const color of colors) {
      expect(css).toContain(color);
      expect(contrastWithWhite(color)).toBeGreaterThanOrEqual(4.5);
    }
  });
  it("uses the inherited Shacho card and line tokens for embedded history", () => {
    expect(css).toContain("--attendance-surface:var(--card)");
    expect(css).toContain("--attendance-border:var(--line)");
    expect(css).toMatch(/\.history\s*\{[^}]*border-radius:22px[^}]*box-shadow:var\(--shadow-s\)/);
  });
  it("contains no text check mark or duplicate logout implementation", () => {
    expect(source).not.toContain("✓");
    expect(source).not.toContain("function logout");
    expect(source).toContain('stroke="currentColor"');
  });
});
