import { describe, expect, it } from "vitest";
import { buildCallReport, jstDateString, parseReportDate } from "./call-report";
import type { CallMetricsSummary } from "./call-metrics";

const summary: CallMetricsSummary = { employeeCount: 15, totalCalls: 1517, totalEffective: 910, totalOrders: 45, totalAcquired: 30, totalTosses: 20, averageCalls: 1517 / 15, effectiveRate: 910 / 1517, acquiredRate: 30 / 1517, preconfirmRate: 45 / 1517 };

describe("call report", () => {
  it("formats the confirmed text in JST with Japanese weekday and rounding", () => {
    const result = buildCallReport(summary, new Date("2026-08-12T06:04:00Z"));
    expect(result.skipped).toBe(false);
    expect(result.text).toContain("[/title]2026/08/12(水) 15:00\nhttps://garden-os.net/system/call-metrics");
    expect(result.text).not.toContain("[/title]\n");
    expect(result.text).toContain("従業員15名／総コール1,517件");
    expect(result.text).toContain("平均コール数：101 件");
    expect(result.text).toContain("有効率：60.0％");
    expect(result.text).toContain("受注率：2.0％（受注30件）");
    expect(result.text).toContain("前確OK率：3.0％（前確OK45件）");
    expect(result.text).not.toContain("獲得");
  });
  it("labels the cron delivery slot at the top of the JST hour", () => {
    const result = buildCallReport(summary, new Date("2026-08-14T09:05:00Z"));
    expect(result.text).toContain("2026/08/14(金) 18:00");
    expect(result.text).not.toContain("18:05");
  });
  it("skips zero-call days without text", () => {
    expect(buildCallReport({ ...summary, totalCalls: 0 })).toEqual({ skipped: true, reason: "本日コール0件", text: null });
  });
  it("WEBインバウンドは事業ごとに 4〜5 行（発着信・初回応答率・受注率（前確待ち／受注）・対象外率）、フォーム受付だけの日も送る", () => {
    const funnelBase = {
      total: 15, inbound: 12, answered: 10, unanswered: 2, callbackConnected: 2, callbackNotConnected: 0, noCallback: 0, forms: 3,
      withSlot: 2, onTime: { connected: 2, notConnected: 0, noCall: 0 }, late: { connected: 0, notConnected: 0, noCall: 0 }, pendingWithSlot: { connected: 0, notConnected: 0, noCall: 0 },
      noSlot: 1, noSlotOnTime: { connected: 1, notConnected: 0, noCall: 0 }, noSlotLate: { connected: 0, notConnected: 0, noCall: 0 }, noSlotPending: { connected: 0, notConnected: 0, noCall: 0 },
      invalidNumberForms: 0, unknownInboundCalls: 2, answerRate: 10 / 12, spoke: 15, spokeInbound: 10, spokeCallback: 2, spokeForm: 3,
      won: 9, inProgress: 4, lost: 1, excluded: 0, noRecord: 1, contactRate: 1, wonRate: 9 / 15, excludedRate: 0, effectiveWonRate: 9 / 15, pendingCount: 0, noRecordList: [], calcNotes: [],
    };
    const metrics = {
      from: "2026-10-13", to: "2026-10-13", listName: null, employeeName: null, metrics: [], employeeMetrics: [], lastImportedAt: null,
      innovera: { lastSyncAt: "2026-10-14T14:45:18Z", stopped: false, hasRows: true },
      lp: {
        businesses: [
          { bizCode: "hikari-pro", bizName: "ヒカリのプロ", recordOrder: 1, inbound: 26, answered: 14, missed: 12, voicemail: 0, outbound: 48, outboundAnswered: 39, talkSeconds: 14498, applications: 4, customerOrders: 6, registeredCounts: { denominator: 9, preconfirmWaiting: 2, applications: 4, won: 6, excluded: 2 }, unassignedApplications: 0 },
          { bizCode: "denki", bizName: "電気開始受付センター", recordOrder: 2, inbound: 21, answered: 14, missed: 7, voicemail: 2, outbound: 39, outboundAnswered: 32, talkSeconds: 11910, applications: 5, customerOrders: 6, registeredCounts: { denominator: 10, preconfirmWaiting: 1, applications: 5, won: 6, excluded: 2 }, unassignedApplications: 0 },
        ],
        totals: null, notes: [], unregisteredExtensionSummary: null,
      },
      lpFunnel: {
        asOf: "2026-10-13T14:59:59Z", notes: [], totals: null,
        businesses: [
          { ...funnelBase, bizCode: "hikari-pro", bizName: "ヒカリのプロ" },
          { ...funnelBase, bizCode: "denki", bizName: "電気開始受付センター", inbound: 10, answered: 8, spoke: 16, won: 7, excluded: 4, answerRate: 0.8, wonRate: 7 / 16, excludedRate: 0.25, effectiveWonRate: 7 / 12, pendingCount: 2 },
        ],
      },
      lpFormCount: 11,
    };
    const result = buildCallReport(summary, new Date("2026-10-14T06:05:00Z"), metrics);
    expect(result.text).toContain("前確OK率：3.0％（前確OK45件）\n\n■ヒカリのプロ\n発着信：74件（着信26件／発信48件）\n初回応答率：83.3％（応答10件／入電12件）\n受注率：66.7％（前確待ち2件／受注6件）\n対象外率：22.2％\n⚠Kintone記録なし：1件\n\n■電気開始受付センター\n");
    expect(result.text).toContain("■電気開始受付センター\n発着信：60件（着信21件／発信39件）\n初回応答率：80.0％（応答8件／入電10件）\n受注率：60.0％（前確待ち1件／受注6件）\n対象外率：20.0％\n⚠Kintone記録なし：1件\n[/info]");
    for (const registeredCounts of [null, { denominator: 0, preconfirmWaiting: 0, applications: 0, won: 0, excluded: 0 }]) {
      const unavailable = buildCallReport(summary, new Date(), { ...metrics, lp: { ...metrics.lp, businesses: metrics.lp.businesses.map(b => ({ ...b, registeredCounts, customerOrders: registeredCounts ? 0 : null })) } });
      expect(unavailable.text).toContain(registeredCounts ? "受注率：-（前確待ち0件／受注0件）" : "受注率：-（前確待ち-／受注-）");
      expect(unavailable.text).toContain("対象外率：-");
    }
    // 細かい内訳は PDF に任せる（本文には出さない）
    expect(result.text).not.toContain("申込");
    const ordersUnavailable = buildCallReport(summary, new Date(), { ...metrics, lp: { ...metrics.lp, businesses: metrics.lp.businesses.map(b => ({ ...b, customerOrders: null })) } });
    expect(ordersUnavailable.text).toContain("受注率：-（前確待ち2件／受注-）");
    expect(ordersUnavailable.text).toContain("対象外率：22.2％");
    const ordersOnly = buildCallReport(summary, new Date(), { ...metrics, lp: { ...metrics.lp, businesses: metrics.lp.businesses.map(b => ({ ...b, customerOrders: 3 })) } });
    expect(ordersOnly.text).toContain("受注率：33.3％（前確待ち2件／受注3件）");
    // リスト名 WEB_〇〇 の〇〇が事業の名前と違う受注は、最後に ⚠ で知らせる（数え漏れを出さない）
    expect(result.text).not.toContain("事業に結びつかない受注");
    const unmatched = buildCallReport(summary, new Date("2026-10-14T06:05:00Z"), { ...metrics, lpUnmatchedOrders: [{ listName: "WEB_ひかりのプロ", count: 2 }] });
    expect(unmatched.text).toContain("\n\n⚠事業に結びつかない受注（リスト名を確認）：WEB_ひかりのプロ 2件");
    expect(result.text).not.toContain("話せた：");
    expect(result.text).not.toContain("有効受注率");
    // 記録なしが 0 件の事業は ⚠ の行を出さない
    const noAlert = buildCallReport(summary, new Date("2026-10-14T06:05:00Z"), { ...metrics, lpFunnel: { ...metrics.lpFunnel, businesses: metrics.lpFunnel.businesses.map((b) => ({ ...b, noRecord: 0 })) } });
    expect(noAlert.text).not.toContain("⚠Kintone記録なし");
    expect(result.text).not.toContain("【対応と結果】");
    expect(result.text).not.toContain("【WEBインバウンド】");
    expect(result.text).not.toContain("ポータルで番号を確かめて登録");
    // テレマ 0 件・LP の電話 0 件でもフォーム受付があれば送る
    const formsOnly = buildCallReport({ ...summary, totalCalls: 0 }, new Date("2026-10-14T06:05:00Z"), { ...metrics, lp: { ...metrics.lp, businesses: metrics.lp.businesses.map((b) => ({ ...b, inbound: 0, outbound: 0 })) } });
    expect(formsOnly.skipped).toBe(false);
    expect(formsOnly.text).toContain("【本日】従業員15名／総コール0件\n平均コール数：-\n");
  });
  it("uses the JST calendar date and validates explicit dates", () => {
    const now = new Date("2026-08-11T15:30:00Z");
    expect(jstDateString(now)).toBe("2026-08-12");
    expect(parseReportDate(undefined, now)).toBe("2026-08-12");
    expect(parseReportDate("2026-02-28")).toBe("2026-02-28");
    expect(() => parseReportDate("2026-02-30")).toThrow("YYYY-MM-DD");
  });
});
