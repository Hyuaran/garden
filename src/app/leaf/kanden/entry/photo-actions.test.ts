import { beforeEach, expect, it, vi } from "vitest";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type { EntryRecord } from "./entry";
import { saveEntryPhotoCategory } from "./photo-actions";
import { entryPhotoScope, readEntryRecord, requireEntry } from "./queries.server";

vi.mock("@/lib/supabase/admin", () => ({ getSupabaseAdmin: vi.fn() }));
vi.mock("./queries.server", () => ({ entryPhotoScope: vi.fn(), readEntryRecord: vi.fn(), requireEntry: vi.fn() }));

const target = { id: "1eaf0000-0000-0000-0000-000000000555", intake: false };
const photoId = "1eaf0000-0000-0000-0000-000000000556";
const setId = "1eaf0000-0000-0000-0000-000000000557";

beforeEach(() => vi.resetAllMocks());

it("閲覧できる案件の写真をセットと写真 ID で指定し、分類を一度だけ更新する", async () => {
  const scope = "kanri_no.eq.1617124";
  vi.mocked(readEntryRecord).mockResolvedValue({ order: { id: target.id, kanri_no: "1617124" } as EntryRecord, intake: null });
  vi.mocked(entryPhotoScope).mockResolvedValue(scope);
  const update = {
    update: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    or: vi.fn().mockReturnThis(),
    not: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: { id: photoId } }),
  };
  const from = vi.fn().mockReturnValue(update);
  vi.mocked(getSupabaseAdmin).mockReturnValue({ from } as unknown as ReturnType<typeof getSupabaseAdmin>);

  expect(await saveEntryPhotoCategory(target, photoId, setId, "諸元")).toEqual({});
  expect(requireEntry).toHaveBeenCalledTimes(1);
  expect(entryPhotoScope).toHaveBeenCalledExactlyOnceWith("1617124", undefined, target.id);
  expect(from).toHaveBeenCalledExactlyOnceWith("leaf_kanden_photos");
  expect(update.update).toHaveBeenCalledExactlyOnceWith({ category: "諸元" });
  expect(update.eq.mock.calls).toEqual([["id", photoId], ["set_id", setId]]);
  expect(update.or).toHaveBeenCalledExactlyOnceWith(scope);
  update.maybeSingle.mockResolvedValue({ data: null });
  expect(await saveEntryPhotoCategory(target, photoId, setId, "電灯")).toHaveProperty("error");
});

it("事務入力権限が無い場合は更新しない", async () => {
  vi.mocked(requireEntry).mockRejectedValue(new Error("denied"));
  expect(await saveEntryPhotoCategory(target, photoId, setId, "電灯")).toHaveProperty("error");
  expect(getSupabaseAdmin).not.toHaveBeenCalled();
});
