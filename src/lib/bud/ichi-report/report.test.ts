// @vitest-environment node
import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { billingMonths, extractReport, object, perPerson, profit, ratio, updatedDate } from "./model";
import { readSnapshot, type Snapshot, type Store } from "./snapshot";
const html = readFileSync("src/lib/bud/ichi-report/__fixtures__/report.html", "utf8");
const data = extractReport(html);
const now = new Date("2026-11-12T00:00:00Z");
const saved: Snapshot = { deployment_id: "old", data, updated: String(data.updated), fetched_at: "2026-11-11T00:00:00Z", checked_at: "2026-11-11T00:00:00Z", failed: false };
const setup = (previous: Snapshot | null = saved) => {
  const store: Store = { read: vi.fn().mockResolvedValue(previous), save: vi.fn().mockResolvedValue(undefined) };
  const request = vi.fn<typeof fetch>();
  return { store, request };
};
const response = (value: unknown) => new Response(JSON.stringify(value), { status: 200 });
describe("報告の読み取り", () => {
  it("script の中の JSON だけを読み、コードを実行しない", () => {
    expect(data.updated).toBe("2026年11月11日 12:33");
    expect(() => extractReport("const D = {};" )).toThrow();
    expect(() => extractReport("<script>const D = {bad};</script>")).toThrow();
    expect(() => extractReport("<script>const D = {}; const D = {};</script>")).toThrow();
    expect(extractReport('<script>const D = {"updated":"別の形","unknown":3}; throw new Error();</script>')).toEqual({ updated: "別の形", unknown: 3 });
  });
  it("元の見本の全請求月について計算式・入金率・1人あたりが一致する", () => {
    const expected = JSON.parse(readFileSync("src/lib/bud/ichi-report/__fixtures__/expected.json", "utf8"));
    for (const r of billingMonths(data)) {
      expect(profit(r), String(r.bm)).toEqual(expected[String(r.bm)].profit);
      expect(ratio(object(r["合計"]).paid, object(r["合計"]).amt)).toBe(expected[String(r.bm)].rate);
      expect(perPerson(object(r["合計"]))).toBe(expected[String(r.bm)].perPerson);
    }
  });
  it("不足した数値をゼロにせず、壊れた形でも落ちない", () => {
    expect(profit({ cost: [] }).op).toBeNull();
    expect(perPerson({ amt: 100, n: 0 })).toBeNull();
    expect(ratio("1", 2)).toBeNull();
    expect(billingMonths({ billing: { months: [null, { "合計": "bad" }] } })).toEqual([]);
    expect(updatedDate(data.updated)).toBe("2026-11-11T12:33:00+09:00");
  });
});
describe("最新の確認と保存", () => {
  it("同じ配備ならファイルを読み直さず、確認日時だけ保存する", async () => {
    const { store, request } = setup();
    request.mockResolvedValue(response({ deployments: [{ uid: "old" }] }));
    const result = await readSnapshot(store, "test-token", false, request, now);
    expect(request).toHaveBeenCalledTimes(1);
    expect(request.mock.calls[0][0]).toContain("target=production&state=READY&limit=1&teamId=");
    expect(result.warning).toBe(false);
    expect(store.save).toHaveBeenCalledWith({ ...saved, checked_at: now.toISOString() });
  });
  it("10分以内は問い合わせず、手動更新は最新の配備を確かめる", async () => {
    const { store, request } = setup({ ...saved, checked_at: now.toISOString() });
    await readSnapshot(store, "test-token", false, request, now);
    expect(request).not.toHaveBeenCalled();
    request.mockResolvedValue(response({ deployments: [{ uid: "old" }] }));
    await readSnapshot(store, "test-token", true, request, now);
    expect(request).toHaveBeenCalledTimes(1);
  });
  it("新しい配備のツリーと base64 を読んで保存する", async () => {
    const { store, request } = setup();
    request.mockResolvedValueOnce(response({ deployments: [{ uid: "new" }] }))
      .mockResolvedValueOnce(response([{ name: "src", children: [{ name: "data", children: [{ name: "report.html", uid: "file" }] }] }]))
      .mockResolvedValueOnce(response({ encoding: "base64", data: Buffer.from(html).toString("base64") }));
    const result = await readSnapshot(store, "test-token", false, request, now);
    expect(result.snapshot?.data).toEqual(data);
    expect(result.snapshot?.deployment_id).toBe("new");
    expect(store.save).toHaveBeenCalledTimes(1);
  });
  it("実際の Vercel の返事（encoding なし・data だけ）でも読める", async () => {
    const { store, request } = setup();
    request.mockResolvedValueOnce(response({ deployments: [{ uid: "new" }] }))
      .mockResolvedValueOnce(response([{ name: "src", children: [{ name: "data", children: [{ name: "report.html", uid: "file" }] }] }]))
      .mockResolvedValueOnce(response({ data: Buffer.from(html).toString("base64") }));
    const result = await readSnapshot(store, "test-token", false, request, now);
    expect(result.warning).toBe(false);
    expect(result.snapshot?.data).toEqual(data);
  });
  it("接続障害時は最後の内容を残し、失敗の通知も10分間残す", async () => {
    const { store, request } = setup();
    request.mockRejectedValue(new Error("offline"));
    const result = await readSnapshot(store, "test-token", false, request, now);
    expect(result.warning).toBe(true);
    expect(result.snapshot?.data).toEqual(data);
    expect(result.snapshot?.fetched_at).toBe(saved.fetched_at);
    const next = setup(result.snapshot);
    expect((await readSnapshot(next.store, "test-token", false, next.request, now)).warning).toBe(true);
    expect(next.request).not.toHaveBeenCalled();
  });
  it("鍵なし・不正形式・保存失敗で既存内容を置き換えない", async () => {
    const { store, request } = setup();
    expect((await readSnapshot(store, undefined, false, request, now)).warning).toBe(true);
    expect(request).not.toHaveBeenCalled();
    request.mockResolvedValue(response({ deployments: [] }));
    expect((await readSnapshot(store, "test-token", false, request, now)).snapshot?.data).toEqual(data);
    request.mockResolvedValue(response({ deployments: [{ uid: "old" }] }));
    vi.mocked(store.save).mockRejectedValue(new Error("storage unavailable"));
    expect((await readSnapshot(store, "test-token", false, request, now)).snapshot?.data).toEqual(data);
    const empty = setup(null);
    empty.request.mockRejectedValue(new Error("offline"));
    expect(await readSnapshot(empty.store, "test-token", false, empty.request, now)).toEqual({ snapshot: null, warning: true });
  });
});
