import { describe, expect, it } from "vitest";
import type { PointRow } from "@/lib/product-points";
import type { KanriSourceRow } from "./kanri-core";
import { matchedKanriOrders, soilPointMasters, missingKanriProducts } from "./soil-points";
import { calculateKanriSheet, kanriTeamBlocks } from "./calc/kanri-sheet";
import { calculateJissekiSheet, type KanriPerson } from "./calc/jisseki-sheet";
import { buildKanriWorkbook, type KanriExcelResults } from "./export/excel-export";
const row = (overrides: Partial<PointRow> = {}): PointRow => ({ id: "1", product: "回線", channel: "hakuchi", category: "kaisen", report_group: "collab", start_date: "2026-11-01", end_date: null, total_points: 2, toss_points: 0.3, closer_points: 1.7, unit_price: 100, kintone_names: ["別名"], sort_order: 0, has_option: null, note: null, updated_at: "", updated_by: null, ...overrides });
const source = (date: string, business = "自社", list = "", product = "別名"): KanriSourceRow => ({ source: "kintone_customer", sourceApp: null, recordId: date, payload: Object.fromEntries(Object.entries({ 受注日: date, 実績日: date, 事業名: business, リスト名: list, 商材名区分2: product, チーム名: "A", トス名: "トス", AP名: "担当" }).map(([key, value]) => [key, { value }])) });
const table = [row({ end_date: "2026-11-14" }), row({ id: "2", channel: "lp", total_points: 4, toss_points: 1, closer_points: 3, unit_price: 300 }), row({ id: "3", start_date: "2026-11-15", total_points: 6, toss_points: 2, closer_points: 4, unit_price: 500 }), ...Array.from({ length: 26 }, (_, i) => row({ id: String(i + 10), product: "商材" + i, sort_order: i + 1, kintone_names: [] }))];
const points = soilPointMasters(table);
const sourceRows = [source("2026-11-02"), source("2026-11-03", "自社", "WEB_test"), source("2026-11-16"), source("2026-11-17", "自社", "", "未登録")];
const manualInputs = { hoursByTeamByDate: {}, openRateByTeamByProduct: { A: { 回線: 1 } } };
const input = { yearMonth: "2026-11", holidays: [], sourceRows, points, teams: [{ team: "A", sort_order: 0 }, { team: "B", sort_order: 1 }, { team: "C", sort_order: 2 }], manualInputs };
describe("11月からの付与ポイント", () => {
    it("実績日で月と日を選び、受注日でポイント期間を選ぶ", () => {
        const before = source("2026-10-30");
        before.payload.実績日 = { value: "2026-11-02" };
        const after = source("2026-11-30");
        after.payload.実績日 = { value: "2026-12-01" };
        const historicalPoints = soilPointMasters([
            row({ start_date: "2026-10-01", end_date: "2026-10-31", total_points: 9 }),
            row({ total_points: 2 }),
        ]);
        const grid = calculateKanriSheet({ ...input, points: historicalPoints, sourceRows: [before, after] });
        expect(grid.totals.all.total).toBe(1);
        expect(grid.totals.all.points).toBe(9);
        expect(grid.days.find(day => day.date === "2026-11-02")?.all.total).toBe(1);
        // 受注日（10/30）の時点の行が無いときは、実績日（11/2）の時点の行で当てる（ポイント表に無い商材にしない）
        expect(missingKanriProducts([before], points, "2026-11")).toEqual([]);
        expect(matchedKanriOrders([before], points, "2026-11")[0].point.total_points).toBe(2);
        for (const excluded of [{ holidays: ["2026-11-02"] }, { targetDate: "2026-11-01" }]) {
            const result = calculateKanriSheet({ ...input, points: historicalPoints, sourceRows: [before], ...excluded });
            expect(result.totals.all.total).toBe(0);
            expect(result.totals.all.points).toBe(0);
        }
        before.payload.受注日 = { value: "" };
        expect(matchedKanriOrders([before], points, "2026-11")[0].point.total_points).toBe(2);
        const people = [{ name: "トス", kot_name: null, team: "A", department: "", employment_kind: "社員", base_wage: 0, is_field_sales: false, sort_order: 0 }];
        const actual = calculateJissekiSheet({ yearMonth: "2026-11", sourceRows: [before, after], points, people, manualInputs, commuteByName: {} });
        expect(actual.rows[0].totalPoints).toBe(0.3);
    });
    it("獲得方法が不明な受注も白地で数え、事業名別に警告する", () => {
        const grid = calculateKanriSheet({ ...input, sourceRows: [source("2026-11-02", ""), source("2026-11-03", "テレマーケティング")] });
        expect(grid.totals.all.total).toBe(2);
        expect(grid.totals.all.points).toBe(4);
        expect(grid.warnings).toEqual([
            { code: "point_channel_unknown", message: "獲得方法が分からない受注（白地で数えた）：事業名なし 1件" },
            { code: "point_channel_unknown", message: "獲得方法が分からない受注（白地で数えた）：事業名テレマーケティング 1件" },
        ]);
    });
    it("27商材を重複せず並べ、獲得方法と期間ごとに金額とポイントを加算する", () => {
        const grid = calculateKanriSheet(input);
        expect(grid.products).toHaveLength(27);
        expect(grid.totals.all.total).toBe(3);
        expect(grid.totals.all.points).toBe(12);
        expect(grid.totals.all.amount).toBe(900);
        expect(kanriTeamBlocks("2026-11", 27).map(b => b.hours)).toEqual(["I", "AM", "BQ"]);
        expect(grid.cellValues.AL4).toBe(0);
        expect(grid.cellValues.AM4).toBe(0);
        expect(grid.warnings).toEqual([{ code: "point_product_missing", message: "ポイント表に無い商材：未登録 1件" }]);
        expect(missingKanriProducts(sourceRows, points, "2026-10")).toEqual([]);
    });
    it("実績管理のトスとAPにも各行の配分を適用する", () => {
        const people = ["トス", "担当"].map(name => ({ name, kot_name: null, team: "A", department: "", employment_kind: "社員", base_wage: 0, is_field_sales: false, sort_order: 0 } as KanriPerson));
        const grid = calculateJissekiSheet({ yearMonth: "2026-11", sourceRows, points, people, manualInputs, commuteByName: {} });
        expect(grid.rows[0].totalPoints).toBeCloseTo(3.3);
        expect(grid.rows[1].totalPoints).toBeCloseTo(8.7);
        expect(grid.productColumns).toHaveLength(54);
    });
    it("Excelのチーム見出し、末尾商材、白地の値と異なる値の行を出す", async () => {
        const kanri = calculateKanriSheet(input);
        const empty = { cellValues: {} };
        const results = { kanri, jisseki: empty, aporan: empty, houhan: { ...empty, weights: {} }, incentive: empty, payroll: empty } as unknown as KanriExcelResults;
        const workbook = buildKanriWorkbook({ run: { id: "test", target_date: "2026-11-30" }, results, points });
        const sheet = workbook.getWorksheet("【入力】管理表")!;
        expect(sheet.getCell("AM2").value).toBe("B");
        expect(sheet.getCell("BQ2").value).toBe("C");
        expect(sheet.getCell("AL3").value).toBe("商材25");
        expect(sheet.getCell("BW3").value).toBe("商材2");
        const pointSheet = workbook.getWorksheet("付与ポイント")!;
        expect(pointSheet.getCell("AB3").value).toBe("商材25");
        expect(pointSheet.getCell("B4").value).toBe(2);
        expect(pointSheet.getCell("F9").value).toBe(4);
        expect(pointSheet.getCell("F10").value).toBe(6);
        expect((await workbook.xlsx.writeBuffer()).byteLength).toBeGreaterThan(0);
    });
});

