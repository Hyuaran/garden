/**
 * Garden Root — kot-api.ts ユニットテスト
 *
 * カバー範囲:
 *   - fetchKotEmployees / fetchKotMonthlyWorkings / fetchKotDailyWorkings
 *   - KotApiClientError クラス
 *   - トークン検証 / URL 構築 / ヘッダー検証
 *   - 日付フォーマット検証（fetch が呼ばれないことの確認）
 *   - HTTP エラーマッピング
 *   - リトライ挙動（fake timers で高速化）
 *   - ネットワークエラー / パースエラー
 *
 * パターン: promise を作った直後に expect(...).rejects / expect(...).resolves を
 * 登録してから vi.runAllTimersAsync() で時計を進める。こうすると「settled 後に
 * handler を登録」という PromiseRejectionHandledWarning が出なくなる。
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  fetchKotEmployees,
  fetchKotMonthlyWorkings,
  fetchKotDailyWorkings,
  KotApiClientError,
} from "@/app/root/_lib/kot-api";

// ----------------------------------------------------------------
// セットアップ
// ----------------------------------------------------------------

const ORIGINAL_TOKEN = process.env.KOT_API_TOKEN;

beforeEach(() => {
  process.env.KOT_API_TOKEN = "test-token";
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  if (ORIGINAL_TOKEN === undefined) {
    delete process.env.KOT_API_TOKEN;
  } else {
    process.env.KOT_API_TOKEN = ORIGINAL_TOKEN;
  }
});

/**
 * fetch を 1 回だけモックする。
 * body が string ならそのまま、オブジェクトなら JSON.stringify して返す。
 */
