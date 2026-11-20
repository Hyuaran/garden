import { beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  canView: vi.fn(), from: vi.fn(), order: vi.fn(), range: vi.fn(), createSignedUrls: vi.fn(),
}));

vi.mock("@/lib/auth/view-permission.server", () => ({
  canView: mocks.canView,
  viewPermissionContext: async () => ({ viewer: { role: "manager" } }),
}));
vi.mock("@/lib/supabase/admin", () => ({
  getSupabaseAdmin: () => ({
    from: mocks.from,
    storage: { from: () => ({ createSignedUrls: mocks.createSignedUrls }) },
  }),
}));

import { loadCaseDetail } from "./actions";

const id = "f4f67f1b-c670-418c-a8a8-3a8be61cbeda";

beforeEach(() => {
  vi.resetAllMocks();
  mocks.canView.mockResolvedValue(true);
  mocks.order.mockReturnThis();
  const photos = { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), order: mocks.order, range: mocks.range };
  mocks.from.mockImplementation((table: string) => table === "leaf_kanden_photos" ? photos : {
    select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(),
    maybeSingle: async () => ({ data: { kanri_no: "123", customer_name: "山田" } }),
  });
});

it("閲覧権限を確認してから写メ用の署名 URL をまとめて発行する", async () => {
  mocks.range.mockResolvedValue({ data: [{ image_path: "a.jpg" }, { image_path: "b.PDF" }, { image_path: "c.png" }] });
  mocks.createSignedUrls.mockResolvedValue({ data: [
    { path: "a.jpg", signedUrl: "https://example.test/a" },
    { path: "c.png", signedUrl: "https://example.test/c" },
  ] });
  await expect(loadCaseDetail(id)).resolves.toEqual({
    detail: { customer_name: "山田" },
    photos: [
      { url: "https://example.test/a", filename: "123_1.jpg", jpeg: true },
      { url: "https://example.test/c", filename: "123_2.jpg", jpeg: false },
    ],
  });
  expect(mocks.canView).toHaveBeenCalledWith("leaf-kanden", "", { role: "manager" });
  expect(mocks.order).toHaveBeenNthCalledWith(1, "event_date", { nullsFirst: false });
  expect(mocks.order).toHaveBeenNthCalledWith(2, "image_path");
  expect(mocks.createSignedUrls).toHaveBeenCalledExactlyOnceWith(["a.jpg", "c.png"], 3600);
});

it("閲覧権限がなければ受注と写メを読み込まない", async () => {
  mocks.canView.mockResolvedValue(false);
  await expect(loadCaseDetail(id)).resolves.toEqual({ error: "閲覧権限がありません。" });
  expect(mocks.from).not.toHaveBeenCalled();
});

it("署名の失敗時も案件の詳細を返す", async () => {
  mocks.range.mockResolvedValue({ data: [{ image_path: "a.jpg" }] });
  mocks.createSignedUrls.mockResolvedValue({ data: [{ error: "not found" }] });
  await expect(loadCaseDetail(id)).resolves.toMatchObject({
    detail: { customer_name: "山田" }, photos: [], photoError: expect.stringContaining("写メを読み込めませんでした"),
  });
});
