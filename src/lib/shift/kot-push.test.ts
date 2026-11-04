import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";

const mock = vi.hoisted(() => ({
  from: vi.fn(),
  enqueue: vi.fn(),
  wait: vi.fn(),
  heartbeat: vi.fn(),
  employee: vi.fn(),
  patches: [] as Record<string, unknown>[],
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/admin", () => ({
  getSupabaseAdmin: () => ({ from: mock.from }),
}));
vi.mock("@/lib/relay/queue.server", () => ({
  enqueueRelayJob: mock.enqueue,
  waitRelayJob: mock.wait,
  getRelayHeartbeat: mock.heartbeat,
  isRelayAlive: () => true,
}));
vi.mock("@/app/root/_lib/kot-api", () => ({
  fetchKotEmployeeByCode: mock.employee,
}));
import { assertKotTime, currentAgent, pushKotPerson } from "./kot-push.server";

let rows: Record<string, unknown>[];
let code: string | null;
beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-12-01T11:00:00+09:00"));
  mock.patches.length = 0;
  code = "001";
  rows = [
    { work_date: "2026-11-30", start_time: "14:00:00" },
    { work_date: "2026-12-01", start_time: "14:00:00" },
    { work_date: "2026-12-02", start_time: "14:00:00" },
    { work_date: "2026-12-03", start_time: null },
    { work_date: "2026-12-04", start_time: null },
    { work_date: "2026-12-05", start_time: "10:00:00" },
    { work_date: "2026-12-10", start_time: null },
    { work_date: "2026-12-11", start_time: null },
  ].map((row) => ({
    ...row,
    employee_id: "1",
    end_time: row.start_time ? "21:00:00" : null,
    updated_at: "revision",
    kot_status: "unsent",
  }));
  mock.heartbeat.mockResolvedValue({ agent_version: "1.3.1" });
  mock.employee.mockResolvedValue({ key: "abc123", divisionCode: "1000" });
  mock.enqueue.mockImplementation(async (_kind, request) => ({
    id: request.method,
  }));
  mock.wait.mockImplementation(async (id) =>
    id === "GET"
      ? [
          // KOT の一覧は日ごと。別の人の予定は削除の対象にしない
          {
            date: "2026-12-03",
            dailySchedules: [
              {
                date: "2026-12-03",
                employeeKey: "abc123",
                clockInSchedule: "2026-12-03T14:00+09:00",
              },
            ],
          },
          {
            date: "2026-12-04",
            dailySchedules: [{ date: "2026-12-04", employeeKey: "other" }],
          },
          // 欠勤は Garden の休みで消さない
          {
            date: "2026-12-11",
            dailySchedules: [
              {
                date: "2026-12-11",
                employeeKey: "abc123",
                holidaysObtained: { fulltimeHoliday: { code: "3" } },
              },
            ],
          },
        ]
      : id === "PUT"
        ? { successRequest: [{ employeeKey: "abc123" }], errorRequest: [] }
        : null,
  );
  mock.from.mockImplementation((table) => {
    let patch: Record<string, unknown> | null = null;
    const query = {
      select: () => query,
      eq: () => query,
      gte: () => query,
      lte: () => query,
      order: () => query,
      update: (value: Record<string, unknown>) => {
        patch = value;
        return query;
      },
      range: async () => ({ data: rows, error: null }),
      maybeSingle: async () => ({
        data: { confirmed_at: "now", holidays: ["2026-12-10"] },
        error: null,
      }),
      single: async () => ({ data: { kot_employee_id: code }, error: null }),
      then: (resolve: (value: unknown) => void) => {
        if (patch) mock.patches.push(patch);
        resolve({ data: null, error: null });
      },
    };
    expect([
      "system_shift_month",
      "system_kanri_month_setting",
      "system_shift_confirmed",
      "root_employees",
    ]).toContain(table);
    return query;
  });
});
afterEach(() => vi.useRealTimers());

