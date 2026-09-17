import { NextResponse } from "next/server";

import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { SOIL_LIST_TABLES } from "@/app/system/list/_lib/list-fields";

import { requireSoilListUser } from "../../../_lib/auth";
import { IMPORT_COLUMNS, prepareAssignmentRows, SoilListUploadError, type ParsedUploadRow } from "../../../_lib/upload-parser";
import { applyRawChecks } from "../../../_lib/raw-excel/check";
import { createImportWorkbook, workbookBuffer } from "../../../_lib/raw-excel/excel";
import { applyRawOverrides, parseRawExcelFiles, type RawRowOverride } from "../../../_lib/raw-excel/parser";
import { findExistingPhones, lookupPostal } from "../../../_lib/raw-excel/raw-excel.server";
import { toParsedUploadRow, type RawImportRow } from "../../../_lib/raw-excel/build-import";
import type { RawParsedFile } from "../../../_lib/raw-excel/parser";
import { applyUploadInBatches, emptyUploadResult } from "../../_lib/apply-upload";

export const runtime = "nodejs";
export const maxDuration = 300;

const PREVIEW_CACHE_MS = 10 * 60 * 1000;
const previewCache = new Map<string, { expiresAt: number; files: RawParsedFile[]; rows: RawImportRow[] }>();

function isUploadedFile(value: FormDataEntryValue): value is File {
  return Boolean(value && typeof value === "object" && "arrayBuffer" in value);
}

function cloneRows<T>(rows: T): T {
  return JSON.parse(JSON.stringify(rows)) as T;
}

function newPreviewId() {
  return crypto.randomUUID();
}

function prunePreviewCache() {
  const now = Date.now();
  for (const [key, value] of previewCache) {
    if (value.expiresAt <= now) previewCache.delete(key);
  }
}

function todayYmd() {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date()).replaceAll("-", "");
}

