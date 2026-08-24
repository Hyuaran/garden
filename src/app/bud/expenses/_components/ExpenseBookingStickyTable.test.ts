import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("expense booking sticky table", () => {
  const source = fs.readFileSync(path.join(process.cwd(), "src/app/bud/expenses/_components/ExpenseBookingPanel.tsx"), "utf8");

  it("uses one bounded scroll region for horizontal scrolling and vertical stickiness", () => {
    expect(source).toContain('const tableScroll: React.CSSProperties = { maxHeight: "min(70vh, 760px)", overflow: "auto", position: "relative"');
    expect(source).toContain('role="region" aria-label="仕訳待ち明細" tabIndex={0}');
  });

  it("sticks the opaque table header above group headers", () => {
    expect(source).toContain('position: "sticky", top: 0, zIndex: 3');
    expect(source).toContain('background: "var(--bg-paper-soft)"');
    expect(source).toContain('color: "var(--text-main)", background: "var(--bg-paper-soft)"');
    expect(source).toContain('borderCollapse: "separate", borderSpacing: 0');
  });
});
