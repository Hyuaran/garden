import { Pool, types, type QueryResultRow } from "pg";

// date 型（OID 1082）は Date に変換せず "YYYY-MM-DD" の文字列のまま受け取る
// （変換すると画面に "Sun May 31 2026 00:00:00 GMT+0000 …" と出る。時刻付き timestamptz は今までどおり）
types.setTypeParser(1082, (value: string) => value);

/**
 * PostgreSQL への直結（Supabase の Session pooler）。
 * Supabase の REST 経由だと 1 回 8 秒・1,000 行までに切られるため、
 * リストマスタの一覧（並べ替え・ページ送り）と書き出しのように大きい照会はこちらを使う。
 * 接続文字列は環境変数 DATABASE_URL（Vercel と .env.local。値は台帳）。
 */
let pool: Pool | null = null;

export function hasDatabaseUrl(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

export function getPgPool(): Pool {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not set");
  }
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 1,
      ssl: { rejectUnauthorized: false },
    });
    // REST の 8 秒制限は掛からないが、無制限にはしない（1 回の照会は 60 秒まで）
    pool.on("connect", (client) => {
      void client.query("set statement_timeout = '60s'");
    });
  }
  return pool;
}

export async function queryPg<T extends QueryResultRow = QueryResultRow>(text: string, values: unknown[]): Promise<{ rows: T[] }> {
  const result = await getPgPool().query<T>(text, values);
  return { rows: result.rows };
}
