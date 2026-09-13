import { NextResponse } from "next/server";

import { SOIL_LIST_TABLES } from "@/app/system/list/_lib/list-fields";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

import { requireSoilListUser } from "../../_lib/auth";

export const runtime = "nodejs";

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireSoilListUser();
  if (!auth.ok) return auth.response;

  const { id } = await context.params;
  if (!id) return NextResponse.json({ ok: false, error: "削除する条件を選んでください" }, { status: 400 });

  const admin = getSupabaseAdmin();
  const { error } = await admin.from(SOIL_LIST_TABLES.condition).delete().eq("id", id);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
