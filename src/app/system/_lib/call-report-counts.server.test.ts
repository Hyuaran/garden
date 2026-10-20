import { describe, expect, it, vi } from "vitest";
import { countReportCustomers, countReportTelema, loadCallReportCounts } from "./call-report-counts.server";
import { countLpRegisteredRecords, type LpCustomerRecord } from "./lp-kintone";
import type { LpContext } from "./lp-context.server";
import type { CallMetricsResponse } from "./call-metrics";
const event = (id: string, sales_id: string | null, flag: string, time = "12:00:00") => ({ id, sales_id, flag, time, date: "2026-10-20" });
const record = (id: string, status: string, phones: Record<string, unknown>, createdAt = "2026-10-20T01:00:00Z"): LpCustomerRecord => ({ id, status, phones, createdAt, assignee: null, source: null, slot: null });
describe("配信用の営業ID集計", () => {
  it("受注は営業IDごと、空IDは各1件。前確は最後の結果で1件", () => {
    expect(countReportTelema([
      event("1", "A", "獲得"), event("2", "A", "獲得"), event("3", null, "獲得"), event("4", "", "獲得"),
      event("5", "B", "前確OK", "11:00:00"), event("6", "B", "前確OK", "11:10:00"), event("7", "B", "前確NG"),
      event("8", "C", "前確OK"), event("9", "C", "前確OK"),
    ], [])).toEqual({ acquired: 3, waiting: 3, ok: 1, ng: 1 });
  });
  it("前確待ちは今日の受注で一度も前確がない営業ID。過去の前確も除く", () => {
    expect(countReportTelema([
      event("1", "A", "獲得"), event("2", "B", "獲得"), event("3", "C", "獲得"),
      event("4", "B", "前確NG"), event("5", "以前の受注", "前確OK"),
    ], ["C"])).toEqual({ acquired: 3, waiting: 1, ok: 1, ng: 1 });
  });
  it("入力順に依存せず同時刻はFM主キーの数値順で決める", () => {
    expect(countReportTelema([event("10", "A", "前確NG"), event("9", "A", "前確OK")], [])).toEqual({ acquired: 0, waiting: 0, ok: 0, ng: 1 });
    expect(countReportTelema([], [])).toEqual({ acquired: 0, waiting: 0, ok: 0, ng: 0 });
  });
});
describe("配信用のWEB顧客数", () => {
  it("同じ番号の発着信は1人、国番号とハイフンを正規化し、対象外は最新記録で1人ずつ引く", () => {
    const records = [
      record("1", "対象外（現アナ等）", { phone: "090-1111-1111", 架電連絡先: "09011111111" }),
      record("2", "申込み", { 電話番号_ハイフンなし: "09022222222" }, "2026-10-19T01:00:00Z"),
      record("3", "対象外（契約不可）", { 携帯番号_ハイフンなし: "09022222222" }),
      record("4", "対象外（連絡つかず）", { phone: "09033333333" }),
      record("5", "重複", { phone: "09044444444" }),
    ];
    expect(countReportCustomers(["09011111111", "+81 90 1111 1111", "09022222222", "09033333333", "09044444444", "09055555555", "非通知", "2001"], records)).toEqual({ handled: 5, effective: 2 });
    expect(countReportCustomers(["09011111111"], null)).toEqual({ handled: 1, effective: null });
    expect(countReportCustomers([], [])).toEqual({ handled: 0, effective: 0 });
  });
  it("前確内訳は登録日基準で重複・期間外を除外", () => {
    const records = [record("1", "前確待ち", {}), record("2", "前確NG", {}), record("3", "申込み", {}), record("4", "重複", {}), record("5", "前確NG", {}, "2026-10-19T01:00:00Z")];
    expect(countLpRegisteredRecords(records, "2026-10-20", "2026-10-20")).toMatchObject({ preconfirmWaiting: 1, preconfirmNg: 1, applications: 1, denominator: 3 });
  });
  it("事業の複数回線を合流し、別事業・回線外の番号を含めず、PDF用データを変更しない", async () => {
    const metrics: CallMetricsResponse = { from: "2026-10-20", to: "2026-10-20", listName: null, employeeName: null, metrics: [], employeeMetrics: [], lastImportedAt: null, innovera: { hasRows: true, stopped: false, lastSyncAt: null }, lp: { businesses: [{ bizCode: "A", bizName: "A", recordOrder: 1, inbound: 2, answered: 0, missed: 2, voicemail: 0, outbound: 2, outboundAnswered: 0, talkSeconds: 0, applications: 0, unassignedApplications: 0 }], totals: null, notes: [], unregisteredExtensionSummary: null } };
    const context = { lpCircuitIds: [164,165,166], lpScope: [{ bizCode: "A", circuitIds: [164,165], customerApp: 226 }], recordsByApp: new Map([[226, []]]) } as unknown as LpContext;
    const client = { rpc: vi.fn().mockResolvedValue({ data: { authorized: true, telema_events: [event("1", "A", "獲得")], confirmed_sales: [], phones: [{ circuit_id: 164, number: "09011111111" }, { circuit_id: 165, number: "09011111111" }, { circuit_id: 165, number: "09022222222" }, { circuit_id: 166, number: "09033333333" }] }, error: null }) };
    const result = await loadCallReportCounts(client, metrics, context, new Date("2026-10-20T06:00:00Z"));
    expect(result.lp!.businesses[0].reportCustomers).toEqual({ handled: 2, effective: 2 });
    expect(result.reportTelema).toEqual({ acquired: 1, waiting: 1, ok: 0, ng: 0 });
    expect(metrics.lp!.businesses[0].reportCustomers).toBeUndefined();
    client.rpc.mockResolvedValue({ data: { authorized: false }, error: null });
    await expect(loadCallReportCounts(client, metrics, context, new Date())).rejects.toThrow("配信集計");
  });
});
