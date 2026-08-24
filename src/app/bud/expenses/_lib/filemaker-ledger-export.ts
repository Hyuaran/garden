import ExcelJS from "exceljs";

import { calculateFiscalPeriod } from "./fiscal-period";

export const FILEMAKER_LEDGER_HEADERS = [
  "経理ID",
  "領収書No",
  "法人名",
  "使用者",
  "適格区分",
  "適格番号",
  "区分",
  "レシート日付",
  "店名",
  "金額",
  "入力日",
  "入力者",
  "入力時間",
  "入力終了時間",
  "入力エラー項目",
  "確認日",
  "確認者",
  "確認時間",
  "確認終了時間",
  "仕分け日",
  "仕分け法人名",
  "決算区分",
] as const;

export type FileMakerLedgerSource = {
  corpName: string;
  applicantName: string;
  qualifiedClass: string | null;
  qualifiedNumber: string | null;
  categoryName: string;
  receiptDate: string | null;
  storeName: string | null;
  amount: number | null;
  submittedAt: string | null;
  submittedByName: string;
  keiriCheckedAt: string | null;
  keiriCheckedByName: string;
  journalizedAt: string | null;
  establishedOn: string | null;
  fiscalEndMonth: number | null;
};

export function stripQualifiedNumberPrefix(value: string | null | undefined) {
  if (!value) return null;
  return /^[Tt]/.test(value) ? value.slice(1) : value;
}

export function buildFileMakerLedgerWorkbook(rows: FileMakerLedgerSource[]) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Garden";
  workbook.created = new Date();
  const sheet = workbook.addWorksheet("Sheet1");
  sheet.addRow([...FILEMAKER_LEDGER_HEADERS]);

  for (const source of rows) {
    const submitted = splitJstDateTime(source.submittedAt);
    const checked = splitJstDateTime(source.keiriCheckedAt);
    const journalized = splitJstDateTime(source.journalizedAt);
    const fiscal = calculateFiscalPeriod(source.establishedOn, source.fiscalEndMonth, source.receiptDate);
    sheet.addRow([
      null,
      null,
      source.corpName,
      source.applicantName,
      source.qualifiedClass ?? null,
      stripQualifiedNumberPrefix(source.qualifiedNumber),
      source.categoryName,
      toExcelDate(source.receiptDate),
      source.storeName ?? null,
      source.amount ?? 0,
      submitted.date,
      source.submittedByName,
      submitted.time,
      null,
      null,
      checked.date,
      source.keiriCheckedByName,
      checked.time,
      null,
      journalized.date,
      source.corpName,
      fiscal ? `第${fiscal.periodNo}期` : null,
    ]);
  }

  for (const column of [8, 11, 16, 20]) sheet.getColumn(column).numFmt = "yyyy/mm/dd";
  for (const column of [13, 18]) sheet.getColumn(column).numFmt = "[hh]:mm:ss";
  sheet.getColumn(10).numFmt = "#,##0";
  sheet.views = [{ state: "frozen", ySplit: 1 }];
  sheet.columns.forEach((column, index) => {
    column.width = Math.max(10, FILEMAKER_LEDGER_HEADERS[index].length * 2 + 2);
  });
  return workbook;
}

export async function writeFileMakerLedgerBuffer(rows: FileMakerLedgerSource[]) {
  const workbook = buildFileMakerLedgerWorkbook(rows);
  return workbook.xlsx.writeBuffer();
}

function toExcelDate(value: string | null) {
  if (!value) return null;
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;
  return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
}

function splitJstDateTime(value: string | null) {
  if (!value) return { date: null, time: null };
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return { date: null, time: null };
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value ?? 0);
  return {
    date: new Date(Date.UTC(get("year"), get("month") - 1, get("day"))),
    time: (get("hour") * 3600 + get("minute") * 60 + get("second")) / 86400,
  };
}
