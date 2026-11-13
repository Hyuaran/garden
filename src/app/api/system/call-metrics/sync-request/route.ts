import { NextResponse } from "next/server";
import { createServerClient } from "@/app/_lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { canView, viewPermissionContext } from "@/lib/auth/view-permission.server";
import { isEmployeeActive } from "@/lib/auth/employee-access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const fields = "id,status,finished_at,error";
const failure = () => NextResponse.json({ ok: false, error: "更新要求の取得に失敗しました" }, { status: 500 });

async function authorize() {
  const db = await createServerClient();
  const { data: auth } = await db.auth.getUser();
  if (!auth.user) return { response: NextResponse.json({ ok: false, error: "未ログインです" }, { status: 401 }) };
  const { data: employee, error } = await db.from("root_employees")
    .select("employee_id,garden_role,is_active,termination_date,deleted_at").eq("user_id", auth.user.id).eq("is_active", true).maybeSingle();
  if (error) return { response: failure() };
  if (!employee || !isEmployeeActive(employee)) return { response: NextResponse.json({ ok: false }, { status: 403 }) };
  const { viewer } = await viewPermissionContext();
  const allowed = await Promise.all(["employees", "lists", "webinbound", "definitions"].map(tab => canView("system-call-metrics", tab, viewer)));
  if (!allowed.some(Boolean) && !await canView("system-list", "list", viewer)) return { response: NextResponse.json({ ok: false }, { status: 403 }) };
  return { requestedBy: String(employee.employee_id ?? auth.user.id) };
}

export async function POST() {
  const auth = await authorize();
  if (auth.response) return auth.response;
  const db = getSupabaseAdmin();
  const agent = await db.from("system_callcenter_agent_auth").select("last_seen_at").eq("id", "host-pc").maybeSingle();
  if (agent.error) return failure();
  const seen = Date.parse(agent.data?.last_seen_at ?? "");
  // 係は通常の取り込み（1 時間ごとの 7 日分など）の間は確認に来られないため、止まったと見なすのは 10 分音沙汰がないとき
  if (!Number.isFinite(seen) || Date.now() - seen > 10 * 60_000) {
    return NextResponse.json({ ok: false, error: "ホスト PC の係が止まっています。少し待ってからもう一度押してください。" }, { status: 503 });
  }
  const active = () => db.from("system_call_sync_requests").select(fields).in("status", ["queued", "running"]).maybeSingle();
  const existing = await active();
  if (existing.error) return failure();
  if (existing.data) return NextResponse.json({ ok: true, ...existing.data });
  const created = await db.from("system_call_sync_requests").insert({ requested_by: auth.requestedBy }).select(fields).single();
  if (created.error?.code === "23505") {
    const concurrent = await active();
    if (!concurrent.error && concurrent.data) return NextResponse.json({ ok: true, ...concurrent.data });
  }
  if (created.error) return failure();
  return NextResponse.json({ ok: true, ...created.data });
}

export async function GET(request: Request) {
  const auth = await authorize();
  if (auth.response) return auth.response;
  const id = new URL(request.url).searchParams.get("id");
  if (!id || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return NextResponse.json({ ok: false, error: "更新要求の ID が不正です" }, { status: 400 });
  }
  const result = await getSupabaseAdmin().from("system_call_sync_requests").select(fields).eq("id", id).maybeSingle();
  if (result.error) return failure();
  if (!result.data) return NextResponse.json({ ok: false, error: "更新要求が見つかりません" }, { status: 404 });
  return NextResponse.json({ ok: true, ...result.data });
}
