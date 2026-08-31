import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({ createServerClient: vi.fn(), getSupabaseAdmin: vi.fn(), redirect: vi.fn() }));
vi.mock("@/app/_lib/supabase/server", () => ({ createServerClient: mocks.createServerClient }));
vi.mock("@/lib/supabase/admin", () => ({ getSupabaseAdmin: mocks.getSupabaseAdmin }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
import { loadCompanyMembers, requireDocsUser } from "./company-doc.server";
import DocsPage from "../page";
import CompanyPage from "../company/page";
import OrientationPage from "@/app/(orientation)/system/docs/company/present/page";

function client() {
  const query = { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), is: vi.fn().mockReturnThis(), maybeSingle: vi.fn().mockResolvedValue({ data: { employee_id: "EMP-0001" }, error: null }) };
  const sign = vi.fn().mockImplementation(async (path: string) => ({ data: { signedUrl: `https://example.com/${path}?signed=1` }, error: null }));
  const db = { auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "U1" } }, error: null }) }, from: vi.fn().mockReturnValue(query), query, storage: { from: vi.fn().mockReturnValue({ createSignedUrl: sign }) }, sign };
  mocks.getSupabaseAdmin.mockReturnValue(db);
  return db;
}

describe("資料の認証と非公開写真", () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.redirect.mockImplementation((url: string) => { throw new Error(`redirect:${url}`); }); });
  it.each([DocsPage, CompanyPage, OrientationPage])("未ログインはデータと署名の出力前にリダイレクト", async Page => {
    const db = client(); db.auth.getUser.mockResolvedValue({ data: { user: null }, error: null }); mocks.createServerClient.mockResolvedValue(db);
    await expect(Page()).rejects.toThrow("redirect:/login?returnTo=%2Fsystem%2Fdocs");
    expect(db.from).not.toHaveBeenCalled(); expect(db.sign).not.toHaveBeenCalled();
    expect(mocks.getSupabaseAdmin).not.toHaveBeenCalled();
  });
  it("オリエンテーション表示は在籍確認を通過するまで署名せず、ログイン後の戻り先を維持する", async () => {
    const db = client(); db.query.maybeSingle.mockResolvedValue({ data: null, error: null }); mocks.createServerClient.mockResolvedValue(db);
    await expect(OrientationPage()).rejects.toThrow("redirect:/login?returnTo=%2Fsystem%2Fdocs%2Fcompany%2Fpresent");
    expect(db.query.eq).toHaveBeenCalledWith("is_active", true);
    expect(db.query.is).toHaveBeenCalledWith("deleted_at", null);
    expect(mocks.getSupabaseAdmin).not.toHaveBeenCalled();
  });
  it("退職・削除・未登録の利用者は拒否する", async () => {
    const db = client(); db.query.maybeSingle.mockResolvedValue({ data: null, error: null }); mocks.createServerClient.mockResolvedValue(db);
    await expect(loadCompanyMembers()).rejects.toThrow("redirect:");
    expect(db.query.eq).toHaveBeenCalledWith("is_active", true);
    expect(db.query.is).toHaveBeenCalledWith("deleted_at", null);
    expect(db.sign).not.toHaveBeenCalled();
    expect(mocks.getSupabaseAdmin).not.toHaveBeenCalled();
  });
  it("認証成功でも従業員照会エラーは拒否する", async () => {
    const db = client(); db.query.maybeSingle.mockResolvedValue({ data: null, error: { message: "failed" } }); mocks.createServerClient.mockResolvedValue(db);
    await expect(requireDocsUser()).rejects.toThrow("redirect:");
  });
  it("在籍者の認証後、サーバー側で表示対象12名のみ1時間のURLを発行する", async () => {
    const db = client(); mocks.createServerClient.mockResolvedValue(db);
    const result = await loadCompanyMembers();
    expect(result.members).toHaveLength(12);
    expect(Object.keys(result.photos)).toHaveLength(12);
    expect(db.storage.from).toHaveBeenCalledWith("system-docs");
    expect(db.sign.mock.calls.every(([, seconds]) => seconds === 3600)).toBe(true);
    const paths = db.sign.mock.calls.map(([path]) => path);
    expect(paths).toContain("company/members/goto-shota.webp");
    for (const id of ["tsuji-mayuko", "matsumoto-minari"]) expect(paths.join()).not.toContain(id);
  });
  it("署名エラーと例外を写真単位で無視し本文を返す", async () => {
    const db = client(); mocks.createServerClient.mockResolvedValue(db);
    db.sign.mockResolvedValueOnce({ data: null, error: { message: "not found" } }).mockRejectedValueOnce(new Error("network"));
    const result = await loadCompanyMembers();
    expect(result.members).toHaveLength(12); expect(Object.keys(result.photos)).toHaveLength(10);
  });
  it("資料入口は会社説明を維持し、線画アイコンの動画カードを追加する", async () => {
    mocks.createServerClient.mockResolvedValue(client());
    render(await DocsPage());
    const links = screen.getAllByRole("link"); expect(links).toHaveLength(2);
    expect(links[0]).toHaveAttribute("href", "/system/docs/company");
    expect(screen.getByText(/2026年8月31日/)).toBeInTheDocument();
    expect(links[1]).toHaveAttribute("href", "/system/docs/videos");
    expect(links[1].querySelector('svg[fill="none"][stroke="currentColor"]')).not.toBeNull();
    expect(links[1].textContent).not.toMatch(/\p{Extended_Pictographic}/u);
  });
});
