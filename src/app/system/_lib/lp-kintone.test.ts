import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const getRecords = vi.fn();
const getAllRecords = vi.fn();
vi.mock("@/lib/kintone/records", () => ({
  getRecords: (...args: unknown[]) => getRecords(...args),
  getAllRecords: (...args: unknown[]) => getAllRecords(...args),
}));

import { countLpApplications, loadLpCustomerRecords, loadLpScope, type LpCustomerRecord } from "./lp-kintone";

const v = (value: unknown) => ({ value });

describe("loadLpScope（kintone 239 事業マスタ）", () => {
  beforeEach(() => {
    process.env.KINTONE_LP_BIZ_MASTER_TOKEN = "token-239";
    getRecords.mockReset();
  });
  afterEach(() => {
    delete process.env.KINTONE_LP_BIZ_MASTER_TOKEN;
  });

  it("稼働中の事業を読み、回線 ID は子テーブル lines の circuit_id から取る", async () => {
    getRecords.mockResolvedValue([
      {
        $id: v("1"),
        biz_code: v("hikari-pro"),
        biz_name: v("ヒカリのプロ"),
        customer_app: v("226"),
        lines: v([{ value: { circuit_id: v("164") } }, { value: { circuit_id: v("165") } }]),
      },
      {
        $id: v("2"),
        biz_code: v("denki-uketsuke"),
        biz_name: v("電気開始受付センター"),
        customer_app: v("235"),
        lines: v([{ value: { circuit_id: v("166") } }, { value: { circuit_id: v("133") } }]),
      },
    ]);
    const scope = await loadLpScope();
    expect(getRecords).toHaveBeenCalledTimes(1);
    const [app, token, query, fields] = getRecords.mock.calls[0];
    expect(app).toBe(239);
    expect(token).toBe("token-239");
    expect(String(query)).toContain('status in ("稼働中")');
    expect(fields).toContain("lines");
    expect(scope).toEqual([
      { bizCode: "hikari-pro", bizName: "ヒカリのプロ", customerApp: 226, circuitIds: [164, 165], recordOrder: 1 },
      { bizCode: "denki-uketsuke", bizName: "電気開始受付センター", customerApp: 235, circuitIds: [166, 133], recordOrder: 2 },
    ]);
  });

  it("鍵が無いときは null", async () => {
    delete process.env.KINTONE_LP_BIZ_MASTER_TOKEN;
    expect(await loadLpScope()).toBeNull();
    expect(getRecords).not.toHaveBeenCalled();
  });
});

describe("loadLpCustomerRecords（顧客アプリ）", () => {
  beforeEach(() => {
    process.env.KINTONE_HIKARI_PRO_TOKEN = "token-226";
    process.env.KINTONE_DENKI_START_TOKEN = "token-235";
    getAllRecords.mockReset();
  });
  afterEach(() => {
    delete process.env.KINTONE_HIKARI_PRO_TOKEN;
    delete process.env.KINTONE_DENKI_START_TOKEN;
    vi.useRealTimers();
  });

  it("235 だけ対応状況の項目コードが status", async () => {
    getAllRecords.mockResolvedValue([
      { $id: v("10"), 作成日時: v("2026-10-13T01:00:00Z"), status: v("申込み"), 対応担当者: v("藤木　誠希"), source: v("HP"), slot: v([]), phone: v("09011112222") },
    ]);
    const rows = await loadLpCustomerRecords(235);
    const [app, token, , fields] = getAllRecords.mock.calls[0];
    expect(app).toBe(235);
    expect(token).toBe("token-235");
    expect(fields).toContain("status");
    expect(fields).not.toContain("対応状況");
    expect(rows?.[0]).toMatchObject({ id: "10", status: "申込み", assignee: "藤木　誠希" });
  });

  it("226 は対応状況", async () => {
    getAllRecords.mockResolvedValue([]);
    await loadLpCustomerRecords(226);
    const [, , , fields] = getAllRecords.mock.calls[0];
    expect(fields).toContain("対応状況");
  });

  it("1 回失敗したら 3 秒後にやり直し、それでも失敗なら null", async () => {
    vi.useFakeTimers();
    getAllRecords.mockRejectedValue(new Error("kintone_500"));
    const promise = loadLpCustomerRecords(226);
    await vi.advanceTimersByTimeAsync(3000);
    expect(await promise).toBeNull();
    expect(getAllRecords).toHaveBeenCalledTimes(2);
  });

  it("対応表に無いアプリは null", async () => {
    expect(await loadLpCustomerRecords(999)).toBeNull();
  });
});

describe("countLpApplications（LP申込み）", () => {
  const record = (overrides: Partial<LpCustomerRecord>): LpCustomerRecord => ({
    id: "1",
    createdAt: "2026-10-13T01:00:00Z",
    status: "申込み",
    assignee: "石原　孝志朗",
    source: "HP",
    slot: [],
    phones: {},
    ...overrides,
  });

  it("対応状況＝申込み かつ 受付日が期間内（JST）を担当者ごとに数える", () => {
    const counts = countLpApplications([
      record({ id: "1" }),
      record({ id: "2", assignee: "石原 孝志朗" }),
      record({ id: "3", status: "見送り" }),
      record({ id: "4", createdAt: "2026-10-12T14:30:00Z" }), // JST 10/12 23:30 ＝期間外
      record({ id: "5", createdAt: "2026-10-12T15:30:00Z" }), // JST 10/13 00:30 ＝期間内
      record({ id: "6", assignee: "-" }),
      record({ id: "7", assignee: null }),
    ], "2026-10-13", "2026-10-13");
    expect(counts?.get("石原孝志朗")).toBe(3);
    expect(counts?.get("担当者未設定")).toBe(2);
    expect(counts?.has("-")).toBe(false);
  });

  it("読めなかったとき（null）はそのまま null", () => {
    expect(countLpApplications(null, "2026-10-13", "2026-10-13")).toBeNull();
  });
});
