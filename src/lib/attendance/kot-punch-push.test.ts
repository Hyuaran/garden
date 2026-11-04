import { afterEach, beforeEach, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({
  existing: [] as unknown[],
  status: "",
  pending: false,
  batch: false,
  start: "2026-11-01" as string | null,
  mode: "success",
  request: null as null | { body?: unknown },
  enqueue: vi.fn(),
  rpc: vi.fn(),
  updates: [] as unknown[],
}));
vi.mock("server-only", () => ({}));
vi.mock("@/app/root/_lib/kot-api", () => ({
  fetchKotEmployeeByCode: async () => ({ key: "employee1" }),
}));
vi.mock("@/lib/relay/queue.server", () => ({
  getRelayHeartbeat: async () => ({ agent_version: "1.4.0" }),
  isRelayAlive: () => true,
  enqueueRelayJob: m.enqueue,
  waitRelayJob: async (id: string) => {
    if (id === "GET") return m.existing;
    if (m.mode === "timeout") throw new Error("timeout");
    if (m.mode === "error")
      return { errorRequest: [{ errors: [{ message: "登録できません" }] }] };
    return {
      successRequest: (
        m.request?.body as { employeeTimeRecordRequests: unknown[] }
      ).employeeTimeRecordRequests,
    };
  },
}));
vi.mock("@/lib/supabase/admin", () => ({
  getSupabaseAdmin: () => ({
    rpc: m.rpc,
    from: (table: string) => {
      let result: unknown = [];
      if (table === "system_attendance_settings")
        result = { kot_send_start_date: m.start };
      if (table === "root_employees")
        result = [
          {
            employee_id: "E1",
            name: "社員",
            kot_employee_id: "0001",
            attendance_rule: "sales",
          },
        ];
      if (table === "system_attendance_punches")
        result = [
          {
            id: 1,
            employee_id: "E1",
            punch_type: "clock_in",
            punched_at: "2026-11-03T14:00:00+09:00",
            kot_sync_status: "unsent",
          },
          {
            id: 2,
            employee_id: "E1",
            punch_type: "clock_out",
            punched_at: "2026-11-03T21:00:00+09:00",
            kot_sync_status: "unsent",
          },
        ];
      if (table === "system_attendance_kot_send")
        result = m.status
          ? [{ employee_id: "E1", work_date: "2026-11-03", status: m.status }]
          : [];
      if (table === "system_attendance_corrections")
        result = m.pending
          ? [{ employee_id: "E1", work_date: "2026-11-03" }]
          : [];
      if (table === "system_attendance_kot_batch")
        result = m.batch ? [{ batch_id: "batch" }] : [];
      const query: Record<string, unknown> = {};
      for (const method of [
        "select",
        "eq",
        "is",
        "gte",
        "lt",
        "lte",
        "order",
        "range",
        "limit",
      ])
        query[method] = () => query;
      query.update = (value: unknown) => {
        m.updates.push(value);
        result = null;
        return query;
      };
      query.single = async () => ({ data: result, error: null });
      query.then = (resolve: (value: unknown) => unknown) =>
        Promise.resolve({ data: result, error: null }).then(resolve);
      return query;
    },
  }),
}));
import { pushPunchDay, punchSendRows } from "./kot-punch-push.server";
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-03T21:30:00+09:00"));
  m.existing = [];
  m.status = "";
  m.pending = false;
  m.batch = false;
  m.start = "2026-11-01";
  m.mode = "success";
  m.request = null;
  m.updates = [];
  m.rpc.mockReset().mockResolvedValue({ data: null, error: null });
  m.enqueue.mockReset().mockImplementation(async (_kind, request) => {
    m.request = request;
    return { id: request.method };
  });
});
afterEach(() => vi.useRealTimers());
it("sends a whole person/day and persists success with the shared transformed rows", async () => {
  expect(await pushPunchDay("2026-11-03", "E1", "ACTOR")).toMatchObject({
    status: "sent",
  });
  expect(m.enqueue).toHaveBeenCalledTimes(2);
  expect(m.rpc).toHaveBeenCalledWith(
    "claim_attendance_send",
    expect.objectContaining({ p_ids: [1, 2] }),
  );
  expect(m.rpc).toHaveBeenLastCalledWith(
    "finish_attendance_send",
    expect.objectContaining({ p_status: "sent", p_actor: "ACTOR" }),
  );
  expect(m.updates).toHaveLength(2);
});
it("never registers when KING OF TIME already has one punch", async () => {
  m.existing = [
    {
      dailyWorkings: [
        { employeeKey: "employee1", timeRecord: [{ code: "1" }] },
      ],
    },
  ];
  expect(await pushPunchDay("2026-11-03", "E1", "ACTOR")).toMatchObject({
    status: "failed",
  });
  expect(m.enqueue).toHaveBeenCalledTimes(1);
});
it("reconciles an unknown outcome before registering anything again", async () => {
  m.status = "unknown";
  m.existing = [
    {
      dailyWorkings: [
        { employeeKey: "employee1", timeRecord: [{ code: "1" }] },
      ],
    },
  ];
  expect(await pushPunchDay("2026-11-03", "E1", "ACTOR")).toMatchObject({
    status: "sent",
  });
  expect(m.enqueue).toHaveBeenCalledTimes(1);
});
it("sends an unknown day only when the preflight contains no punches", async () => {
  m.status = "unknown";
  expect(await pushPunchDay("2026-11-03", "E1", "ACTOR")).toMatchObject({
    status: "sent",
  });
  expect(m.enqueue).toHaveBeenCalledTimes(2);
});
it.each([
  ["error", "failed"],
  ["timeout", "unknown"],
])("persists %s as %s without retrying", async (mode, status) => {
  m.mode = mode;
  expect(await pushPunchDay("2026-11-03", "E1", "ACTOR")).toMatchObject({
    status,
  });
  expect(m.enqueue).toHaveBeenCalledTimes(2);
});
it("blocks pending corrections and unfinished CSV batches", async () => {
  m.pending = true;
  await expect(pushPunchDay("2026-11-03", "E1", "ACTOR")).rejects.toThrow();
  m.pending = false;
  m.batch = true;
  await expect(pushPunchDay("2026-11-03", "E1", "ACTOR")).rejects.toThrow(
    "途中",
  );
  expect(m.enqueue).not.toHaveBeenCalled();
});
it("does not expose send targets before the cutover date", async () => {
  m.start = null;
  expect((await punchSendRows("2026-11-03")).rows).toEqual([]);
  m.start = "2026-11-04";
  await expect(pushPunchDay("2026-11-03", "E1", "ACTOR")).rejects.toThrow();
  expect(m.enqueue).not.toHaveBeenCalled();
});
