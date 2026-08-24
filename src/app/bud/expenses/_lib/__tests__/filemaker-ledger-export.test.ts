import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";

import {
  FILEMAKER_LEDGER_HEADERS,
  stripQualifiedNumberPrefix,
  writeFileMakerLedgerBuffer,
  type FileMakerLedgerSource,
} from "../filemaker-ledger-export";

const BASE: FileMakerLedgerSource = {
  corpName: "ARATA",
  applicantName: "申請 花子",
  qualifiedClass: "有",
  qualifiedNumber: "T5120003009625",
  categoryName: "通信費",
  receiptDate: "2018-09-30",
  storeName: "Garden店",
  amount: 1234,
  submittedAt: "2026-07-07T12:47:25.000Z",
  submittedByName: "入力 太郎",
  keiriCheckedAt: "2026-07-09T06:31:55.000Z",
  keiriCheckedByName: "経理 次郎",
  bookingDate: "2026-07-31",
  bookingCorpName: "ヒュアラン",
  fiscalPeriod: "第9期",
};

describe("FileMaker ledger Excel export", () => {
  it("writes the exact 22 headers and keeps accounting identifiers blank", async () => {
    const workbook = await load([BASE]);
    const sheet = workbook.worksheets[0];
    expect(sheet.columnCount).toBe(22);
    expect(sheet.getRow(1).values).toEqual([undefined, ...FILEMAKER_LEDGER_HEADERS]);
    expect(sheet.getCell("A2").value).toBeNull();
    expect(sheet.getCell("B2").value).toBeNull();
    expect(sheet.getCell("J2").value).toBe(1234);
  });

  it("writes date and time columns as Excel values with date/time formats", async () => {
    const sheet = (await load([BASE])).worksheets[0];
    for (const address of ["H2", "K2", "P2", "T2"]) {
      expect(sheet.getCell(address).value).toBeInstanceOf(Date);
      expect(sheet.getCell(address).numFmt).toBe("yyyy/mm/dd");
    }
    for (const address of ["M2", "R2"]) {
      expect(sheet.getCell(address).value).toBeInstanceOf(Date);
      expect(sheet.getCell(address).numFmt).toBe("[hh]:mm:ss");
    }
  });

  it("strips only a leading T and preserves missing or already-normalized values", () => {
    expect(stripQualifiedNumberPrefix("T5120003009625")).toBe("5120003009625");
    expect(stripQualifiedNumberPrefix("t5120003009625")).toBe("5120003009625");
    expect(stripQualifiedNumberPrefix("5120003009625")).toBe("5120003009625");
    expect(stripQualifiedNumberPrefix(null)).toBeNull();
  });

  it("keeps original corporation and writes saved booking values separately", async () => {
    const sheet = (await load([
      BASE,
      { ...BASE, bookingDate: null, bookingCorpName: null, fiscalPeriod: null },
    ])).worksheets[0];
    expect(sheet.getCell("C2").value).toBe("ARATA");
    expect(sheet.getCell("U2").value).toBe("ヒュアラン");
    expect(sheet.getCell("V2").value).toBe("第9期");
    expect(sheet.getCell("T3").value).toBeNull();
    expect(sheet.getCell("U3").value).toBeNull();
    expect(sheet.getCell("V3").value).toBeNull();
  });

  it("creates a header-only workbook for zero records", async () => {
    const sheet = (await load([])).worksheets[0];
    expect(sheet.rowCount).toBe(1);
    expect(sheet.columnCount).toBe(22);
  });
});

async function load(rows: FileMakerLedgerSource[]) {
  const buffer = await writeFileMakerLedgerBuffer(rows);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  return workbook;
}
