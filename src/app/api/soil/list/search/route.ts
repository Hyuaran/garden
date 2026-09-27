import { NextResponse } from "next/server";

import { hasDatabaseUrl, queryPg, queryPgWithTimeout } from "@/lib/db/pg";

import { requireSoilListUser } from "../_lib/auth";
import { toSearchRow } from "../_lib/query";
import { buildSearchPlanSql, buildSearchSql, normalizeSearchPage, normalizeSearchSort, shouldUseFilterFirstSearch } from "../_lib/search-sql";
import { SoilListRequestError, normalizeConditionRequestPayload } from "../_lib/validation";

export const runtime = "nodejs";

const WALK_SEARCH_TIMEOUT_MS = 8000;

function readPlanRows(rows: Record<string, unknown>[]): number | null {
  const first = rows[0];
  if (!first) return null;
  const value = Object.values(first)[0];
  const planRoot = Array.isArray(value) ? value[0] : value;
  if (!planRoot || typeof planRoot !== "object") return null;
  const plan = (planRoot as { Plan?: unknown }).Plan;
  if (!plan || typeof plan !== "object") return null;
  const planRows = (plan as { "Plan Rows"?: unknown })["Plan Rows"];
  return typeof planRows === "number" ? planRows : null;
}

async function estimatePlanRows(condition: ReturnType<typeof normalizeConditionRequestPayload>): Promise<number | null> {
  try {
    const sql = buildSearchPlanSql(condition);
    const result = await queryPg(sql.text, sql.values);
    return readPlanRows(result.rows as Record<string, unknown>[]);
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  const auth = await requireSoilListUser();
  if (!auth.ok) return auth.response;

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const condition = normalizeConditionRequestPayload(body);
    const sort = normalizeSearchSort(body.sort);
    const page = normalizeSearchPage(body.page);
    if (!hasDatabaseUrl()) {
      return NextResponse.json({ ok: false, error: "一覧を取得できませんでした（接続の設定がありません）" }, { status: 500 });
    }

    const planRows = await estimatePlanRows(condition);
    let result: { rows: Record<string, unknown>[] };
    if (shouldUseFilterFirstSearch(planRows)) {
      const sql = buildSearchSql(condition, sort, page, { filterFirst: true });
      result = await queryPg(sql.text, sql.values);
    } else {
      // 電話番号順の索引を歩く方式は、該当の番号が並びの後ろに固まっていると遅い（本番実測：東京都・福岡県・愛知県で 30 秒超）。
      // 8 秒で打ち切り、先に絞ってから並べる方式でやり直す
      const sql = buildSearchSql(condition, sort, page);
      try {
        result = await queryPgWithTimeout(sql.text, sql.values, WALK_SEARCH_TIMEOUT_MS);
      } catch (error) {
        if ((error as { code?: string } | null)?.code !== "57014") throw error;
        const retry = buildSearchSql(condition, sort, page, { filterFirst: true });
        result = await queryPg(retry.text, retry.values);
      }
    }
    const rawRows = result.rows;
    const rows = rawRows.map((row) => toSearchRow(row));
    return NextResponse.json({ ok: true, rows, page, pageSize: 100, sort });
  } catch (error) {
    if (error instanceof SoilListRequestError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
    }
    return NextResponse.json({ ok: false, error: "一覧を取得できませんでした" }, { status: 500 });
  }
}
