import { NextResponse } from "next/server";

import { getColumnName } from "@/app/system/list/_lib/list-fields";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

import { requireSoilListUser } from "../_lib/auth";
import { buildBasePhoneQuery, type SoilListDb } from "../_lib/query";
import { SoilListRequestError, normalizeConditionRequestPayload } from "../_lib/validation";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const auth = await requireSoilListUser();
  if (!auth.ok) return auth.response;

  try {
    const startedAt = performance.now();
    const body = (await request.json()) as Record<string, unknown>;
    const condition = normalizeConditionRequestPayload(body);
    const admin = getSupabaseAdmin() as unknown as SoilListDb;
    const built = await buildBasePhoneQuery(admin, condition, getColumnName("phoneNumber"), {
      count: "exact",
      head: true,
    });
    const result = await built.query;
    if (result.error) {
      return NextResponse.json({ ok: false, error: result.error.message }, { status: 500 });
    }

    const elapsedMs = Math.round(performance.now() - startedAt);
    return NextResponse.json({
      ok: true,
      count: result.count ?? 0,
      approximate: elapsedMs > 5000,
      elapsedMs,
    });
  } catch (error) {
    if (error instanceof SoilListRequestError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
    }
    return NextResponse.json({ ok: false, error: "件数を確認できませんでした" }, { status: 500 });
  }
}
