import { beforeEach, expect, it, vi } from "vitest";
import seeds from "@/lib/product-points/initial-values.json";
import type { PointRow } from "@/lib/product-points";
import { savePoint } from "./actions";

const mocks = vi.hoisted(() => ({
  context: vi.fn(),
  load: vi.fn(),
  rpc: vi.fn(),
}));
vi.mock("./server", () => ({
  productPointsContext: mocks.context,
  loadPoints: mocks.load,
}));
const row = {
  ...seeds[0],
  id: "source",
  channel: "hakuchi",
  start_date: "2026-11-01",
  end_date: null,
  closer_points: 1,
  updated_at: "2026-11-12T00:00:00.000001Z",
  updated_by: null,
  note: null,
} as PointRow;

beforeEach(() => {
  vi.clearAllMocks();
  mocks.context.mockResolvedValue({
    db: { rpc: mocks.rpc },
    employee: { userId: "actor" },
  });
  mocks.load.mockResolvedValue([row]);
});

it("権限エラーのとき書き込みを呼ばない", async () => {
  mocks.context.mockRejectedValue(new Error("変更できるのは全権管理者です。"));
  expect((await savePoint(row, row.id, row.updated_at, false)).error).toContain(
    "全権管理者",
  );
  expect(mocks.rpc).not.toHaveBeenCalled();
});

it("過去の更新時刻では上書きしない", async () => {
  expect((await savePoint(row, row.id, "2026-11-01", false)).error).toContain(
    "別の変更",
  );
  expect(mocks.rpc).not.toHaveBeenCalled();
});

it("切り替えはDB関数を1回だけ呼び、本人と対象行を渡す", async () => {
  mocks.rpc.mockResolvedValue({
    data: [
      { ...row, end_date: "2026-11-14" },
      { ...row, id: "new", start_date: "2026-11-15" },
    ],
    error: null,
  });
  const result = await savePoint(
    { ...row, id: "new", start_date: "2026-11-15" },
    row.id,
    row.updated_at,
    true,
  );
  expect(result.rows).toHaveLength(2);
  expect(mocks.context).toHaveBeenCalledWith(true);
  expect(mocks.rpc).toHaveBeenCalledOnce();
  expect(mocks.rpc).toHaveBeenCalledWith(
    "soil_product_points_save",
    expect.objectContaining({
      p_actor: "actor",
      p_source_id: row.id,
      p_split: true,
    }),
  );
});

it("並行保存による重複も日本語で知らせる", async () => {
  mocks.rpc.mockResolvedValue({ data: null, error: { code: "23P01" } });
  const result = await savePoint(
    { ...row, total_points: 2 },
    row.id,
    row.updated_at,
    false,
  );
  expect(result.error).toContain("期間が重なっています");
});
