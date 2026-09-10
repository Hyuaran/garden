import { NextResponse } from "next/server";

import { SOIL_LIST_TABLES } from "@/app/system/list/_lib/list-fields";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

import { requireSoilListUser } from "../../../_lib/auth";
import { applyUploadInBatches, emptyUploadResult, uploadStoppedMessage, UploadApplyError, type DbError, type UploadResult } from "../../_lib/apply-upload";

export const runtime = "nodejs";
export const maxDuration = 300;

type UploadRecord = {
  id: string;
  status: "processing" | "done" | "failed";
  row_count: number;
  result: UploadResult | null;
};

type ApplyDb = {
  from(table: string): {
    select(columns: string): {
      eq(column: string, value: unknown): {
        maybeSingle<T>(): Promise<{ data: T | null; error: DbError }>;
      };
    };
    update(values: Record<string, unknown>): { eq(column: string, value: unknown): Promise<{ error: DbError }> };
  };
  rpc(name: string, args?: Record<string, unknown>): Promise<{ data: UploadResult[] | UploadResult | null; error: DbError }>;
};

function completedResult(row: UploadRecord): UploadResult {
  return emptyUploadResult({ ...(row.result ?? {}), remaining: 0 });
}

async function refreshOptions(db: ApplyDb, result: UploadResult): Promise<UploadResult> {
  const { error } = await db.rpc("soil_list_refresh_options");
  return error ? { ...result, warning: "選択肢の件数を更新できませんでした" } : result;
}

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireSoilListUser();
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const db = getSupabaseAdmin() as unknown as ApplyDb;
  const { data: upload, error } = await db
    .from(SOIL_LIST_TABLES.upload)
    .select("id,status,row_count,result")
    .eq("id", id)
    .maybeSingle<UploadRecord>();
  if (error) return NextResponse.json({ ok: false, error: "取り込みの記録を読み込めませんでした" }, { status: 500 });
  if (!upload) return NextResponse.json({ ok: false, error: "取り込みの記録が見つかりません" }, { status: 404 });
  if (upload.status === "done") {
    return NextResponse.json({ ok: false, error: "この取り込みは反映済みです" }, { status: 400 });
  }

  const initial = emptyUploadResult(upload.result ?? {});
  try {
    const result = await refreshOptions(db, completedResult({ ...upload, result: await applyUploadInBatches(db, id, initial) }));
    await db.from(SOIL_LIST_TABLES.upload).update({ status: "done", result }).eq("id", id);
    return NextResponse.json({ ok: true, result });
  } catch (applyError) {
    if (!(applyError instanceof UploadApplyError)) throw applyError;
    const result = emptyUploadResult({ ...applyError.result, remaining: applyError.result.remaining });
    await db.from(SOIL_LIST_TABLES.upload).update({ status: "failed", result }).eq("id", id);
    return NextResponse.json(
      {
        ok: false,
        result,
        error: uploadStoppedMessage(result, upload.row_count),
      },
      { status: 200 },
    );
  }
}
