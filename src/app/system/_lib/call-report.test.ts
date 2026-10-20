import { describe, expect, it } from "vitest";
import { buildCallReport, jstDateString, parseReportDate } from "./call-report";
import type { CallMetricsResponse } from "./call-metrics";
import { summarizeCallMetrics } from "./call-metrics";

function fixture(): CallMetricsResponse {
  return {
    from: "2026-10-20", to: "2026-10-20", listName: null, employeeName: null, lastImportedAt: null,
    metrics: [{ listName: "A", callCount: 2345, effectiveCount: 903, effectiveRate: 0, tossCount: 0, orderCount: 6, acquiredCount: 5, callOrderRate: 0, callAcquiredRate: 0 }],
    employeeMetrics: Array.from({ length: 12 }, (_, i) => ({ employeeName: String(i), callCount: i ? 0 : 2345, effectiveCount: i ? 0 : 903, effectiveRate: 0, tossCount: 0, orderCount: i ? 0 : 6, acquiredCount: i ? 0 : 5, callOrderRate: 0, callAcquiredRate: 0, prospectCount: 0, absentCount: 0, awayCount: 0, invalidCount: 0, workSeconds: 2345 * 3600 / 42 / 12 })),
    reportTelema: { acquired: 5, waiting: 4, ng: 1, ok: 6 },
    lp: { businesses: [{ bizCode: "hikari", bizName: "ヒカリのプロ", recordOrder: 1, inbound: 6, answered: 6, missed: 0, voicemail: 0, outbound: 11, outboundAnswered: 6, talkSeconds: 0, applications: 2, unassignedApplications: 0, customerOrders: 3, reportCustomers: { handled: 12, effective: 10 }, registeredCounts: { denominator: 3, preconfirmWaiting: 1, preconfirmNg: 0, applications: 2, won: 3, excluded: 0 } }], totals: null, notes: [], unregisteredExtensionSummary: null },
    lpFunnel: { businesses: [{ bizCode: "hikari", inbound: 6, answered: 6, answerRate: 1, noRecord: 0 } as NonNullable<CallMetricsResponse["lpFunnel"]>["businesses"][number]], totals: null, asOf: "2026-10-20T06:00:00Z", notes: [] },
  };
}
const now = new Date("2026-10-20T06:04:00Z");
const report = (m = fixture()) => buildCallReport(summarizeCallMetrics(m), now, m);
describe("配信本文 v2", () => {
  it("例の全文と単位・改行が一致する", () => {
    expect(report().text).toBe(`[info][title]テレマ コール集計ポータル 自動配信[/title]2026/10/20(火) 15:00
https://garden-os.net/system/call-metrics

【本日】従業員12名／総コール2,345回
平均コール数/人：195 回
平均コール数/ｈ：42回
有効率：38.5％
受注数：5件（前確待ち4件／前確NG1件／前確OK6件）
受注率：0.6％
前確OK率：85.7％

■ヒカリのプロ
発着信：17件（着信6件／発信11件）
初回応答率：100.0％（応答6件／入電6件）
対応顧客数：12人
有効顧客数：10件
受注数：3件（前確待ち1件／前確NG0件／前確OK2件）
受注率：30.0％
前確OK率：100.0％
[/info]`);
  });
  it("ゼロの分母は -、対象外率は表示しない", () => {
    const m = fixture();
    m.employeeMetrics.forEach(r => { r.workSeconds = 0; r.effectiveCount = 0; });
    m.reportTelema = { acquired: 0, waiting: 0, ok: 0, ng: 0 };
    m.lp!.businesses[0].reportCustomers = { handled: 0, effective: 0 };
    m.lp!.businesses[0].registeredCounts = { denominator: 0, preconfirmWaiting: 0, preconfirmNg: 0, applications: 0, won: 0, excluded: 0 };
    const text = report(m).text;
    expect(text).toContain("平均コール数/ｈ：-");
    expect(text?.match(/受注率：-/g)).toHaveLength(2);
    expect(text?.match(/前確OK率：-/g)).toHaveLength(2);
    expect(text).not.toContain("対象外率");
  });
  it("取得失敗を0と区別する", () => {
    const m = fixture(); m.reportTelema = null;
    m.lp!.businesses[0] = { ...m.lp!.businesses[0], reportCustomers: null, registeredCounts: null, customerOrders: null };
    expect(report(m).text).toContain("対応顧客数：-\n有効顧客数：-\n受注数：-（前確待ち-／前確NG-／前確OK-）\n受注率：-\n前確OK率：-");
  });
  it("両方の警告行と停止注記を維持する", () => {
    const m = fixture(); m.lpFunnel!.businesses[0].noRecord = 1;
    m.lpUnmatchedOrders = [{ listName: "WEB_不一致", count: 2 }];
    m.innovera = { hasRows: true, stopped: true, lastSyncAt: "2026-10-20T05:00:00Z" };
    const text = report(m).text;
    expect(text).toContain("※INNOVERA 取込停止中（最終 14:00）");
    expect(text).toContain("⚠Kintone記録なし：1件");
    expect(text).toContain("\n\n⚠事業に結びつかない受注（リスト名を確認）：WEB_不一致 2件");
  });
  it("0件スキップとフォームのみの日の配信を維持する", () => {
    const m = fixture(); m.metrics = []; m.employeeMetrics = []; m.lp!.businesses[0].inbound = 0; m.lp!.businesses[0].outbound = 0;
    expect(report(m)).toEqual({ skipped: true, reason: "本日コール0件", text: null });
    m.lpFormCount = 1;
    expect(report(m).skipped).toBe(false);
    expect(report(m).text).toContain("総コール0回\n平均コール数/人：-\n平均コール数/ｈ：-");
  });
  it("JSTの日付と日付検証を維持する", () => {
    expect(jstDateString(new Date("2026-08-11T15:30:00Z"))).toBe("2026-08-12");
    expect(parseReportDate(undefined, now)).toBe("2026-10-20");
    expect(() => parseReportDate("2026-02-30")).toThrow("YYYY-MM-DD");
  });
});
