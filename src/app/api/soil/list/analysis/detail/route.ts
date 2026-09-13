import { NextResponse } from "next/server";

import { requireSoilListUser } from "../../_lib/auth";
import { loadAnalysisDetail, type AnalysisDb } from "../_lib/analysis";

import { getSupabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BLOCKS = new Set(["vendor", "active_list"]);

export async function GET(request: Request) {
  const auth = await requireSoilListUser();
  if (!auth.ok) return auth.response;

  const url = new URL(request.url);
  const block = url.searchParams.get("block") ?? "";
  const segment = url.searchParams.get("segment") ?? "";
  const result = url.searchParams.get("result") ?? "";
  if (!BLOCKS.has(block) || !segment || !result) {
    return NextResponse.json({ ok: false, error: "条件が足りません" }, { status: 400 });
  }

  try {
    const rows = await loadAnalysisDetail(getSupabaseAdmin() as unknown as AnalysisDb, block as "vendor" | "active_list", segment, result);
    return NextResponse.json({ ok: true, rows });
  } catch {
    return NextResponse.json({ ok: false, error: "一覧を読み込めませんでした" }, { status: 500 });
  }
}