function todayIso() {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

function formText(form: FormData, name: string): string {
  const value = form.get(name);
  return typeof value === "string" ? value.trim() : "";
}

function parseOverrides(form: FormData): RawRowOverride[] {
  const raw = form.get("overrides");
  if (typeof raw !== "string" || !raw.trim()) return [];
  const parsed = JSON.parse(raw) as unknown;
  if (!Array.isArray(parsed)) return [];
  return parsed
    .filter((item): item is Record<string, unknown> & { rowNumber: number } => Boolean(item) && typeof item === "object" && typeof item.rowNumber === "number")
    .map((item) => ({
      fileName: typeof item.fileName === "string" ? item.fileName : undefined,
      rowNumber: item.rowNumber,
      lastName: typeof item.lastName === "string" ? item.lastName : undefined,
      firstName: typeof item.firstName === "string" ? item.firstName : undefined,
      phone: typeof item.phone === "string" ? item.phone : undefined,
      postal: typeof item.postal === "string" ? item.postal : undefined,
      listName: typeof item.listName === "string" ? item.listName : undefined,
    }));
}

function summarizeByList(rows: Array<{ "リスト名": string | null; reviewReasons: string[]; excludedReason?: string }>) {
  const map = new Map<string, { name: string; count: number; needsReview: number; excluded: number }>();
  for (const row of rows) {
    const name = row["リスト名"] || "（リスト名なし）";
    const item = map.get(name) ?? { name, count: 0, needsReview: 0, excluded: 0 };
    item.count += 1;
    if (row.reviewReasons.length) item.needsReview += 1;
    if (row.excludedReason) item.excluded += 1;
    map.set(name, item);
  }
  return [...map.values()].sort((a, b) => b.count - a.count);
}

function listNameCounts(rows: ParsedUploadRow[]): Record<string, number> {
  return rows.reduce<Record<string, number>>((counts, row) => {
    const key = row["リスト名"] || "（リスト名なし）";
    counts[key] = (counts[key] ?? 0) + 1;
    return counts;
  }, {});
}

function assignmentPayload(row: ParsedUploadRow, uploadId: string) {
  const values = Object.fromEntries(IMPORT_COLUMNS.map((column) => [column, row[column]]));
  return {
    ...values,
    電話番号: row.normalizedPhone,
    リスト名: row["リスト名"] ?? "",
    リスト投入日: row.listLoadedOn,
    形式: "A",
    upload_id: uploadId,
    要確認の理由: row.checkReason,
    applied_at: null,
    updated_at: new Date().toISOString(),
  };
}

async function upsertRows(db: ReturnType<typeof getSupabaseAdmin>, rows: ParsedUploadRow[], uploadId: string) {
  for (let index = 0; index < rows.length; index += 1000) {
    const chunk = rows.slice(index, index + 1000).map((row) => assignmentPayload(row, uploadId));
    if (chunk.length === 0) continue;
    const { error } = await db.from(SOIL_LIST_TABLES.assignment).upsert(chunk, { onConflict: "電話番号,リスト名" });
    if (error) throw new Error(error.message);
  }
}

export async function POST(request: Request) {
  const auth = await requireSoilListUser();
  if (!auth.ok) return auth.response;
  try {
    const form = await request.formData();
    const files = form.getAll("files").filter(isUploadedFile);
    const action = typeof form.get("action") === "string" ? form.get("action") : "";
    const requestedPreviewId = formText(form, "previewId");
    const db = getSupabaseAdmin();
    prunePreviewCache();
    const cached = requestedPreviewId ? previewCache.get(requestedPreviewId) : undefined;
    const parsed = cached
      ? { files: cloneRows(cached.files), rows: cloneRows(cached.rows) }
      : await parseRawExcelFiles(files, (postal) => lookupPostal(db as never, postal));
    const previewId = cached ? requestedPreviewId : newPreviewId();
    if (!cached) previewCache.set(previewId, { expiresAt: Date.now() + PREVIEW_CACHE_MS, files: cloneRows(parsed.files), rows: cloneRows(parsed.rows) });
    await applyRawOverrides(parsed.rows, parseOverrides(form), (postal) => lookupPostal(db as never, postal));
    const hits = await findExistingPhones(db as never, parsed.rows.flatMap((row) => [row["電話番号_ハイフンなし"], row["携帯番号_ハイフンなし"]].filter(Boolean) as string[]));
    const checked = applyRawChecks(parsed.rows, hits);

    if (action === "download") {
      const workbook = createImportWorkbook(checked.rows.filter((row) => row.normalizedPhone), checked.excluded);
      const fileName = `統合インポート_${todayYmd()}_光回線＋クレカ.xlsx`;
      return new Response(await workbookBuffer(workbook), {
        headers: {
          "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="raw-import.xlsx"; filename*=UTF-8''${encodeURIComponent(fileName)}`,
        },
      });
    }

    if (action === "import") {
      const purchaseVendor = formText(form, "purchaseVendor");
      if (!purchaseVendor) return NextResponse.json({ ok: false, error: "取り込めませんでした（購入先を選んでください）" }, { status: 400 });
      const importRows = checked.rows.filter((row) => row.normalizedPhone && !row.reviewReasons.some((reason) => reason.includes("電話番号の桁") || reason.includes("電話番号なし"))).map(toParsedUploadRow);
      const { data: upload, error: uploadError } = await db.from(SOIL_LIST_TABLES.upload).insert({
        file_name: parsed.files.map((file) => file.fileName).join(" / "),
        format: "A",
        row_count: checked.summary.readRows,
        list_names: listNameCounts(importRows),
        購入先: purchaseVendor,
        購入日: todayIso(),
        source_kind: "raw_excel",
        raw_file_names: parsed.files.map((file) => file.fileName),
        excluded_assignment: checked.summary.excludedAssignment,
        excluded_order: checked.summary.excludedOrder,
        needs_review: checked.summary.needsReviewRows,
        result: null,
        status: "processing",
        created_by: auth.user.name,
      }).select("id").single<{ id: string }>();
      if (uploadError || !upload) return NextResponse.json({ ok: false, error: "取り込めませんでした（記録を保存できませんでした）" }, { status: 500 });
      const prepared = prepareAssignmentRows(importRows);
      await upsertRows(db, prepared.rows, upload.id);
      const applyResult = await applyUploadInBatches(db as never, upload.id, emptyUploadResult({ remaining: prepared.rows.length }));
      const result = emptyUploadResult({
        ...applyResult,
        skipped: applyResult.skipped + prepared.emptyPhoneRows + checked.summary.excludedRows,
        duplicate_rows: prepared.duplicateRows,
      });
      await db.from(SOIL_LIST_TABLES.upload).update({ status: "done", result }).eq("id", upload.id);
      return NextResponse.json({ ok: true, uploadId: upload.id, result });
    }

    const allRows = [...checked.rows, ...checked.excluded];
    return NextResponse.json({
      ok: true,
      preview: {
        previewId,
        files: parsed.files.map((file) => ({ fileName: file.fileName, kind: file.kind, rowCount: file.rows.length })),
        summary: checked.summary,
        listNames: summarizeByList(allRows),
        needsReview: checked.rows.filter((row) => row.reviewReasons.length > 0).slice(0, 50).map((row) => ({
          fileName: row.sourceFileName,
          rowNumber: row.rowNumber,
          listName: row["リスト名"],
          lastName: row["既契約者名_姓"] ?? row["申込者名_姓"] ?? "",
          firstName: row["既契約者名_名"] ?? row["申込者名_名"] ?? "",
          phone: row.normalizedPhone,
          postal: row["設置先_郵便番号"] ?? "",
          reasons: row.reviewReasons,
        })),
        excluded: checked.excluded.slice(0, 50).map((row) => ({ fileName: row.sourceFileName, rowNumber: row.rowNumber, listName: row["リスト名"], phone: row.normalizedPhone, reason: row.excludedReason })),
      },
    });
  } catch (error) {
    const message = error instanceof SoilListUploadError ? error.message : "元 Excel を読み取れませんでした";
    const status = error instanceof SoilListUploadError ? error.status : 500;
    return NextResponse.json({ ok: false, error: `チェックできませんでした（${message}）` }, { status });
  }
}
