import { PassThrough, Readable } from "node:stream";

import ExcelJS from "exceljs";
import iconv from "iconv-lite";
import { NextResponse } from "next/server";

import { SOIL_LIST_TABLES, getColumnName, type SoilListColumnKey, type SoilListConditionPayload, type SoilListSortKey } from "@/app/system/list/_lib/list-fields";
import { forEachPgBatch, queryPg } from "@/lib/db/pg";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

import { requireSoilListUser } from "../_lib/auth";
import { buildCsvLine, type ExportRow } from "../_lib/export-format";
import { buildExportCountSql, buildExportPhoneSql, buildExportStreamSql } from "../_lib/export-sql";
import { quoteMerLine, type MerRow } from "../_lib/mer";
import {
  SoilListRequestError,
  normalizeConditionRequestPayload,
  normalizeExportColumns,
  normalizeSortKey,
} from "../_lib/validation";

export const runtime = "nodejs";
export const maxDuration = 300;

const EXPORT_BATCH_SIZE = 5000;
const PHONE_NUMBERS_RECORD_LIMIT = 50000;
const EXCEL_MAX_DATA_ROWS = 1048575;

type ExportFormat = "xlsx" | "csv" | "mer";

type ExportRecord = {
  id: string;
  condition: SoilListConditionPayload;
  columns: string[];
  row_limit: number;
  sort_key: SoilListSortKey | null;
  file_name: string;
  phone_numbers: string[] | null;
  format?: ExportFormat | null;
};

function normalizeFormat(input: unknown): ExportFormat {
  return input === "xlsx" || input === "csv" || input === "mer" ? input : "mer";
}

function contentType(format: ExportFormat): string {
  if (format === "xlsx") return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  if (format === "csv") return "text/csv; charset=utf-8";
  return "application/octet-stream";
}

function timestampFileName(format: ExportFormat): string {
  const parts = new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })
    .formatToParts(new Date())
    .reduce<Record<string, string>>((acc, part) => {
      if (part.type !== "literal") acc[part.type] = part.value;
      return acc;
    }, {});
  return `リストマスタ_${parts.year}${parts.month}${parts.day}_${parts.hour}${parts.minute}.${format}`;
}

function responseHeaders(fileName: string, format: ExportFormat, rowCount: number, replacedChars: number) {
  const headers = new Headers({
    "Content-Type": contentType(format),
    "Content-Disposition": `attachment; filename="list-master.${format}"; filename*=UTF-8''${encodeURIComponent(fileName)}`,
    "X-Soil-List-Row-Count": String(rowCount),
  });
  if (format === "mer") headers.set("X-Soil-List-Replaced-Chars", String(replacedChars));
  return headers;
}

function normalizeRecordColumns(columns: string[]): SoilListColumnKey[] {
  const allowed = new Set(Object.keys(getColumnNameMap()));
  return columns.filter((column): column is SoilListColumnKey => allowed.has(column));
}

function getColumnNameMap(): Record<SoilListColumnKey, string> {
  return {
    phoneNumber: getColumnName("phoneNumber"),
    name: getColumnName("name"),
    nameKana: getColumnName("nameKana"),
    postalCode: getColumnName("postalCode"),
    prefecture: getColumnName("prefecture"),
    city: getColumnName("city"),
    town: getColumnName("town"),
    block: getColumnName("block"),
    mobileNumber: getColumnName("mobileNumber"),
    birthday: getColumnName("birthday"),
    industry: getColumnName("industry"),
    oldNumber: getColumnName("oldNumber"),
    listName: getColumnName("listName"),
    listLoadedOn: getColumnName("listLoadedOn"),
    appointmentBlocked: getColumnName("appointmentBlocked"),
    invalidCount: getColumnName("invalidCount"),
    decisionResult: getColumnName("decisionResult"),
    decisionItem: getColumnName("decisionItem"),
    recheckedOn: getColumnName("recheckedOn"),
    managementLoaded: getColumnName("managementLoaded"),
    purchaseStatus: getColumnName("purchaseStatus"),
    eastWest: getColumnName("eastWest"),
    originalLine: getColumnName("originalLine"),
    lineIspExpected: getColumnName("lineIspExpected"),
    elapsedMonths: getColumnName("elapsedMonths"),
    elapsedLabel: getColumnName("elapsedLabel"),
    oldSegmentMemo: getColumnName("oldSegmentMemo"),
    auApplied: getColumnName("auApplied"),
    complaintHistory: getColumnName("complaintHistory"),
    auCallAvailability: getColumnName("auCallAvailability"),
    oldAuCallAvailability: getColumnName("oldAuCallAvailability"),
    nameFromDirectory: getColumnName("nameFromDirectory"),
    addressFromDirectory: getColumnName("addressFromDirectory"),
    directoryYear: getColumnName("directoryYear"),
    directoryAcquiredOn: getColumnName("directoryAcquiredOn"),
    source: getColumnName("source"),
    ispExpected: getColumnName("ispExpected"),
    ispInterview: getColumnName("ispInterview"),
    purchaseVendor: getColumnName("purchaseVendor"),
    purchasedOn: getColumnName("purchasedOn"),
    callCount: getColumnName("callCount"),
    firstCalledOn: getColumnName("firstCalledOn"),
    lastCalledOn: getColumnName("lastCalledOn"),
    lastCallResult: getColumnName("lastCallResult"),
    latestPurchaseVendor: getColumnName("latestPurchaseVendor"),
    latestPurchasedOn: getColumnName("latestPurchasedOn"),
    latestOrderOn: getColumnName("latestOrderOn"),
    latestOrderProduct: getColumnName("latestOrderProduct"),
    orderCount: getColumnName("orderCount"),
    purchaseHistoryExists: getColumnName("purchaseHistoryExists"),
  };
}

