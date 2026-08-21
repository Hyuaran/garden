import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(join(process.cwd(), "src/app/system/attendance/attendance.module.css"), "utf8");

describe("attendance theme styles", () => {
  it("defines light, preferred dark, and explicit dark theme variables", () => {
    expect(css).toContain(":global(:root)");
    expect(css).toContain("@media (prefers-color-scheme: dark)");
    expect(css).toContain(':global([data-theme="dark"])');
    expect(css.match(/--attendance-heading:/g)).toHaveLength(3);
    expect(css.match(/--attendance-ink:/g)).toHaveLength(3);
  });

  it("keeps the four established punch button colors", () => {
    expect(css).toMatch(/\.clock_in\s*\{\s*background:\s*#267346/);
    expect(css).toMatch(/\.clock_out\s*\{\s*background:\s*#31527b/);
    expect(css).toMatch(/\.break_start\s*\{\s*background:\s*#a26322/);
    expect(css).toMatch(/\.break_end\s*\{\s*background:\s*#6d4c88/);
  });
});
