import { describe, expect, it } from "vitest";
import { reportEmployeeCount, reportOrders, reportPoints, reportRanking, telemaEmployees } from "./call-report-v3";
import { kotReportHours } from "./call-report-v3.server";
import { buildCallReport } from "./call-report";
import { normalizeCallMetricsRpc, summarizeCallMetrics } from "./call-metrics";
import type { PointRow } from "@/lib/product-points";

const date = "2026-11-10";
const employee = (name: string, current_team: string | null, code: string) => ({ name, current_team, kot_employee_id: code });
const people = [employee("宮永 ひかり", "宮永チーム", "1"), employee("小泉 翔", "小泉チーム", "2"), employee("石原 孝志朗", "石原チーム", "3"), employee("新人 花子", "新人チーム", "4"), employee("上田 太郎", "宮永チーム", "5"), employee("無所属 太郎", null, "6")];
const metric = (name: string, acquired: number, toss: number) => normalizeCallMetricsRpc({ employee_metrics: [{ employee_name: name, call_count: 2, acquired_count: acquired, toss_count: toss }] }, { from: date, to: date, listName: null, employeeName: null }).employeeMetrics[0];
const row = (product: string, channel: PointRow["channel"], report_group: PointRow["report_group"], total_points: number): PointRow => ({ id: product, category: "kaisen", toss_points: 0, closer_points: total_points, unit_price: null, has_option: null, sort_order: 0, note: null, updated_at: date, updated_by: null, product, kintone_names: [], channel, report_group, total_points, start_date: date, end_date: null });
const record = (fields: Record<string, string>) => Object.fromEntries(Object.entries(fields).map(([k, value]) => [k, { value }]));

