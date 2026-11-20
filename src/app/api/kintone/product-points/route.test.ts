import { expect, it, vi } from "vitest";
import { GET, OPTIONS } from "./route";

const { load } = vi.hoisted(() => ({ load: vi.fn() }));
vi.mock("@/lib/product-points/load-points", () => ({ loadPoints: load }));
vi.mock("@/lib/supabase/admin", () => ({ getSupabaseAdmin: () => ({}) }));

const origin = "https://9j11u0q829lg.cybozu.com";
const url = "https://garden-os.net/api/kintone/product-points";

it("OPTIONS と入力エラーに固定の CORS を返し、入力エラーで DB を読まない", async () => {
  expect(OPTIONS().status).toBe(204);
  expect(OPTIONS().headers.get("Access-Control-Allow-Origin")).toBe(origin);
  const invalid = await GET(new Request(url + "?date=2026-11-99"));
  expect(invalid.status).toBe(400);
  expect(invalid.headers.get("Access-Control-Allow-Origin")).toBe(origin);
  expect(invalid.headers.get("Cache-Control")).toBe("no-store");
  expect(load).not.toHaveBeenCalled();
});

it("失敗した読み取りは保持せず、並行リクエストでポイント表の取得を共有する", async () => {
  load.mockRejectedValueOnce(new Error("read error")).mockResolvedValueOnce([{
    product: "商材A", channel: "hakuchi", kintone_names: ["A"], total_points: 2,
    start_date: "2026-11-01", end_date: null, note: "内部メモ",
  }]);
  const request = new Request(url + "?" + new URLSearchParams({
    product: "A", business: "自社", date: "2026-11-20",
  }));
  expect((await GET(request)).status).toBe(503);
  const [first, second] = await Promise.all([GET(request), GET(request)]);
  expect(first.headers.get("Cache-Control")).toBe("public, s-maxage=300, stale-while-revalidate=600");
  expect(first.headers.get("Access-Control-Allow-Origin")).toBe(origin);
  expect(await first.json()).toEqual({ product: "商材A", channel: "hakuchi", points: 2 });
  expect(second.status).toBe(200);
  expect((await GET(request)).status).toBe(200);
  expect(load).toHaveBeenCalledTimes(2);
});
