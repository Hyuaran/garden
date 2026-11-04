import { afterEach, beforeEach, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("./submitters.server", () => ({
  readSubmitterSettings: async () => [],
}));
vi.mock("@/lib/line/staff-client", () => ({ pushLineStaff: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({
  getSupabaseAdmin: () => ({
    rpc: m.rpc,
    from: (table: string) => {
      const data =
        table === "root_employees_with_team"
          ? [
              {
                employee_id: "E1",
                name: "社員",
                employment_type: "アルバイト",
                business: "ブロードバンド事業",
                current_team: "チーム",
                is_active: true,
              },
            ]
          : [];
      const query = {
        select: () => query,
        eq: () => query,
        gte: () => query,
        lte: () => query,
        order: () => query,
        range: async () => ({ data: [], error: null }),
        maybeSingle: async () => ({ data: null, error: null }),
        then: (resolve: (value: unknown) => unknown) =>
          Promise.resolve({ data, error: null }).then(resolve),
      };
      return query;
    },
  }),
}));
import { myShift, teamShift } from "./service.server";
import { monthDays } from "./rules";
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-04T12:00:00+09:00"));
  m.rpc.mockReset().mockResolvedValue({ data: null, error: null });
});
afterEach(() => vi.useRealTimers());
const rows = monthDays("2026-12").map((work_date) => ({
  work_date,
  start_time: null,
}));
it("saves a 500-character note atomically with the self submission", async () => {
  await myShift("E1", "2026-12", rows, "備".repeat(500));
  expect(m.rpc).toHaveBeenCalledWith(
    "save_shift_person",
    expect.objectContaining({ p_note: "備".repeat(500), p_submit: true }),
  );
});
it("rejects notes over 500 characters before saving or notifying", async () => {
  await expect(
    myShift("E1", "2026-12", rows, "備".repeat(501)),
  ).rejects.toThrow("500字");
  expect(m.rpc).not.toHaveBeenCalled();
});
it("lets a manager save 18:30 through the actual person action", async () => {
  await teamShift(
    "2026-12",
    "person",
    {
      employee_id: "E1",
      rows: rows.map((row) => ({ ...row, start_time: "18:30" })),
    },
    { employee_id: "M1", name: "責任者", userId: "U1" },
  );
  expect(m.rpc).toHaveBeenCalledWith(
    "save_shift_person",
    expect.objectContaining({ p_submit: false }),
  );
});
