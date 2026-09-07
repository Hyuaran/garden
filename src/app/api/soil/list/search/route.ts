import { NextResponse } from "next/server";

import { getSupabaseAdmin } from "@/lib/supabase/admin";

import { requireSoilListUser } from "../_lib/auth";
import {
  buildBasePhoneQuery,
  clampSearchRange,
  searchSelect,
  toSearchRow,
  type SoilListDb,
} from "../_lib/query";
import { SoilListRequestError, normalizeConditionRequestPayload } from "../_lib/validation";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const auth = await requireSoilListUser();
  if (!auth.ok) return auth.response;

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const condition = normalizeConditionRequestPayload(body);
    const admin = getSupabaseAdmin() as unknown as SoilListDb;
    const built = await buildBasePhoneQuery(admin, condition, searchSelect());
    const query = clampSearchRange(built.query);
    const result = await query;
    if (result.error) {
      return NextResponse.json({ ok: false, error: result.error.message }, { status: 500 });
    }

    const rawRows = (result.data ?? []) as Record<string, unknown>[];
    const rows = rawRows.map((row) => toSearchRow(row));
    return NextResponse.json({ ok: true, rows });
  } catch (error) {
    if (error instanceof SoilListRequestError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
    }
    return NextResponse.json({ ok: false, error: "一覧を取得できませんでした" }, { status: 500 });
  }
}
