// @vitest-environment node
import ExcelJS from "exceljs";
import { expect, it } from "vitest";
import { generateHakenExcel } from "./haken-excel.server";
import fields from "./ledger-fields.json";
import type { HakenData, HakenWorker } from "./types";
it("手本の項目・順番で１人１シートを出し、就業記録の枠と教育訓練を付ける", async () => {
  const worker = {
    id: "w",
    name: "社員A",
    contract_id: "c",
    employee_id: "e",
    start_on: "2026-09-11",
    end_on: "2026-12-31",
  } as HakenWorker;
  const data = {
    workers: [worker],
    contracts: [
      {
        id: "c",
        side: "ukeire",
        party_id: "p",
        office_id: "o",
        org_unit: "営業課",
        period_start: worker.start_on,
        period_end: worker.end_on,
      },
    ],
    parties: [{ id: "p", name: "A社", issue_defaults: {} }],
    offices: [{ id: "o", name: "本社", company_id: "co" }],
    companies: [{ company_id: "co", company_name: "法人A" }],
    events: [
      {
        worker_id: "w",
        on_date: "2026-10-01",
        kind: "training",
        content: "研修",
        handler: "担当A",
        result: "完了",
        party_contact: "連絡済み",
      },
    ],
    documents: [],
    employees: [],
  } as unknown as HakenData;
  const buffer = await generateHakenExcel(data, [worker]);
  const book = new ExcelJS.Workbook();
  await book.xlsx.load(new Uint8Array(buffer) as never);
  expect(book.worksheets).toHaveLength(3);
  const sheet = book.worksheets[0];
  expect(sheet.getCell("A1").text).toContain("派遣法第42条");
  expect(sheet.getCell("A2").text).toContain("2029-12-31");
  expect([1, 2, 3, 4].map((c) => sheet.getRow(3).getCell(c).text)).toEqual([
    "区分",
    "項目",
    "内容",
    "備考",
  ]);
  expect(fields.map((_, i) => sheet.getRow(i + 4).getCell(2).text)).toEqual(
    fields.map((row) => row[1]),
  );
  expect(sheet.getCell("C4").text).toBe("社員A");
  expect(book.getWorksheet("就業記録")?.getCell("A1").text).toBe(
    "就業記録は別途添付",
  );
  expect(book.getWorksheet("教育訓練・苦情")?.getCell("D2").text).toBe("研修");
});
