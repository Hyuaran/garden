import ExcelJS from "exceljs";
import iconv from "iconv-lite";

export const MAX_UPLOAD_FILE_SIZE = 20 * 1024 * 1024;
export const MAX_UPLOAD_ROWS = 50_000;

export const IMPORT_COLUMNS = [
  "リスト名",
  "電話番号_ハイフンなし",
  "携帯番号_ハイフンなし",
  "携帯キャリア",
  "申込者名_姓",
  "申込者名_名",
  "申込者名_生年月日",
  "連絡担当者名_姓",
  "連絡担当者名_名",
  "連絡担当者名_生年月日",
  "既契約者名_姓",
  "既契約者名_名",
  "既契約者名_生年月日",
  "設置先_郵便番号",
  "設置先_住所_都道府県",
  "設置先_住所_市町村",
  "設置先_住所_町域",
  "設置先_住所_建物名",
  "設置先_住所_部屋番号",
] as const;

const FORMAT_A_COLUMNS = IMPORT_COLUMNS;
const FORMAT_B_COLUMNS = [
  "リスト名",
  "既契約者名_姓",
  "既契約者名_名",
  "設置先_住所_都道府県",
  "設置先_住所_市町村",
  "設置先_住所_町域",
  "電話番号_ハイフンなし",
  "設置先_郵便番号",
] as const;
const FORMAT_C_COLUMNS = [...FORMAT_B_COLUMNS, "A_提供判定", "A_提供判定_結果"] as const;

export type SoilListUploadFormat = "A" | "B" | "C";

export type ParsedUploadRow = Record<(typeof IMPORT_COLUMNS)[number], string | null> & {
  rowNumber: number;
  format: SoilListUploadFormat;
  normalizedPhone: string;
  listLoadedOn: string | null;
  checkReason: string | null;
};

export type UploadListSummary = {
  name: string;
  count: number;
  listLoadedOn: string | null;
};

export type UploadPreview = {
  format: SoilListUploadFormat;
  formatLabel: string;
  rowCount: number;
  listNames: UploadListSummary[];
  warnings: {
    emptyPhoneRows: number;
    shortPhoneRows: number;
    unreadableListDateNames: number;
  };
};

export type ParsedUpload = UploadPreview & {
  rows: ParsedUploadRow[];
};

export class SoilListUploadError extends Error {
  constructor(
    message: string,
    public readonly status = 400,
  ) {
    super(message);
  }
}

export function uploadFileExtension(fileName: string): string {
  const match = /\.([^.]+)$/.exec(fileName.toLowerCase());
  return match ? `.${match[1]}` : "";
}

export function assertUploadFile(file: File) {
  const extension = uploadFileExtension(file.name);
  if (![".csv", ".xlsx", ".mer"].includes(extension)) {
    throw new SoilListUploadError("CSV・Excel・.mer のファイルを選んでください");
  }
  if (file.size > MAX_UPLOAD_FILE_SIZE) {
    throw new SoilListUploadError("ファイルは20MBまでです");
  }
}

export function normalizePhone(value: string): string {
  return value
    .normalize("NFKC")
    .replace(/[^\d]/g, "");
}