async function countRows(condition: SoilListConditionPayload): Promise<number> {
  const sql = buildExportCountSql(condition);
  const result = await queryPg<{ count: string }>(sql.text, sql.values);
  return Number(result.rows[0]?.count ?? 0);
}

async function fetchPhoneNumbers(condition: SoilListConditionPayload, sortKey: SoilListSortKey, rowCount: number): Promise<string[] | null> {
  if (rowCount > PHONE_NUMBERS_RECORD_LIMIT) return null;
  const sql = buildExportPhoneSql(condition, sortKey, PHONE_NUMBERS_RECORD_LIMIT);
  const result = await queryPg<ExportRow>(sql.text, sql.values);
  return result.rows.map((row) => String(row.phoneNumber ?? "")).filter(Boolean);
}

/** 書き出す行の SQL（limit/offset なし）。記録に電話番号があるときはその番号を渡した順で、無いときは条件と並びで */
function exportRowsSql(condition: SoilListConditionPayload, columns: SoilListColumnKey[], sortKey: SoilListSortKey, phoneNumbers: string[] | null): { text: string; values: unknown[] } {
  if (!phoneNumbers) return buildExportStreamSql(condition, columns, sortKey);
  const phoneColumn = `"${getColumnName("phoneNumber").replaceAll('"', '""')}"`;
  const select = columns.map((key) => `"${getColumnName(key).replaceAll('"', '""')}" as "${key}"`).join(", ");
  const text = [
    `select ${select}`,
    `from "${SOIL_LIST_TABLES.phone}"`,
    `where ${phoneColumn} = any($1::text[])`,
    `order by array_position($1::text[], ${phoneColumn})`,
  ].join("\n");
  return { text, values: [phoneNumbers] };
}

/**
 * 書き出す行を 5,000 行ずつ受け取る（サーバー側カーソル）。
 * limit/offset の繰り返しだと 1 束ごとに全体を並べ直して 6〜7 秒かかり、190 万件では 40 分を超えた（2026-09-13 本番実測）
 */
async function forEachExportBatch(
  condition: SoilListConditionPayload,
  columns: SoilListColumnKey[],
  sortKey: SoilListSortKey,
  phoneNumbers: string[] | null,
  onBatch: (rows: ExportRow[]) => Promise<void> | void,
): Promise<void> {
  const sql = exportRowsSql(condition, columns, sortKey, phoneNumbers);
  await forEachPgBatch<ExportRow>(sql.text, sql.values, EXPORT_BATCH_SIZE, onBatch);
}

async function computeMerReplacedChars(
  condition: SoilListConditionPayload,
  columns: SoilListColumnKey[],
  sortKey: SoilListSortKey,
  phoneNumbers: string[] | null,
): Promise<number> {
  let replaced = quoteMerLine(columns).replacedChars;
  await forEachExportBatch(condition, columns, sortKey, phoneNumbers, (rows) => {
    for (const row of rows) replaced += quoteMerLine(columns, row as MerRow).replacedChars;
  });
  return replaced;
}

async function insertExportRecord(input: {
  condition: SoilListConditionPayload;
  columns: SoilListColumnKey[];
  rowCount: number;
  replacedChars: number;
  phoneNumbers: string[] | null;
  fileName: string;
  sortKey: SoilListSortKey;
  format: ExportFormat;
  createdBy: string;
}) {
  const admin = getSupabaseAdmin();
  const { error } = await admin.from(SOIL_LIST_TABLES.export).insert({
    condition: input.condition,
    columns: input.columns,
    row_limit: input.rowCount,
    sort_key: input.sortKey,
    row_count: input.rowCount,
    replaced_chars: input.replacedChars,
    phone_numbers: input.phoneNumbers,
    file_name: input.fileName,
    format: input.format,
    created_by: input.createdBy,
  });
  if (error) throw new Error("書き出しの記録を保存できませんでした");
}

