import ExcelJS from "exceljs";
import iconv from "iconv-lite";

import { MAX_UPLOAD_FILE_SIZE, MAX_UPLOAD_ROWS, normalizePhone, uploadFileExtension } from "./upload-parser";

export type ParsedInternalBlockRow = {
  rowNumber: number;
  phoneNumber: string;
  reason: string;
};

export type InternalBlockPreview = {
  rowCount: number;
  validRows: number;
  duplicateRows: number;
  invalidPhoneRows: number;
  missingReasonRows: number;
  alreadyBlockedRows: number;
};

export class InternalBlockFileError extends Error {
  constructor(
    message: string,
    public readonly status = 400,
  ) {
    super(message);
  }
}

export function assertInternalBlockFile(file: File) {
  const extension = uploadFileExtension(file.name);
  if (![".csv", ".xlsx", ".mer"].includes(extension)) {
    throw new InternalBlockFileError("CSV・Excel・.mer のファイルを選んでください");
  }
  if (file.size > MAX_UPLOAD_FILE_SIZE) {
    throw new InternalBlockFileError("ファイルは20MBまでです");
  }
}

function csvRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let value = "";
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];
    if (quoted) {
      if (char === '"' && next === '"') {
        value += '"';
        i += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        value += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      row.push(value);
      value = "";
    } else if (char === "\n") {
      row.push(value);
      rows.push(row);
      row = [];
      value = "";
    } else if (char !== "\r") {
      value += char;
    }
  }
  row.push(value);
  if (row.some((cell) => cell !== "") || rows.length === 0) rows.push(row);
  return rows;
}

function decodeText(buffer: ArrayBuffer): string {
  const bytes = Buffer.from(buffer);
  const utf8 = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
  return utf8.includes("\uFFFD") ? iconv.decode(bytes, "cp932") : utf8.replace(/^\uFEFF/, "");
}

async function readRows(file: File): Promise<string[][]> {
  const extension = uploadFileExtension(file.name);
  if (extension === ".xlsx") {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(await file.arrayBuffer());
    const worksheet = workbook.worksheets[0];
    if (!worksheet) throw new InternalBlockFileError("取り込めませんでした（シートが見つかりません）");
    const rows: string[][] = [];
    worksheet.eachRow({ includeEmpty: false }, (row) => {
      const values = Array.isArray(row.values) ? row.values.slice(1) : [];
      rows.push(values.map((cell) => String(cell ?? "").trim()));
    });
    return rows;
  }
  return csvRows(decodeText(await file.arrayBuffer())).map((row) => row.map((cell) => cell.trim()));
}

function headerIndex(headers: string[], candidates: string[]): number {
  return headers.findIndex((header) => candidates.includes(header));
}

export async function parseInternalBlockFile(file: File): Promise<ParsedInternalBlockRow[]> {
  assertInternalBlockFile(file);
  const rawRows = await readRows(file);
  const headers = rawRows[0]?.map((cell) => cell.replace(/^\uFEFF/, "").trim()) ?? [];
  const phoneIndex = headerIndex(headers, ["電話番号", "phone", "phoneNumber"]);
  const reasonIndex = headerIndex(headers, ["理由", "reason"]);
  if (phoneIndex < 0 || reasonIndex < 0) {
    throw new InternalBlockFileError("列名が違います（電話番号・理由 が必要）");
  }
  const dataRows = rawRows.slice(1).filter((row) => row.some((cell) => cell.trim() !== ""));
  if (dataRows.length > MAX_UPLOAD_ROWS) {
    throw new InternalBlockFileError("ファイルは50,000行までです");
  }
  return dataRows.map((row, index) => ({
    rowNumber: index + 2,
    phoneNumber: normalizePhone(row[phoneIndex] ?? ""),
    reason: (row[reasonIndex] ?? "").trim(),
  }));
}

export function summarizeInternalBlockRows(rows: ParsedInternalBlockRow[], alreadyBlocked = new Set<string>()): InternalBlockPreview {
  const seen = new Set<string>();
  let duplicateRows = 0;
  let invalidPhoneRows = 0;
  let missingReasonRows = 0;
  let validRows = 0;
  let alreadyBlockedRows = 0;
  for (const row of rows) {
    const invalidPhone = row.phoneNumber.length < 9;
    const missingReason = row.reason.trim() === "";
    if (invalidPhone) invalidPhoneRows += 1;
    if (missingReason) missingReasonRows += 1;
    if (invalidPhone || missingReason) continue;
    if (seen.has(row.phoneNumber)) {
      duplicateRows += 1;
      continue;
    }
    seen.add(row.phoneNumber);
    if (alreadyBlocked.has(row.phoneNumber)) alreadyBlockedRows += 1;
    else validRows += 1;
  }
  return {
    rowCount: rows.length,
    validRows,
    duplicateRows,
    invalidPhoneRows,
    missingReasonRows,
    alreadyBlockedRows,
  };
}

export function uniqueValidInternalBlockRows(rows: ParsedInternalBlockRow[], alreadyBlocked = new Set<string>()): ParsedInternalBlockRow[] {
  const seen = new Set<string>();
  const result: ParsedInternalBlockRow[] = [];
  for (const row of rows) {
    if (row.phoneNumber.length < 9 || row.reason.trim() === "") continue;
    if (seen.has(row.phoneNumber) || alreadyBlocked.has(row.phoneNumber)) continue;
    seen.add(row.phoneNumber);
    result.push(row);
  }
  return result;
}
