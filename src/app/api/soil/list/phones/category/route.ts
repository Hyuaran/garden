import { NextResponse } from "next/server";

import { SOIL_LIST_TABLES } from "@/app/system/list/_lib/list-fields";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

import { requireSoilListUser } from "../../_lib/auth";

export const runtime = "nodejs";

const CATEGORY_VALUES = new Set(["", "個人", "屋号", "法人"]);

type UpdateDb = {
  from(table: string): {
    update(values: Record<string, unknown>): {
      eq(column: string, value: unknown): Promise<{ error: { message: string } | null }>;
    };
  };
};

export async function PATCH(request: Request) {
  const auth = await requireSoilListUser();
  if (!auth.ok) return auth.response;

  const body = (await request.json()) as Record<string, unknown>;
  const phoneNumber = typeof body.phoneNumber === "string" ? body.phoneNumber.trim() : "";
  const category = typeof body.category === "string" ? body.category.trim() : "";
  if (!phoneNumber) {
    return NextResponse.json({ ok: false, error: "電話番号がありません" }, { status: 400 });
  }
  if (!CATEGORY_VALUES.has(category)) {
    return NextResponse.json({ ok: false, error: "区分の値が正しくありません" }, { status: 400 });
  }

  const db = getSupabaseAdmin() as unknown as UpdateDb;
  const { error } = await db
    .from(SOIL_LIST_TABLES.phone)
    .update({ 区分: category || null, 区分_判定元: "手入力" })
    .eq("電話番号", phoneNumber);
  if (error) {
    return NextResponse.json({ ok: false, error: "区分を更新できませんでした" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
