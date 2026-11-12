import { expect, it } from "vitest";
import { hasEmployeeWebActivity } from "./call-metrics";

it("WEBの4項目がすべて0または未取得なら表示を省く", () => {
  expect(hasEmployeeWebActivity({ lpAnswered: 0, lpOutbound: 0, lpTalkSeconds: 0, lpApplications: 0 })).toBe(false);
  expect(hasEmployeeWebActivity({})).toBe(false);
});

it.each(["lpAnswered", "lpOutbound", "lpTalkSeconds", "lpApplications"])("%sに実績があれば0を含む元の値を表示し、値は変えない", key => {
  const row = { lpAnswered: 0, lpOutbound: 0, lpTalkSeconds: 0, lpApplications: 0, [key]: 1 };
  const before = { ...row };
  expect(hasEmployeeWebActivity(row)).toBe(true);
  expect(row).toEqual(before);
});
