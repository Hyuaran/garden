import { Pool, types, type PoolClient, type QueryResultRow } from "pg";

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

/**
 * 1 つの接続を占有して使う（カーソルのように同じ接続で続けて実行する必要がある処理用）。
 * 終わったら必ず接続を返す。
 */
export async function withPgClient<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await getPgPool().connect();
  try {
    return await fn(client);
  } finally {
    client.release();
  }
}

/**
 * 大きい結果をサーバー側カーソルで少しずつ受け取る。
 * `limit/offset` を繰り返す方式だと 1 束ごとに全体を並べ直す（本番実測：5,000 行 1 束に 6〜7 秒 → 190 万件で 40 分超）。
 * カーソルなら並べ替えは最初の 1 回だけで、あとは順に取り出すだけ。
 */
export async function forEachPgBatch<T extends QueryResultRow = QueryResultRow>(
  text: string,
  values: unknown[],
  batchSize: number,
  onBatch: (rows: T[]) => Promise<void> | void,
): Promise<void> {
  await withPgClient(async (client) => {
    await client.query("begin");
    try {
      await client.query(`declare soil_list_batch_cursor no scroll cursor for ${text}`, values);
      for (;;) {
        const result = await client.query<T>(`fetch forward ${Math.max(1, Math.floor(batchSize))} from soil_list_batch_cursor`);
        if (result.rows.length === 0) break;
        await onBatch(result.rows);
        if (result.rows.length < batchSize) break;
      }
      await client.query("close soil_list_batch_cursor");
      await client.query("commit");
    } catch (error) {
      await client.query("rollback").catch(() => undefined);
      throw error;
    }
  });
}
