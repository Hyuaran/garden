/**
 * Garden-Soil — Kintone REST API クライアント（fetch ベース、外部 SDK 非依存）
 *
 * 対応 spec:
 *   - docs/specs/2026-04-26-soil-phase-b-01-list-import-phase-1.md（B-01 §3.1）
 *
 * 作成: 2026-05-08（Phase B-01 第 2 弾、a-soil）
 *
 * 設計方針:
 *   - 新規 npm install を回避するため fetch 自前実装（CLAUDE.md 制約）
 *   - cursor pagination（`/k/v1/records/cursor.json`）に特化
 *   - 認証は API トークン（`X-Cybozu-API-Token`）固定、Phase 1 = App 55 関電リスト
 *   - 全機能 fetcher 注入で testable（vitest mock fetch で完結）
 *   - エラーは kind ('retriable' | 'permanent' | 'unknown') で分類、リトライ判断を呼出側に委ねる
 *
 * Kintone API 公式制約:
 *   - cursor size 上限: 500 件 / req
 *   - レート制限: 100 req/sec（本番は 10 req/sec で抑制推奨）
 *   - cursor は 10 分で自動失効（明示 deleteCursor 推奨）
 *
 * 使用例:
 *   const client = createKintoneClient({
 *     domain: "hyuaran.cybozu.com",
 *     apiToken: process.env.KINTONE_APP_55_TOKEN!,
 *   });
 *   for await (const batch of client.fetchAllRecords({ app: 55, size: 500 })) {
 *     // batch = KintoneApp55Record[]
 *   }
 */

// ============================================================
// 型定義
// ============================================================

export type CreateCursorRequest = {
  app: number;
  size: number;             // 1 〜 500
  fields?: string[];
  query?: string;
};

export type CreateCursorResponse = {
  id: string;
  totalCount: number;
};

export type GetCursorResponse<T = unknown> = {
  records: T[];
  next: boolean;
};

export type KintoneClientOptions = {
  domain: string;            // 'example.cybozu.com'
  apiToken: string;          // Kintone アプリの API トークン
  fetcher?: typeof fetch;    // テスト時のみ注入（本番は globalThis.fetch）
};

export type KintoneClient = {
  createCursor(req: CreateCursorRequest): Promise<CreateCursorResponse>;
  getCursor<T = unknown>(cursorId: string): Promise<GetCursorResponse<T>>;
  deleteCursor(cursorId: string): Promise<void>;
  fetchAllRecords<T = unknown>(req: CreateCursorRequest): AsyncIterable<T[]>;
};

export type KintoneError = {
  kind: "retriable" | "permanent" | "unknown";
  status: number;
  code?: string;
  message: string;
  errorId?: string;
};

// ============================================================
// 純粋ヘルパー
// ============================================================

/**
 * createCursor の request body を組み立てる純粋関数。
 * size が 1〜500 の範囲外なら例外を投げる。
 */
export function buildCursorRequestBody(req: CreateCursorRequest): {
  app: number;
  size: number;
  fields?: string[];
  query?: string;
} {
  if (req.size < 1) {
    throw new Error(`Kintone cursor size must be >= 1 (got ${req.size})`);
  }
  if (req.size > 500) {
    throw new Error(`Kintone cursor size must be <= 500 (got ${req.size})`);
  }
  const body: { app: number; size: number; fields?: string[]; query?: string } = {
    app: req.app,
    size: req.size,
  };
  if (req.fields !== undefined) body.fields = req.fields;
  if (req.query !== undefined) body.query = req.query;
  return body;
}

/**
 * Kintone API レスポンスのエラー分類。
 *
 * 分類規則:
 *   - 5xx / 429 → retriable（指数バックオフでリトライ可）
 *   - 4xx（429 以外）→ permanent（即停止 + admin 通知）
 *   - その他（status=0 等のネットワーク障害含む） → unknown
 */
