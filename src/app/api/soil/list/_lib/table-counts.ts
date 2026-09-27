import { SOIL_LIST_TABLES } from "@/app/system/list/_lib/list-fields";
import { getPgPool, hasDatabaseUrl } from "@/lib/db/pg";

export type TableCountKey = "phone" | "purchase" | "assignment" | "call" | "order";

export type TableCounts = Record<TableCountKey, number | null>;

export type TableCountRow = {
  table_name: string;
  row_count: string | number;
  counted_at: string | null;
};

export type TableCountsDb = {
  from(table: string): {
    select(columns: string): Promise<{ data: TableCountRow[] | null; error: { message: string } | null }>;
  };
};

export type LoadTableCountsResult = {
  counts: TableCounts;
  countedAt: string | null;
};

export type RefreshTableCountsResult = {
  tableCountsRefreshed: boolean;
  tableCountsError?: string;
};

const TABLE_COUNT_TABLE = "soil_list_table_count";

const COUNT_TARGETS: Array<{ key: TableCountKey; table: string }> = [
  { key: "phone", table: SOIL_LIST_TABLES.phone },
  { key: "purchase", table: SOIL_LIST_TABLES.purchase },
  { key: "assignment", table: SOIL_LIST_TABLES.assignment },
  { key: "call", table: SOIL_LIST_TABLES.call },
  { key: "order", table: SOIL_LIST_TABLES.order },
];

function emptyCounts(): TableCounts {
  return { phone: null, purchase: null, assignment: null, call: null, order: null };
}

function keyForTable(tableName: string): TableCountKey | null {
  return COUNT_TARGETS.find((target) => target.table === tableName)?.key ?? null;
}

export function normalizeTableCounts(rows: TableCountRow[]): LoadTableCountsResult {
  const counts = emptyCounts();
  let countedAt: string | null = null;
  for (const row of rows) {
    const key = keyForTable(row.table_name);
    if (!key) continue;
    counts[key] = Number(row.row_count);
    if (row.counted_at && (!countedAt || row.counted_at < countedAt)) countedAt = row.counted_at;
  }
  return { counts, countedAt };
}

export async function loadTableCounts(db: TableCountsDb): Promise<LoadTableCountsResult> {
  if (hasDatabaseUrl()) {
    const { rows } = await getPgPool().query<TableCountRow>(
      `select table_name, row_count, counted_at from public.${TABLE_COUNT_TABLE}`,
    );
    return normalizeTableCounts(rows);
  }

  const { data, error } = await db.from(TABLE_COUNT_TABLE).select("table_name,row_count,counted_at");
  if (error) throw new Error(error.message);
  return normalizeTableCounts(data ?? []);
}

export async function refreshTableCounts(): Promise<RefreshTableCountsResult> {
  if (!hasDatabaseUrl()) return { tableCountsRefreshed: false, tableCountsError: "DATABASE_URL is not set" };

  const client = await getPgPool().connect();
  try {
    await client.query("begin");
    try {
      await client.query("set local statement_timeout = '240s'");
      for (const target of COUNT_TARGETS) {
        const countResult = await client.query<{ count: string }>(`select count(*)::bigint as count from public.${target.table}`);
        await client.query(
          `insert into public.${TABLE_COUNT_TABLE} (table_name, row_count, counted_at)
           values ($1, $2::bigint, now())
           on conflict (table_name) do update
           set row_count = excluded.row_count, counted_at = now()`,
          [target.table, countResult.rows[0]?.count ?? "0"],
        );
      }
      await client.query("commit");
      return { tableCountsRefreshed: true };
    } catch (error) {
      await client.query("rollback").catch(() => undefined);
      return { tableCountsRefreshed: false, tableCountsError: error instanceof Error ? error.message : "table_count_refresh_failed" };
    }
  } finally {
    client.release();
  }
}
