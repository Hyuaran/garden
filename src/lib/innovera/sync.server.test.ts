import { beforeEach, describe, expect, it, vi } from "vitest";
import type { InnoveraCircuit, KintoneInnoveraRecord } from "./types";

vi.mock("server-only", () => ({}));

const mocks = vi.hoisted(() => ({
  sendMessage: vi.fn(),
  inserts: [] as unknown[],
  logRows: [] as unknown[],
}));

vi.mock("@/lib/chatwork", () => ({
  ChatworkClient: vi.fn().mockImplementation(function ChatworkClientMock() {
    return { sendMessage: mocks.sendMessage };
  }),
}));

vi.mock("@/lib/supabase/admin", () => ({
  getSupabaseAdmin: () => ({
    from: (table: string) => {
      if (table !== "system_innovera_sync_log") throw new Error(`unexpected table ${table}`);
      return {
        insert: async (value: unknown) => {
          mocks.inserts.push(value);
          return { error: null };
        },
        select: () => ({
          order: () => ({
            limit: async () => ({ data: mocks.logRows, error: null }),
          }),
        }),
      };
    },
  }),
}));

import { buildInnoveraChatworkBody, runInnoveraSync } from "./sync.server";

const fixedNow = new Date("2026-10-07T05:35:00.000Z");

function circuit(overrides: Partial<InnoveraCircuit> = {}): InnoveraCircuit {
  return {
    circuit_num: "004",
    name: "旧名",
    number: "05012345678",
    free_number: "",
    related_number: "",
    inserted: "2026-09-16 10:11:12",
    ...overrides,
  };
}

function record(overrides: Partial<KintoneInnoveraRecord> = {}): KintoneInnoveraRecord {
  return {
    $id: { value: "10" },
    識別番号: { value: "004" },
    回線番号: { value: "05012345678" },
    FD番号: { value: "05012345678" },
    最終回線名称: { value: "旧名" },
    最終番号ステータス: { value: "未使用" },
    発番日: { value: "2026-09-16" },
    廃止日: { value: "" },
    ドロップダウン: { value: "" },
    最終入力日時: { value: "2026-09-16T01:11:12Z" },
    最終行番号: { value: "1" },
    テーブル: {
      value: [{
        id: "row-1",
        value: {
          回線名称: { value: "旧名" },
          入力日時: { value: "2026-09-16T01:11:12Z" },
          入力者: { value: [{ code: "Garden" }] },
          行番号: { value: "1" },
          番号ステータス: { value: "未使用" },
        },
      }],
    },
    ...overrides,
  };
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

function mockFetch(circuits: InnoveraCircuit[], records: KintoneInnoveraRecord[], options: { innoveraResult?: false; failKintoneRead?: boolean; failFirstWrite400?: boolean } = {}) {
  const writes: Array<{ method: string; body: unknown }> = [];
  let writeCount = 0;
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.includes("ckey=circuit")) {
      return jsonResponse(options.innoveraResult === false ? { result: false, error_code: "999", data: [] } : { result: true, error_code: "", data: circuits });
    }
    if (url.includes("records.json")) {
      if (options.failKintoneRead) return jsonResponse({ message: "ng" }, 500);
      return jsonResponse({ records });
    }
    if (url.includes("record.json")) {
      writeCount += 1;
      writes.push({ method: init?.method ?? "GET", body: JSON.parse(String(init?.body ?? "{}")) });
      if (options.failFirstWrite400 && writeCount === 1) return jsonResponse({ message: "bad user" }, 400);
      return jsonResponse(init?.method === "POST" ? { id: "99", revision: "1" } : { revision: "2" });
    }
    throw new Error(`unexpected fetch ${url}`);
  });
  vi.stubGlobal("fetch", fetchMock);
  return { fetchMock, writes };
}

