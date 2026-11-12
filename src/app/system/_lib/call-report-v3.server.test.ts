import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ daily: vi.fn(), employees: vi.fn(), records: vi.fn() }));
vi.mock("@/lib/kintone/records", () => ({ getAllRecords: mocks.records }));
vi.mock("@/app/root/_lib/kot-api", async (original) => ({
  ...await original<typeof import("@/app/root/_lib/kot-api")>(),
  fetchKotDailyWorkings: mocks.daily,
  fetchKotEmployees: mocks.employees,
}));
import { loadCallReportV3 } from "./call-report-v3.server";
import { normalizeCallMetricsRpc, summarizeCallMetrics } from "./call-metrics";
import { buildCallReport } from "./call-report";
import { creditApps, safeFetchCredit } from "../kanri/_lib/kanri-import.server";
import type { PointRow } from "@/lib/product-points";

const date = "2026-11-10";
const rec = (fields: Record<string, string>) => Object.fromEntries(Object.entries(fields).map(([key, value]) => [key, { value }]));
const point = (product: string, report_group: PointRow["report_group"], total_points: number, channel: PointRow["channel"] = "hakuchi"): PointRow => ({ id: product, category: "kaisen", toss_points: 0, closer_points: total_points, unit_price: null, has_option: null, sort_order: 0, note: null, updated_at: date, updated_by: null, product, report_group, total_points, channel, kintone_names: [], start_date: date, end_date: null });
const metrics = () => normalizeCallMetricsRpc({ metrics: [{ call_count: 172 }], employee_metrics: [{ employee_name: "南薗 太郎", call_count: 172, acquired_count: 2, toss_count: 4 }] }, { from: date, to: date, listName: null, employeeName: null });
const people = [{ name: "南薗 太郎", current_team: "宮永チーム", kot_employee_id: "1" }];
const client = (rows: PointRow[]) => {
  const query = { order: vi.fn(), range: vi.fn(async () => ({ data: rows, error: null })) };
  query.order.mockReturnValue(query);
  return { from: vi.fn(() => ({ select: vi.fn(() => query) })) } as unknown as Parameters<typeof loadCallReportV3>[0];
};

