import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({ createServerClient: vi.fn(), getSupabaseAdmin: vi.fn(), redirect: vi.fn() }));
vi.mock("@/app/_lib/supabase/server", () => ({ createServerClient: mocks.createServerClient }));
vi.mock("@/lib/supabase/admin", () => ({ getSupabaseAdmin: mocks.getSupabaseAdmin }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("../_data/slides", async importOriginal => {
  const original = await importOriginal<typeof import("../_data/slides")>();
  return { ...original, slides: [...original.slides, { ...original.slides[0], id: "hidden-slide", title: "非公開スライド", visible: false }] };
});
import { loadSlideDeck, loadSlideDecks } from "./slides.server";

function client() {
  const query = { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), is: vi.fn().mockReturnThis(), maybeSingle: vi.fn().mockResolvedValue({ data: { employee_id: "E1" }, error: null }) };
  const sign = vi.fn().mockImplementation(async (path: string) => ({ data: { signedUrl: `https://example.com/${path}?signed=1` }, error: null }));
  const db = { auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "U1" } }, error: null }) }, from: vi.fn().mockReturnValue(query), query, storage: { from: vi.fn().mockReturnValue({ createSignedUrl: sign }) }, sign };
  mocks.createServerClient.mockResolvedValue(db); mocks.getSupabaseAdmin.mockReturnValue(db);
  return db;
}

describe("非公開スライドの取得", () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.redirect.mockImplementation((url: string) => { throw new Error(`redirect:${url}`); }); });

  it("未ログインは署名せずログインへ戻す", async () => {
    const db = client(); db.auth.getUser.mockResolvedValue({ data: { user: null }, error: null });
    await expect(loadSlideDecks()).rejects.toThrow("redirect:/login?returnTo=%2Fsystem%2Fdocs%2Fslides");
    expect(db.from).not.toHaveBeenCalled(); expect(mocks.getSupabaseAdmin).not.toHaveBeenCalled();
  });

  it("一覧は表示する3本の表紙だけを1時間で署名する", async () => {
    const db = client(); const result = await loadSlideDecks();
    expect(result.map(deck => deck.id)).toEqual(["01-orientation", "03-refresh-time", "04-sales-guide"]);
    expect(result.map(deck => deck.slideCount)).toEqual([14, 10, 10]);
    expect(db.sign).toHaveBeenCalledTimes(3);
    expect(db.storage.from).toHaveBeenCalledWith("system-docs");
    for (const deck of result) expect(db.sign).toHaveBeenCalledWith(`slides/${deck.id}/s_01.webp`, 3600);
    expect(JSON.stringify(db.sign.mock.calls)).not.toContain("hidden-slide");
  });

  it("1本は承認済みデータの枚数ぶんだけ署名し、失敗した画像は飛ばす", async () => {
    const db = client();
    db.sign.mockImplementation(async (path: string) => path.endsWith("s_02.webp") ? { data: null, error: { message: "missing" } } : { data: { signedUrl: `https://example.com/${path}` }, error: null });
    const result = await loadSlideDeck("01-orientation");
    expect(result?.title).toBe("アルバイト入社オリエンテーション");
    expect(result?.slides).toHaveLength(13);
    expect(result?.slides.map(slide => slide.index)).not.toContain(2);
    expect(db.sign).toHaveBeenCalledWith("slides/01-orientation/s_14.webp", 3600);
  });

  it("未登録のidは認証後にundefinedを返し、利用者指定文字列で署名しない", async () => {
    const db = client(); const result = await loadSlideDeck("../secret");
    expect(result).toBeUndefined();
    expect(db.sign).not.toHaveBeenCalled();
  });
});
