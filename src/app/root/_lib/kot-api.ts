/**
 * Garden Root — KING OF TIME（KoT）Web API クライアント
 *
 * - ベース: https://api.kingtime.jp/v1.0
 * - 認証: Authorization: Bearer <process.env.KOT_API_TOKEN>
 * - Server 実行専用（トークンをブラウザに漏らさない）
 *
 * 🔒 セキュリティ:
 *   - トークンは環境変数からのみ取得。ファイル・引数・ログへの書込禁止。
 *   - エラーログには **トークンの有無（!!token）** のみ記録、値は絶対に出さない。
 *
 * 依存: 新規 npm なし（fetch は Next.js 16 / Node 20 標準）
 */

import type {
  KotApiError,
  KotEmployee,
  KotMonthlyWorking,
} from "../_types/kot";

const BASE_URL = "https://api.kingtime.jp/v1.0";

const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_RETRY_BASE_MS = 500; // 500ms → 1s → 2s の指数バックオフ

type FetchOptions = {
  maxRetries?: number;
  /** テスト注入用（通常未指定） */
  signal?: AbortSignal;
};

/**
 * KoT 側のレート制限・一時障害をハンドルする低レベル fetch。
 * - 401 / 403 / 404 は即座にエラーを返す（リトライ不要）
 * - 429 / 5xx は指数バックオフでリトライ
 */
async function kotFetch<T>(path: string, opts: FetchOptions = {}): Promise<T> {
  const token = process.env.KOT_API_TOKEN;
  if (!token) {
    throw new KotApiClientError({
      code: "TOKEN_MISSING",
      httpStatus: 0,
      message: "KOT_API_TOKEN が環境変数に設定されていません（.env.local / Vercel 環境変数を確認）",
    });
  }

  const maxRetries = opts.maxRetries ?? DEFAULT_MAX_RETRIES;
  const url = `${BASE_URL}${path}`;
  let lastError: unknown = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    let res: Response;
    try {
      res = await fetch(url, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
        cache: "no-store",
        signal: opts.signal,
      });
    } catch (e) {
      // ネットワーク障害（DNS 失敗等）→ リトライ
      lastError = e;
      if (attempt < maxRetries) { await sleep(backoffMs(attempt)); continue; }
      throw new KotApiClientError({
        code: "NETWORK_ERROR",
        httpStatus: 0,
        message: "KoT API ホストへ到達できませんでした",
        detail: safeErrorMessage(e),
      });
    }

    // 成功系
    if (res.ok) {
      try {
        return (await res.json()) as T;
      } catch (e) {
        throw new KotApiClientError({
          code: "PARSE_ERROR",
          httpStatus: res.status,
          message: "KoT API のレスポンスを JSON として解釈できませんでした",
          detail: safeErrorMessage(e),
        });
      }
    }

    // エラー系
    const errBody = await safeReadError(res);

    // リトライ対象: 429 / 5xx / 303,308(ToManyRequests in KoT codes)
    const retryable = res.status === 429 || (res.status >= 500 && res.status < 600);
    if (retryable && attempt < maxRetries) {
      lastError = errBody;
      await sleep(backoffMs(attempt));
      continue;
    }

    // 認証系・クライアント系は即エラー
    throw new KotApiClientError({
      code: mapHttpToCode(res.status, errBody),
      httpStatus: res.status,
      message: buildMessage(res.status, errBody),
      detail: errBody,
    });
  }

  throw new KotApiClientError({
    code: "UNKNOWN",
    httpStatus: 0,
    message: "KoT API 呼び出しに失敗しました（詳細不明）",
    detail: lastError,
  });
}

// ------------------------------------------------------------
// 高レベル API
// ------------------------------------------------------------

/**
 * 従業員一覧を取得。
 *
 * @param opts.date          "YYYY-MM-DD"。指定日時点で在籍する従業員を返す（省略時は当日）
 * @param opts.includeResigner  退職者も含めるか
 */
export async function fetchKotEmployees(opts: { date?: string; includeResigner?: boolean } = {}): Promise<KotEmployee[]> {
  const params = new URLSearchParams();
  if (opts.date) params.set("date", opts.date);
  if (opts.includeResigner) params.set("includeResigner", "true");
  const q = params.toString();
  return kotFetch<KotEmployee[]>(`/employees${q ? `?${q}` : ""}`);
}

/**
 * 月別勤怠を取得。
 *
 * @param yearMonth  "YYYY-MM" 形式（例: "2026-04"）。
 *                   実機確認で KoT API は YYYY-MM のみ受理（YYYY-MM-DD だと HTTP 400 / code 2）。
 */
export async function fetchKotMonthlyWorkings(yearMonth: string): Promise<KotMonthlyWorking[]> {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(yearMonth)) {
    throw new KotApiClientError({
      code: "INVALID_ARG",
      httpStatus: 0,
      message: `yearMonth は YYYY-MM 形式で指定してください（受け取り: "${yearMonth}"）`,
    });
  }
  return kotFetch<KotMonthlyWorking[]>(`/monthly-workings/${yearMonth}`);
}

// ------------------------------------------------------------
// エラー型
// ------------------------------------------------------------

export type KotApiClientErrorCode =
  | "TOKEN_MISSING"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "RATE_LIMITED"
  | "NOT_FOUND"
  | "VALIDATION"
  | "SERVER_ERROR"
  | "NETWORK_ERROR"
  | "PARSE_ERROR"
  | "INVALID_ARG"
  | "UNKNOWN";

export class KotApiClientError extends Error {
  readonly code: KotApiClientErrorCode | string;
  readonly httpStatus: number;
  readonly detail: unknown;
  constructor(args: { code: KotApiClientErrorCode | string; httpStatus: number; message: string; detail?: unknown }) {
    super(args.message);
    this.name = "KotApiClientError";
    this.code = args.code;
    this.httpStatus = args.httpStatus;
    this.detail = args.detail;
  }
}

// ------------------------------------------------------------
// 内部ヘルパ
// ------------------------------------------------------------

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function backoffMs(attempt: number): number {
  return DEFAULT_RETRY_BASE_MS * Math.pow(2, attempt);
}

async function safeReadError(res: Response): Promise<KotApiError | string> {
  try {
    const text = await res.text();
    try { return JSON.parse(text) as KotApiError; } catch { return text; }
  } catch {
    return `HTTP ${res.status} ${res.statusText}`;
  }
}

function safeErrorMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  return String(e);
}

function mapHttpToCode(status: number, body: KotApiError | string): KotApiClientErrorCode {
  if (status === 401) return "UNAUTHORIZED";
  if (status === 403) {
    // KoT 独自コード 105 = レート制限
    if (typeof body === "object" && body.errors?.some((e) => Number(e.code) === 105)) return "RATE_LIMITED";
    return "FORBIDDEN";
  }
  if (status === 404) return "NOT_FOUND";
  if (status === 429) return "RATE_LIMITED";
  if (status >= 500) return "SERVER_ERROR";
  if (status === 400 || status === 422) return "VALIDATION";
  return "UNKNOWN";
}

function buildMessage(status: number, body: KotApiError | string): string {
  if (typeof body === "object") {
    const msgs = body.errors?.map((e) => `${e.code}: ${e.message}`).join(" / ") ?? body.message;
    if (msgs) return `KoT API エラー (HTTP ${status}): ${msgs}`;
  }
  if (typeof body === "string" && body) return `KoT API エラー (HTTP ${status}): ${body.slice(0, 200)}`;
  return `KoT API エラー (HTTP ${status})`;
}
