import { beforeEach, it, expect, vi } from "vitest";
const m = vi.hoisted(() => ({ push: vi.fn(), insert: vi.fn(), select: vi.fn(), from: vi.fn() }));
vi.mock("@/lib/line/staff-client", () => ({ pushLineStaff: m.push }));
vi.mock("@/lib/supabase/admin", () => ({ getSupabaseAdmin: () => ({ from: m.from }) }));
import { notifyShift, myShift, teamShift } from "./service.server";
beforeEach(() => {
  vi.clearAllMocks();
  m.from.mockImplementation(() => ({ insert: m.insert, select: m.select }));
  m.push.mockResolvedValue(undefined);
  m.insert.mockResolvedValue({ error: null });
});
it("締切後の本人の変更を403にし保存しない", async () => {
  m.select.mockResolvedValue({
    error: null,
    data: [
      {
        employee_id: "1",
        name: "山田",
        employment_type: "アルバイト",
        business: "ブロードバンド事業",
        current_team: "宮永チーム",
        is_active: true,
      },
    ],
  });
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-16T00:00:00+09:00"));
  try {
    await expect(myShift("1", "2026-12", [])).rejects.toMatchObject({
      status: 403,
      message: "提出の締切を過ぎました。変更は責任者に連絡してください。",
    });
    expect(m.insert).not.toHaveBeenCalled();
  } finally {
    vi.useRealTimers();
  }
});
it("提出済み・対象外の人には提出のお願いを送らない", async () => {
  const people = ["1", "2"].map((employee_id) => ({
    employee_id,
    name: "山田",
    employment_type: "アルバイト",
    business: "ブロードバンド事業",
    current_team: "宮永チーム",
    is_active: true,
    line_user_id: "U" + employee_id,
  }));
  m.from.mockImplementation((table: string) => {
    if (table === "root_employees_with_team")
      return {
        select: async () => ({
          data: [...people, { ...people[0], employee_id: "3", employment_type: "正社員" }],
          error: null,
        }),
      };
    if (table === "system_shift_submission")
      return { select: () => ({ eq: async () => ({ data: [{ employee_id: "1" }], error: null }) }) };
    if (table === "system_kanri_month_setting" || table === "system_shift_month")
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: table === "system_shift_month" ? null : { holidays: [] }, error: null }),
          }),
        }),
      };
    if (table === "system_line_staff_message") return { insert: m.insert };
    const query = {
      gte: () => query,
      lte: () => query,
      order: () => query,
      range: async () => ({ data: [], error: null }),
    };
    return { select: () => query };
  });
  await teamShift("2026-12", "remind", {}, { employee_id: "boss", name: "責任者", userId: "user" });
  expect(m.push).toHaveBeenCalledTimes(1);
  expect(m.push.mock.calls[0][0]).toEqual(["U2"]);
  expect(m.push.mock.calls[0][1]).toContain("12月のシフト希望の提出をお願いします。");
});
it("service case 1", async () => {
  const result = await notifyShift(
    "2026-12",
    [
      { employee_id: "1", name: "山田", employee_number: "01", line_user_id: "U1" },
      { employee_id: "2", name: "山田" },
      { employee_id: "3", name: "山田", line_user_id: "U3", line_link_source: "unfollowed" },
    ],
    "boss",
    false,
  );
  expect(result).toEqual({ sent: 1, failed: 0, unlinked: 2 });
  expect(m.push).toHaveBeenCalledWith(
    ["U1"],
    "12月のシフトが確定しました。公式LINEのメニューの［シフト］から確認できます。",
  );
  expect(m.insert).toHaveBeenCalledWith(
    expect.objectContaining({ employee_id: "1", status: "sent", sent_by_employee_id: "boss" }),
  );
});
it("service case 2", async () => {
  m.push.mockRejectedValue(new Error("failed"));
  expect(await notifyShift("2026-12", [{ employee_id: "1", name: "山田", line_user_id: "U1" }], "boss", true)).toEqual({
    sent: 0,
    failed: 1,
    unlinked: 0,
  });
  expect(m.push.mock.calls[0][1]).toContain("11月15日(日) 23:59");
  expect(m.insert).toHaveBeenCalledWith(expect.objectContaining({ status: "failed", shift: "shift_remind" }));
});
