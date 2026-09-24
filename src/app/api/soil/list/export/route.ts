import { PassThrough, Readable } from "node:stream";

import ExcelJS from "exceljs";
import iconv from "iconv-lite";
import { NextResponse } from "next/server";

import { SOIL_LIST_TABLES, getColumnName, type SoilListColumnKey, type SoilListConditionPayload, type SoilListSortKey } from "@/app/system/list/_lib/list-fields";
import { forEachPgBatch, queryPg } from "@/lib/db/pg";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

import { requireSoilListUser } from "../_lib/auth";
import { buildCsvLine, type ExportRow } from "../_lib/export-format";
import { buildExportCountSql, buildExportPhoneSql, buildExportStreamSql, buildInternalBlockExcludedCountSql } from "../_lib/export-sql";
import { buildFmImportRow, buildFmImportStreamSql, type FmImportSourceRow } from "../_lib/fm-import";
import { quoteMerLine, type MerRow } from "../_lib/mer";
import { IMPORT_COLUMNS } from "../_lib/upload-parser";
import {
  SoilListRequestError,
  normalizeConditionRequestPayload,
  normalizeExportColumns,
  normalizeSortKey,
} from "../_lib/validation";
import { applyUploadInBatches, emptyUploadResult, type DbError, type UploadResult } from "../uploads/_lib/apply-upload";

export const runtime = "nodejs";
export const maxDuration = 300;

const EXPORT_BATCH_SIZE = 5000;
const PHONE_NUMBERS_RECORD_LIMIT = 50000;
const EXCEL_MAX_DATA_ROWS = 1048575;

type ExportFormat = "xlsx" | "csv" | "mer" | "fm_import";

type ExportRecord = {
  id: string;
  condition: SoilListConditionPayload;
  columns: string[];
  row_limit: number;
  sort_key: SoilListSortKey | null;
  file_name: string;
  phone_numbers: string[] | null;
  format?: ExportFormat | null;
  excluded_internal_block?: number | null;
  list_name?: string | null;
};

function normalizeFormat(input: unknown): ExportFormat {
  return input === "xlsx" || input === "csv" || input === "mer" || input === "fm_import" ? input : "mer";
}

function contentType(format: ExportFormat): string {
  if (format === "xlsx" || format === "fm_import") return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
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

function todayFileDate(): string {
  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date()).filter((part) => part.type !== "literal").map((part) => part.value).join("");
}

