import { NextResponse } from "next/server";

import { requireSoilListUser } from "../_lib/auth";

import { getSupabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const CACHE_MS = 10 * 60 * 1000;

export type SoilListAnalysisRow = {
  list_name: string;
  list_loaded_on: string | null;
  row_count: number;
  called_count: number;
  purchase_history_count: number;
  last_called_on: string | null;
};

type AnalysisDb = {
  rpc(name: string): Promise<{ data: SoilListAnalysisRow[] | null; error: { message: string } | null }>;
};

let cached: { expiresAt: number; rows: SoilListAnalysisRow[] } | null = null;

async function loadAnalysis(): Promise<SoilListAnalysisRow[]> {
  const now = Date.now();
  if (cached && cached.expiresAt > now) return cached.rows;
  const { data, error } = await (getSupabaseAdmin() as unknown as AnalysisDb).rpc("soil_list_analysis_by_list");
  if (error) throw new Error(error.message);
  const rows = data ?? [];
  cached = { expiresAt: now + CACHE_MS, rows };
  return rows;
}

export async function GET() {
  const auth = await requireSoilListUser();
  if (!auth.ok) return auth.response;

  try {
    return NextResponse.json({ ok: true, rows: await loadAnalysis() });
  } catch {
    return NextResponse.json({ ok: false, error: "分析を読み込めませんでした" }, { status: 500 });
  }
}
