import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  createKintoneClient,
  buildCursorRequestBody,
  parseKintoneError,
  type KintoneClient,
} from "../kintone-client";

describe("buildCursorRequestBody", () => {
  it("最小: app と size のみ", () => {
    const body = buildCursorRequestBody({ app: 55, size: 500 });
    expect(body).toEqual({ app: 55, size: 500 });
  });

  it("fields 指定", () => {
    const body = buildCursorRequestBody({
      app: 55,
      size: 500,
      fields: ["$id", "電話番号", "漢字"],
    });
    expect(body.fields).toEqual(["$id", "電話番号", "漢字"]);
  });

  it("query 指定", () => {
    const body = buildCursorRequestBody({
      app: 55,
      size: 500,
      query: '更新日時 > "2026-04-01"',
    });
    expect(body.query).toBe('更新日時 > "2026-04-01"');
  });

  it("size の上限は 500（Kintone 公式制約）", () => {
    expect(() => buildCursorRequestBody({ app: 55, size: 600 })).toThrow(
      /size.*500/,
    );
  });

  it("size の下限は 1", () => {
    expect(() => buildCursorRequestBody({ app: 55, size: 0 })).toThrow(/size.*1/);
  });
});

describe("parseKintoneError", () => {
  it("公式エラー形式: code + message + id", () => {
    const err = parseKintoneError({
      status: 400,
      body: {
        code: "GAIA_QU01",
        message: "クエリの条件指定が不正です。",
        id: "abc-123",
      },
    });
    expect(err.kind).toBe("permanent");
    expect(err.code).toBe("GAIA_QU01");
    expect(err.message).toContain("クエリの条件指定が不正");
  });

  it("429 = レート制限 = retriable", () => {
    const err = parseKintoneError({
      status: 429,
      body: { code: "CB_NO02", message: "Too many requests" },
    });
    expect(err.kind).toBe("retriable");
  });

  it("5xx = サーバーエラー = retriable", () => {
    const err = parseKintoneError({ status: 503, body: {} });
    expect(err.kind).toBe("retriable");
  });

  it("401 = 認証 = permanent", () => {
    const err = parseKintoneError({
      status: 401,
      body: { code: "CB_AU01", message: "Authentication failed" },
    });
    expect(err.kind).toBe("permanent");
  });

  it("不明な status = unknown", () => {
    const err = parseKintoneError({ status: 0, body: {} });
    expect(err.kind).toBe("unknown");
  });
});

describe("createKintoneClient", () => {
  let mockFetch: ReturnType<typeof vi.fn>;
  let client: KintoneClient;

  beforeEach(() => {
    mockFetch = vi.fn();
    client = createKintoneClient({
      domain: "example.cybozu.com",
      apiToken: "tok-123",
      fetcher: mockFetch as unknown as typeof fetch,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const jsonResponse = (body: unknown, status = 200): Response =>
    new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    });

  it("createCursor: POST /k/v1/records/cursor.json + 認証ヘッダー + body", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ id: "cursor-xyz", totalCount: "42" }));

    const result = await client.createCursor({ app: 55, size: 500 });

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockFetch).toHaveBeenCalledWith(
      "https://example.cybozu.com/k/v1/records/cursor.json",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "X-Cybozu-API-Token": "tok-123",
          "Content-Type": "application/json",
        }),
        body: JSON.stringify({ app: 55, size: 500 }),
      }),
    );
    expect(result).toEqual({ id: "cursor-xyz", totalCount: 42 });
  });

  it("getCursor: GET /k/v1/records/cursor.json?id=...", async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({ records: [{ $id: { value: "1" } }], next: true }),
    );

    const result = await client.getCursor("cursor-xyz");

    expect(mockFetch).toHaveBeenCalledWith(
      "https://example.cybozu.com/k/v1/records/cursor.json?id=cursor-xyz",
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({ "X-Cybozu-API-Token": "tok-123" }),
      }),
    );
    expect(result.records).toHaveLength(1);
    expect(result.next).toBe(true);
  });

  it("deleteCursor: DELETE /k/v1/records/cursor.json", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({}));

    await client.deleteCursor("cursor-xyz");

    expect(mockFetch).toHaveBeenCalledWith(
      "https://example.cybozu.com/k/v1/records/cursor.json",
      expect.objectContaining({
        method: "DELETE",
        body: JSON.stringify({ id: "cursor-xyz" }),
      }),
    );
  });

  it("HTTP エラー時は parseKintoneError ベースの例外を投げる", async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({ code: "CB_AU01", message: "auth failed", id: "x" }, 401),
    );

    await expect(
      client.createCursor({ app: 55, size: 500 }),
    ).rejects.toThrow(/auth failed/);
  });

  it("fetchAllRecords: cursor 作成 → 複数 getCursor → 自動完走", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ id: "cur-1", totalCount: "3" }));
    mockFetch.mockResolvedValueOnce(
      jsonResponse({
        records: [{ $id: { value: "1" } }, { $id: { value: "2" } }],
        next: true,
      }),
    );
    mockFetch.mockResolvedValueOnce(
      jsonResponse({
        records: [{ $id: { value: "3" } }],
        next: false,
      }),
    );

    const all: { $id: { value: string } }[] = [];
    for await (const batch of client.fetchAllRecords<{ $id: { value: string } }>({
      app: 55,
      size: 500,
    })) {
      all.push(...batch);
    }

    expect(all.map((r) => r.$id.value)).toEqual(["1", "2", "3"]);
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });
});
