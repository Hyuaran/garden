import { expect, it } from "vitest";
import { emptyAdminInput } from "./onboarding-admin";
import { parseTemplateValues, templateOverwrites, templatePatch } from "./onboarding-admin-templates";
import { canDeleteHireCandidate, type HireCandidate } from "./hire-candidates";

it("空の値では入力を消さず、明示的な手当なしだけを適用する", () => {
  expect(templatePatch(parseTemplateValues({ office: "", allowances: [] }))).toEqual({ allowances: [] });
  expect(templatePatch(parseTemplateValues({}))).toEqual({});
  expect(() => parseTemplateValues({ employee_id: "other" })).toThrow();
  expect(() => parseTemplateValues({ salary_kind: "日給" })).toThrow();
});
it("同じ値や空の入力は確認不要で、異なる入力済みの値は確認する", () => {
  const current = { ...emptyAdminInput(), office: "大阪本社" };
  expect(templateOverwrites(current, { office: "大阪本社", base_salary: "260000" })).toBe(false);
  expect(templateOverwrites(current, { office: "東京" })).toBe(true);
});
it("削除対象は未着手の入社予定・辞退に限る", () => {
  const row = { status: "planned", employee_number: null, employee_id: null, kintone_roster_record_id: null, steps: {} } as HireCandidate;
  expect(canDeleteHireCandidate(row)).toBe(true);
  expect(canDeleteHireCandidate({ ...row, status: "no_show" })).toBe(true);
  for (const patch of [{ status: "hired" }, { status: "hiring" }, { employee_number: "1572" }, { employee_id: "EMP-1" }, { kintone_roster_record_id: "123" }, { steps: { number: { done: true } } }]) {
    expect(canDeleteHireCandidate({ ...row, ...patch } as HireCandidate)).toBe(false);
  }
});