describe("配信v3の読み込み（外部接続はすべてモック）", () => {
  afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(date + "T06:00:00Z"));
    vi.unstubAllEnvs();
    mocks.daily.mockReset().mockResolvedValue({ date, dailyWorkings: [{ employeeKey: "key", totalWork: 6540 }] });
    mocks.employees.mockReset().mockResolvedValue([{ key: "key", code: "1" }]);
    mocks.records.mockReset().mockResolvedValue([]);
    vi.stubEnv("KINTONE_KANRI_CUSTOMER_TOKEN", "mock-customer");
    vi.stubEnv("KINTONE_KANRI_CREDIT_APPS", "66,84,89,91,94,96,229,230");
    for (const app of creditApps()) vi.stubEnv(`KINTONE_KANRI_CREDIT_TOKEN_${app}`, "mock-credit");
  });
  it("クレカ8アプリの当日分を全て足し、失敗アプリだけ警告して配信を続ける", async () => {
    mocks.records.mockImplementation(async (app: string | number) => {
      if (app === 10) return [];
      if (app === "94") throw new Error("mock failure");
      return [rec({ 日付_4: date, ドロップダウン_12: "カード" }), rec({ 日付_4: "2026-11-09", ドロップダウン_12: "カード" })];
    });
    const result = await loadCallReportV3(client([point("カード", "credit", 0.4)]), metrics(), people);
    expect(result.reportV3?.points).toContain("合計件数：2.8P");
    expect(mocks.records.mock.calls.filter(([app]) => app !== 10).map(([app]) => app)).toEqual(creditApps());
    expect(result.reportV3?.warnings).toEqual(["⚠クレカのアプリ 94 を読めませんでした"]);
    const output = buildCallReport(summarizeCallMetrics(result), new Date(date + "T06:00:00Z"), result);
    expect(output.skipped).toBe(false);
    expect(output.text).toContain("⚠クレカのアプリ 94 を読めませんでした\n[/info]");
  });
  it("全8アプリが読めた場合も集計し、管理表の既存条件は維持する", async () => {
    mocks.records.mockImplementation(async (app: string | number) => app === 10 ? [] : [rec({ 紹介日: date, 商材名区分2: "カード" })]);
    const result = await loadCallReportV3(client([point("カード", "credit", 0.4)]), metrics(), people);
    expect(result.reportV3?.points).toContain("合計件数：3.2P");
    expect(result.reportV3?.warnings).toEqual([]);
    await safeFetchCredit("66", date);
    expect(mocks.records.mock.calls.at(-1)?.[2]).toContain('ドロップダウン_17 in ("OK")');
  });
  it("稼働時間はコール履歴ではなくKING OF TIMEの勤務時間を使う", async () => {
    const m = metrics();
    m.employeeMetrics = [
      { ...m.employeeMetrics[0], employeeName: "南薗 太郎", workSeconds: 5 * 3600 },
      { ...m.employeeMetrics[0], employeeName: "上田 基人", workSeconds: 8 * 3600 },
      { ...m.employeeMetrics[0], employeeName: "外部 花子", workSeconds: 3 * 3600 },
    ];
    const roster = [...people, { name: "上田 基人", current_team: "宮永チーム", kot_employee_id: "2" }, { name: "外部 花子", current_team: null, kot_employee_id: "3" }];
    const result = await loadCallReportV3(client([]), m, roster);
    expect(result.reportV3?.hours).toBe(109);
    expect(mocks.daily).toHaveBeenCalledWith(date);
    expect(mocks.employees).toHaveBeenCalledWith({ date, includeResigner: true });
    expect(result.reportV3?.points).toContain("合計件数：0.0P");
  });
  it("モックの本文を全文で確認する", async () => {
    mocks.records.mockImplementation(async (app: string | number) => app === 10 ? [
      rec({ 受注日: date, 商材名区分2: "コラボ", 事業名: "自社" }),
      rec({ 受注日: date, 商材名区分2: "でんき", 事業名: "自社" }),
      rec({ 受注日: date, 商材名区分2: "コラボLP", 事業名: "自社", B_リスト名: "WEB_ヒカリのプロ" }),
    ] : []);
    const m = metrics();
    m.employeeMetrics = [
      ...Array.from({ length: 6 }, (_, i) => ({ ...m.employeeMetrics[0], employeeName: `従業員${i} 花子`, callCount: 1, acquiredCount: 0, tossCount: 0, effectiveCount: 0 })),
      { ...m.employeeMetrics[0], callCount: 166, tossCount: 0, effectiveCount: 50, workSeconds: 109 * 3600 },
      { ...m.employeeMetrics[0], employeeName: "宮本 桃華", callCount: 0, acquiredCount: 0, tossCount: 4, effectiveCount: 0 },
    ];
    const roster = m.employeeMetrics.map((r, i) => ({ name: r.employeeName, current_team: "宮永チーム", kot_employee_id: String(i + 1) }));
    m.reportTelema = { acquired: 0, waiting: 0, ng: 0, ok: 0 };
    const codes: Record<string, string> = { "ヒカリのプロ": "hikari-pro", "電気お申込み受付窓口": "denki-kaishi", "フレッツ": "flets" };
    const lpRow = (name: string) => ({ bizName: name, bizCode: codes[name], inbound: 15, outbound: 7, reportCustomers: { handled: 17, effective: 13 }, customerOrders: 1, registeredCounts: { preconfirmWaiting: 1, preconfirmNg: 0, applications: 1 } });
    m.lp = { businesses: [lpRow("ヒカリのプロ"), lpRow("電気お申込み受付窓口"), lpRow("フレッツ")] as NonNullable<typeof m.lp>["businesses"], totals: null, notes: [], unregisteredExtensionSummary: null };
    m.lpFunnel = { businesses: m.lp.businesses.map(r => ({ bizCode: r.bizCode, answered: 8, inbound: 12, answerRate: 8 / 12, noRecord: r.bizName === "ヒカリのプロ" ? 2 : 0 })) as NonNullable<typeof m.lpFunnel>["businesses"], totals: null, notes: [], asOf: date };
    const result = await loadCallReportV3(client([point("コラボ", "collab", 1.2), point("でんき", "denki", 0.4), point("コラボLP", "collab", 1.6, "lp")]), m, roster);
    const output = buildCallReport(summarizeCallMetrics(result), new Date(date + "T06:00:00Z"), result).text;
    expect(output).toMatchSnapshot();
  });
  it("KOTのエラーは時間をnullにし、本文の警告に追加しない", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    mocks.daily.mockRejectedValue(new Error("secret-token personal-name"));
    const result = await loadCallReportV3(client([]), metrics(), people);
    expect(result.reportV3?.hours).toBeNull();
    expect(result.reportV3?.warnings).toEqual([]);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).not.toMatch(/secret-token|personal-name/);
    const text = buildCallReport(summarizeCallMetrics(result), new Date(), result).text;
    expect(text).toContain("-ｈ");
  });

  it("読めた勤務時間0は0、形式が違う結果はnullにする", async () => {
    mocks.daily.mockResolvedValue({ date, dailyWorkings: [{ employeeKey: "key", totalWork: 0 }] });
    expect((await loadCallReportV3(client([]), metrics(), people)).reportV3?.hours).toBe(0);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    mocks.daily.mockResolvedValue({ date, dailyWorkings: [{ employeeKey: "key", workMinutes: 600 }] });
    const result = await loadCallReportV3(client([]), metrics(), people);
    expect(result.reportV3?.hours).toBeNull();
    expect(result.reportV3?.warnings).toEqual([]);
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["T09:05:00+09:00", "T08:30:00+09:00"],
    ["T18:05:00+09:00", "T17:30:00+09:00"],
  ])("停止時間%sは当日の停止開始前の最新中継結果だけを読む", async (time, cutoff) => {
    vi.setSystemTime(new Date(date + time));
    const relayQueries: Record<string, ReturnType<typeof vi.fn>>[] = [];
    const db = client([]);
    const originalFrom = client([]).from.bind(db);
    vi.spyOn(db, "from").mockImplementation((table: string) => {
      if (table !== "system_relay_jobs") return originalFrom(table);
      let path = "";
      const query: Record<string, ReturnType<typeof vi.fn>> = {};
      for (const method of ["select", "eq", "gte", "lt", "order", "limit"]) {
        query[method] = vi.fn((...args: unknown[]) => {
          if (method === "eq" && args[0] === "request->>path") path = String(args[1]);
          return query;
        });
      }
      query.maybeSingle = vi.fn(async () => ({ data: { result: path.startsWith("/daily-workings/")
        ? { date, dailyWorkings: [{ employeeKey: "key", totalWork: 300 }] }
        : [{ key: "key", code: "1" }] }, error: null }));
      relayQueries.push(query);
      return query as unknown as ReturnType<typeof db.from>;
    });
    const result = await loadCallReportV3(db, metrics(), people);
    expect(result.reportV3?.hours).toBe(5);
    expect(mocks.daily).not.toHaveBeenCalled();
    expect(mocks.employees).not.toHaveBeenCalled();
    expect(relayQueries).toHaveLength(2);
    for (const query of relayQueries) {
      expect(query.eq).toHaveBeenCalledWith("kind", "kot");
      expect(query.eq).toHaveBeenCalledWith("status", "done");
      expect(query.gte).toHaveBeenCalledWith("created_at", new Date(date + "T00:00:00+09:00").toISOString());
      expect(query.lt).toHaveBeenCalledWith("created_at", new Date(date + cutoff).toISOString());
      expect(query.order).toHaveBeenCalledWith("created_at", { ascending: false });
      expect(query.limit).toHaveBeenCalledWith(1);
    }
    expect(relayQueries[0].eq).toHaveBeenCalledWith("request->>path", `/daily-workings/${date}`);
    expect(relayQueries[1].eq).toHaveBeenCalledWith("request->>path", `/employees?date=${date}&includeResigner=true`);
    relayQueries[1].maybeSingle.mockResolvedValue({ data: null, error: null });
    let index = 0;
    vi.mocked(db.from).mockImplementation((table: string) => table === "system_relay_jobs"
      ? relayQueries[index++ % 2] as unknown as ReturnType<typeof db.from> : originalFrom(table));
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const missing = await loadCallReportV3(db, metrics(), people);
    expect(missing.reportV3?.hours).toBeNull();
    expect(missing.reportV3?.warnings).toEqual([]);
    expect(warn).toHaveBeenCalledTimes(1);
  });
});
