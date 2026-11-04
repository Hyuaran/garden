import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { defaultDays, hasLunchBreak, hours, validateDefaultDays, type DefaultPattern } from "./rules";
import { shiftMode } from "./eligibility";
const mocks = vi.hoisted(() => ({ rpc: vi.fn(), patterns: vi.fn(), options: vi.fn(), updates: vi.fn(), mode: "default" }));
vi.mock("@/lib/line/staff-client", () => ({ pushLineStaff: vi.fn() }));
vi.mock("./submitters.server", () => ({ readSubmitterSettings: async () => [] }));
vi.mock("./defaults.server", () => ({ readDefaultPatterns: mocks.patterns, readDefaultOptions: mocks.options }));
vi.mock("@/lib/supabase/admin", () => ({ getSupabaseAdmin: () => ({
  rpc: mocks.rpc,
  from: (table: string) => {
    const data = table === "root_employees_with_team" ? [{
      employee_id: "E1", name: "事務", is_active: true, employment_type: "正社員",
    }] : [];
    const query = {
      select: () => query, eq: () => query, gte: () => query, lte: () => query,
      order: () => query, is: () => query,
      update: (values: unknown) => { mocks.updates(values); return query; },
      range: async () => ({ data: [], error: null }),
      maybeSingle: async () => ({ data: null, error: null }),
      then: (resolve: (value: unknown) => unknown) => Promise.resolve({ data, error: null }).then(resolve),
    };
    return query;
  },
}) }));
import { myShift, teamShift } from "./service.server";
const pattern: DefaultPattern[] = [0, 1, 2, 3, 4, 5, 6, 8].map(weekday => ({
  weekday, start_time: weekday > 0 && weekday < 6 ? "09:30" : null,
  end_time: weekday > 0 && weekday < 6 ? "18:00" : null,
}));
beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-12-04T12:00:00+09:00"));
  mocks.patterns.mockResolvedValue(pattern.map(row => ({ ...row, employee_id: "E1" })));
  mocks.rpc.mockResolvedValue({ error: null });
  mocks.options.mockResolvedValue([]);
});
it("本人の応答に選べる勤務を含め、候補の時刻で提出する", async () => {
  const options = [{ label: "出社", start_time: "12:00:00", end_time: "17:00:00" }];
  mocks.options.mockResolvedValue(options);
  expect(await myShift("E1", "2027-01")).toMatchObject({ options });
  const rows = defaultDays("2027-01", pattern).map(row => row.work_date === "2027-01-04"
    ? { ...row, start_time: "12:00", end_time: "17:00" } : row);
  await myShift("E1", "2027-01", rows);
  expect(mocks.rpc).toHaveBeenCalledWith("save_shift_person", expect.objectContaining({ p_rows: rows }));
});
afterEach(() => vi.useRealTimers());
it("対象は在籍する社員等、テレマは既存のまま、役員等は例外設定だけ", () => {
  const base = { employee_id: "1", name: "社員", is_active: true };
  for (const employment_type of ["正社員", "契約社員", "パート", "アルバイト"])
    expect(shiftMode({ ...base, employment_type })).toBe("default");
  for (const employment_type of ["役員", "業務委託", "派遣"])
    expect(shiftMode({ ...base, employment_type })).toBeNull();
  expect(shiftMode({ ...base, employment_type: "アルバイト", business: "ブロードバンド事業", current_team: "営業" })).toBe("telema");
  expect(shiftMode({ ...base, is_active: false }, [{ employee_id: "1", mode: "default" }])).toBeNull();
  expect(shiftMode(base, [{ employee_id: "1", mode: "default" }])).toBe("default");
  expect(shiftMode({ ...base, employment_type: "正社員" }, [{ employee_id: "1", mode: "exclude" }])).toBeNull();
});
it("開始前・未設定は提出を止め、対象外と表示しない", async () => {
  expect(await myShift("E1", "2026-11")).toMatchObject({ eligible: true, message: "2026年12月分から提出します。" });
  mocks.patterns.mockResolvedValue([]);
  expect(await myShift("E1", "2027-01")).toMatchObject({ eligible: true, message: "既定の勤務を準備しています。" });
  await expect(myShift("E1", "2027-01", [])).rejects.toThrow("準備しています");
  expect(mocks.rpc).not.toHaveBeenCalled();
});
it("未提出の本人画面に曜日別の既定勤務と祝日の休みが入る", async () => {
  const data = await myShift("E1", "2027-01");
  expect(data).toMatchObject({ mode: "default", editable: true, holidays: [] });
  if (!("wish" in data)) throw new Error("勤務の一覧がありません。");
  expect(data.wish?.find(row => row.work_date === "2027-01-04")).toMatchObject({ start_time: "09:30", end_time: "18:00" });
  expect(data.wish?.find(row => row.work_date === "2027-01-11")).toMatchObject({ start_time: null, day_kind: "rest" });
});
it("本人は既定勤務・休み・有給だけ、責任者は任意の30分単位を保存", async () => {
  const rows = defaultDays("2027-01", pattern);
  const paid = rows.map(row => row.work_date === "2027-01-04"
    ? { ...row, start_time: null, end_time: null, day_kind: "paid" as const } : row);
  await myShift("E1", "2027-01", paid, "時刻変更のお願い");
  expect(mocks.rpc).toHaveBeenCalledWith("save_shift_person", expect.objectContaining({ p_rows: paid, p_note: "時刻変更のお願い" }));
  const changed = rows.map(row => row.work_date === "2027-01-04" ? { ...row, start_time: "10:00" } : row);
  await expect(myShift("E1", "2027-01", changed)).rejects.toThrow("既定の勤務");
  expect(() => validateDefaultDays("2027-01", changed, pattern, true)).not.toThrow();
  expect(() => validateDefaultDays("2027-01", rows.map(row => ({ ...row, day_kind: "paid" })), pattern)).toThrow();
});
it("休憩は13時から14時を丸ごと含む日だけ、終了時刻から時間数を計算", () => {
  expect(hours("09:30", "18:00")).toBe(7.5);
  expect(hours("06:00", "13:30")).toBe(7.5);
  expect(hasLunchBreak("09:00", "13:30")).toBe(false);
  expect(hasLunchBreak("13:00", "14:00")).toBe(true);
});
it("有給の入力済みは対象者・月・有給行に限定して記録", async () => {
  await teamShift("2027-01", "manual", { employee_id: "E1", work_date: "2027-01-04" },
    { employee_id: "M1", name: "責任者", userId: "U1" });
  expect(mocks.updates).toHaveBeenCalledWith({ kot_manual_at: expect.any(String), kot_manual_by: "M1" });
  await expect(teamShift("2027-01", "manual", { employee_id: "E1", work_date: "2026-12-04" },
    { employee_id: "M1", name: "責任者", userId: "U1" })).rejects.toThrow("対象の日");
});
it("みんなのシフトに未提出の既定勤務を出し、定休日候補には時間を足さない", async () => {
  const data = await teamShift("2027-01", "read", {}, { employee_id: "M1", name: "責任者", userId: "U1" });
  if (!("wish" in data)) throw new Error("勤務の一覧がありません。");
  expect(data.people).toContainEqual(expect.objectContaining({ employee_id: "E1", shift_mode: "default" }));
  expect(data.wish.find(row => row.work_date === "2027-01-04")).toMatchObject({ start_time: "09:30", end_time: "18:00" });
  expect(data.candidates.every(row => row.hours === 0)).toBe(true);
  await teamShift("2027-01", "confirm", {}, { employee_id: "M1", name: "責任者", userId: "U1" });
  expect(mocks.rpc).toHaveBeenCalledWith("confirm_shift_month", expect.objectContaining({ p_people: ["E1"] }));
});
