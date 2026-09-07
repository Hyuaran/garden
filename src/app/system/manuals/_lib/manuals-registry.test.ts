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
    expect(SYSTEM_MANUALS).toHaveLength(14);
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
      ["system", 13],
      ["bud", 1],
    ]);
  });

  it("resolves registered manuals and files only", () => {
    const manual = findManual("system", "kot-attendance");
    expect(manual?.name).toBe("勤怠打刻と KOT 取込");
    expect(manual && findManualDoc(manual, "1_operation.html")?.key).toBe("operation");
    expect(manual && findManualDoc(manual, "../secret.html")).toBeNull();
  });
});
