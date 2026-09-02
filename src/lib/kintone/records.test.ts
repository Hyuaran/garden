import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

describe("kintone records", () => {
  beforeEach(() => {
    vi.resetModules();
    process.env.KINTONE_SUBDOMAIN = "garden-test";
    vi.stubGlobal("fetch", vi.fn());
  });

  it("sends token, app, query and fields", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ records: [{ $id: { value: "1" } }] })));
    const { getRecords } = await import("./records");

    const records = await getRecords(10, "secret-token", "実績日 >= \"2026-09-01\"", ["レコード番号", "実績日"]);

    expect(records).toHaveLength(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain("https://garden-test.cybozu.com/k/v1/records.json?");
    expect(String(url)).toContain("app=10");
    expect(String(url)).toContain("fields%5B0%5D=");
    expect((init as RequestInit).headers).toMatchObject({ "X-Cybozu-API-Token": "secret-token" });
    // GET に Content-Type を付けると Kintone が 400 を返す（2026-09-02 実機で確認）。付いていないことを守る。
    expect(Object.keys((init as RequestInit).headers as Record<string, string>)).not.toContain("Content-Type");
  });

  it("uses $id pagination until the final partial page", async () => {
    const firstPage = Array.from({ length: 500 }, (_, index) => ({ $id: { value: String(index + 1) } }));
    const secondPage = [{ $id: { value: "501" } }];
    const fetchMock = vi.mocked(fetch);
    fetchMock
      .mockResolvedValueOnce(new Response(JSON.stringify({ records: firstPage })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ records: secondPage })));
    const { getAllRecords } = await import("./records");

    const records = await getAllRecords(10, "secret-token", "実績日 >= \"2026-09-01\"", ["レコード番号"]);

    expect(records).toHaveLength(501);
    expect(new URL(String(fetchMock.mock.calls[0][0])).searchParams.get("query")).toContain("limit 500");
    expect(new URL(String(fetchMock.mock.calls[0][0])).searchParams.get("fields[1]")).toBe("$id");
    expect(new URL(String(fetchMock.mock.calls[1][0])).searchParams.get("query")).toContain("$id > 500");
  });
});
