import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(join(process.cwd(), "src/app/system/_components/ShachoShell/shacho-shell.module.css"), "utf8");
const railRule = css.match(/\.rail\{([^}]+)\}/)?.[1] ?? "";

describe("ShachoShell rail layout", () => {
  it("lets tooltips extend beyond the rail without rail scrollbars", () => {
    expect(railRule).toContain("overflow:visible");
    expect(railRule).not.toMatch(/overflow(?:-x|-y)?:auto/);
    expect(css).toMatch(/\.railTip\{[^}]*position:absolute[^}]*left:52px/);
  });

  it("uses page scrolling when the complete rail is taller than the viewport", () => {
    expect(railRule).toContain("position:relative");
    expect(railRule).toContain("min-height:100vh");
    expect(railRule).toContain("height:auto");
    expect(railRule).not.toContain("position:sticky");
  });
});
