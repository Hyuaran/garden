import { NextResponse } from "next/server";

import { SOIL_LIST_TABLES } from "@/app/system/list/_lib/list-fields";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

import { requireSoilListUser } from "../_lib/auth";

export const runtime = "nodejs";

export async function GET() {
  const auth = await requireSoilListUser();
  if (!auth.ok) return auth.response;

  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from(SOIL_LIST_TABLES.export)
    .select("id,condition,columns,row_limit,sort_key,row_count,replaced_chars,file_name,created_by,created_at")
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, exports: data ?? [] });
}