export function extractListLoadedOn(listName: string): string | null {
  const matches = [...listName.matchAll(/_(\d{8})(?=_\d+$|_|$)/g)];
  const value = matches.at(-1)?.[1];
  if (!value) return null;
  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(4, 6));
  const day = Number(value.slice(6, 8));
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`;
}

function detectFormat(headers: string[]): SoilListUploadFormat {
  const names = new Set(headers);
  if (!names.has("リスト名") || !names.has("電話番号_ハイフンなし")) {
    throw new SoilListUploadError("列名が取込ファイルの形式と違います（リスト名・電話番号_ハイフンなし が必要）");
  }
  const hasAll = (columns: readonly string[]) => columns.every((column) => names.has(column));
  if (hasAll(FORMAT_A_COLUMNS)) return "A";
  if (hasAll(FORMAT_C_COLUMNS)) return "C";
  if (hasAll(FORMAT_B_COLUMNS)) return "B";
  throw new SoilListUploadError("列名が取込ファイルの形式と違います（リスト名・電話番号_ハイフンなし が必要）");
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
    if (!worksheet) throw new SoilListUploadError("取り込めませんでした（シートが見つかりません）");
    const rows: string[][] = [];
    worksheet.eachRow({ includeEmpty: false }, (row) => {
      const values = Array.isArray(row.values) ? row.values.slice(1) : [];
      rows.push(values.map((cell) => String(cell ?? "").trim()));
    });
    return rows;
  }
  return csvRows(decodeText(await file.arrayBuffer())).map((row) => row.map((cell) => cell.trim()));
}

function formatLabel(format: SoilListUploadFormat): string {
  if (format === "A") return "19 列（申込者・連絡担当者・既契約者つき）";
  if (format === "C") return "10 列（提供判定つき）";
  return "8 列";
}

function checkReason(phone: string, listLoadedOn: string | null): string | null {
  const reasons: string[] = [];
  if (!phone) reasons.push("電話番号が空");
  else if (phone.length < 9) reasons.push("電話番号が9桁未満");
  if (!listLoadedOn) reasons.push("投入日が読めないリスト名");
  return reasons.length ? reasons.join("／") : null;
}

function summarize(format: SoilListUploadFormat, rows: ParsedUploadRow[]): UploadPreview {
  const byList = new Map<string, UploadListSummary>();
  for (const row of rows) {
    const name = row["リスト名"] || "（リスト名なし）";
    const current = byList.get(name) ?? { name, count: 0, listLoadedOn: row.listLoadedOn };
    current.count += 1;
    current.listLoadedOn ??= row.listLoadedOn;
    byList.set(name, current);
  }
  const unreadableNames = new Set(rows.filter((row) => !row.listLoadedOn).map((row) => row["リスト名"] || "（リスト名なし）"));
  return {
    format,
    formatLabel: formatLabel(format),
    rowCount: rows.length,
    listNames: [...byList.values()].sort((a, b) => b.count - a.count),
    warnings: {
      emptyPhoneRows: rows.filter((row) => !row.normalizedPhone).length,
      shortPhoneRows: rows.filter((row) => row.normalizedPhone.length > 0 && row.normalizedPhone.length < 9).length,
      unreadableListDateNames: unreadableNames.size,
    },
  };
}

/**
 * 投入履歴へ送る行を整える：電話番号が空の行は送らない（主キーが作れない）。
 * 同じ 電話番号×リスト名 が 1 ファイルに 2 回以上あると 1 回の upsert で衝突するので、後の行を残して 1 つにする。
 */
export function prepareAssignmentRows(rows: ParsedUploadRow[]): { rows: ParsedUploadRow[]; emptyPhoneRows: number; duplicateRows: number } {
  const byKey = new Map<string, ParsedUploadRow>();
  let emptyPhoneRows = 0;
  let duplicateRows = 0;
  for (const row of rows) {
    if (!row.normalizedPhone) { emptyPhoneRows += 1; continue; }
    const key = `${row.normalizedPhone}\t${row["リスト名"] ?? ""}`;
    if (byKey.has(key)) duplicateRows += 1;
    byKey.set(key, row);
  }
  return { rows: [...byKey.values()], emptyPhoneRows, duplicateRows };
}

export async function parseUploadFile(file: File): Promise<ParsedUpload> {
  assertUploadFile(file);
  const rawRows = await readRows(file);
  const header = rawRows[0]?.map((cell) => cell.replace(/^\uFEFF/, "").trim()).filter(Boolean) ?? [];
  const format = detectFormat(header);
  const dataRows = rawRows.slice(1).filter((row) => row.some((cell) => cell.trim() !== ""));
  if (dataRows.length > MAX_UPLOAD_ROWS) {
    throw new SoilListUploadError("ファイルは50,000行までです");
  }
  const rows = dataRows.map((raw, index) => {
    const values = Object.fromEntries(IMPORT_COLUMNS.map((column) => [column, null])) as Record<(typeof IMPORT_COLUMNS)[number], string | null>;
    for (const column of IMPORT_COLUMNS) {
      const position = header.indexOf(column);
      if (position >= 0) values[column] = raw[position]?.trim() || null;
    }
    const normalizedPhone = normalizePhone(values["電話番号_ハイフンなし"] ?? "");
    const listLoadedOn = extractListLoadedOn(values["リスト名"] ?? "");
    return {
      ...values,
      rowNumber: index + 2,
      format,
      normalizedPhone,
      listLoadedOn,
      checkReason: checkReason(normalizedPhone, listLoadedOn),
    };
  });
  return { ...summarize(format, rows), rows };
}
