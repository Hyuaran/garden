import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("@/app/api/bud/expense-drive/_lib/drive", () => ({ getDriveAccessToken: vi.fn(async () => "test-token") }));
import { buildDriveIndex } from "./drive-index";
describe("Drive 全階層一覧", () => {
  afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });
  it("ページングと子フォルダ一括検索・循環回避", async () => {
    const fetch = vi.fn().mockResolvedValueOnce(Response.json({ files: [{ id: "a", mimeType: "application/vnd.google-apps.folder" }, { id: "b", mimeType: "application/vnd.google-apps.folder" }], nextPageToken: "next" }))
      .mockResolvedValueOnce(Response.json({ files: [{ id: "file", md5Checksum: "ABC" }] }))
      .mockResolvedValueOnce(Response.json({ files: [{ id: "root", mimeType: "application/vnd.google-apps.folder" }, { id: "file2", md5Checksum: "DEF" }] }));
    vi.stubGlobal("fetch", fetch);
    expect(await buildDriveIndex("root")).toEqual(new Set(["abc", "def"]));
    const urls = fetch.mock.calls.map(c => new URL(c[0]));
    expect(urls[1].searchParams.get("pageToken")).toBe("next");
    expect(urls[2].searchParams.get("q")).toContain("'a' in parents or 'b' in parents");
    expect(urls[0].searchParams.get("supportsAllDrives")).toBe("true");
    expect(urls[0].searchParams.get("pageSize")).toBe("1000");
  });
  it("503 は3回再試行して失敗を投げる", async () => {
    vi.useFakeTimers();
    const fetch = vi.fn(async () => new Response("", { status: 503 })); vi.stubGlobal("fetch", fetch);
    const assertion = expect(buildDriveIndex("root")).rejects.toThrow("読めません");
    await vi.runAllTimersAsync(); await assertion;
    expect(fetch).toHaveBeenCalledTimes(4);
  });
});
