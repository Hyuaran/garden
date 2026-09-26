import { NextResponse } from "next/server";
import { requireManager, requireStaff } from "@/app/system/mypage/_lib/submission-server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";

type SiteNewsInput = {
  company_id?: unknown;
  published_on?: unknown;
  title?: unknown;
  body?: unknown;
};

function isDate(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function cleanString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function validateInput(body: SiteNewsInput) {
  const companyId = cleanString(body.company_id);
  const title = cleanString(body.title);
  const text = typeof body.body === "string" ? body.body : "";
  if (!companyId) return { ok: false as const, error: "会社を選択してください" };
  if (!isDate(body.published_on)) return { ok: false as const, error: "日付を正しく入力してください" };
  if (!title) return { ok: false as const, error: "題名を入力してください" };
  return {
    ok: true as const,
    value: { company_id: companyId, published_on: body.published_on, title, body: text },
  };
}

async function writeAudit(params: {
  actorUserId: string | null;
  actorEmpNum: string | null;
  targetId?: string | null;
  payload: Record<string, unknown>;
}) {
  await getSupabaseAdmin().from("root_audit_log").insert({
    actor_user_id: params.actorUserId,
    actor_emp_num: params.actorEmpNum,
    action: "site_news_update",
    target_type: "system_site_news",
    target_id: params.targetId ?? null,
    payload: params.payload,
    user_agent: null,
  });
}

export async function GET(request: Request) {
  const staff = await requireStaff();
  if (!staff) return NextResponse.json({ ok: false, error: "ログインが必要です" }, { status: 403 });

  const companyId = new URL(request.url).searchParams.get("company_id");
  if (!companyId) return NextResponse.json({ ok: false, error: "会社を選択してください" }, { status: 400 });

  const { data, error } = await getSupabaseAdmin()
    .from("system_site_news")
    .select("id,company_id,published_on,title,body,kind,source_field,is_published,created_by,created_at,updated_at")
    .eq("company_id", companyId)
    .order("published_on", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ ok: false, error: "お知らせを読み込めませんでした" }, { status: 500 });
  return NextResponse.json({ ok: true, news: data ?? [] });
}

export async function POST(request: Request) {
  const manager = await requireManager();
  if (!manager) return NextResponse.json({ ok: false, error: "編集権限がありません" }, { status: 403 });

  const body = await request.json().catch(() => null) as SiteNewsInput | null;
  const validation = validateInput(body ?? {});
  if (!validation.ok) return NextResponse.json({ ok: false, error: validation.error }, { status: 400 });

  const { data, error } = await getSupabaseAdmin()
    .from("system_site_news")
    .insert({
      ...validation.value,
      kind: "manual",
      is_published: true,
      created_by: String(manager.name ?? manager.employee_number ?? ""),
    })
    .select("id,company_id,published_on,title,body,kind,source_field,is_published,created_by,created_at,updated_at")
    .single();

  if (error || !data) return NextResponse.json({ ok: false, error: "お知らせを保存できませんでした" }, { status: 500 });

  await writeAudit({
    actorUserId: String(manager.userId ?? ""),
    actorEmpNum: String(manager.employee_number ?? ""),
    targetId: String(data.id),
    payload: { action: "create", news: data },
  });

  return NextResponse.json({ ok: true, news: data });
}
