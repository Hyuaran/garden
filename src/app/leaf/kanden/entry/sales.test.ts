import { expect, it } from "vitest";
import { matchSalesEmployee, selectApplyCode } from "./sales";

it("異体字セレクタと空白を除き、在籍候補で一意の姓名か姓を照合する", () => {
  const hagio = { name: "萩尾 拓也", filemaker_employee_name: "萩尾" };
  const other = { name: "萩尾 花子", filemaker_employee_name: null };
  const tsuji = { name: "辻󠄀健", filemaker_employee_name: null };
  expect(matchSalesEmployee("萩尾", [hagio, tsuji])).toBe(hagio);
  expect(matchSalesEmployee("萩尾", [hagio, other, tsuji])).toBeNull();
  expect(matchSalesEmployee("萩尾拓也", [hagio, other])).toBe(hagio);
  expect(matchSalesEmployee("辻", [hagio, tsuji])).toBe(tsuji);
  expect(matchSalesEmployee("辻󠄁", [hagio, tsuji])).toBe(tsuji);
});

it("案件の入力値を優先し、既定値は受注日が適用期間に入るものを使う", () => {
  const current = { apply_code: "0281-30101", starts_on: "2026-11-01", ends_on: null };
  const old = { apply_code: "0281-10001", starts_on: null, ends_on: "2026-10-31" };
  expect(selectApplyCode("案件コード", "2026-11-19", [current, old])).toBe("案件コード");
  expect(selectApplyCode(null, "2026-11-01", [current, old])).toBe(current.apply_code);
  expect(selectApplyCode(null, "2026-10-31", [current, old])).toBe(old.apply_code);
  expect(selectApplyCode(null, null, [current, old])).toBeNull();
  expect(selectApplyCode(null, null, [{ ...current, starts_on: null }])).toBe(current.apply_code);
});
