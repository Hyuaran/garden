// @vitest-environment node
import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  context: vi.fn(),
  load: vi.fn(),
  save: vi.fn(),
  pdf: vi.fn(),
  insert: vi.fn(),
}));
vi.mock("@/lib/haken/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/haken/server")>()),
  hakenContext: mocks.context,
  loadHakenData: mocks.load,
}));
vi.mock("@/lib/haken/haken-drive.server", () => ({
  saveHakenPdf: mocks.save,
  validateHakenPdf: vi.fn(),
}));
vi.mock("@/lib/haken/haken-pdf.server", () => ({
  generateHakenPdf: mocks.pdf,
}));
import { POST } from "./route";
import { HakenError } from "@/lib/haken/server";
beforeEach(() => {
  vi.clearAllMocks();
  mocks.context.mockResolvedValue({
    db: { from: () => ({ insert: mocks.insert }) },
  });
  mocks.insert.mockResolvedValue({ data: null, error: null });
  mocks.load.mockResolvedValue({
    parties: [{ id: "p", name: "A社", issue_defaults: { office_id: "o" } }],
    offices: [{ id: "o", company_id: "c" }],
    contracts: [],
    companies: [{ company_id: "c", company_name: "法人A" }],
  });
  mocks.pdf.mockResolvedValue(Buffer.from("%PDF-test"));
});
const request = () =>
  new Request("https://example.test/api/system/haken/documents", {
    method: "POST",
    body: JSON.stringify({
      party_id: "p",
      doc_type: "reply",
      start: "2026-09-11",
      end: "2026-12-31",
      issued_on: "2026-09-07",
    }),
  });
it("保存が失敗してもPDFを渡し、発行履歴と画面用のエラーを残す", async () => {
  mocks.save.mockRejectedValue(new Error("保存先なし"));
  const response = await POST(request());
  expect(response.status).toBe(200);
  expect(await response.text()).toBe("%PDF-test");
  expect(
    decodeURIComponent(response.headers.get("X-Haken-Warning")!),
  ).toContain("保存できませんでした");
  expect(mocks.insert).toHaveBeenCalledWith(
    expect.objectContaining({
      document_status: "issued",
      save_error: expect.any(String),
      drive_file_id: null,
    }),
  );
});
it("権限が無い場合は403、書類も保存も呼ばない", async () => {
  mocks.context.mockRejectedValue(new HakenError("権限がありません", 403));
  expect((await POST(request())).status).toBe(403);
  expect(mocks.pdf).not.toHaveBeenCalled();
  expect(mocks.save).not.toHaveBeenCalled();
});
