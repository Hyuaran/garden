import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(join(process.cwd(), "src/app/system/_components/ShachoShell/shacho-shell.module.css"), "utf8");
const shellRule = css.match(/\.shell\{([^}]+)\}/)?.[1] ?? "";
const darkShellRule = css.match(/:global\(\[data-theme="dark"\]\) \.shell\{([^}]+)\}/)?.[1] ?? "";
const railRule = css.match(/\.rail\{([^}]+)\}/)?.[1] ?? "";
const railInnerRule = css.match(/\.railInner\{([^}]+)\}/)?.[1] ?? "";
const appRule = css.match(/\.app\{([^}]+)\}/)?.[1] ?? "";
const currentBarRule = css.match(/\.current::before\{([^}]+)\}/)?.[1] ?? "";
const sideRule = css.match(/\.side\{([^}]+)\}/)?.[1] ?? "";
const sideInnerRule = css.match(/\.sideInner\{([^}]+)\}/)?.[1] ?? "";
const actionsRule = css.match(/\.actions\{([^}]+)\}/)?.[1] ?? "";
const mainFullRule = css.match(/\.mainFull\{([^}]+)\}/)?.[1] ?? "";
const navigationProgressRule = css.match(/\.navigationProgress\{([^}]+)\}/)?.[1] ?? "";

describe("ShachoShell rail layout", () => {
  it("lets tooltips extend beyond the rail without rail scrollbars", () => {
    expect(railRule).toContain("overflow:visible");
    expect(railInnerRule).toContain("overflow:visible");
    expect(railRule).not.toMatch(/overflow(?:-x|-y)?:auto/);
    expect(railInnerRule).not.toMatch(/overflow(?:-x|-y)?:(?:auto|scroll)/);
    expect(css).toMatch(/\.railTip\{[^}]*position:absolute[^}]*left:52px/);
  });

  it("keeps the compact rail content sticky without clipping tooltips", () => {
    expect(railRule).toContain("position:relative");
    expect(railRule).toContain("min-height:100vh");
    expect(railRule).toContain("height:auto");
    expect(railRule).not.toContain("position:sticky");
    expect(railInnerRule).toContain("position:sticky");
    expect(railInnerRule).toContain("top:0");
    expect(railInnerRule).toContain("display:flex");
    expect(railInnerRule).toContain("flex-direction:column");
    expect(railInnerRule).toContain("align-items:center");
    expect(railInnerRule).toContain("gap:6px");
    expect(railInnerRule).toContain("padding:10px 0 12px");
    expect(appRule).toContain("width:40px");
    expect(appRule).toContain("height:40px");
    expect(appRule).toContain("flex:0 0 40px");
    expect(css).toMatch(/\.app>svg\{[^}]*width:20px[^}]*height:20px/);
  });

  it("keeps the rail backgrounds fixed and leaves glass icons unglowed", () => {
    expect(shellRule).toContain("--rail:#0a1424");
    expect(shellRule).toContain("--side:#0f1f36");
    expect(darkShellRule).toContain("--rail:#0a1424");
    expect(darkShellRule).toContain("--side:#0f1f36");
    expect(appRule).toContain("width:40px");
    expect(appRule).toContain("height:40px");
    expect(css.match(/\.app>svg\{([^}]+)\}/)?.[1]).not.toContain("drop-shadow");
    expect(css).toContain(".app:not(.current)>svg{filter:brightness(.78)}");
    expect(css).toContain(".app:not(.current):hover>svg{filter:brightness(1)}");
    expect(currentBarRule).toContain("width:4px");
    expect(currentBarRule).toContain("height:28px");
    expect(currentBarRule).toContain("background:#fff");
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

  it("keeps the shared actions above page headers and below their tooltips", () => {
    expect(actionsRule).toContain("z-index:10");
    expect(css).toMatch(/\.actionTip\{[^}]*z-index:30/);
  });

  it("centers the sidebarless main while retaining the base max width", () => {
    expect(mainFullRule).toContain("width:100%");
    expect(mainFullRule).toContain("margin:0 auto");
    expect(mainFullRule).toContain("box-sizing:border-box");
    expect(mainFullRule).not.toContain("max-width");
    expect(css.match(/\.main\{([^}]+)\}/)?.[1]).toContain("max-width:1180px");
  });

  it("shows a thin theme-colored pending bar without covering content", () => {
    expect(navigationProgressRule).toContain("position:fixed");
    expect(navigationProgressRule).toContain("height:2px");
    expect(navigationProgressRule).toContain("background:var(--teal)");
    expect(navigationProgressRule).toContain("pointer-events:none");
    expect(navigationProgressRule).not.toMatch(/(?:width|height):100v/);
    expect(css).toContain("@keyframes systemNavigationProgress");
  });

  it("hides only the scrollbar appearance and keeps native scrolling", () => {
    expect(css).toMatch(/\.nav\{[^}]*overflow-y:auto/);
    expect(css).toMatch(/\.nav\{[^}]*scrollbar-width:none/);
    expect(css).toContain(".nav::-webkit-scrollbar,.sideInner::-webkit-scrollbar{display:none}");
    expect(css).toContain("scroll-padding-block:20px");
    expect(css).toContain("scroll-margin-block:20px");
  });

  it("uses theme-colored non-interactive fade overlays outside the scroll area", () => {
    expect(css).toMatch(/\.navFrame\{[^}]*position:relative[^}]*min-height:0/);
    expect(css).toMatch(/\.scrollFade\{[^}]*pointer-events:none/);
    expect(css).toContain("linear-gradient(to bottom,var(--side),transparent)");
    expect(css).toContain("linear-gradient(to top,var(--side),transparent)");
  });
});
