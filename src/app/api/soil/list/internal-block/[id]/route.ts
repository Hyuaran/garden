import { NextResponse } from "next/server";

import { getSupabaseAdmin } from "@/lib/supabase/admin";

import { requireSoilListUser } from "../../_lib/auth";
import { hasActiveInternalBlock, INTERNAL_BLOCK_TABLE, setPhoneInternalBlock } from "../../_lib/internal-block-db";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  const auth = await requireSoilListUser();
  if (!auth.ok) return auth.response;

  try {
    const { id } = await context.params;
    const body = (await request.json()) as Record<string, unknown>;
    const reason = String(body.reason ?? "").trim();
    if (!reason) return NextResponse.json({ ok: false, error: "解除理由は必須です" }, { status: 400 });

    const admin = getSupabaseAdmin();
    const { data: current, error: fetchError } = await admin
      .from(INTERNAL_BLOCK_TABLE)
      .select("id,電話番号,解除日")
      .eq("id", id)
      .maybeSingle();
    if (fetchError) throw new Error("自社アポ禁を確認できませんでした");
    const row = current as { id: string; 電話番号: string; 解除日: string | null } | null;
    if (!row) return NextResponse.json({ ok: false, error: "記録が見つかりません" }, { status: 404 });
    if (row.解除日) return NextResponse.json({ ok: true, released: 0 });

    const { error } = await admin
      .from(INTERNAL_BLOCK_TABLE)
      .update({
        解除日: new Date().toISOString().slice(0, 10),
        解除者: auth.user.name ?? "",
        解除理由: reason,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);
    if (error) throw new Error("自社アポ禁を解除できませんでした");
    await setPhoneInternalBlock(row.電話番号, await hasActiveInternalBlock(row.電話番号, id));
    return NextResponse.json({ ok: true, released: 1 });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "自社アポ禁を解除できませんでした" }, { status: 500 });
  }
}