it("配信と同じマスタ補完・キャンセル除外と、クレカの旧フィールド補完を使う", () => {
  const master=source("2026-11-05","自社","","タイプなし"); master.payload.m_product={value:"回線"};
  const cancelled=source("2026-11-06"); cancelled.payload["商材ステータス"]={value:"キャンセル"};
  const credit:KanriSourceRow={source:"credit_card",sourceApp:null,recordId:"credit",payload:{日付_4:{value:"2026-11-07"},ドロップダウン_12:{value:"カード"},文字列__1行__26:{value:"A"},AP名:{value:"担当"}}};
  const points=soilPointMasters([row(),row({product:"カード",category:"credit",total_points:0.5,kintone_names:[]})]);
  const matched=matchedKanriOrders([master,cancelled,credit],points,"2026-11");
  expect(matched.map(item=>item.point.product)).toEqual(["回線","カード"]);
  expect(missingKanriProducts([master,cancelled,credit],points,"2026-11")).toEqual([]);
  const people=[{name:"担当",kot_name:null,team:"A",department:"",employment_kind:"社員",base_wage:0,is_field_sales:false,sort_order:0}];
  const grid=calculateJissekiSheet({yearMonth:"2026-11",sourceRows:[credit],points,people,manualInputs,commuteByName:{}});
  expect(grid.productColumns.filter(column=>column.product==="カード")).toHaveLength(1);
  expect(grid.rows[0].totalPoints).toBe(0.5);
});
