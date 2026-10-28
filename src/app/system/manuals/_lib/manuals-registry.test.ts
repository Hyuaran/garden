import { describe, expect, it } from "vitest";
import {
  findManual,
  findManualDoc,
  getManualModules,
  getVisibleManualDocs,
  getVisibleManuals,
  SYSTEM_MANUALS,
} from "./manuals-registry";

describe("manuals registry", () => {
  it("defines the initial manual modules and documents", () => {
    expect(SYSTEM_MANUALS).toHaveLength(31); // 2026-10-28 事業の収支（Bud）と郵便の転送（Root）を追加
    expect(findManual("system", "kot-attendance")).toMatchObject({
      moduleSlug: "system",
      slug: "kot-attendance",
      storagePrefix: "system/kot-attendance",
    });
    expect(SYSTEM_MANUALS[3].docs.map((doc) => [doc.key, doc.file, doc.minRole])).toEqual([
      ["operation", "1_operation.html", "staff"],
      ["summary", "0_summary.html", "super_admin"],
      ["overview", "2_overview.html", "super_admin"],
      ["engineer", "3_engineer.html", "super_admin"],
      ["claude", "4_claude.md", "super_admin"],
    ]);
  });

  it("filters documents by role", () => {
    const manual = SYSTEM_MANUALS[3];
    expect(getVisibleManualDocs(manual, "staff").map((doc) => doc.key)).toEqual(["operation"]);
    expect(getVisibleManualDocs(manual, "super_admin").map((doc) => doc.key)).toEqual([
      "operation",
      "summary",
      "overview",
      "engineer",
      "claude",
    ]);
  });

  it("hides manuals and modules with no readable document", () => {
    expect(getVisibleManuals("cs")).toEqual([]);
    expect(getManualModules("staff").map((module) => [module.slug, module.count])).toEqual([
      ["system", 27],
      ["bud", 3],
      ["root", 1],
    ]);
  });

  it("shows the corporate site manual immediately after contracts", () => {
    const visibleManuals = getVisibleManuals("super_admin");
    const contractsIndex = visibleManuals.findIndex((manual) => manual.slug === "contracts");

    expect(visibleManuals.map((manual) => manual.slug)).toContain("sites");
    expect(visibleManuals[contractsIndex + 1]).toMatchObject({
      moduleSlug: "system",
      slug: "sites",
      name: "コーポレートサイト",
    });
  });

  it("resolves registered manuals and files only", () => {
    const manual = findManual("system", "kot-attendance");
    expect(manual?.name).toBe("勤怠打刻と KING OF TIME 取込");
    expect(manual && findManualDoc(manual, "1_operation.html")?.key).toBe("operation");
    expect(manual && findManualDoc(manual, "../secret.html")).toBeNull();
  });
});

it("adds the onboarding flow after operation for staff and above only", () => {
  const manual = findManual("system", "onboarding")!;
  expect(getVisibleManualDocs(manual, "staff").map(doc => doc.key)).toEqual(["operation", "flow"]);
  expect(getVisibleManualDocs(manual, "super_admin").slice(0, 2).map(doc => doc.key)).toEqual(["operation", "flow"]);
  expect(getVisibleManualDocs(manual, "cs")).toEqual([]);
  expect(findManualDoc(manual, "5_flow.html")).toMatchObject({ key: "flow", kind: "html", minRole: "staff" });
  expect(SYSTEM_MANUALS.filter(manual => manual.docs.some(doc => doc.key === "flow"))).toHaveLength(1);
});