it("出勤をまとめて送り、手入力の予定がある休みだけ削除し、今日以前は送らない", async () => {
  expect(await pushKotPerson("2026-12", "1", "boss")).toEqual({
    sent: 6,
    failed: 0,
  });
  expect(mock.enqueue.mock.calls.map((call) => call[1].method)).toEqual([
    "GET",
    "PUT",
    "DELETE",
  ]);
  expect(mock.enqueue.mock.calls[1][1].body).toEqual({
    employeeScheduleRequests: [
      {
        employeeKey: "abc123",
        dailySchedules: [
          {
            workingDate: "2026-12-02",
            workPlaceDivisionCode: "1000",
            clockInSchedule: "2026-12-02T14:00+09:00",
            clockOutSchedule: "2026-12-02T21:00+09:00",
          },
          {
            workingDate: "2026-12-05",
            workPlaceDivisionCode: "1000",
            clockInSchedule: "2026-12-05T10:00+09:00",
            clockOutSchedule: "2026-12-05T21:00+09:00",
            startEndBreakSchedule: [
              { start: "2026-12-05T13:00+09:00", end: "2026-12-05T14:00+09:00" },
            ],
          },
          {
            workingDate: "2026-12-10",
            workPlaceDivisionCode: "1000",
            fulltimeHoliday: { code: "9" },
          },
        ],
      },
    ],
  });
  expect(mock.enqueue.mock.calls[2][1].path).toBe(
    "/daily-schedules/abc123/2026-12-03",
  );
  expect(mock.patches).toEqual([
    expect.objectContaining({
      kot_status: "sent",
      kot_sent_start: "14:00:00",
      kot_sent_end: "21:00",
    }),
    expect.objectContaining({
      kot_status: "sent",
      kot_sent_start: "10:00:00",
      kot_sent_end: "21:00",
    }),
    expect.objectContaining({
      kot_status: "sent",
      kot_sent_start: null,
      kot_sent_end: null,
    }),
    expect.objectContaining({
      kot_status: "sent",
      kot_sent_start: null,
      kot_sent_end: null,
    }),
    expect.objectContaining({
      kot_status: "sent",
      kot_sent_start: null,
      kot_sent_end: null,
    }),
    expect.objectContaining({
      kot_status: "sent",
      kot_sent_start: null,
      kot_sent_end: null,
    }),
  ]);
});

it("従業員コードがない場合は失敗を記録し、外部へ要求しない", async () => {
  code = null;
  expect(await pushKotPerson("2026-12", "1", "boss")).toEqual({
    sent: 0,
    failed: 6,
  });
  expect(mock.patches[0].kot_error).toBe(
    "KING OF TIME の従業員コードが登録されていません",
  );
  expect(mock.employee).not.toHaveBeenCalled();
  expect(mock.enqueue).not.toHaveBeenCalled();
});

it("200 の errorRequest を行の失敗にする", async () => {
  const normal = mock.wait.getMockImplementation()!;
  mock.wait.mockImplementation(async (id) =>
    id === "PUT"
      ? {
          errorRequest: [
            {
              employeeKey: "abc123",
              errors: [
                { date: "2026-12-02", code: "x", message: "打刻があります" },
              ],
            },
          ],
        }
      : normal(id),
  );
  expect(await pushKotPerson("2026-12", "1", "boss")).toEqual({
    sent: 3,
    failed: 3,
  });
  expect(mock.patches[0]).toMatchObject({
    kot_status: "failed",
    kot_error: "打刻があるため変更できません",
  });
});

it.each(["08:30", "09:59", "17:30", "18:29"])(
  "受付停止の %s は要求しない",
  async (time) => {
    vi.setSystemTime(new Date(`2026-12-01T${time}:00+09:00`));
    await expect(pushKotPerson("2026-12", "1", "boss")).rejects.toThrow(
      "予定を受け付けていません",
    );
    expect(mock.enqueue).not.toHaveBeenCalled();
  },
);

it.each(["10:00", "18:30", "08:29"])("%s は受付できる", (time) => {
  expect(() =>
    assertKotTime(new Date(`2026-12-01T${time}:00+09:00`)),
  ).not.toThrow();
});

it("古い中継では送らない", async () => {
  mock.heartbeat.mockResolvedValue({ agent_version: "1.2.9" });
  await expect(pushKotPerson("2026-12", "1", "boss")).rejects.toThrow(
    "係の入れ替えが必要です",
  );
  expect(mock.enqueue).not.toHaveBeenCalled();
  expect(currentAgent("1.3.0")).toBe(false);
  expect(currentAgent("1.10.0")).toBe(true);
  expect(currentAgent(null)).toBe(false);
});

it("開始と終了の変更を SQL のトリガーで未送信に戻す", () => {
  const sql = readFileSync(
    "supabase/migrations/20261103000512_shift_kot_status.sql",
    "utf8",
  );
  expect(sql).toContain("new.start_time is distinct from old.start_time");
  expect(sql).toContain("new.end_time is distinct from old.end_time");
  expect(sql).toContain("new.kot_status := 'unsent'");
  expect(sql).toContain("before update on public.system_shift_confirmed");
});