function safeFileNamePart(value: string): string {
  return value.replace(/[\\/:*?"<>|]/g, "_").replace(/\s+/g, "_").slice(0, 80) || "list";
}

function fmImportFileName(listName: string): string {
  return `FileMaker取込_${safeFileNamePart(listName)}_${todayFileDate()}.xlsx`;
}

function responseHeaders(fileName: string, format: ExportFormat, rowCount: number, replacedChars: number, excludedInternalBlock: number, assignmentResult?: UploadResult | null) {
  const headers = new Headers({
    "Content-Type": contentType(format),
    "Content-Disposition": `attachment; filename="list-master.${format === "fm_import" ? "xlsx" : format}"; filename*=UTF-8''${encodeURIComponent(fileName)}`,
    "X-Soil-List-Row-Count": String(rowCount),
  });
  if (format === "mer") headers.set("X-Soil-List-Replaced-Chars", String(replacedChars));
  headers.set("X-Soil-List-Excluded-Internal-Block", String(excludedInternalBlock));
  if (assignmentResult) {
    headers.set("X-Soil-List-Assignment-Recorded", String(assignmentResult.assignments));
    headers.set("X-Soil-List-Assignment-New", String(assignmentResult.assignments_new));
    headers.set("X-Soil-List-Assignment-Updated", String(assignmentResult.assignments_updated));
    headers.set("X-Soil-List-Upload-Inserted", String(assignmentResult.parent_inserted));
    headers.set("X-Soil-List-Upload-Updated", String(assignmentResult.parent_updated));
    headers.set("X-Soil-List-Purchase-Inserted", String(assignmentResult.purchase_inserted));
  }
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
    lineType: getColumnName("lineType"),
    originalLine: getColumnName("originalLine"),
    contractMonth: getColumnName("contractMonth"),
    contractElapsed: getColumnName("contractElapsed"),
    category: getColumnName("category"),
    categorySource: getColumnName("categorySource"),
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
    latestVendor: getColumnName("latestVendor"),
    latestPurchasedOn: getColumnName("latestPurchasedOn"),
    latestOrderOn: getColumnName("latestOrderOn"),
    latestOrderProduct: getColumnName("latestOrderProduct"),
    orderCount: getColumnName("orderCount"),
    internalBlocked: getColumnName("internalBlocked"),
    purchaseHistoryExists: getColumnName("purchaseHistoryExists"),
  };
}

async function countRows(condition: SoilListConditionPayload): Promise<number> {
  const sql = buildExportCountSql(condition);
  const result = await queryPg<{ count: string }>(sql.text, sql.values);
  return Number(result.rows[0]?.count ?? 0);
}

async function countExcludedInternalBlock(condition: SoilListConditionPayload): Promise<number> {
  const sql = buildInternalBlockExcludedCountSql(condition);
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
  const contractMonthColumn = `"${getColumnName("contractMonth").replaceAll('"', '""')}"`;
  const select = columns.map((key) => {
    const expression = key === "contractElapsed"
      ? `case when ${contractMonthColumn} is null then null else concat(extract(year from age(current_date, ${contractMonthColumn}))::int, '年', extract(month from age(current_date, ${contractMonthColumn}))::int, 'か月') end`
      : `"${getColumnName(key).replaceAll('"', '""')}"`;
    return `${expression} as "${key}"`;
  }).join(", ");
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
  excludedInternalBlock: number;
  listName?: string | null;
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
    list_name: input.listName ?? null,
    excluded_internal_block: input.excludedInternalBlock,
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

async function forEachFmImportBatch(
  condition: SoilListConditionPayload,
  sortKey: SoilListSortKey,
  phoneNumbers: string[] | null,
  onBatch: (rows: FmImportSourceRow[]) => Promise<void> | void,
): Promise<void> {
  const sql = buildFmImportStreamSql(condition, sortKey, phoneNumbers);
  await forEachPgBatch<FmImportSourceRow>(sql.text, sql.values, EXPORT_BATCH_SIZE, onBatch);
}

function streamFmImportExcel(input: {
  condition: SoilListConditionPayload;
  sortKey: SoilListSortKey;
  phoneNumbers: string[] | null;
  listName: string;
}): ReadableStream<Uint8Array> {
  const pass = new PassThrough();
  void (async () => {
    const workbook = new ExcelJS.stream.xlsx.WorkbookWriter({ stream: pass, useStyles: false, useSharedStrings: false });
    const sheet = workbook.addWorksheet("統合リスト");
    sheet.columns = IMPORT_COLUMNS.map((column) => ({ header: column, key: column, width: column === IMPORT_COLUMNS[0] ? 28 : 16 }));
    sheet.getRow(1).commit();
    await forEachFmImportBatch(input.condition, input.sortKey, input.phoneNumbers, (rows) => {
      for (const row of rows) sheet.addRow(buildFmImportRow(row, input.listName)).commit();
    });
    await workbook.commit();
  })().catch((error: unknown) => pass.destroy(error instanceof Error ? error : new Error("Excel を作れませんでした")));
  return Readable.toWeb(pass) as ReadableStream<Uint8Array>;
}

type ExportAssignmentDb = {
  from(table: string): {
    insert(values: Record<string, unknown>): { select(columns: string): { single<T>(): Promise<{ data: T | null; error: DbError }> } };
    update(values: Record<string, unknown>): { eq(column: string, value: unknown): Promise<{ error: DbError }> };
    upsert(values: Record<string, unknown>[], options?: { onConflict?: string }): Promise<{ error: DbError }>;
  };
  rpc(name: string, args?: Record<string, unknown>): Promise<{ data: UploadResult[] | UploadResult | null; error: DbError }>;
};

const ASSIGNMENT_FORMAT_COLUMN = "形式";
const ASSIGNMENT_REVIEW_COLUMN = "要確認の理由";
function assignmentPayloadFromFm(row: FmImportSourceRow, uploadId: string, listName: string, listLoadedOn: string) {
  const values = buildFmImportRow(row, listName);
  return {
    ...values,
    [getColumnName("phoneNumber")]: values[IMPORT_COLUMNS[1]] ?? "",
    [getColumnName("listName")]: listName,
    [getColumnName("listLoadedOn")]: listLoadedOn,
    [ASSIGNMENT_FORMAT_COLUMN]: "A",
    upload_id: uploadId,
    [ASSIGNMENT_REVIEW_COLUMN]: null,
    applied_at: null,
    updated_at: new Date().toISOString(),
  };
}

async function upsertExportAssignments(input: {
  db: ExportAssignmentDb;
  condition: SoilListConditionPayload;
  sortKey: SoilListSortKey;
  phoneNumbers: string[] | null;
  uploadId: string;
  listName: string;
  listLoadedOn: string;
}) {
  await forEachFmImportBatch(input.condition, input.sortKey, input.phoneNumbers, async (rows) => {
    for (let index = 0; index < rows.length; index += 1000) {
      const chunk = rows.slice(index, index + 1000).map((row) => assignmentPayloadFromFm(row, input.uploadId, input.listName, input.listLoadedOn));
      if (chunk.length === 0) continue;
      const { error } = await input.db.from(SOIL_LIST_TABLES.assignment).upsert(chunk, { onConflict: `${getColumnName("phoneNumber")},${getColumnName("listName")}` });
      if (error) throw new Error(error.message);
    }
  });
}

async function recordExportAssignment(input: {
  condition: SoilListConditionPayload;
  sortKey: SoilListSortKey;
  phoneNumbers: string[] | null;
  rowCount: number;
  fileName: string;
  listName: string;
  listLoadedOn: string;
  createdBy: string;
}): Promise<UploadResult> {
  const db = getSupabaseAdmin() as unknown as ExportAssignmentDb;
  const { data: upload, error: uploadError } = await db
    .from(SOIL_LIST_TABLES.upload)
    .insert({
      file_name: input.fileName,
      format: "A",
      row_count: input.rowCount,
      list_names: { [input.listName]: input.rowCount },
      source_kind: "export",
      raw_file_names: [],
      excluded_assignment: 0,
      excluded_order: 0,
      needs_review: 0,
      result: null,
      status: "processing",
      created_by: input.createdBy,
    })
    .select("id")
    .single<{ id: string }>();
  if (uploadError || !upload) throw new Error(uploadError?.message ?? "投入履歴の記録を作れませんでした");

  await upsertExportAssignments({ ...input, db, uploadId: upload.id });
  const result = await applyUploadInBatches(db, upload.id, emptyUploadResult({ remaining: input.rowCount }));
  const { error: updateError } = await db.from(SOIL_LIST_TABLES.upload).update({ status: "done", result }).eq("id", upload.id);
  if (updateError) throw new Error(updateError.message);
  return result;
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
  excludedInternalBlock: number;
  listName?: string | null;
  assignmentResult?: UploadResult | null;
}) {
  const body = input.format === "fm_import"
    ? streamFmImportExcel({ condition: input.condition, sortKey: input.sortKey, phoneNumbers: input.phoneNumbers, listName: input.listName ?? "" })
    : input.format === "xlsx"
    ? streamExcelExport(input)
    : streamTextExport({ ...input, format: input.format });
  return new Response(body, {
    headers: responseHeaders(input.fileName, input.format, input.rowCount, input.replacedChars, input.excludedInternalBlock, input.assignmentResult),
  });
}

async function redownload(exportId: string) {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from(SOIL_LIST_TABLES.export)
    .select("id,condition,columns,row_limit,sort_key,file_name,phone_numbers,format,excluded_internal_block,list_name")
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
  const excludedInternalBlock = record.excluded_internal_block ?? (await countExcludedInternalBlock(record.condition));
  if ((format === "xlsx" || format === "fm_import") && rowCount > EXCEL_MAX_DATA_ROWS) {
    return NextResponse.json({ ok: false, error: "Excel は 1,048,576 行までです。CSV か .mer を選んでください" }, { status: 400 });
  }
  const replacedChars = format === "mer"
    ? await computeMerReplacedChars(record.condition, columns, sortKey, phoneNumbers)
    : 0;
  return buildExportResponse({ condition: record.condition, columns, sortKey, format, fileName: record.file_name, phoneNumbers, rowCount, replacedChars, excludedInternalBlock, listName: record.list_name });
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
    const listName = typeof body.listName === "string" ? body.listName.trim() : "";
    const listLoadedOn = typeof body.listLoadedOn === "string" ? body.listLoadedOn.trim() : "";
    const recordAssignment = body.recordAssignment !== false;
    if (format === "fm_import" && !listName) {
      return NextResponse.json({ ok: false, error: "リスト名を決めてください" }, { status: 400 });
    }
    if (format === "fm_import" && !/^\d{4}-\d{2}-\d{2}$/.test(listLoadedOn)) {
      return NextResponse.json({ ok: false, error: "架電開始日を選んでください" }, { status: 400 });
    }
    const [rowCount, excludedInternalBlock] = await Promise.all([
      countRows(condition),
      countExcludedInternalBlock(condition),
    ]);
    if ((format === "xlsx" || format === "fm_import") && rowCount > EXCEL_MAX_DATA_ROWS) {
      return NextResponse.json({ ok: false, error: "Excel は 1,048,576 行までです。CSV か .mer を選んでください" }, { status: 400 });
    }

    const phoneNumbers = await fetchPhoneNumbers(condition, sortKey, rowCount);
    const fileName = format === "fm_import" ? fmImportFileName(listName) : timestampFileName(format);
    const replacedChars = format === "mer"
      ? await computeMerReplacedChars(condition, columns, sortKey, phoneNumbers)
      : 0;
    const assignmentResult = format === "fm_import" && recordAssignment
      ? await recordExportAssignment({ condition, sortKey, phoneNumbers, rowCount, fileName, listName, listLoadedOn, createdBy: auth.user.name ?? "" })
      : null;

    await insertExportRecord({
      condition,
      columns: format === "fm_import" ? [] : columns,
      rowCount,
      replacedChars,
      phoneNumbers,
      fileName,
      sortKey,
      format,
      createdBy: auth.user.name ?? "",
      excludedInternalBlock,
      listName: format === "fm_import" ? listName : null,
    });

    return buildExportResponse({ condition, columns, sortKey, format, fileName, phoneNumbers, rowCount, replacedChars, excludedInternalBlock, listName, assignmentResult });
  } catch (error) {
    if (error instanceof SoilListRequestError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
    }
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "書き出しできませんでした" }, { status: 500 });
  }
}
