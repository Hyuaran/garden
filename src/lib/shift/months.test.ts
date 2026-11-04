import { describe, expect, it } from "vitest";
import { canSubmitMonth, deadline, myShiftMonths } from "./rules";

function months(date: string, options: Partial<Parameters<typeof myShiftMonths>[0]> = {}) {
  return myShiftMonths({
    now: new Date(date + "T12:00:00+09:00"),
    mode: "telema",
    submittedMonths: [],
    confirmedMonths: [],
    personalConfirmedMonths: [],
    ...options,
  });
}

it("11/4は12月と1月を提出できる", () => {
  expect(months("2026-11-04").submit_months).toEqual([
    { month: "2026-12", editable: true },
    { month: "2027-01", editable: true },
  ]);
});
it("11/16は12月を見るだけ、1月は提出できる", () => {
  expect(months("2026-11-16").submit_months).toEqual([
    { month: "2026-12", editable: false },
    { month: "2027-01", editable: true },
  ]);
});
it("12月確定後は1月と2月を提出できる", () => {
  expect(months("2026-12-04", { confirmedMonths: ["2026-12"] }).submit_months).toEqual([
    { month: "2027-01", editable: true },
    { month: "2027-02", editable: true },
  ]);
});
it("月をまたいだ提出がある今月だけ候補に残し、年もまたぐ", () => {
  expect(months("2026-12-01", { submittedMonths: ["2026-12"] }).submit_months).toEqual([
    { month: "2026-12", editable: false },
    { month: "2027-01", editable: true },
  ]);
  expect(months("2026-12-01").submit_months.map(row => row.month)).toEqual(["2027-01", "2027-02"]);
});
it("既定勤務は開始前の月を出さず、候補が1つの場合もある", () => {
  expect(months("2026-10-04", { mode: "default", submittedMonths: ["2026-10"] }).submit_months)
    .toEqual([{ month: "2026-12", editable: true }]);
});
it("確定行だけの月を含め、重複せず新しい順に2か月", () => {
  expect(months("2026-11-04", {
    confirmedMonths: ["2026-09", "2026-10"],
    personalConfirmedMonths: ["2026-11", "2026-10"],
  }).confirmed_months).toEqual([{ month: "2026-11" }, { month: "2026-10" }]);
  expect(months("2026-11-04").confirmed_months).toEqual([]);
});
describe.each(["telema", "default"])("%s の本人提出の月", () => {
  it("来月と再来月だけ、締切まで、確定前だけ許す", () => {
    const now = new Date("2026-11-04T12:00:00+09:00");
    expect(canSubmitMonth("2026-12", now)).toBe(true);
    expect(canSubmitMonth("2027-01", now)).toBe(true);
    expect(canSubmitMonth("2027-02", now)).toBe(false);
    expect(canSubmitMonth("2026-11", now)).toBe(false);
    expect(canSubmitMonth("2026-12", now, true)).toBe(false);
    expect(canSubmitMonth("2026-12", deadline("2026-12"))).toBe(true);
    expect(canSubmitMonth("2026-12", new Date(deadline("2026-12").getTime() + 1))).toBe(false);
  });
});
