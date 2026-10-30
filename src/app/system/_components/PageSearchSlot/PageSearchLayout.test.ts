import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");
it("keeps actions floating and reserves 36px plus a 6px gap", () => {
  const slot = read("./PageSearchSlot.module.css");
  expect(slot).toContain("position:absolute; top:calc(100% + 6px); right:0; width:100%; height:36px");
  expect(slot).toContain("@media(max-width:800px)");
  const shell = read("../ShachoShell/shacho-shell.module.css");
  expect(shell).toContain(".actions{position:absolute");
  expect(shell).not.toContain(":has([data-page-search-slot]");
  expect(read("../../../rill/_components/RillShachoShell.module.css")).not.toContain(":has([data-page-search-slot]");
  expect(read("../../../bud/_components/BudShachoShell/BudShachoShell.module.css")).toContain(".topbar { position:relative");
});
it("protects onboarding tabs for both table modes", () => {
  const page = read("../../onboarding/page.tsx");
  expect(page.indexOf("styles.header")).toBeLessThan(page.indexOf("<SystemTabs"));
  expect(read("../../onboarding/onboarding.module.css")).toContain("min-height:max(86px, calc(var(--page-search-bottom, 0px) - 30px))");
});
it("protects Root employees actions, LINE tabs and Bud broadband update stamps", () => {
  expect(read("../../../root/employees/page.tsx")).toContain("<PageHeader");
  const root = read("../../../root/_components/root-shell.module.css");
  expect(root).toContain("margin-right:var(--page-search-width, 0px)");
  expect(root).toContain("min-height:calc(var(--page-search-bottom, 0px) - 30px)");
  for (const path of ["../../line/LineManager.tsx", "../../../bud/profit/broadband/BroadbandTable.tsx"]) {
    const page = read(path);
    expect(page).toContain("<header data-page-search-heading className={pageSearchStyles.heading}>");
    expect(page.indexOf("</header>")).toBeLessThan(page.indexOf("<UpdatedStampRow>"));
    expect(page.indexOf("</header>")).toBeLessThan(page.indexOf("<SystemTabs"));
  }
  expect(read("./PageSearchSlot.module.css")).toContain("min-height:calc(var(--page-search-bottom, 0px) - var(--page-search-heading-top, 30px))");
});
