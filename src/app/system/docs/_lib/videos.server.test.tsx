import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({ createServerClient: vi.fn(), getSupabaseAdmin: vi.fn(), redirect: vi.fn() }));
vi.mock("@/app/_lib/supabase/server", () => ({ createServerClient: mocks.createServerClient }));
vi.mock("@/lib/supabase/admin", () => ({ getSupabaseAdmin: mocks.getSupabaseAdmin }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("../_data/videos", async importOriginal => {
  const original = await importOriginal<typeof import("../_data/videos")>();
  return { ...original, videos: [...original.videos, { ...original.videos[0], id: "hidden-video", title: "非公開動画", visible: false }] };
});
import { loadVideos } from "./videos.server";
import VideosPage from "../videos/page";

function client() {
  const query = { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), is: vi.fn().mockReturnThis(), maybeSingle: vi.fn().mockResolvedValue({ data: { employee_id: "E1" }, error: null }) };
  const sign = vi.fn().mockImplementation(async (path: string) => ({ data: { signedUrl: `https://example.com/${path}?signed=1` }, error: null }));
  const db = { auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "U1" } }, error: null }) }, from: vi.fn().mockReturnValue(query), query, storage: { from: vi.fn().mockReturnValue({ createSignedUrl: sign }) }, sign };
  mocks.createServerClient.mockResolvedValue(db); mocks.getSupabaseAdmin.mockReturnValue(db);
  return db;
}

describe("非公開動画の取得", () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.redirect.mockImplementation((url: string) => { throw new Error(`redirect:${url}`); }); });

  it("未ログインはページから署名せずログインへ戻す", async () => {
    const db = client(); db.auth.getUser.mockResolvedValue({ data: { user: null }, error: null });
    await expect(VideosPage()).rejects.toThrow("redirect:/login?returnTo=%2Fsystem%2Fdocs%2Fvideos");
    expect(db.from).not.toHaveBeenCalled(); expect(mocks.getSupabaseAdmin).not.toHaveBeenCalled();
  });

  it("認証エラーは拒否する", async () => {
    const db = client(); db.auth.getUser.mockResolvedValue({ data: { user: { id: "U1" } }, error: { message: "invalid" } });
    await expect(loadVideos()).rejects.toThrow("redirect:");
    expect(db.sign).not.toHaveBeenCalled();
  });

  it("在籍・未削除の条件を必須にし、退職・削除・未登録を拒否する", async () => {
    const db = client(); db.query.maybeSingle.mockResolvedValue({ data: null, error: null });
    await expect(loadVideos()).rejects.toThrow("redirect:");
    expect(db.query.eq).toHaveBeenCalledWith("user_id", "U1");
    expect(db.query.eq).toHaveBeenCalledWith("is_active", true);
    expect(db.query.is).toHaveBeenCalledWith("deleted_at", null);
    expect(mocks.getSupabaseAdmin).not.toHaveBeenCalled();
  });

  it("在籍の照会失敗も拒否する", async () => {
    const db = client(); db.query.maybeSingle.mockResolvedValue({ data: null, error: { message: "query failed" } });
    await expect(loadVideos()).rejects.toThrow("redirect:");
    expect(db.sign).not.toHaveBeenCalled();
  });

  it("認証・在籍確認後のみ、表示する5本とポスターのURLを1時間で発行する", async () => {
    const db = client(); const result = await loadVideos();
    expect(result).toHaveLength(5);
    expect(result.map(video => video.id)).toEqual(["00-company-intro", "01-orientation", "03-refresh-time", "04-sales-guide", "02-rakuten-hayatoku"]);
    expect(result.map(video => video.duration)).toEqual(["1分40秒", "4分09秒", "4分07秒", "4分15秒", "2分40秒"]);
    expect(db.sign).toHaveBeenCalledTimes(10);
    expect(db.storage.from).toHaveBeenCalledWith("system-docs");
    for (const video of result) {
      expect(db.sign).toHaveBeenCalledWith(`videos/${video.id}.mp4`, 3600);
      expect(db.sign).toHaveBeenCalledWith(`videos/posters/${video.id}.webp`, 3600);
    }
    expect(db.query.maybeSingle.mock.invocationCallOrder[0]).toBeLessThan(mocks.getSupabaseAdmin.mock.invocationCallOrder[0]);
  });

  it("visible:falseは結果にも署名対象にも含めない", async () => {
    const db = client(); const result = await loadVideos();
    expect(JSON.stringify(result)).not.toContain("hidden-video");
    expect(JSON.stringify(db.sign.mock.calls)).not.toContain("hidden-video");
  });

  it.each(["error", "throw"])("サムネイルの%sでも動画を返す", async mode => {
    const db = client();
    db.sign.mockImplementation(async (path: string) => {
      if (path.endsWith(".webp")) {
        if (mode === "throw") throw new Error("network");
        return { data: null, error: { message: "missing" } };
      }
      return { data: { signedUrl: `https://example.com/${path}` }, error: null };
    });
    const result = await loadVideos();
    expect(result).toHaveLength(5);
    expect(result.every(video => video.videoUrl && !video.posterUrl)).toBe(true);
  });

  it("動画の署名だけ失敗しても題名・説明を残し、他の動画を返す", async () => {
    const db = client(); db.sign.mockResolvedValueOnce({ data: null, error: { message: "missing" } });
    const result = await loadVideos();
    expect(result[0].title).toBe("会社紹介"); expect(result[0].videoUrl).toBeUndefined();
    expect(result[0].posterUrl).toBeDefined(); expect(result[1].videoUrl).toBeDefined();
  });
});