describe("本文v3の集計", () => {
  it("四チームのリーダーを含め、上田とチーム無しを時間と人数から除く", () => {
    expect(telemaEmployees(people)).toHaveLength(4);
    const codes = new Map(people.map((p, i) => [String(i), p.kot_employee_id]));
    const raw = { date, dailyWorkings: people.map((p, i) => ({ employeeKey: String(i), totalWork: i < 4 ? 1633 : 9000 })) };
    expect(kotReportHours(raw, date, people, codes)).toBe(109);
    expect(kotReportHours({ date, dailyWorkings: [{ employeeKey: "0", totalWork: 0 }] }, date, people, codes)).toBe(0);
    expect(() => kotReportHours({ date, dailyWorkings: [{ employeeKey: "0", workMinutes: 60 }] }, date, people, codes)).toThrow();
    expect(kotReportHours({ date, dailyWorkings: [{ employeeKey: "0", totalWork: 90 }, { employeeKey: "4" }] }, date, people, codes)).toBe(2);
    expect(reportEmployeeCount([metric("宮永　ひかり", 0, 0), metric("小泉 翔", 0, 0), metric("上田 太郎", 0, 0), metric("無所属 太郎", 0, 0)], people)).toBe(2);
    expect(() => kotReportHours(raw, "2026-11-11", people, codes)).toThrow();
    expect(() => kotReportHours([{ date, employeeCode: "1", employeeKey: "1" }], date, people, codes)).toThrow();
  });
  it("獲得とトスを前確OKと独立して順位付けし、同数全員とゼロ非表示を扱う", () => {
    expect(reportRanking([metric("南薗 太郎", 2, 0), metric("宮永 ひかり", 2, 0), metric("宮本 桃華", 0, 4)])).toBe("\n\n当日獲得ランキング1位\nクローザー：2件 南薗さん・宮永さん\nトス：4件 宮本さん");
    expect(reportRanking([metric("宮本 桃華", 0, 4)])).not.toContain("クローザー");
    expect(reportRanking([metric("南薗 太郎", 2, 0)])).not.toContain("トス：");
    expect(reportRanking([metric("南薗 太郎", 0, 0)])).toBe("");
  });
  it("当日の受注と獲得方法・キャンセル除外・クレカ代替欄を扱う", () => {
    const customer = (extra: Record<string, string>) => record({ 受注日: date, 商材名区分2: "コラボ", 事業名: "自社", ...extra });
    const orders = reportOrders([customer({}), customer({ B_リスト名: "WEB_ヒカリのプロ" }), customer({ 事業名: "アライアンス" }), customer({ 商材ステータス: "キャンセル" }), customer({ 受注日: "2026-11-09" }), customer({ 事業名: "他社" })], date);
    expect(orders.map(o => o.channel)).toEqual(["hakuchi", "lp", "alliance"]);
    expect(reportOrders([record({ 紹介日: date, 商材名区分2: "カード" })], date, true)[0].channel).toBe("hakuchi");
    expect(reportOrders([record({ 日付_4: date, ドロップダウン_12: "カード", 文字列__1行__14: "アライアンス" })], date, true)[0].channel).toBe("alliance");
    expect(reportOrders([record({ 日付_4: date, ドロップダウン_12: "カード", 事業名: "自社", リスト名: "WEB_カード" })], date, true)[0].channel).toBe("lp");
  });
  it("ポイント表の合計付与Pと配信の内訳を使い、ゼロを消し不明商材を警告する", () => {
    const orders = reportOrders([record({ 受注日: date, 商材名区分2: "コラボ", 事業名: "自社" }), record({ 受注日: date, 商材名区分2: "au光プラス", 事業名: "自社" })], date);
    const result = reportPoints(orders, [row("コラボ", "hakuchi", "collab", 1.2)]);
    expect(result.text).toBe("\n\n【テレマ全体】\n合計件数：1.2P\n白地：1.2P（コラボ1.2）");
    expect(reportPoints([], []).text).toBe("\n\n【テレマ全体】\n合計件数：0.0P");
    expect(result.text).not.toContain("AU0");
    expect(result.warnings).toEqual(["⚠ポイント表に無い商材：au光プラス 1件"]);
  });
  it("事業を指定順に並べ、開始受付を除きフレッツを出し、LP受注率を出さない", () => {
    const m = normalizeCallMetricsRpc({ metrics: [{ call_count: 172 }] }, { from: date, to: date, listName: null, employeeName: null });
    const codes: Record<string, string> = { "ヒカリのプロ": "hikari-pro", "電気お申込み受付窓口": "denki-kaishi", "フレッツ": "flets", "電気開始受付センター": "denki-uketsuke" };
    const business = (bizName: string) => ({ bizCode: codes[bizName], bizName, inbound: 15, outbound: 7, reportCustomers: { handled: 17, effective: 13 }, customerOrders: 1 });
    m.lp = { businesses: ["フレッツ", "電気開始受付センター", "電気お申込み受付窓口", "ヒカリのプロ"].map(business) as NonNullable<typeof m.lp>["businesses"], totals: null, notes: [], unregisteredExtensionSummary: null };
    m.reportV3 = { employeeCount: 7, hours: 109, points: "", ranking: "", warnings: [] };
    const text = buildCallReport(summarizeCallMetrics(m), new Date(date + "T06:00:00Z"), m).text!;
    expect(text).toContain("【アウトテレマ】従業員7名／109ｈ／総コール172回");
    expect(text).toContain("平均コール数/ｈ：2回");
    expect(text).toContain("有効顧客率：76.5％（13件）");
    expect(text).not.toContain("電気開始受付センター");
    expect(text.indexOf("■ヒカリのプロ")).toBeLessThan(text.indexOf("■電気お申込み受付窓口"));
    expect(text.indexOf("■電気お申込み受付窓口")).toBeLessThan(text.indexOf("■フレッツ"));
    expect(text.split("■").slice(1).join("■")).not.toContain("受注率：");
  });
  it("商材名区分2 で表に無いときは「商材区分2（マスタ）」で探す（タイプなしの au光プラス）", () => {
    const rec = (fields: Record<string, string>) => Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, { value: v }]));
    const orders = reportOrders([
      rec({ 受注日: date, 事業名: "自社", B_リスト名: "", 商材名区分2: "au光プラス", m_product: "au光プラス タイプ3", 商材ステータス: "" }),
      rec({ 受注日: date, 事業名: "自社", B_リスト名: "", 商材名区分2: "au光プラス", m_product: "", 商材ステータス: "" }),
    ] as never, date);
    const row = (product: string, total: number) => ({ id: product, product, channel: "hakuchi", category: "kaisen", report_group: "au", start_date: date, end_date: null, total_points: total, toss_points: 0.2, closer_points: total - 0.2, unit_price: null, has_option: null, kintone_names: [], sort_order: 0, note: null, updated_at: date, updated_by: null });
    const result = reportPoints(orders, [row("au光プラス タイプ3", 2.0)] as never);
    expect(result.text).toContain("合計件数：2.0P");
    expect(result.warnings.join("")).toContain("au光プラス 1件");
  });
});
