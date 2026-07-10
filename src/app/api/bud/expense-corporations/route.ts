import { NextResponse } from "next/server";

import { createServerClient } from "@/app/_lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";

type CorporationRow = {
  id: string;
  name_short: string | null;
  sort_order?: number | null;
};

export async function GET() {
  const supabase = await createServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user?.id) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const admin = getSupabaseAdmin();
  const ordered = await admin
    .from("bud_corporations")
    .select("id,name_short,sort_order")
    .order("sort_order", { ascending: true, nullsFirst: false })
    .order("id", { ascending: true });

  if (!ordered.error) {
    return NextResponse.json({ ok: true, corps: (ordered.data as CorporationRow[] | null) ?? [] });
  }

  const fallback = await admin.from("bud_corporations").select("id,name_short").order("id", { ascending: true });
  if (fallback.error) {
    return NextResponse.json({ ok: false, error: fallback.error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, corps: (fallback.data as CorporationRow[] | null) ?? [] });
}
