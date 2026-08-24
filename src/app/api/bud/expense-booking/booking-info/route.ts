import { NextResponse } from "next/server";
import { createServerClient } from "@/app/_lib/supabase/server";

type Body = {
  ids?: string[];
  bookingDate?: string;
  bookingCorpId?: string;
  fiscalPeriods?: Record<string, string>;
  corpOnly?: boolean;
};

export async function POST(request: Request) {
  const supabase = await createServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user?.id) return NextResponse.json({ error: "未ログインです" }, { status: 401 });
  const body = (await request.json()) as Body;
  const ids = Array.from(new Set(body.ids ?? []));
  if (!ids.length || !body.bookingCorpId) return NextResponse.json({ error: "対象と仕分け法人名は必須です" }, { status: 400 });

  const { data: employee } = await supabase.from("root_employees").select("garden_role").eq("user_id", auth.user.id).maybeSingle();
  const gardenRole = (employee as { garden_role?: string } | null)?.garden_role;
  if (body.corpOnly && gardenRole !== "super_admin") return NextResponse.json({ error: "仕分け法人名の付け替えは全権管理者のみ可能です" }, { status: 403 });
  const { data: hasAccess } = await supabase.rpc("bud_has_access");
  if (!hasAccess) return NextResponse.json({ error: "Bud権限がありません" }, { status: 403 });
  if (gardenRole !== "super_admin") {
    const { data: targets, error } = await supabase.from("bud_expense_requests").select("id,corp_id").in("id", ids);
    if (error || ((targets as Array<{ corp_id: string | null }> | null) ?? []).some((row) => row.corp_id !== body.bookingCorpId))
      return NextResponse.json({ error: "仕分け法人名の付け替えは全権管理者のみ可能です" }, { status: 403 });
  }

  const now = new Date().toISOString();
  for (const id of ids) {
    const values = body.corpOnly
      ? { booking_corp_id: body.bookingCorpId, fiscal_period: body.fiscalPeriods?.[id] ?? null, booking_set_at: now, booking_set_by: auth.user.id }
      : {
          booking_date: body.bookingDate,
          booking_corp_id: body.bookingCorpId,
          fiscal_period: body.fiscalPeriods?.[id] ?? null,
          booking_set_at: now,
          booking_set_by: auth.user.id,
        };
    if (!body.corpOnly && !/^\d{4}-\d{2}-\d{2}$/.test(body.bookingDate ?? ""))
      return NextResponse.json({ error: "仕分け日が不正です" }, { status: 400 });
    const { error } = await supabase.from("bud_expense_requests").update(values).eq("id", id).eq("status", "journalize_pending");
    if (error) return NextResponse.json({ error: `保存に失敗しました: ${error.message}` }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
