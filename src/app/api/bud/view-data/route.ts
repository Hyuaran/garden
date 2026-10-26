import { budViewContext, budViewResponse, canViewBud } from "@/lib/auth/bud-view.server";
import { validBudRead } from "@/lib/auth/bud-view-data";

export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const url = new URL(request.url);
  const page = url.searchParams.get("page") ?? "";
  const table = url.searchParams.get("table") ?? "";
  const tab = url.searchParams.get("tab") ?? undefined;
  const params = new URLSearchParams(url.searchParams.get("query") ?? "");
  if (!validBudRead(page, table, params)) return Response.json({ message: "対象を確認してください。" }, { status: 400 });
  const denied = await budViewResponse(page, tab);
  if (denied) return denied;
  if (page === "bud-transfers" && ["bud_transfers", "bud_transfer_status_history"].includes(table)) {
    if (!(await Promise.all(["overview", "approval", "schedule", "history", "list"].map(key => canViewBud(page, key)))).some(Boolean)) return Response.json({ message: "閲覧権限がありません" }, { status: 403 });
  }
  if (page === "bud-statements" && table === "bud_transfers") {
    params.append("and", "(status.in.(承認済み,CSV出力済み),executed_date.is.null)");
  }
  // 同じ申請を使うタブでも、非許可の状態・削除済みの行は取得しない。
  if (table === "bud_expense_requests") {
    const [list, submit, approve, booking, done, deleted] = await Promise.all(["list", "submit", "approve", "booking", "done", "deleted"].map(key => canViewBud(page, key)));
    const statuses = [...(submit ? ["submitted", "final_pending", "final_returned", "journalize_pending", "journalized", "keiri_returned"] : []), ...(approve ? ["final_pending"] : []), ...(booking ? ["journalize_pending", "journalized"] : []), ...(done ? ["journalized"] : [])];
    const active = list ? "deleted_at.is.null" : statuses.length ? `and(deleted_at.is.null,status.in.(${[...new Set(statuses)].join(",")}))` : "id.is.null";
    // and を別パラメータとして追加し、呼び出し側の or 条件で制限を消せないようにする。
    params.append("and", `(${deleted ? `or(${active},deleted_at.not.is.null)` : active})`);
  }
  const context = await budViewContext();
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  // 従来から見られる人の行・列制限も保持し、設定で新しく許可した人だけ管理者接続にする。
  const key = context.defaultAllowed ? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY : process.env.SUPABASE_SERVICE_ROLE_KEY;
  const token = context.defaultAllowed ? (await context.db.auth.getSession()).data.session?.access_token : key;
  if (!base || !key || !token) return Response.json({ message: "読み取り接続を確認してください。" }, { status: 503 });
  const headers = new Headers({ apikey: key, Authorization: `Bearer ${token}` });
  for (const name of ["accept", "range", "range-unit"]) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  if (request.headers.get("prefer")?.includes("count=exact")) headers.set("Prefer", "count=exact");
  const result = await fetch(`${base}/rest/v1/${table}?${params}`, { headers, cache: "no-store" });
  const responseHeaders = new Headers({ "Cache-Control": "private, no-store", "Content-Type": "application/json" });
  const count = result.headers.get("content-range");
  if (count) responseHeaders.set("content-range", count);
  return new Response(await result.text(), { status: result.status, headers: responseHeaders });
}
