import { NextResponse } from "next/server";

import { getSupabaseAdmin } from "@/lib/supabase/admin";

import { requireSoilListUser } from "../_lib/auth";
import { hasActiveInternalBlock, INTERNAL_BLOCK_TABLE, setPhoneInternalBlock } from "../_lib/internal-block-db";
import { normalizePhone } from "../_lib/upload-parser";

export const runtime = "nodejs";

const PAGE_SIZE = 100;

type InternalBlockRow = {
  id: string;
  電話番号: string;
  登録日: string;
  理由: string;
  登録者: string | null;
  出所: string;
  解除日: string | null;
  解除者: string | null;
  解除理由: string | null;
  created_at: string;
};

function normalizePage(value: string | null): number {
  const page = Number(value ?? 1);
  return Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
}

export async function GET(request: Request) {
  const auth = await requireSoilListUser();
  if (!auth.ok) return auth.response;

  const url = new URL(request.url);
  const q = normalizePhone(url.searchParams.get("q") ?? "");
  const includeReleased = url.searchParams.get("includeReleased") === "true";
  const page = normalizePage(url.searchParams.get("page"));
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  let query = getSupabaseAdmin()
    .from(INTERNAL_BLOCK_TABLE)
    .select("id,電話番号,登録日,理由,登録者,出所,解除日,解除者,解除理由,created_at", { count: "exact" })
    .order("登録日", { ascending: false })
    .order("created_at", { ascending: false })
    .range(from, to);
  if (q) query = query.ilike("電話番号", `%${q}%`);
  if (!includeReleased) query = query.is("解除日", null);

  const { data, error, count } = await query;
  if (error) return NextResponse.json({ ok: false, error: "自社アポ禁を読み込めませんでした" }, { status: 500 });
  return NextResponse.json({ ok: true, rows: (data ?? []) as unknown as InternalBlockRow[], count: count ?? 0, page, pageSize: PAGE_SIZE });
}

export async function POST(request: Request) {
  const auth = await requireSoilListUser();
  if (!auth.ok) return auth.response;

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const phoneNumber = normalizePhone(String(body.phoneNumber ?? ""));
    const reason = String(body.reason ?? "").trim();
    if (phoneNumber.length < 9) return NextResponse.json({ ok: false, error: "電話番号の形が違います" }, { status: 400 });
    if (!reason) return NextResponse.json({ ok: false, error: "理由は必須です" }, { status: 400 });

    if (await hasActiveInternalBlock(phoneNumber)) {
      return NextResponse.json({ ok: true, inserted: 0, alreadyBlocked: 1 });
    }

    const admin = getSupabaseAdmin();
    const { data, error } = await admin
      .from(INTERNAL_BLOCK_TABLE)
      .insert({
        電話番号: phoneNumber,
        理由: reason,
        登録者: auth.user.name ?? "",
        出所: "画面",
      })
      .select("id,電話番号,登録日,理由,登録者,出所,解除日,解除者,解除理由,created_at")
      .single();
    if (error) throw new Error("自社アポ禁を登録できませんでした");
    await setPhoneInternalBlock(phoneNumber, true);
    return NextResponse.json({ ok: true, inserted: 1, alreadyBlocked: 0, row: data as unknown as InternalBlockRow });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "自社アポ禁を登録できませんでした" }, { status: 500 });
  }
}
