import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { defaultDays, monthDays } from "./rules";

const mocks = vi.hoisted(() => ({
  mode: "telema", confirmed: false, rpc: vi.fn(),
}));
vi.mock("@/lib/line/staff-client", () => ({ pushLineStaff: vi.fn() }));
vi.mock("./submitters.server", () => ({
  readSubmitterSettings: async () => [{ employee_id: "E1", mode: mocks.mode === "default" ? "default" : "include" }],
}));
const pattern = [0, 1, 2, 3, 4, 5, 6, 8].map(weekday => ({
  weekday, start_time: "09:00", end_time: "18:00",
}));
vi.mock("./defaults.server", () => ({
  readDefaultPatterns: async () => [0, 1, 2, 3, 4, 5, 6, 8].map(weekday => ({
    weekday, start_time: "09:00", end_time: "18:00",
  })),
  readDefaultOptions: async () => [],
}));
vi.mock("@/lib/supabase/admin", () => ({
  getSupabaseAdmin: () => ({
    rpc: mocks.rpc,
    from: (table: string) => {
      const data = table === "root_employees_with_team"
        ? [{ employee_id: "E1", name: "本人", is_active: true, employment_type: "アルバイト",
          business: "ブロードバンド事業", current_team: "営業" }]
        : table === "system_shift_month" && mocks.confirmed
          ? [{ year_month: "2027-01", confirmed_at: "2026-11-01T00:00:00Z" }] : [];
      const query = {
        select: () => query, eq: () => query, gte: () => query, lte: () => query,
        order: () => query,
        range: async () => ({ data: [], error: null }),
        maybeSingle: async () => ({ data: null, error: null }),
        then: (resolve: (value: unknown) => unknown) => Promise.resolve({ data, error: null }).then(resolve),
      };
      return query;
    },
  }),
}));
import { myShift } from "./service.server";

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-04T12:00:00+09:00"));
  mocks.confirmed = false;
  mocks.rpc.mockResolvedValue({ error: null });
});
afterEach(() => vi.useRealTimers());

it.each(["telema", "default"])("%sの再来月は保存し、3か月先・締切後・確定後は保存しない", async mode => {
  mocks.mode = mode;
  const rows = mode === "default" ? defaultDays("2027-01", pattern)
    : monthDays("2027-01").map(work_date => ({ work_date, start_time: null }));
  const result = await myShift("E1", "2027-01", rows);
  expect(result).toMatchObject({
    submit_months: [{ month: "2026-12", editable: true }, { month: "2027-01", editable: true }],
    confirmed_months: [],
  });
  expect(mocks.rpc).toHaveBeenCalledTimes(1);
  await expect(myShift("E1", "2027-02", [])).rejects.toMatchObject({ status: 403 });
  mocks.confirmed = true;
  await expect(myShift("E1", "2027-01", rows)).rejects.toThrow("確定後");
  mocks.confirmed = false;
  vi.setSystemTime(new Date("2026-12-16T00:00:00+09:00"));
  await expect(myShift("E1", "2027-01", rows)).rejects.toMatchObject({ status: 403 });
  expect(mocks.rpc).toHaveBeenCalledTimes(1);
});