describe("runInnoveraSync", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
    mocks.inserts = [];
    mocks.logRows = [];
    process.env.INNOVERA_API_HOST = "innovera.test";
    process.env.INNOVERA_API_KEY = "innovera-key";
    process.env.KINTONE_INNOVERA_APP_ID = "189";
    process.env.KINTONE_INNOVERA_TOKEN = "kintone-token";
    process.env.KINTONE_SUBDOMAIN = "garden";
    process.env.CHATWORK_API_TOKEN = "cw-token";
    process.env.GARDEN_NOTICE_CHATWORK_ROOM_ID = "room-1";
  });

  it("does not write when INNOVERA returns result false", async () => {
    const { writes } = mockFetch([], [], { innoveraResult: false });
    const result = await runInnoveraSync({ apply: true, trigger: "cron", now: fixedNow });
    expect(result).toMatchObject({ ok: false, error: expect.stringMatching(/^innovera_unreachable/) });
    expect(writes).toHaveLength(0);
  });

  it("does not write when INNOVERA returns no rows", async () => {
    const { writes } = mockFetch([], []);
    const result = await runInnoveraSync({ apply: true, trigger: "cron", now: fixedNow });
    expect(result).toMatchObject({ ok: false, error: "innovera_empty", innoveraCount: 0 });
    expect(writes).toHaveLength(0);
  });

  it("does not write when Kintone read fails", async () => {
    const { writes } = mockFetch([circuit()], [], { failKintoneRead: true });
    const result = await runInnoveraSync({ apply: true, trigger: "cron", now: fixedNow });
    expect(result).toMatchObject({ ok: false, error: "kintone_read_failed" });
    expect(writes).toHaveLength(0);
  });

  it("does not write with apply false", async () => {
    const { writes } = mockFetch([circuit({ circuit_num: "005" })], []);
    const result = await runInnoveraSync({ apply: false, trigger: "manual", now: fixedNow });
    expect(result.counts.added).toBe(1);
    expect(result.details[0]).toMatchObject({ result: "pending" });
    expect(writes).toHaveLength(0);
    expect(mocks.inserts).toHaveLength(0);
  });

  it("writes added, renamed, and retired records with the expected bodies", async () => {
    const { writes } = mockFetch(
      [
        circuit({ circuit_num: "101", name: "新規", number: "05000000001", free_number: "08000000001" }),
        circuit({ circuit_num: "102", name: "新名", number: "05000000002" }),
      ],
      [
        record({ $id: { value: "20" }, 識別番号: { value: "102" }, 回線番号: { value: "05000000002" }, 最終回線名称: { value: "旧名" }, 最終行番号: { value: "2" } }),
        record({ $id: { value: "30" }, 識別番号: { value: "103" }, 回線番号: { value: "05000000003" }, 最終回線名称: { value: "廃止名" }, ドロップダウン: { value: "依頼中" } }),
      ],
    );
    const result = await runInnoveraSync({ apply: true, trigger: "manual", now: fixedNow });
    expect(result.counts).toMatchObject({ added: 1, renamed: 1, retired: 1, failed: 0 });
    expect(writes).toHaveLength(3);
    expect(writes[0]).toMatchObject({ method: "POST", body: { record: { 識別番号: { value: "101" }, FD番号: { value: "08000000001" } } } });
    expect(writes[1]).toMatchObject({ method: "PUT", body: { id: "20", record: { 最終回線名称: { value: "新名" }, 最終行番号: { value: "3" } } } });
    expect(writes[2]).toMatchObject({ method: "PUT", body: { id: "30", record: { 最終番号ステータス: { value: "削除" }, 廃止日: { value: "2026-10-07" }, ドロップダウン: { value: "" } } } });
    expect((writes[1].body as { record: KintoneInnoveraRecord }).record.テーブル?.value).toHaveLength(2);
    expect(mocks.sendMessage).toHaveBeenCalledWith("room-1", expect.stringContaining("[title]INNOVERA番号の同期（INNOVERA → Kintone）[/title]"));
    expect(mocks.sendMessage).toHaveBeenCalledWith("room-1", expect.stringContaining("新規 1件・名称変更 1件・廃止 1件・要確認 0件"));
  });

  it("sends Kintone updates without type metadata in existing table rows", async () => {
    const { writes } = mockFetch(
      [circuit({ circuit_num: "102", name: "新名", number: "05000000002" })],
      [record({
        $id: { value: "20" },
        識別番号: { value: "102" },
        回線番号: { value: "05000000002" },
        最終回線名称: { value: "旧名" },
        テーブル: {
          value: [{
            id: "row-1",
            value: {
              回線名称: { type: "SINGLE_LINE_TEXT", value: "旧名" },
              入力日時: { type: "DATETIME", value: "2026-09-16T01:11:12Z" },
              入力者: { type: "USER_SELECT", value: [{ code: "Garden" }] },
              行番号: { type: "NUMBER", value: "1" },
              番号ステータス: { type: "DROP_DOWN", value: "未使用" },
            },
          }],
        },
      })],
    );
    await runInnoveraSync({ apply: true, trigger: "manual", now: fixedNow });
    expect(writes).toHaveLength(1);
    expect(JSON.stringify(writes[0].body)).not.toContain("\"type\"");
  });

  it("retries without the input user field after a 400", async () => {
    const { writes } = mockFetch([circuit({ circuit_num: "005" })], [], { failFirstWrite400: true });
    const result = await runInnoveraSync({ apply: true, trigger: "manual", now: fixedNow });
    expect(result.ok).toBe(true);
    expect(writes).toHaveLength(2);
    expect(JSON.stringify(writes[0].body)).toContain("入力者");
    expect(JSON.stringify(writes[1].body)).not.toContain("入力者");
  });

  it("sends no message when there are no differences", async () => {
    mockFetch([circuit()], [record()]);
    const result = await runInnoveraSync({ apply: true, trigger: "cron", now: fixedNow });
    expect(result.actions).toHaveLength(0);
    expect(mocks.sendMessage).not.toHaveBeenCalled();
  });

  it("records the failure detail (HTTP status) in the error after one retry", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const fetchMock = vi.fn(async () => new Response("down", { status: 503 }));
    vi.stubGlobal("fetch", fetchMock);
    const result = await runInnoveraSync({ apply: true, trigger: "cron", now: fixedNow });
    vi.useRealTimers();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result).toMatchObject({ ok: false, error: "innovera_unreachable:http 503" });
    expect(mocks.inserts).toHaveLength(1);
    expect((mocks.inserts[0] as { error: string }).error).toBe("innovera_unreachable:http 503");
  });

  it("succeeds when the retry after a transient connection error works", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const { fetchMock } = mockFetch([circuit()], [record()]);
    const original = fetchMock.getMockImplementation()!;
    let calls = 0;
    fetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input).includes("ckey=circuit") && calls++ === 0) {
        throw Object.assign(new TypeError("fetch failed"), { cause: { code: "ECONNRESET", message: "socket hang up" } });
      }
      return original(input, init);
    });
    const result = await runInnoveraSync({ apply: true, trigger: "cron", now: fixedNow });
    vi.useRealTimers();
    expect(result.ok).toBe(true);
    expect(result.innoveraCount).toBe(1);
    expect(mocks.sendMessage).not.toHaveBeenCalled();
  });

  it("records the connection error cause when both attempts fail", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.stubGlobal("fetch", vi.fn(async () => { throw Object.assign(new TypeError("fetch failed"), { cause: { code: "ENOTFOUND", message: "getaddrinfo ENOTFOUND" } }); }));
    const result = await runInnoveraSync({ apply: true, trigger: "cron", now: fixedNow });
    vi.useRealTimers();
    expect(result.ok).toBe(false);
    expect(result.error).toContain("innovera_unreachable:fetch TypeError: fetch failed (ENOTFOUND getaddrinfo ENOTFOUND)");
  });

  it("notifies the first failure but not the same failure repeated within 12 hours", async () => {
    mockFetch([], [], { innoveraResult: false });
    const first = await runInnoveraSync({ apply: true, trigger: "cron", now: fixedNow });
    expect(first.notificationSkipped).toBeUndefined();
    expect(mocks.sendMessage).toHaveBeenCalledTimes(1);

    mocks.logRows = [{ ran_at: fixedNow.toISOString(), trigger: "cron", applied: true, ok: false, error: "innovera_unreachable:999", innovera_count: null, kintone_count: null, added: 0, renamed: 0, retired: 0, needs_review: 0, failed: 0, details: [], actor_employee_id: null }];
    const fiveMinutesLater = new Date(fixedNow.getTime() + 5 * 60 * 1000);
    const second = await runInnoveraSync({ apply: true, trigger: "cron", now: fiveMinutesLater });
    expect(second.ok).toBe(false);
    expect(second.notificationSkipped).toBe(true);
    expect(mocks.sendMessage).toHaveBeenCalledTimes(1);
    expect(mocks.inserts).toHaveLength(2);
  });

  it("notifies again when a different kind of failure follows", async () => {
    mocks.logRows = [{ ran_at: fixedNow.toISOString(), trigger: "cron", applied: true, ok: false, error: "innovera_unreachable:http 503", innovera_count: null, kintone_count: null, added: 0, renamed: 0, retired: 0, needs_review: 0, failed: 0, details: [], actor_employee_id: null }];
    mockFetch([circuit()], [], { failKintoneRead: true });
    const result = await runInnoveraSync({ apply: true, trigger: "cron", now: new Date(fixedNow.getTime() + 5 * 60 * 1000) });
    expect(result.error).toBe("kintone_read_failed");
    expect(result.notificationSkipped).toBeUndefined();
    expect(mocks.sendMessage).toHaveBeenCalledTimes(1);
  });

  it("sends one recovery message and logs the run after a failure", async () => {
    mocks.logRows = [{ ran_at: fixedNow.toISOString(), trigger: "cron", applied: true, ok: false, error: "innovera_unreachable:http 503", innovera_count: null, kintone_count: null, added: 0, renamed: 0, retired: 0, needs_review: 0, failed: 0, details: [], actor_employee_id: null }];
    mockFetch([circuit()], [record()]);
    const result = await runInnoveraSync({ apply: true, trigger: "cron", now: new Date(fixedNow.getTime() + 5 * 60 * 1000) });
    expect(result.ok).toBe(true);
    expect(result.recovered).toBe(true);
    expect(mocks.sendMessage).toHaveBeenCalledTimes(1);
    expect(mocks.sendMessage).toHaveBeenCalledWith("room-1", expect.stringContaining("回復しました"));
    expect(mocks.inserts).toHaveLength(1);
    expect((mocks.inserts[0] as { ok: boolean }).ok).toBe(true);
  });

  it("uses the first failure of the streak as the recovery start time", async () => {
    const row = (minutesAgo: number, ok: boolean, error: string | null) => ({ ran_at: new Date(fixedNow.getTime() - minutesAgo * 60 * 1000).toISOString(), trigger: "cron" as const, applied: true, ok, error, innovera_count: null, kintone_count: null, added: 0, renamed: 0, retired: 0, needs_review: 0, failed: 0, details: [], actor_employee_id: null });
    // 新しい順：失敗 5 回（25 分前が最初）→ その前は成功
    mocks.logRows = [row(5, false, "innovera_unreachable:http 503"), row(10, false, "innovera_unreachable:http 503"), row(15, false, "innovera_unreachable:http 503"), row(20, false, "innovera_unreachable:http 503"), row(25, false, "innovera_unreachable:http 503"), row(30, true, null)];
    mockFetch([circuit()], [record()]);
    const result = await runInnoveraSync({ apply: true, trigger: "cron", now: fixedNow });
    expect(result.recovered).toBe(true);
    const body = String(mocks.sendMessage.mock.calls[0][1]);
    const startMinute = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(new Date(fixedNow.getTime() - 25 * 60 * 1000));
    const v = Object.fromEntries(startMinute.map((part) => [part.type, part.value]));
    expect(body).toContain(`${v.year}-${v.month}-${v.day} ${v.hour}:${v.minute} から続いていた失敗`);
  });

  it("does not send a recovery message when the previous run succeeded", async () => {
    mocks.logRows = [{ ran_at: fixedNow.toISOString(), trigger: "cron", applied: true, ok: true, error: null, innovera_count: 1, kintone_count: 1, added: 0, renamed: 0, retired: 0, needs_review: 0, failed: 0, details: [], actor_employee_id: null }];
    mockFetch([circuit()], [record()]);
    const result = await runInnoveraSync({ apply: true, trigger: "cron", now: new Date(fixedNow.getTime() + 5 * 60 * 1000) });
    expect(result.recovered).toBeUndefined();
    expect(mocks.sendMessage).not.toHaveBeenCalled();
    expect(mocks.inserts).toHaveLength(0);
  });

  it("sends a failure message and keeps the result when notification throws", async () => {
    mocks.sendMessage.mockRejectedValueOnce(new Error("chatwork down"));
    mockFetch([], []);
    const result = await runInnoveraSync({ apply: true, trigger: "cron", now: fixedNow });
    expect(result.ok).toBe(false);
    expect(mocks.sendMessage).toHaveBeenCalledWith("room-1", expect.stringContaining("反映できませんでした"));
  });

  it("builds the Chatwork title with the current INNOVERA label", () => {
    const body = buildInnoveraChatworkBody({
      ok: true,
      applied: true,
      trigger: "manual",
      ranAt: fixedNow.toISOString(),
      innoveraCount: 0,
      kintoneCount: 0,
      counts: { added: 0, renamed: 0, retired: 0, needsReview: 0, failed: 0 },
      actions: [],
      details: [],
    }, fixedNow);
    expect(body).toContain("[title]INNOVERA番号の同期（INNOVERA → Kintone）[/title]");
  });
});
