import { GET as readData } from "@/app/api/bud/view-data/route";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { budViewContext } from "@/lib/auth/bud-view.server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const path = url.searchParams.get("path") ?? "";
  if (!path || path.length > 1000 || /[,()]/.test(path)) return Response.json({ error: "保存先を確認してください。" }, { status: 400 });
  const query = new URLSearchParams({ select: "id", or: `(storage_path.eq.${path},and(storage_path.is.null,drive_file_id.eq.${path}))`, limit: "1" });
  const params = new URLSearchParams({ page: "bud-expenses", table: "bud_expense_requests", query: query.toString() });
  const result = await readData(new Request(`${url.origin}/api/bud/view-data?${params}`));
  if (!result.ok) return result;
  const rows = await result.json();
  if (!Array.isArray(rows) || !rows.length) return Response.json({ error: "閲覧権限がありません" }, { status: 403 });
  const context = await budViewContext();
  const signed = await (context.defaultAllowed ? context.db : getSupabaseAdmin()).storage.from("bud-receipts").createSignedUrl(path, 600);
  if (signed.error) return Response.json({ error: "画像を取得できませんでした。" }, { status: 500 });
  return Response.json({ data: signed.data }, { headers: { "Cache-Control": "private, no-store" } });
}
