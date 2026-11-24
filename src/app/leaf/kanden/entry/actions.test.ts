import { expect, it, vi } from "vitest";
import { loadEntryDetail } from "./actions";
import type { EntryRecord } from "./entry";
import { readEntryHistory, readEntryListValues, readEntryPhotos, readEntryRecord, requireEntry, signEntryPhotos } from "./queries.server";

vi.mock("./queries.server", () => ({
  requireEntry: vi.fn(), readEntryHistory: vi.fn(), readEntryListValues: vi.fn(), readEntryPhotos: vi.fn(),
  readEntryRecord: vi.fn(), signEntryPhotos: vi.fn(),
}));
vi.mock("@/lib/relay/monitor.server", () => ({ sendGardenNotice: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ getSupabaseAdmin: vi.fn() }));

it("選択IDの詳細・変更履歴・入金明細・写メを1回の応答で返す", async () => {
  const target = { id: "1eaf0000-0000-0000-0000-000000000544", intake: false };
  const payments = [{ pd_row_no: "123", statement_month: "2026-11", amount: 1000, source_file: null }];
  const history = [{ id: 1, changed_at: "2026-11-20T00:00:00Z", changed_by: "staff",
    field: "invoice_sent_on", old_value: null, new_value: "2026-11-20" }];
  const photos = [{ category: "諸元", url: "https://example.test/photo", filename: "photo.jpg", jpeg: true, id: "photo", setId: "set" }];
  vi.mocked(readEntryRecord).mockResolvedValue({ intake: null, order: {
    id: target.id, kanri_no: "1504115", mailed_on: "2026-11-18", invoice_sent_on: "2026-11-20",
    paid_on: "2026-11-20", leaf_kanden_payments: payments,
  } as EntryRecord });
  vi.mocked(readEntryHistory).mockResolvedValue(history);
  const listValues = { customer_name: "テスト用リスト" };
  vi.mocked(readEntryListValues).mockResolvedValue(listValues);
  vi.mocked(readEntryPhotos).mockResolvedValue([{ image_path: "photo.jpg", category: "諸元", id: "photo", set_id: "set" }]);
  vi.mocked(signEntryPhotos).mockResolvedValue(photos);

  expect(await loadEntryDetail(target)).toMatchObject({ detail: { status: "完了", history, payments, photos, listValues,
    draft: { mailed_on: "2026-11-18", invoice_sent_on: "2026-11-20" } } });
  expect(requireEntry).toHaveBeenCalledTimes(1);
  expect(readEntryRecord).toHaveBeenCalledExactlyOnceWith(target);
  expect(readEntryHistory).toHaveBeenCalledExactlyOnceWith(target.id);
  expect(readEntryListValues).toHaveBeenCalledExactlyOnceWith("1504115");
  expect(readEntryPhotos).toHaveBeenCalledExactlyOnceWith("1504115", undefined, false, target.id);
});
