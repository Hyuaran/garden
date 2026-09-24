import { describe, expect, it } from "vitest";
import { getVisibleSystemForms, SYSTEM_FORMS } from "./forms-registry";

describe("forms registry", () => {
  it("defines system forms in the registry", () => {
    expect(SYSTEM_FORMS).toHaveLength(3);
    expect(SYSTEM_FORMS[0]).toMatchObject({
      slug: "payroll-notice",
      name: "給与計算連絡",
      minRole: "staff",
      href: "/system/forms/payroll-notice",
    });
    expect(SYSTEM_FORMS[1]).toMatchObject({
      slug: "shukkin",
      name: "出勤表・シフトLINE連絡テキスト生成",
      minRole: "staff",
      href: "/system/forms/shukkin",
    });
    expect(SYSTEM_FORMS[2]).toMatchObject({
      slug: "nhk-visit",
      name: "NHK訪問業務 報告",
      minRole: "staff",
      href: "/system/forms/nhk-visit",
    });
  });

  it("filters forms by role", () => {
    expect(getVisibleSystemForms("cs")).toEqual([]);
    expect(getVisibleSystemForms("staff").map((form) => form.name)).toEqual(["給与計算連絡", "出勤表・シフトLINE連絡テキスト生成", "NHK訪問業務 報告"]);
    expect(getVisibleSystemForms("manager").map((form) => form.name)).toEqual(["給与計算連絡", "出勤表・シフトLINE連絡テキスト生成", "NHK訪問業務 報告"]);
  });
});
