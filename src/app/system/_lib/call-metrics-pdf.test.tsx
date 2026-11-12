// @vitest-environment node
// PDF は Node 向けの部品で作る（jsdom だとブラウザ向けの部品になり、埋め込んだ日本語フォントが壊れる・2026-10-15）
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { formatPdfSnapshot, lpFunnelPdfWidths, PDF_CONTENT_WIDTH, callMetricCountTone, callMetricsPdfFilename, measureVectorTextLayout, renderCallMetricsPdf } from "./call-metrics-pdf";
import type { CallMetricsResponse, EmployeeCallMetricRow } from "./call-metrics";
import { funnelFixture } from "./lp-funnel-view.test";

const employee = (index: number): EmployeeCallMetricRow => ({
  employeeName: index === 1 ? "非常に長い社員名二十文字以上折返確認担当者" : `社員${String(index).padStart(3, "0")}`,
  callCount: 21 + index,
  effectiveCount: 15,
  effectiveRate: .7,
  tossCount: index % 2,
  orderCount: index % 3,
  acquiredCount: index % 4,
  callOrderRate: .1,
  callAcquiredRate: .05,
  prospectCount: 3,
  absentCount: 4,
  awayCount: 5,
  invalidCount: 6,
  workSeconds: 7200,
});

const fixture: CallMetricsResponse = {
  from: "2026-08-21", to: "2026-08-21", listName: null, employeeName: null, lastImportedAt: null,
  employeeMetrics: Array.from({ length: 16 }, (_, index) => employee(index + 1)),
  metrics: Array.from({ length: 54 }, (_, index) => ({
    listName: index === 0 ? "関西電力_20260801_再架電_A_長いリスト名確認" : `リスト${index + 1}`, callCount: 100, effectiveCount: 70, effectiveRate: .7,
    tossCount: index % 2, orderCount: index % 3, acquiredCount: index % 4,
    callOrderRate: .1, callAcquiredRate: .05,
  })),
};

async function extractPages(bytes: Uint8Array) {
  const pdf = await getDocument({ data: bytes }).promise;
  const pages: string[] = [];
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    pages.push(content.items.map((item) => "str" in item ? item.str : "").join(" "));
  }
  return pages;
}

