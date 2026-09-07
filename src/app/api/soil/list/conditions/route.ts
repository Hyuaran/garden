import { NextResponse } from "next/server";

import { SOIL_LIST_TABLES } from "@/app/system/list/_lib/list-fields";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

import { requireSoilListUser } from "../_lib/auth";
import { SoilListRequestError, normalizeConditionPayload } from "../_lib/validation";

export const runtime = "nodejs";

export async function GET() {
  const auth = await requireSoilListUser();
  if (!auth.ok) return auth.response;

  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from(SOIL_LIST_TABLES.condition)
    .select("id,name,condition,created_by,created_at,updated_at")
    .order("updated_at", { ascending: false })
    .limit(50);

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, conditions: data ?? [] });
}

export async function POST(request: Request) {
  const auth = await requireSoilListUser();
  if (!auth.ok) return auth.response;

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name) throw new SoilListRequestError("条件名を入力してください");
    const condition = normalizeConditionPayload(body.condition);

    const admin = getSupabaseAdmin();
    const { data, error } = await admin
      .from(SOIL_LIST_TABLES.condition)
      .insert({ name, condition, created_by: auth.user.name })
      .select("id,name,condition,created_by,created_at,updated_at")
      .single();

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, condition: data });
  } catch (error) {
    if (error instanceof SoilListRequestError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
    }
    return NextResponse.json({ ok: false, error: "条件を保存できませんでした" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const auth = await requireSoilListUser();
  if (!auth.ok) return auth.response;

  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  if (!id) return NextResponse.json({ ok: false, error: "削除する条件を選んでください" }, { status: 400 });

  const admin = getSupabaseAdmin();
  const { error } = await admin.from(SOIL_LIST_TABLES.condition).delete().eq("id", id);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
