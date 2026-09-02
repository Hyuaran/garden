import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { requireManager } from "@/app/system/mypage/_lib/submission-server";

export const runtime = "nodejs";

function validYearMonth(value: string) {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
}

function validDate(value: unknown) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export async function GET(_request: Request, context: { params: Promise<{ yearMonth: string }> }) {
  const manager = await requireManager();
  if (!manager) return NextResponse.json({ ok: false }, { status: 403 });
  const { yearMonth } = await context.params;
  if (!validYearMonth(yearMonth)) return NextResponse.json({ ok: false }, { status: 400 });
  const { data, error } = await getSupabaseAdmin()
    .from("system_kanri_month_setting")
    .select("year_month,holidays,updated_at")
    .eq("year_month", yearMonth)
    .maybeSingle();
  if (error) return NextResponse.json({ ok: false, error: "定休日を読み込めませんでした" }, { status: 500 });
  return NextResponse.json({ ok: true, setting: data ?? { year_month: yearMonth, holidays: [] } });
}

export async function PUT(request: Request, context: { params: Promise<{ yearMonth: string }> }) {
  const manager = await requireManager();
  if (!manager) return NextResponse.json({ ok: false }, { status: 403 });
  const { yearMonth } = await context.params;
  if (!validYearMonth(yearMonth)) return NextResponse.json({ ok: false }, { status: 400 });
  const body = await request.json().catch(() => null) as { holidays?: unknown } | null;
  const holidays = Array.isArray(body?.holidays) ? body.holidays.filter(validDate) : null;
  if (!holidays) return NextResponse.json({ ok: false, error: "定休日を確認してください" }, { status: 400 });
  const { data, error } = await getSupabaseAdmin()
    .from("system_kanri_month_setting")
    .upsert({
      year_month: yearMonth,
      holidays,
      updated_by: manager.userId,
      updated_at: new Date().toISOString(),
    })
    .select("year_month,holidays,updated_at")
    .single();
  if (error) return NextResponse.json({ ok: false, error: "定休日を保存できませんでした" }, { status: 500 });
  return NextResponse.json({ ok: true, setting: data });
}
