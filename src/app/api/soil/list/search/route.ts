import { NextResponse } from "next/server";

import { hasDatabaseUrl, queryPg } from "@/lib/db/pg";

import { requireSoilListUser } from "../_lib/auth";
import { toSearchRow } from "../_lib/query";
import { buildSearchSql, normalizeSearchPage, normalizeSearchSort } from "../_lib/search-sql";
import { SoilListRequestError, normalizeConditionRequestPayload } from "../_lib/validation";

export const runtime = "nodejs";

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

    const sql = buildSearchSql(condition, sort, page);
    const result = await queryPg(sql.text, sql.values);
    const rawRows = result.rows as Record<string, unknown>[];
    const rows = rawRows.map((row) => toSearchRow(row));
    return NextResponse.json({ ok: true, rows, page, pageSize: 100, sort });
  } catch (error) {
    if (error instanceof SoilListRequestError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
    }
    return NextResponse.json({ ok: false, error: "一覧を取得できませんでした" }, { status: 500 });
  }
}
