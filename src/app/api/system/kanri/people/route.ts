import { NextResponse } from "next/server";
import { requireManager } from "@/app/system/mypage/_lib/submission-server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type { KanriPerson } from "@/app/system/kanri/_lib/calc/jisseki-sheet";

export const runtime = "nodejs";

const SELECT_COLUMNS = "id,name,kot_name,team,department,employment_kind,base_wage,is_field_sales,employee_id,active,sort_order";

function validPeople(value: unknown): value is KanriPerson[] {
  if (!Array.isArray(value)) return false;
  return value.every((person) => {
    if (!person || typeof person !== "object") return false;
    const item = person as Partial<KanriPerson>;
    return typeof item.name === "string"
      && typeof item.team === "string"
      && typeof item.department === "string"
      && typeof item.employment_kind === "string";
  });
}

export async function GET() {
  const manager = await requireManager();
  if (!manager) return NextResponse.json({ ok: false }, { status: 403 });
  const { data, error } = await getSupabaseAdmin()
    .from("system_kanri_person")
    .select(SELECT_COLUMNS)
    .order("sort_order", { ascending: true });
  if (error) return NextResponse.json({ ok: false, error: "人の設定を読み込めませんでした" }, { status: 500 });
  return NextResponse.json({ ok: true, people: data ?? [] });
}

export async function PUT(request: Request) {
  const manager = await requireManager();
  if (!manager) return NextResponse.json({ ok: false }, { status: 403 });
  const body = await request.json().catch(() => null) as { people?: unknown } | null;
  if (!validPeople(body?.people)) return NextResponse.json({ ok: false, error: "人の設定を確認してください" }, { status: 400 });

  const rows = body.people.map((person, index) => ({
    ...person,
    kot_name: person.kot_name ?? null,
    base_wage: person.employment_kind === "アルバイト" ? person.base_wage ?? null : null,
    is_field_sales: Boolean(person.is_field_sales),
    active: person.active !== false,
    sort_order: person.sort_order ?? (index + 1) * 10,
  }));
  const { data, error } = await getSupabaseAdmin()
    .from("system_kanri_person")
    .upsert(rows)
    .select(SELECT_COLUMNS)
    .order("sort_order", { ascending: true });
  if (error) return NextResponse.json({ ok: false, error: "人の設定を保存できませんでした" }, { status: 500 });
  return NextResponse.json({ ok: true, people: data ?? [] });
}
