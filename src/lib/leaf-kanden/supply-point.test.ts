import { expect, it } from "vitest";
import { nextSupplyDay, supplyPoint } from "./supply-point";

it("日程と中央14桁を取り出す", () => {
  expect(supplyPoint("0601551553880322001020")).toEqual({ schedule: "01", middle: "55155388032200" });
  expect(supplyPoint("0602551553880322009999").middle).toBe("55155388032200");
});
it("22桁の半角数字を要求する", () => {
  expect(supplyPoint("060155155388032200102").error).toBe("22 桁で入力してください（今 21 桁）");
  expect(supplyPoint("060155155388032200102a").error).toBe("22 桁で入力してください（今 21 桁）");
  expect(supplyPoint("06 01 551553880322001020").error).toBe("22 桁で入力してください（今 22 桁）");
});

it("基準日以降の2か月で、同じ日程の最初の日を選ぶ", () => {
  const days = [
    { schedule: "01", date: "2027-03-01" },
    { schedule: "01", date: "2027-02-28" },
    { schedule: "01", date: "2026-12-30" },
    { schedule: "02", date: "2027-01-01" },
  ];
  expect(nextSupplyDay(days, "01", "2026-12-31")).toBe("2027-02-28");
  expect(nextSupplyDay(days.slice(0, 1), "01", "2026-12-31")).toBeNull();
});
