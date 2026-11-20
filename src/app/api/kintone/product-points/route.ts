import { parseKintonePointQuery, resolveKintonePoints } from "@/lib/product-points/kintone-points";
import { loadPoints } from "@/lib/product-points/load-points";
import { type PointRow } from "@/lib/product-points";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

const cors = {
  "Access-Control-Allow-Origin": "https://9j11u0q829lg.cybozu.com",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};
const cacheMs = 300_000;
let cached: { rows: PointRow[]; expiresAt: number } | undefined;
let loading: Promise<PointRow[]> | undefined;

function getPoints() {
  if (cached && cached.expiresAt > Date.now()) return Promise.resolve(cached.rows);
  loading ??= Promise.resolve()
    .then(() => loadPoints(getSupabaseAdmin(), AbortSignal.timeout(4_500)))
    .then((rows) => {
      cached = { rows, expiresAt: Date.now() + cacheMs };
      return rows;
    })
    .finally(() => { loading = undefined; });
  return loading;
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: cors });
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const input = url.search.length <= 8192 ? parseKintonePointQuery(url.searchParams) : null;
  if (!input) {
    return Response.json({ error: "入力内容を確認してください。" }, {
      status: 400, headers: { ...cors, "Cache-Control": "no-store" },
    });
  }
  try {
    const rows = await getPoints();
    return Response.json(resolveKintonePoints(rows, input), {
      headers: { ...cors, "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" },
    });
  } catch {
    return Response.json({ error: "付与ポイント表を読み込めませんでした。" }, {
      status: 503, headers: { ...cors, "Cache-Control": "no-store" },
    });
  }
}