function mockFetchOnce(body: unknown, init: ResponseInit = {}) {
  const fetchMock = vi.fn().mockResolvedValueOnce(
    typeof body === "string"
      ? new Response(body, init)
      : new Response(JSON.stringify(body), {
          headers: { "content-type": "application/json" },
          ...init,
        }),
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

/**
 * fetch を複数回モックする。
 * responses の各要素は [body, init] の形式。
 */
function mockFetchSequence(responses: Array<[unknown, ResponseInit?]>) {
  let mock = vi.fn();
  for (const [body, init = {}] of responses) {
    mock = mock.mockResolvedValueOnce(
      typeof body === "string"
        ? new Response(body, init)
        : new Response(JSON.stringify(body), {
            headers: { "content-type": "application/json" },
            ...init,
          }),
    );
  }
  vi.stubGlobal("fetch", mock);
  return mock;
}

/**
 * rejects テストの標準パターン。
 * assertion を先に登録 → タイマー進行 → assertion が解決。
 */
async function expectRejects(
  promise: Promise<unknown>,
  matcher: Record<string, unknown>,
) {
  const assertion = expect(promise).rejects.toMatchObject(matcher);
  await vi.runAllTimersAsync();
  await assertion;
}

// ----------------------------------------------------------------
// 1. トークン処理
// ----------------------------------------------------------------

describe("Token handling", () => {
  it("KOT_API_TOKEN が未設定のとき TOKEN_MISSING エラーを投げる", async () => {
    delete process.env.KOT_API_TOKEN;
    // バリデーションは同期的に即 reject するため、タイマー不要
    await expect(fetchKotEmployees()).rejects.toMatchObject({
      code: "TOKEN_MISSING",
      httpStatus: 0,
    });
  });

  it("TOKEN_MISSING エラーは KotApiClientError のインスタンス", async () => {
    delete process.env.KOT_API_TOKEN;
    try {
      await fetchKotEmployees();
      expect.fail("should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(KotApiClientError);
    }
  });

  it("トークンが存在し 200 OK の場合、パース済み JSON を返す", async () => {
    const payload = [{ code: "0001", key: "abc" }];
    mockFetchOnce(payload, { status: 200 });
    const promise = fetchKotEmployees();
    const assertion = expect(promise).resolves.toEqual(payload);
    await vi.runAllTimersAsync();
    await assertion;
  });
});

// ----------------------------------------------------------------
// 2. URL 構築
// ----------------------------------------------------------------

describe("URL construction", () => {
  it("fetchKotEmployees() — クエリなしで /employees を呼ぶ", async () => {
    const mock = mockFetchOnce([], { status: 200 });
    const promise = fetchKotEmployees();
    await vi.runAllTimersAsync();
    await promise;
    const calledUrl = mock.mock.calls[0][0] as string;
    expect(calledUrl).toBe("https://api.kingtime.jp/v1.0/employees");
  });

  it("fetchKotEmployees({ date }) — ?date=... を付ける", async () => {
    const mock = mockFetchOnce([], { status: 200 });
    const promise = fetchKotEmployees({ date: "2026-04-25" });
    await vi.runAllTimersAsync();
    await promise;
    const calledUrl = mock.mock.calls[0][0] as string;
    expect(calledUrl).toContain("?date=2026-04-25");
  });

  it("fetchKotEmployees({ includeResigner: true }) — includeResigner=true を付ける", async () => {
    const mock = mockFetchOnce([], { status: 200 });
    const promise = fetchKotEmployees({ includeResigner: true });
    await vi.runAllTimersAsync();
    await promise;
    const calledUrl = mock.mock.calls[0][0] as string;
    expect(calledUrl).toContain("includeResigner=true");
  });

  it("fetchKotEmployees({ date, includeResigner }) — 両クエリパラメータが含まれる", async () => {
    const mock = mockFetchOnce([], { status: 200 });
    const promise = fetchKotEmployees({ date: "2026-04-25", includeResigner: true });
    await vi.runAllTimersAsync();
    await promise;
    const calledUrl = mock.mock.calls[0][0] as string;
    expect(calledUrl).toContain("date=2026-04-25");
    expect(calledUrl).toContain("includeResigner=true");
  });

  it("fetchKotMonthlyWorkings — /monthly-workings/YYYY-MM を呼ぶ", async () => {
    const mock = mockFetchOnce([], { status: 200 });
    const promise = fetchKotMonthlyWorkings("2026-04");
    await vi.runAllTimersAsync();
    await promise;
    const calledUrl = mock.mock.calls[0][0] as string;
    expect(calledUrl).toBe("https://api.kingtime.jp/v1.0/monthly-workings/2026-04");
  });

  it("fetchKotDailyWorkings — /daily-workings/YYYY-MM-DD を呼ぶ", async () => {
    const mock = mockFetchOnce([], { status: 200 });
    const promise = fetchKotDailyWorkings("2026-04-25");
    await vi.runAllTimersAsync();
    await promise;
    const calledUrl = mock.mock.calls[0][0] as string;
    expect(calledUrl).toBe("https://api.kingtime.jp/v1.0/daily-workings/2026-04-25");
  });
});

// ----------------------------------------------------------------
// 3. リクエストヘッダー
// ----------------------------------------------------------------

describe("Request headers", () => {
  it("Authorization: Bearer <token> ヘッダーを送る", async () => {
    const mock = mockFetchOnce([], { status: 200 });
    const promise = fetchKotEmployees();
    await vi.runAllTimersAsync();
    await promise;
    const calledInit = mock.mock.calls[0][1] as RequestInit;
    expect((calledInit.headers as Record<string, string>)["Authorization"]).toBe("Bearer test-token");
  });

  it("Accept: application/json ヘッダーを送る", async () => {
    const mock = mockFetchOnce([], { status: 200 });
    const promise = fetchKotEmployees();
    await vi.runAllTimersAsync();
    await promise;
    const calledInit = mock.mock.calls[0][1] as RequestInit;
    expect((calledInit.headers as Record<string, string>)["Accept"]).toBe("application/json");
  });

  it("cache: 'no-store' オプションを送る", async () => {
    const mock = mockFetchOnce([], { status: 200 });
    const promise = fetchKotEmployees();
    await vi.runAllTimersAsync();
    await promise;
    const calledInit = mock.mock.calls[0][1] as RequestInit;
    expect(calledInit.cache).toBe("no-store");
  });
});

// ----------------------------------------------------------------
// 4. 日付フォーマット検証（fetch は呼ばれない）
// ----------------------------------------------------------------

describe("Date format validation — fetchKotMonthlyWorkings", () => {
  it("ゼロパディングなし '2026-4' → INVALID_ARG（fetch 呼び出しなし）", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    // バリデーションは同期的に即 reject する
    await expect(fetchKotMonthlyWorkings("2026-4")).rejects.toMatchObject({ code: "INVALID_ARG" });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("存在しない月 '2026-13' → INVALID_ARG（fetch 呼び出しなし）", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    await expect(fetchKotMonthlyWorkings("2026-13")).rejects.toMatchObject({ code: "INVALID_ARG" });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("日付付きフル '2026-04-25' → INVALID_ARG（月次に日は不可）", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    await expect(fetchKotMonthlyWorkings("2026-04-25")).rejects.toMatchObject({ code: "INVALID_ARG" });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("空文字列 '' → INVALID_ARG（fetch 呼び出しなし）", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    await expect(fetchKotMonthlyWorkings("")).rejects.toMatchObject({ code: "INVALID_ARG" });
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe("Date format validation — fetchKotDailyWorkings", () => {
  it("月のみ '2026-04' → INVALID_ARG（日次に月のみは不可）", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    await expect(fetchKotDailyWorkings("2026-04")).rejects.toMatchObject({ code: "INVALID_ARG" });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("存在しない日 '2026-04-32' → INVALID_ARG（fetch 呼び出しなし）", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    await expect(fetchKotDailyWorkings("2026-04-32")).rejects.toMatchObject({ code: "INVALID_ARG" });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("存在しない月 '2026-13-01' → INVALID_ARG（fetch 呼び出しなし）", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    await expect(fetchKotDailyWorkings("2026-13-01")).rejects.toMatchObject({ code: "INVALID_ARG" });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("空文字列 '' → INVALID_ARG（fetch 呼び出しなし）", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    await expect(fetchKotDailyWorkings("")).rejects.toMatchObject({ code: "INVALID_ARG" });
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

// ----------------------------------------------------------------
// 5. HTTP エラーマッピング
// ----------------------------------------------------------------

describe("HTTP error mapping", () => {
  it("401 → UNAUTHORIZED (httpStatus: 401)", async () => {
    mockFetchOnce({ errors: [] }, { status: 401 });
    await expectRejects(fetchKotMonthlyWorkings("2026-04"), { code: "UNAUTHORIZED", httpStatus: 401 });
  });

  it("403 + errors[].code=105 → RATE_LIMITED", async () => {
    mockFetchOnce({ errors: [{ code: 105, message: "rate" }] }, { status: 403 });
    await expectRejects(fetchKotMonthlyWorkings("2026-04"), { code: "RATE_LIMITED", httpStatus: 403 });
  });

  it("403 (plain body) → FORBIDDEN", async () => {
    mockFetchOnce("Forbidden", { status: 403 });
    await expectRejects(fetchKotMonthlyWorkings("2026-04"), { code: "FORBIDDEN", httpStatus: 403 });
  });

  it("403 (JSON without code 105) → FORBIDDEN", async () => {
    mockFetchOnce({ errors: [{ code: 999, message: "other" }] }, { status: 403 });
    await expectRejects(fetchKotMonthlyWorkings("2026-04"), { code: "FORBIDDEN", httpStatus: 403 });
  });

  it("404 → NOT_FOUND", async () => {
    mockFetchOnce("Not Found", { status: 404 });
    await expectRejects(fetchKotMonthlyWorkings("2026-04"), { code: "NOT_FOUND", httpStatus: 404 });
  });

  it("422 → VALIDATION", async () => {
    mockFetchOnce({ errors: [{ code: 222, message: "validation error" }] }, { status: 422 });
    await expectRejects(fetchKotMonthlyWorkings("2026-04"), { code: "VALIDATION", httpStatus: 422 });
  });

  it("500 (リトライ全消化後) → SERVER_ERROR", async () => {
    // DEFAULT_MAX_RETRIES = 3 なので 4 回 500 を返すと SERVER_ERROR
    const mock = mockFetchSequence([
      [{ errors: [] }, { status: 500 }],
      [{ errors: [] }, { status: 500 }],
      [{ errors: [] }, { status: 500 }],
      [{ errors: [] }, { status: 500 }],
    ]);
    const promise = fetchKotMonthlyWorkings("2026-04");
    const assertion = expect(promise).rejects.toMatchObject({ code: "SERVER_ERROR" });
    await vi.runAllTimersAsync();
    await assertion;
    expect(mock).toHaveBeenCalledTimes(4);
  });

  it("418 (非マップステータス) → UNKNOWN", async () => {
    mockFetchOnce("I'm a teapot", { status: 418 });
    await expectRejects(fetchKotMonthlyWorkings("2026-04"), { code: "UNKNOWN", httpStatus: 418 });
  });
});

// ----------------------------------------------------------------
// 6. リトライ挙動
// ----------------------------------------------------------------

describe("Retry behavior", () => {
  it("500 の後 200 → 成功し、fetch は 2 回呼ばれる", async () => {
    const mock = mockFetchSequence([
      [{ errors: [] }, { status: 500 }],
      [[], { status: 200 }],
    ]);
    const promise = fetchKotMonthlyWorkings("2026-04");
    const assertion = expect(promise).resolves.toEqual([]);
    await vi.runAllTimersAsync();
    await assertion;
    expect(mock).toHaveBeenCalledTimes(2);
  });

  it("429 の後 200 → 成功し、fetch は 2 回呼ばれる", async () => {
    const mock = mockFetchSequence([
      ["Too Many Requests", { status: 429 }],
      [[], { status: 200 }],
    ]);
    const promise = fetchKotMonthlyWorkings("2026-04");
    const assertion = expect(promise).resolves.toEqual([]);
    await vi.runAllTimersAsync();
    await assertion;
    expect(mock).toHaveBeenCalledTimes(2);
  });

  it("500 × 4 (maxRetries+1 超) → SERVER_ERROR をスロー", async () => {
    const mock = mockFetchSequence([
      [{ errors: [] }, { status: 500 }],
      [{ errors: [] }, { status: 500 }],
      [{ errors: [] }, { status: 500 }],
      [{ errors: [] }, { status: 500 }],
    ]);
    const promise = fetchKotMonthlyWorkings("2026-04");
    const assertion = expect(promise).rejects.toMatchObject({ code: "SERVER_ERROR" });
    await vi.runAllTimersAsync();
    await assertion;
    expect(mock).toHaveBeenCalledTimes(4);
  });

  it("401 → リトライせず即スロー（fetch は 1 回のみ）", async () => {
    const mock = mockFetchOnce({ errors: [] }, { status: 401 });
    const promise = fetchKotMonthlyWorkings("2026-04");
    const assertion = expect(promise).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await vi.runAllTimersAsync();
    await assertion;
    expect(mock).toHaveBeenCalledTimes(1);
  });

  it("404 → リトライせず即スロー（fetch は 1 回のみ）", async () => {
    const mock = mockFetchOnce("Not Found", { status: 404 });
    const promise = fetchKotMonthlyWorkings("2026-04");
    const assertion = expect(promise).rejects.toMatchObject({ code: "NOT_FOUND" });
    await vi.runAllTimersAsync();
    await assertion;
    expect(mock).toHaveBeenCalledTimes(1);
  });
});

// ----------------------------------------------------------------
// 7. ネットワークエラー
// ----------------------------------------------------------------

describe("Network error", () => {
  it("fetch が TypeError をスローした後 → NETWORK_ERROR をスロー（リトライ後）", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("network down")));
    const promise = fetchKotMonthlyWorkings("2026-04");
    const assertion = expect(promise).rejects.toMatchObject({ code: "NETWORK_ERROR", httpStatus: 0 });
    await vi.runAllTimersAsync();
    await assertion;
  });

  it("NETWORK_ERROR は KotApiClientError のインスタンス", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("network down")));
    const promise = fetchKotMonthlyWorkings("2026-04");
    const assertion = expect(promise).rejects.toBeInstanceOf(KotApiClientError);
    await vi.runAllTimersAsync();
    await assertion;
  });

  it("ネットワークエラー時は DEFAULT_MAX_RETRIES + 1 回 fetch が呼ばれる", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new TypeError("network down"));
    vi.stubGlobal("fetch", fetchMock);
    const promise = fetchKotMonthlyWorkings("2026-04");
    const assertion = expect(promise).rejects.toBeInstanceOf(KotApiClientError);
    await vi.runAllTimersAsync();
    await assertion;
    // DEFAULT_MAX_RETRIES = 3 → attempt 0,1,2,3 = 4 回
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });
});

// ----------------------------------------------------------------
// 8. パースエラー
// ----------------------------------------------------------------

describe("Parse error", () => {
  it("200 で非 JSON ボディ → PARSE_ERROR をスロー", async () => {
    mockFetchOnce("this is not json", { status: 200 });
    await expectRejects(fetchKotMonthlyWorkings("2026-04"), { code: "PARSE_ERROR" });
  });

  it("PARSE_ERROR は KotApiClientError のインスタンス", async () => {
    mockFetchOnce("not valid json {{", { status: 200 });
    const promise = fetchKotMonthlyWorkings("2026-04");
    const assertion = expect(promise).rejects.toBeInstanceOf(KotApiClientError);
    await vi.runAllTimersAsync();
    await assertion;
  });

  it("PARSE_ERROR の httpStatus は 200", async () => {
    mockFetchOnce("not json at all", { status: 200 });
    await expectRejects(fetchKotMonthlyWorkings("2026-04"), { httpStatus: 200 });
  });
});

// ----------------------------------------------------------------
// 9. KotApiClientError クラス
// ----------------------------------------------------------------

describe("KotApiClientError class", () => {
  it("Error を継承している", () => {
    const err = new KotApiClientError({
      code: "TOKEN_MISSING",
      httpStatus: 0,
      message: "test message",
    });
    expect(err).toBeInstanceOf(Error);
  });

  it("KotApiClientError のインスタンスである", () => {
    const err = new KotApiClientError({
      code: "TOKEN_MISSING",
      httpStatus: 0,
      message: "test message",
    });
    expect(err).toBeInstanceOf(KotApiClientError);
  });

  it('.name === "KotApiClientError"', () => {
    const err = new KotApiClientError({
      code: "UNAUTHORIZED",
      httpStatus: 401,
      message: "unauthorized",
    });
    expect(err.name).toBe("KotApiClientError");
  });

  it("code / httpStatus / message が保持される", () => {
    const err = new KotApiClientError({
      code: "NOT_FOUND",
      httpStatus: 404,
      message: "not found",
    });
    expect(err.code).toBe("NOT_FOUND");
    expect(err.httpStatus).toBe(404);
    expect(err.message).toBe("not found");
  });

  it("detail を指定した場合、detail が保持される", () => {
    const detail = { extra: "info" };
    const err = new KotApiClientError({
      code: "UNKNOWN",
      httpStatus: 0,
      message: "unknown",
      detail,
    });
    expect(err.detail).toEqual(detail);
  });

  it("detail を指定しない場合、.detail === undefined", () => {
    const err = new KotApiClientError({
      code: "TOKEN_MISSING",
      httpStatus: 0,
      message: "no detail",
    });
    expect(err.detail).toBeUndefined();
  });

  it("message は Error.message として露出する", () => {
    const err = new KotApiClientError({
      code: "SERVER_ERROR",
      httpStatus: 500,
      message: "server blew up",
    });
    expect(err.message).toBe("server blew up");
  });
});

// ----------------------------------------------------------------
// 付加: fetchKotDailyWorkings の正常系・エラー系も確認
// ----------------------------------------------------------------

describe("fetchKotDailyWorkings — 正常系と代表エラー", () => {
  it("200 → パース済み配列を返す", async () => {
    const payload = [{ date: "2026-04-25", employeeKey: "key1" }];
    mockFetchOnce(payload, { status: 200 });
    const promise = fetchKotDailyWorkings("2026-04-25");
    const assertion = expect(promise).resolves.toEqual(payload);
    await vi.runAllTimersAsync();
    await assertion;
  });

  it("401 → UNAUTHORIZED", async () => {
    mockFetchOnce({ errors: [] }, { status: 401 });
    await expectRejects(fetchKotDailyWorkings("2026-04-25"), { code: "UNAUTHORIZED" });
  });
});

describe("fetchKotEmployees — エラー系", () => {
  it("500 (全リトライ消化) → SERVER_ERROR", async () => {
    mockFetchSequence([
      [{ errors: [] }, { status: 500 }],
      [{ errors: [] }, { status: 500 }],
      [{ errors: [] }, { status: 500 }],
      [{ errors: [] }, { status: 500 }],
    ]);
    const promise = fetchKotEmployees();
    const assertion = expect(promise).rejects.toMatchObject({ code: "SERVER_ERROR" });
    await vi.runAllTimersAsync();
    await assertion;
  });
});
