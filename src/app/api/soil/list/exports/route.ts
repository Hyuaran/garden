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
    .select("id,condition,columns,row_limit,sort_key,row_count,replaced_chars,file_name,format,phone_numbers,created_by,created_at")
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  const exports = (data ?? []).map((item) => {
    const record = item as Record<string, unknown>;
    const phoneNumbers = Array.isArray(record.phone_numbers) ? record.phone_numbers : null;
    return {
      ...record,
      phone_numbers: undefined,
      rebuild_from_condition: phoneNumbers === null,
    };
  });
  return NextResponse.json({ ok: true, exports });
}