function streamTextExport(input: {
  condition: SoilListConditionPayload;
  columns: SoilListColumnKey[];
  sortKey: SoilListSortKey;
  format: "csv" | "mer";
  phoneNumbers: string[] | null;
}): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        if (input.format === "csv") {
          controller.enqueue(encoder.encode(`\uFEFF${buildCsvLine(input.columns)}\r\n`));
        } else {
          controller.enqueue(iconv.encode(`${quoteMerLine(input.columns).line}\r\n`, "cp932"));
        }
        await forEachExportBatch(input.condition, input.columns, input.sortKey, input.phoneNumbers, (rows) => {
          for (const row of rows) {
            const line = input.format === "csv"
              ? buildCsvLine(input.columns, row)
              : quoteMerLine(input.columns, row as MerRow).line;
            controller.enqueue(input.format === "csv" ? encoder.encode(`${line}\r\n`) : iconv.encode(`${line}\r\n`, "cp932"));
          }
        });
        controller.close();
      } catch (error) {
        controller.error(error);
      }
    },
  });
}

function streamExcelExport(input: {
  condition: SoilListConditionPayload;
  columns: SoilListColumnKey[];
  sortKey: SoilListSortKey;
  phoneNumbers: string[] | null;
}): ReadableStream<Uint8Array> {
  const pass = new PassThrough();
  void (async () => {
    const workbook = new ExcelJS.stream.xlsx.WorkbookWriter({ stream: pass, useStyles: false, useSharedStrings: false });
    const sheet = workbook.addWorksheet("リストマスタ");
    sheet.columns = input.columns.map((key) => ({ header: getColumnName(key), key }));
    sheet.getRow(1).commit();
    await forEachExportBatch(input.condition, input.columns, input.sortKey, input.phoneNumbers, (rows) => {
      for (const row of rows) sheet.addRow(row).commit();
    });
    await workbook.commit();
  })().catch((error: unknown) => pass.destroy(error instanceof Error ? error : new Error("Excel を作れませんでした")));
  return Readable.toWeb(pass) as ReadableStream<Uint8Array>;
}

async function buildExportResponse(input: {
  condition: SoilListConditionPayload;
  columns: SoilListColumnKey[];
  sortKey: SoilListSortKey;
  format: ExportFormat;
  fileName: string;
  phoneNumbers: string[] | null;
  rowCount: number;
  replacedChars: number;
}) {
  const body = input.format === "xlsx"
    ? streamExcelExport(input)
    : streamTextExport({ ...input, format: input.format });
  return new Response(body, {
    headers: responseHeaders(input.fileName, input.format, input.rowCount, input.replacedChars),
  });
}

async function redownload(exportId: string) {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from(SOIL_LIST_TABLES.export)
    .select("id,condition,columns,row_limit,sort_key,file_name,phone_numbers,format")
    .eq("id", exportId)
    .maybeSingle();

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  const record = data as ExportRecord | null;
  if (!record) return NextResponse.json({ ok: false, error: "記録が見つかりません" }, { status: 404 });

  const columns = normalizeRecordColumns(record.columns);
  const sortKey = normalizeSortKey(record.sort_key);
  const format = record.format ?? "mer";
  const phoneNumbers = record.phone_numbers && record.phone_numbers.length > 0 ? record.phone_numbers : null;
  const rowCount = phoneNumbers ? phoneNumbers.length : await countRows(record.condition);
  if (format === "xlsx" && rowCount > EXCEL_MAX_DATA_ROWS) {
    return NextResponse.json({ ok: false, error: "Excel は 1,048,576 行までです。CSV か .mer を選んでください" }, { status: 400 });
  }
  const replacedChars = format === "mer"
    ? await computeMerReplacedChars(record.condition, columns, sortKey, phoneNumbers)
    : 0;
  return buildExportResponse({ condition: record.condition, columns, sortKey, format, fileName: record.file_name, phoneNumbers, rowCount, replacedChars });
}

export async function POST(request: Request) {
  const auth = await requireSoilListUser();
  if (!auth.ok) return auth.response;

  try {
    const body = (await request.json()) as Record<string, unknown>;
    if (typeof body.exportId === "string" && body.exportId) {
      return redownload(body.exportId);
    }

    const condition = normalizeConditionRequestPayload(body);
    const columns = normalizeExportColumns(body.columns);
    const sortKey = normalizeSortKey(body.sortKey);
    const format = normalizeFormat(body.format);
    const rowCount = await countRows(condition);
    if (format === "xlsx" && rowCount > EXCEL_MAX_DATA_ROWS) {
      return NextResponse.json({ ok: false, error: "Excel は 1,048,576 行までです。CSV か .mer を選んでください" }, { status: 400 });
    }

    const phoneNumbers = await fetchPhoneNumbers(condition, sortKey, rowCount);
    const fileName = timestampFileName(format);
    const replacedChars = format === "mer"
      ? await computeMerReplacedChars(condition, columns, sortKey, phoneNumbers)
      : 0;

    await insertExportRecord({
      condition,
      columns,
      rowCount,
      replacedChars,
      phoneNumbers,
      fileName,
      sortKey,
      format,
      createdBy: auth.user.name ?? "",
    });

    return buildExportResponse({ condition, columns, sortKey, format, fileName, phoneNumbers, rowCount, replacedChars });
  } catch (error) {
    if (error instanceof SoilListRequestError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
    }
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "書き出しできませんでした" }, { status: 500 });
  }
}
