import { NextResponse } from "next/server";

import {
  MAX_OPTION_ITEMS,
  OFFICIAL_PREFECTURES,
  SOIL_LIST_OPTION_FIELDS,
  SOIL_LIST_TABLES,
  getColumnName,
  type SoilListOptionFieldKey,
  type SoilListOptionItem,
  type SoilListOptionsPayload,
} from "@/app/system/list/_lib/list-fields";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

import { requireSoilListUser } from "../_lib/auth";
import { mergeOptionRows, toOptionItems, type OptionRow } from "../_lib/options";

export const runtime = "nodejs";

const CACHE_MS = 60 * 60 * 1000;

// 選択肢は soil_list_option（列ごとの値と件数を集計した表）から読む。
// 本番の PostgREST は集計（count()）が無効（PGRST123）なので、265 万行を毎回数えない。
type OptionQueryResult = { data: OptionRow[] | null; error: { message: string } | null };
type OptionQuery = PromiseLike<OptionQueryResult> & {
  eq(column: string, value: unknown): OptionQuery;
  in(column: string, values: unknown[]): OptionQuery;
  or(filters: string): OptionQuery;
  order(column: string, options?: { ascending?: boolean }): OptionQuery;
  limit(count: number): OptionQuery;
};
type OptionDb = {
  from(table: string): {
    select(columns: string): OptionQuery;
  };
};

let cachedOptions: { expiresAt: number; value: SoilListOptionsPayload } | null = null;

async function fetchFieldOptions(db: OptionDb, field: SoilListOptionFieldKey): Promise<SoilListOptionItem[]> {
  const column = getColumnName(field);
  // PostgREST は 1 回 1,000 行までしか返さない（都道府県は表記ゆれが 2,700 種類）。
  // 全部を取ってから並べ替えると上位が抜けるので、DB 側で件数の多い順に上限まで取り、「（空欄）」の行は別に取って先頭に置く
  const officialPrefectures =
    field === "prefecture"
      ? db
          .from(SOIL_LIST_TABLES.option)
          .select("value,row_count")
          .eq("column_name", column)
          .in("value", OFFICIAL_PREFECTURES)
      : Promise.resolve({ data: [], error: null } satisfies OptionQueryResult);
  const [top, empty, official] = await Promise.all([
    db
      .from(SOIL_LIST_TABLES.option)
      .select("value,row_count")
      .eq("column_name", column)
      .order("row_count", { ascending: false })
      .limit(MAX_OPTION_ITEMS),
    db.from(SOIL_LIST_TABLES.option).select("value,row_count").eq("column_name", column).or("value.is.null,value.eq."),
    officialPrefectures,
  ]);
  if (top.error) throw new Error(top.error.message);
  if (empty.error) throw new Error(empty.error.message);
  if (official.error) throw new Error(official.error.message);
  // 1 件しかない値（住所の断片や個別の電話番号つきのメモ）は選択肢に出さない。空欄は残す
  const limit = field === "prefecture" ? MAX_OPTION_ITEMS + OFFICIAL_PREFECTURES.length + 1 : MAX_OPTION_ITEMS + 1;
  return toOptionItems(mergeOptionRows(top.data ?? [], empty.data ?? [], official.data ?? []))
    .filter((item) => item.empty || item.count >= 2)
    .slice(0, limit);
}

async function fetchOptions(): Promise<SoilListOptionsPayload> {
  const now = Date.now();
  if (cachedOptions && cachedOptions.expiresAt > now) return cachedOptions.value;

  const db = getSupabaseAdmin() as unknown as OptionDb;
  const entries = await Promise.all(
    SOIL_LIST_OPTION_FIELDS.map(async (field) => [field, await fetchFieldOptions(db, field)] as const),
  );
  const value = Object.fromEntries(entries) as SoilListOptionsPayload;
  cachedOptions = { expiresAt: now + CACHE_MS, value };
  return value;
}

export async function GET() {
  const auth = await requireSoilListUser();
  if (!auth.ok) return auth.response;

  try {
    return NextResponse.json({ ok: true, options: await fetchOptions() });
  } catch {
    return NextResponse.json({ ok: false, error: "選択肢を取得できませんでした" }, { status: 500 });
  }
}