export function parseKintoneError(input: {
  status: number;
  body: { code?: string; message?: string; id?: string };
}): KintoneError {
  const { status, body } = input;
  const code = body?.code;
  const message = body?.message ?? `HTTP ${status}`;
  const errorId = body?.id;

  let kind: KintoneError["kind"] = "unknown";
  if (status === 429 || (status >= 500 && status < 600)) {
    kind = "retriable";
  } else if (status >= 400 && status < 500) {
    kind = "permanent";
  } else if (status >= 200 && status < 300) {
    kind = "unknown"; // 成功時に呼ばれる想定なし
  }

  return { kind, status, code, message, errorId };
}

// ============================================================
// クライアント本体
// ============================================================

/**
 * Kintone REST API クライアントを生成する。
 *
 * @param options.domain         Kintone サブドメイン（'example.cybozu.com'）
 * @param options.apiToken       アプリ単位の API トークン
 * @param options.fetcher        テスト時のみ注入（既定は globalThis.fetch）
 */
export function createKintoneClient(options: KintoneClientOptions): KintoneClient {
  const fetcher = options.fetcher ?? (globalThis.fetch as typeof fetch);
  const baseUrl = `https://${options.domain}`;

  const baseHeaders = {
    "X-Cybozu-API-Token": options.apiToken,
    "Content-Type": "application/json",
  };

  async function callJson<R>(
    url: string,
    init: { method: string; body?: string },
  ): Promise<R> {
    const resp = await fetcher(url, {
      method: init.method,
      headers: baseHeaders,
      body: init.body,
    } as Parameters<typeof fetch>[1]);

    const text = await resp.text();
    let body: Record<string, unknown> = {};
    if (text) {
      const trimmed = text.trim();
      if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
        try {
          body = JSON.parse(trimmed) as Record<string, unknown>;
        } catch {
          body = {};
        }
      }
    }

    if (!resp.ok) {
      const err = parseKintoneError({ status: resp.status, body });
      const e = new Error(err.message) as Error & { kintoneError: KintoneError };
      e.kintoneError = err;
      throw e;
    }
    return body as R;
  }

  async function createCursor(req: CreateCursorRequest): Promise<CreateCursorResponse> {
    const body = buildCursorRequestBody(req);
    const raw = await callJson<{ id: string; totalCount: string | number }>(
      `${baseUrl}/k/v1/records/cursor.json`,
      { method: "POST", body: JSON.stringify(body) },
    );
    return {
      id: raw.id,
      totalCount: typeof raw.totalCount === "string"
        ? parseInt(raw.totalCount, 10)
        : raw.totalCount,
    };
  }

  async function getCursor<T = unknown>(
    cursorId: string,
  ): Promise<GetCursorResponse<T>> {
    return await callJson<GetCursorResponse<T>>(
      `${baseUrl}/k/v1/records/cursor.json?id=${encodeURIComponent(cursorId)}`,
      { method: "GET" },
    );
  }

  async function deleteCursor(cursorId: string): Promise<void> {
    await callJson<Record<string, never>>(
      `${baseUrl}/k/v1/records/cursor.json`,
      { method: "DELETE", body: JSON.stringify({ id: cursorId }) },
    );
  }

  /**
   * cursor を作って完走するまで getCursor を繰り返す async iterator。
   *
   * - 各 yield = 1 回の getCursor で取得した records 配列
   * - 完走時（next=false）は cursor が API 側で破棄されるため明示 delete 不要
   * - 異常終了時（throw）は呼出側で deleteCursor を試みること
   */
  async function* fetchAllRecords<T = unknown>(
    req: CreateCursorRequest,
  ): AsyncIterable<T[]> {
    const cursor = await createCursor(req);
    let hasNext = true;
    while (hasNext) {
      const batch = await getCursor<T>(cursor.id);
      yield batch.records;
      hasNext = batch.next;
    }
  }

  return { createCursor, getCursor, deleteCursor, fetchAllRecords };
}
