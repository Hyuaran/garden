import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(join(process.cwd(), "src/app/system/_components/ShachoShell/shacho-shell.module.css"), "utf8");
const shellRule = css.match(/\.shell\{([^}]+)\}/)?.[1] ?? "";
const railRule = css.match(/\.rail\{([^}]+)\}/)?.[1] ?? "";
const sideRule = css.match(/\.side\{([^}]+)\}/)?.[1] ?? "";
const sideInnerRule = css.match(/\.sideInner\{([^}]+)\}/)?.[1] ?? "";

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

  it("stretches the shell and both dark columns to long page content", () => {
    expect(shellRule).toContain("flex-shrink:0");
    expect(shellRule).not.toContain("height:max-content");
    expect(shellRule).toContain("min-height:100vh");
    expect(shellRule).toContain("align-items:stretch");
    expect(railRule).toContain("align-self:stretch");
    expect(sideRule).toContain("align-self:stretch");
    expect(sideRule).toContain("min-height:100vh");
    expect(sideRule).toContain("height:auto");
    expect(sideRule).not.toMatch(/(?:^|;)height:100vh/);
    expect(sideRule).not.toContain("position:sticky");
  });

  it("keeps the sidebar content visible while its outer background stretches", () => {
    expect(sideInnerRule).toContain("position:sticky");
    expect(sideInnerRule).toContain("top:0");
    expect(sideInnerRule).toContain("max-height:100vh");
    expect(sideInnerRule).toContain("display:flex");
    expect(sideInnerRule).toContain("flex-direction:column");
    expect(sideInnerRule).toContain("overflow-y:auto");
    expect(railRule).toContain("overflow:visible");
  });
});
