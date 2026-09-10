import { NextResponse } from "next/server";

import { SOIL_LIST_TABLES } from "@/app/system/list/_lib/list-fields";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

import { requireSoilListUser } from "../_lib/auth";
import { IMPORT_COLUMNS, parseUploadFile, prepareAssignmentRows, SoilListUploadError, type ParsedUploadRow } from "../_lib/upload-parser";
import { applyUploadInBatches, emptyUploadResult, uploadStoppedMessage, UploadApplyError, type DbError, type UploadResult } from "./_lib/apply-upload";

export const runtime = "nodejs";
export const maxDuration = 300;

type UploadRecord = {
  id: string;
  file_name: string;
  format: string;
  row_count: number;
  list_names: Record<string, number>;
  result: UploadResult | null;
  status: "processing" | "done" | "failed";
  created_by: string | null;
  created_at: string;
};

type UploadDb = {
  from(table: string): {
    select(columns: string): {
      order(column: string, options?: { ascending?: boolean }): { limit(count: number): Promise<{ data: UploadRecord[] | null; error: DbError }> };
    };
    insert(values: Record<string, unknown>): {
      select(columns: string): { single<T>(): Promise<{ data: T | null; error: DbError }> };
    };
    update(values: Record<string, unknown>): { eq(column: string, value: unknown): Promise<{ error: DbError }> };
    upsert(values: Record<string, unknown>[], options?: { onConflict?: string }): Promise<{ error: DbError }>;
  };
  rpc(name: string, args?: Record<string, unknown>): Promise<{ data: UploadResult[] | UploadResult | null; error: DbError }>;
};

function isUploadedFile(value: FormDataEntryValue | null): value is File {
  return Boolean(value && typeof value === "object" && "arrayBuffer" in value);
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
    形式: row.format,
    upload_id: uploadId,
    要確認の理由: row.checkReason,
    updated_at: new Date().toISOString(),
  };
}

async function upsertInChunks(db: UploadDb, rows: ParsedUploadRow[], uploadId: string) {
  for (let index = 0; index < rows.length; index += 1000) {
    const chunk = rows.slice(index, index + 1000).map((row) => assignmentPayload(row, uploadId));
    if (chunk.length === 0) continue;
    const { error } = await db.from(SOIL_LIST_TABLES.assignment).upsert(chunk, { onConflict: "電話番号,リスト名" });
    if (error) throw new Error(error.message);
  }
}

async function refreshOptions(db: UploadDb, result: UploadResult): Promise<UploadResult> {
  const { error } = await db.rpc("soil_list_refresh_options");
  return error ? { ...result, warning: "選択肢の件数を更新できませんでした" } : result;
}

async function saveUploadResult(db: UploadDb, uploadId: string, status: "done" | "failed", result: UploadResult) {
  const { error } = await db.from(SOIL_LIST_TABLES.upload).update({ status, result }).eq("id", uploadId);
  if (error) throw new Error(error.message);
}

export async function GET() {
  const auth = await requireSoilListUser();
  if (!auth.ok) return auth.response;

  const db = getSupabaseAdmin() as unknown as UploadDb;
  const { data, error } = await db
    .from(SOIL_LIST_TABLES.upload)
    .select("id,file_name,format,row_count,list_names,result,status,created_by,created_at")
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) return NextResponse.json({ ok: false, error: "取り込みの記録を読み込めませんでした" }, { status: 500 });
  return NextResponse.json({ ok: true, uploads: data ?? [] });
}

export async function POST(request: Request) {
  const auth = await requireSoilListUser();
  if (!auth.ok) return auth.response;

  let uploadId: string | null = null;
  let uploadRowCount = 0;
  let emptyPhoneRows = 0;
  let duplicateRows = 0;
  try {
    const form = await request.formData();
    const file = form.get("file");
    if (!isUploadedFile(file)) {
      return NextResponse.json({ ok: false, error: "取り込めませんでした（ファイルを選んでください）" }, { status: 400 });
    }

    const parsed = await parseUploadFile(file);
    uploadRowCount = parsed.rowCount;
    const db = getSupabaseAdmin() as unknown as UploadDb;
    const { data: upload, error: uploadError } = await db
      .from(SOIL_LIST_TABLES.upload)
      .insert({
        file_name: file.name,
        format: parsed.format,
        row_count: parsed.rowCount,
        list_names: listNameCounts(parsed.rows),
        result: null,
        status: "processing",
        created_by: auth.user.name,
      })
      .select("id")
      .single<{ id: string }>();
    if (uploadError || !upload) {
      return NextResponse.json({ ok: false, error: "取り込めませんでした（記録を保存できませんでした）" }, { status: 500 });
    }
    uploadId = upload.id;

    // 電話番号が空の行は投入履歴に入れない（主キーが作れず、同じリスト名で衝突する）。同じ番号×リスト名の重複は後の行を残す
    const prepared = prepareAssignmentRows(parsed.rows);
    emptyPhoneRows = prepared.emptyPhoneRows;
    duplicateRows = prepared.duplicateRows;
    await upsertInChunks(db, prepared.rows, uploadId);
    const applyResult = await applyUploadInBatches(db, uploadId, emptyUploadResult({ remaining: prepared.rows.length }));
    const result = await refreshOptions(db, emptyUploadResult({
      ...applyResult,
      skipped: applyResult.skipped + emptyPhoneRows,
      duplicate_rows: duplicateRows,
    }));
    await saveUploadResult(db, uploadId, "done", result);

    return NextResponse.json({ ok: true, uploadId, result, preview: { ...parsed, rows: undefined } });
  } catch (error) {
    if (uploadId && error instanceof UploadApplyError) {
      const db = getSupabaseAdmin() as unknown as UploadDb;
      const result = emptyUploadResult({
        ...error.result,
        skipped: error.result.skipped + emptyPhoneRows,
        duplicate_rows: duplicateRows,
      });
      await saveUploadResult(db, uploadId, "failed", result);
      return NextResponse.json(
        { ok: false, uploadId, result, error: uploadStoppedMessage(result, uploadRowCount) },
        { status: 200 },
      );
    }
    const message = error instanceof SoilListUploadError ? error.message : "保存できませんでした";
    const status = error instanceof SoilListUploadError ? error.status : 500;
    return NextResponse.json(
      { ok: false, uploadId, error: `取り込めませんでした（${message}）` },
      { status },
    );
  }
}
