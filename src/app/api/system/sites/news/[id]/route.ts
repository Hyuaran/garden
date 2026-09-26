import { NextResponse } from "next/server";
import { requireManager } from "@/app/system/mypage/_lib/submission-server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";

type PatchInput = {
  title?: unknown;
  body?: unknown;
  published_on?: unknown;
  is_published?: unknown;
};

function isDate(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function patchPayload(input: PatchInput) {
  const payload: Record<string, string | boolean> = {};
  if (Object.prototype.hasOwnProperty.call(input, "title")) {
    if (typeof input.title !== "string" || input.title.trim() === "") return { error: "題名を入力してください" };
    payload.title = input.title.trim();
  }
  if (Object.prototype.hasOwnProperty.call(input, "body")) {
    if (typeof input.body !== "string") return { error: "本文を入力してください" };
    payload.body = input.body;
  }
  if (Object.prototype.hasOwnProperty.call(input, "published_on")) {
    if (!isDate(input.published_on)) return { error: "日付を正しく入力してください" };
    payload.published_on = input.published_on;
  }
  if (Object.prototype.hasOwnProperty.call(input, "is_published")) {
    if (typeof input.is_published !== "boolean") return { error: "公開状態を正しく指定してください" };
    payload.is_published = input.is_published;
  }
  return Object.keys(payload).length > 0 ? { payload } : { error: "更新する項目がありません" };
}

async function writeAudit(params: {
  actorUserId: string | null;
  actorEmpNum: string | null;
  targetId: string;
  payload: Record<string, unknown>;
}) {
  await getSupabaseAdmin().from("root_audit_log").insert({
    actor_user_id: params.actorUserId,
    actor_emp_num: params.actorEmpNum,
    action: "site_news_update",
    target_type: "system_site_news",
    target_id: params.targetId,
    payload: params.payload,
    user_agent: null,
  });
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const manager = await requireManager();
  if (!manager) return NextResponse.json({ ok: false, error: "編集権限がありません" }, { status: 403 });

  const { id } = await context.params;
  const body = await request.json().catch(() => null) as PatchInput | null;
  const validation = patchPayload(body ?? {});
  if ("error" in validation) return NextResponse.json({ ok: false, error: validation.error }, { status: 400 });

  const { data, error } = await getSupabaseAdmin()
    .from("system_site_news")
    .update(validation.payload)
    .eq("id", id)
    .select("id,company_id,published_on,title,body,kind,source_field,is_published,created_by,created_at,updated_at")
    .single();

  if (error || !data) return NextResponse.json({ ok: false, error: "お知らせを更新できませんでした" }, { status: 500 });

  await writeAudit({
    actorUserId: String(manager.userId ?? ""),
    actorEmpNum: String(manager.employee_number ?? ""),
    targetId: id,
    payload: { action: "update", patch: validation.payload },
  });

  return NextResponse.json({ ok: true, news: data });
}
