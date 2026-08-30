import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("System shell ownership", () => {
  it("keeps ShachoShell in the shared System layout only", () => {
    expect(source("src/app/system/layout.tsx")).toContain("<ShachoShell");
    for (const path of [
      "src/app/system/page.tsx",
      "src/app/system/call-metrics/page.tsx",
      "src/app/system/contracts/layout.tsx",
      "src/app/system/mypage/_components/MyPageSectionPage.tsx",
      "src/app/system/attendance/sync-status/page.tsx",
    ]) expect(source(path)).not.toContain("<ShachoShell");
  });

  it("sets the stored theme synchronously before providers mount", () => {
    const layout = source("src/app/layout.tsx");
    expect(layout).toContain("<head>");
    expect(layout).toContain('localStorage.getItem("garden.theme")');
    expect(layout).toContain('root.setAttribute("data-theme", theme)');
    expect(layout).not.toMatch(/<html[^>]*data-theme="light"/);
  });
});
