import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({ createServerClient: vi.fn(), getSupabaseAdmin: vi.fn(), redirect: vi.fn() }));
vi.mock("@/app/_lib/supabase/server", () => ({ createServerClient: mocks.createServerClient }));
vi.mock("@/lib/supabase/admin", () => ({ getSupabaseAdmin: mocks.getSupabaseAdmin }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
import { loadHikariBasicsFigures } from "./hikari-basics.server";

function client() {
  const query = { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), is: vi.fn().mockReturnThis(), maybeSingle: vi.fn().mockResolvedValue({ data: { employee_id: "EMP-0001" }, error: null }) };
  const sign = vi.fn().mockImplementation(async (path: string) => ({ data: { signedUrl: `https://example.com/${path}?signed=1` }, error: null }));
  const db = { auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "U1" } }, error: null }) }, from: vi.fn().mockReturnValue(query), query, storage: { from: vi.fn().mockReturnValue({ createSignedUrl: sign }) }, sign };
  mocks.createServerClient.mockResolvedValue(db);
  mocks.getSupabaseAdmin.mockReturnValue(db);
  return db;
}

describe("光回線・通信の基礎の挿絵", () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.redirect.mockImplementation((url: string) => { throw new Error(`redirect:${url}`); }); });

  it("在籍者の認証後、8枚の挿絵だけを1時間で署名する", async () => {
    const db = client();
    const result = await loadHikariBasicsFigures();
    expect(result).toHaveLength(8);
    expect(db.storage.from).toHaveBeenCalledWith("system-docs");
    expect(db.sign).toHaveBeenCalledTimes(8);
    expect(db.sign.mock.calls.every(([, seconds]) => seconds === 3600)).toBe(true);
    expect(db.sign).toHaveBeenCalledWith("docs/hikari-basics/01.webp", 3600);
    expect(db.sign).toHaveBeenCalledWith("docs/hikari-basics/08.webp", 3600);
  });

  it("署名できなかった挿絵は飛ばして本文側に返す", async () => {
    const db = client();
    db.sign.mockImplementation(async (path: string) => path.endsWith("02.webp")
      ? { data: null, error: { message: "missing" } }
      : { data: { signedUrl: `https://example.com/${path}` }, error: null });
    const result = await loadHikariBasicsFigures();
    expect(result).toHaveLength(7);
    expect(result.map(figure => figure.id)).not.toContain("02");
  });
});
