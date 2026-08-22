import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { callMetricCountTone, callMetricsPdfFilename, measureVectorTextLayout, renderCallMetricsPdf } from "./call-metrics-pdf";
import type { CallMetricsResponse, EmployeeCallMetricRow } from "./call-metrics";

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
  it("uses the delivery slot in the Japanese filename", () => {
    expect(callMetricsPdfFilename(new Date("2026-08-21T07:37:00Z"))).toBe("テレマコール集計ポータル_20260821_1600.pdf");
  });

  it("styles zero counts as muted and positive counts as strong", () => {
    expect(callMetricCountTone(0)).toBe("zero");
    expect(callMetricCountTone(1)).toBe("strong");
  });

  it("flows long employee data across pages before list and definition sections", async () => {
    const buffer = await renderCallMetricsPdf(fixture);
    const pages = await extractPages(new Uint8Array(buffer));
    expect(pages.length).toBeGreaterThan(3);
    const employeePage = pages.findIndex((text) => text.includes("SECTION_EMPLOYEE"));
    const listPage = pages.findIndex((text) => text.includes("SECTION_LIST"));
    const definitionPage = pages.findIndex((text) => text.includes("SECTION_DEFINITION"));
    expect(pages).toHaveLength(4);
    expect(employeePage).toBe(0);
    expect(listPage).toBe(employeePage + 1);
    expect(definitionPage).toBeGreaterThan(listPage + 1);
    expect(pages[listPage + 1]).toContain("CONTINUATION_LIST");
    const employeeLayout = measureVectorTextLayout(fixture.employeeMetrics[0].employeeName, 91, 7.5, false, true);
    const listLayout = measureVectorTextLayout(fixture.metrics[0].listName, 127, 7.5, false, true);
    expect(employeeLayout.lines.length).toBeGreaterThan(1);
    expect(listLayout.lines.length).toBeGreaterThan(1);
    expect([...employeeLayout.lineWidths, ...listLayout.lineWidths].every((width) => width <= 121)).toBe(true);
    expect(pages.every((text) => text.includes("PDF_HEADER 2026-08-21 2026-08-21"))).toBe(true);
    expect(pages.every((text, index) => text.includes(`${index + 1} / ${pages.length}`))).toBe(true);
    if (process.env.WRITE_CALL_METRICS_PDF === "1") {
      const outputDir = path.join(process.cwd(), "output", "pdf");
      mkdirSync(outputDir, { recursive: true });
      writeFileSync(path.join(outputDir, "テレマコール集計ポータル_20260821_1600.pdf"), buffer);
    }
  }, 60_000);

  it("flows expanded definitions naturally and labels continuation pages", async () => {
    const definitionRows = Array.from({ length: 80 }, (_, index) => [`追加指標${index + 1}`, "項目追加時の自然改ページを確認するための定義文です。"]);
    const buffer = await renderCallMetricsPdf(fixture, { definitionRows });
    const pages = await extractPages(new Uint8Array(buffer));
    const definitionPage = pages.findIndex((text) => text.includes("SECTION_DEFINITION"));
    expect(definitionPage).toBeGreaterThanOrEqual(0);
    expect(pages.length).toBeGreaterThan(definitionPage + 1);
    expect(pages.slice(definitionPage + 1).some((text) => text.includes("CONTINUATION_DEFINITION"))).toBe(true);
  }, 60_000);
});