describe("call metrics PDF", () => {
  it("集計日時を日本時間の分まで表示し、列幅がページ内に収まる", () => {
    expect(formatPdfSnapshot(new Date("2026-11-12T06:07:00Z"))).toBe("2026/11/12(木) 15:07 時点");
    for (const count of [2, 4, 12]) {
      expect(lpFunnelPdfWidths(count).reduce((sum, width) => sum + width, 1)).toBeLessThanOrEqual(PDF_CONTENT_WIDTH + 0.001);
    }
  });
  it("uses the standard note mark instead of a star", () => {
    const source = readFileSync(path.join(process.cwd(), "src", "app", "system", "_lib", "call-metrics-pdf.tsx"), "utf8");
    expect(source).toContain("※ 休憩の時間帯が変わったときは");
    expect(source).not.toContain("★");
  });

  it("uses the delivery slot in the Japanese filename", () => {
    expect(callMetricsPdfFilename(new Date("2026-08-21T07:37:00Z"))).toBe("テレマコール集計ポータル_20260821_1600.pdf");
  });

  it("styles zero counts as muted and positive counts as strong", () => {
    expect(callMetricCountTone(0)).toBe("zero");
    expect(callMetricCountTone(1)).toBe("strong");
  });

  it("flows long employee data across pages before list and definition sections", async () => {
    const buffer = await renderCallMetricsPdf(fixture, { generatedAt: new Date("2026-11-12T06:07:00Z") });
    const pages = await extractPages(new Uint8Array(buffer));
    expect(pages.length).toBeGreaterThan(3);
    expect(pages.every(text => text.includes("2026/11/12(木) 15:07 時点"))).toBe(true);
    const employeePage = pages.findIndex((text) => text.includes("SECTION_EMPLOYEE"));
    const webInboundPage = pages.findIndex((text) => text.includes("SECTION_WEB_INBOUND"));
    const listPage = pages.findIndex((text) => text.includes("SECTION_LIST"));
    const definitionPage = pages.findIndex((text) => text.includes("SECTION_DEFINITION"));
    expect(employeePage).toBe(0);
    expect(webInboundPage).toBeGreaterThan(employeePage);
    expect(listPage).toBeGreaterThan(webInboundPage);
    expect(definitionPage).toBeGreaterThan(listPage + 1);
    expect(pages[listPage + 1]).toContain("CONTINUATION_LIST");
    expect(pages[listPage + 1]).toContain("リスト名");
    // 従業員の表が次のページに続くときは、続きのページにも列の見出しを出す（余白を詰めて 1 ページに収まることもある）
    const names = fixture.employeeMetrics.map(row => row.employeeName.split(/\s/)[0]);
    for (const page of pages.slice(employeePage + 1, webInboundPage).filter(text => names.some(name => text.includes(name)))) {
      expect(page).toContain("社員名");
      expect(page.replace(/\s/g, "")).toContain("WEB申込み");
    }
    const employeeLayout = measureVectorTextLayout(fixture.employeeMetrics[0].employeeName, 91, 7.5, false, true);
    const listLayout = measureVectorTextLayout(fixture.metrics[0].listName, 127, 7.5, false, true);
    expect(employeeLayout.lines.length).toBeGreaterThan(1);
    expect(listLayout.lines.length).toBeGreaterThan(1);
    expect([...employeeLayout.lineWidths, ...listLayout.lineWidths].every((width) => width <= 121)).toBe(true);
    expect(pages.every((text) => text.includes("PDF_HEADER 2026-08-21 2026-08-21"))).toBe(true);
    // 日本語が「文字」として入っている（コピー・検索できる）。ヘッダーのタイトルは各ページ 1 回だけ
    expect(pages[0]).toContain("従業員ごと");
    expect(pages[0]).toContain("社員002");
    expect(pages.every((text) => text.split("テレマ コール集計ポータル").length - 1 === 1)).toBe(true);
    expect(pages.every((text, index) => text.includes(`${index + 1} / ${pages.length}`))).toBe(true);
    if (process.env.WRITE_CALL_METRICS_PDF === "1") {
      const outputDir = path.join(process.cwd(), "output", "pdf");
      mkdirSync(outputDir, { recursive: true });
      writeFileSync(path.join(outputDir, "テレマコール集計ポータル_20260821_1600.pdf"), buffer);
    }
  }, 180_000);

  it("WEBインバウンドの表A・表Bを別ページの全幅に描く", async () => {
    const emptyWeb = { ...employee(1), employeeName: "WEB実績なし", lpAnswered: 0, lpOutbound: 0, lpTalkSeconds: 0, lpApplications: 0 };
    const activeWeb = { ...emptyWeb, employeeName: "WEB申込あり", lpApplications: 1 };
    const buffer = await renderCallMetricsPdf({ ...fixture, employeeMetrics: [emptyWeb, activeWeb], lpFunnel: {
      ...funnelFixture,
      businesses: ["ヒカリのプロ", "電気開始受付センター", "第三事業"].map((bizName, index) => ({
        ...funnelFixture.businesses[0], bizName, bizCode: `business-${index}`,
      })),
      totals: { ...funnelFixture.businesses[0], bizName: "合計", bizCode: "total" },
    } }, { generatedAt: new Date("2026-11-12T06:07:00Z") });
    const pdf = await getDocument({ data: new Uint8Array(buffer) }).promise;
    const firstPage = await pdf.getPage(1);
    const firstContent = await firstPage.getTextContent();
    const firstItems = firstContent.items.filter(item => "str" in item);
    const webLeft = 28 + [80, 48, 48, 39, 52, 34, 37, 31, 37, 31, 48, 25, 25, 25, 25].reduce((a, b) => a + b, 0);
    for (const [name, expected] of [["WEB実績なし", ["-", "-", "-", "-"]], ["WEB申込あり", ["0", "0", "0:00:00", "1"]]] as const) {
      const nameItem = firstItems.find(item => item.str === name)!;
      const values = firstItems.filter(item => item.str.trim() && item.transform[4] >= webLeft && Math.abs(item.transform[5] - nameItem.transform[5]) < 0.1);
      expect(values.map(item => item.str)).toEqual(expected);
      await firstPage.getOperatorList();
      const applicationFont = firstPage.commonObjs.get(values.at(-1)!.fontName);
      expect(applicationFont.name).toContain("Bold");
    }
    const titles: { label: string; page: number; y: number }[] = [];
    for (let n = 1; n <= pdf.numPages; n++) {
      const page = await pdf.getPage(n);
      expect(page.view[2]).toBeCloseTo(841.89, 1);
      expect(page.view[3]).toBeCloseTo(595.28, 1);
      const content = await page.getTextContent();
      const items = content.items.filter(item => "str" in item);
      for (const item of items) {
        if (item.str.startsWith("表A") || item.str.startsWith("表B")) titles.push({ label: item.str, page: n, y: item.transform[5] });
      }
      {
        for (const item of items.filter(item => item.width > 0)) {
          expect(item.transform[4]).toBeGreaterThanOrEqual(27);
          expect(item.transform[4] + item.width).toBeLessThanOrEqual(page.view[2] - 27);
          // 本文は 7.5pt、フッターは従来の 7pt。不可視マーカーは検査から除く。
          if (!item.str.startsWith("SECTION_") && !item.str.startsWith("PDF_HEADER") && !item.str.startsWith("CONTINUATION_")) {
            expect(Math.abs(item.transform[0])).toBeGreaterThanOrEqual(item.transform[5] > 42 ? 7.5 : 7);
          }
        }
      }
    }
    expect(titles).toHaveLength(2);
    expect(titles[1].page).toBe(titles[0].page + 1);
    if (process.env.WRITE_CALL_METRICS_PDF === "1") {
      const outputDir = path.join(process.cwd(), "output", "pdf");
      mkdirSync(outputDir, { recursive: true });
      writeFileSync(path.join(outputDir, "call-metrics-524-web.pdf"), buffer);
    }
    const pages = await extractPages(new Uint8Array(buffer));
    const web = pages.findIndex((text) => text.includes("SECTION_WEB_INBOUND"));
    const list = pages.findIndex((text) => text.includes("SECTION_LIST"));
    expect(list).toBeGreaterThan(web);
    const webText = pages.slice(web, list).join(" ").replace(/(?<=[^\x00-\x7F]) (?=[^\x00-\x7F])/g, "");
    for (const label of ["表A", "表B", "総数（入電＋フォーム）", "折り返していない", "指定どおり（繋がった・繋がらない）", "判定待ち", "番号不備", "初回応答率（応答できた ÷ 入電）", "どうやって話せたか", "Kintone記録なし", "有効受注率"]) {
      expect(webText.replace(/\s/g, "")).toContain(label.replace(/\s/g, ""));
    }
    expect(webText).not.toContain("うち");
  }, 180_000);

  it("flows expanded definitions naturally and labels continuation pages", async () => {
    const definitionRows = Array.from({ length: 80 }, (_, index) => [`追加指標${index + 1}`, "項目追加時の自然改ページを確認するための定義文です。"]);
    const buffer = await renderCallMetricsPdf(fixture, { definitionRows });
    const pages = await extractPages(new Uint8Array(buffer));
    const definitionPage = pages.findIndex((text) => text.includes("SECTION_DEFINITION"));
    expect(definitionPage).toBeGreaterThanOrEqual(0);
    expect(pages.length).toBeGreaterThan(definitionPage + 1);
    expect(pages.slice(definitionPage + 1).some((text) => text.includes("CONTINUATION_DEFINITION"))).toBe(true);
    for (const page of pages.filter(text => text.includes("追加指標"))) {
      expect(page).toContain("指標");
      expect(page).toContain("定義");
    }
  }, 180_000);
});
