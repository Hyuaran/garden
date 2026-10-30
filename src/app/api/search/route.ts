import { gardenSearch } from "@/lib/search/search.server";
import { validSearch } from "@/lib/search/match";
import { viewPermissionContext, ViewPermissionError } from "@/lib/auth/view-permission.server";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" };
export async function GET(request: Request) {
  try {
    await viewPermissionContext();
    const params = new URL(request.url).searchParams;
    const query = (params.get("q") ?? "").trim();
    if (query.length > 200) return Response.json({ error: "検索文字は 200 文字以内で入力してください。" }, { status: 400, headers });
    if (!validSearch(query)) return Response.json({ groups: [] }, { headers });
    const expanded = new Set((params.get("expanded") ?? "").split(","));
    return Response.json({ groups: await gardenSearch(query, expanded) }, { headers });
  } catch (error) {
    // 検索した文字・URL・抜き出した文は残さない。失敗した表と DB のエラー文だけ残す
    if (!(error instanceof ViewPermissionError)) console.error("[search] failed", error instanceof Error ? error.message : "unknown");
    return Response.json({ error: "検索できませんでした。" }, { status: error instanceof ViewPermissionError ? error.status : 503, headers });
  }
}
