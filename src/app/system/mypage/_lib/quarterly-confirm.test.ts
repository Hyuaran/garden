import { describe, expect, it } from "vitest";
import { effectiveConfirmations, needsQuarterlyConfirmation, SELF_CONFIRM_CATEGORIES } from "./quarterly-confirm";
import type { ProfileHistoryRow } from "@/app/root/_lib/profile-history.server";

const now = Date.parse("2026-10-29T00:00:00Z");
const date = (days: number) => new Date(now - days * 86400000).toISOString();
const all = (days: number) => Object.fromEntries(SELF_CONFIRM_CATEGORIES.map(category => [category, date(days)]));
describe("quarterly confirmation", () => {
 it("requires every category and rejects expired or invalid dates", () => {
  expect(needsQuarterlyConfirmation({}, now)).toBe(true);
  expect(needsQuarterlyConfirmation(all(89), now)).toBe(false);
  expect(needsQuarterlyConfirmation(all(90), now)).toBe(false);
  expect(needsQuarterlyConfirmation({...all(1), address: date(91)}, now)).toBe(true);
  expect(needsQuarterlyConfirmation({...all(1), address: "invalid"}, now)).toBe(true);
 });
 it("uses the latest employee confirmation across history sources", () => {
  const rows = [{category:"address", source:"employee_confirm", confirmed_by_employee_at:date(100)}, {category:"address", source:"submission", confirmed_by_employee_at:date(1)}] as ProfileHistoryRow[];
  expect(effectiveConfirmations(rows, null, now)).toEqual({address:date(1)});
 });
 it("accepts only recorded onboarding categories for recent hires", () => {
  const rows = SELF_CONFIRM_CATEGORIES.map(category => ({category,source:"onboarding",recorded_at:date(10)})) as ProfileHistoryRow[];
  expect(needsQuarterlyConfirmation(effectiveConfirmations(rows,date(10),now),now)).toBe(false);
  expect(needsQuarterlyConfirmation(effectiveConfirmations(rows.slice(1),date(10),now),now)).toBe(true);
  expect(needsQuarterlyConfirmation(effectiveConfirmations(rows,date(100),now),now)).toBe(true);
  expect(needsQuarterlyConfirmation(effectiveConfirmations(rows,null,now),now)).toBe(true);
 });
});
