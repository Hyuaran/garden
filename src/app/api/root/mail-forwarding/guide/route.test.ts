// @vitest-environment node
import { beforeEach, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ rpc: vi.fn(), row: vi.fn(), download: vi.fn(), admin: vi.fn() }));
vi.mock("@/app/_lib/supabase/server", () => ({ createServerClient: async () => ({ rpc: m.rpc, from: () => ({ select: () => ({ eq: () => ({ maybeSingle: m.row }) }) }) }) }));
vi.mock("@/lib/supabase/admin", () => ({ getSupabaseAdmin: () => { m.admin(); return { storage: { from: () => ({ download: m.download }) } }; } }));
import { GET } from "./route";
const request = () => new Request("https://example.test/api/root/mail-forwarding/guide?id=12345678-1234-1234-1234-123456789abc");
beforeEach(() => { vi.clearAllMocks(); m.rpc.mockResolvedValue({ data: true }); m.row.mockResolvedValue({ data: { guide_path: "forwardings/a.png" } }); m.download.mockResolvedValue({ data: new Blob(["png"]) }); });
it("閲覧可能なら非公開PNGを返す", async () => {
  const response = await GET(request());
  expect(response.status).toBe(200);
  expect(response.headers.get("Content-Type")).toBe("image/png");
  expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  expect(await response.text()).toBe("png");
});
it("閲覧不可は403でStorageを読まない", async () => {
  m.rpc.mockResolvedValue({ data: false });
  expect((await GET(request())).status).toBe(403);
  expect(m.admin).not.toHaveBeenCalled();
});
it("画像の指定なし、画像なしは404", async () => {
  m.row.mockResolvedValue({ data: { guide_path: null } });
  expect((await GET(request())).status).toBe(404);
  expect(m.admin).not.toHaveBeenCalled();
  m.row.mockResolvedValue({ data: { guide_path: "missing.png" } });
  m.download.mockResolvedValue({ error: new Error("missing") });
  expect((await GET(request())).status).toBe(404);
});
