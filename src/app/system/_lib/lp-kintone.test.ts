import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const getRecords = vi.fn();
const getAllRecords = vi.fn();
vi.mock("@/lib/kintone/records", () => ({
  getRecords: (...args: unknown[]) => getRecords(...args),
  getAllRecords: (...args: unknown[]) => getAllRecords(...args),
}));

import { loadLpCustomerOrderCounts, countLpRegisteredRecords, countLpApplications, loadLpCustomerRecords, loadLpScope, type LpCustomerRecord } from "./lp-kintone";

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

describe("登録日基準の配信集計", () => {
  const record = (status: string | null, createdAt = "2026-10-13T01:00:00Z"): LpCustomerRecord => ({ id: "1", status, createdAt, assignee: null, source: null, slot: [], phones: {} });
  it("重複と期間外を除きJSTの両端を含む", () => {
    const records = ["前確待ち", "前確待ち", "申込み", "申込み", "申込み", "申込み", "重複", "対象外（現アナ等）", "対象外（契約不可）", "その他"].map(status => record(status));
    records[0].createdAt = "2026-10-12T15:00:00Z";
    records[1].createdAt = "2026-10-13T14:59:59.999Z";
    records.push(record("申込み", "2026-10-12T14:59:59.999Z"), record("申込み", "2026-10-13T15:00:00Z"), record("申込み", "invalid"), { ...record("申込み"), createdAt: null });
    expect(countLpRegisteredRecords(records, "2026-10-13", "2026-10-13")).toEqual({ denominator: 9, preconfirmWaiting: 2, applications: 4, won: 6, excluded: 2 });
    expect([...countLpApplications(records, "2026-10-13", "2026-10-13")!.values()].reduce((a,b) => a+b,0)).toBe(4);
  });
  it("対象外3種と空欄を扱い、0件と取得失敗を区別する", () => {
    expect(countLpRegisteredRecords([record("対象外（連絡つかず）"), record(null)], "2026-10-13", "2026-10-13")).toMatchObject({ denominator: 2, excluded: 1 });
    expect(countLpRegisteredRecords([record("重複")], "2026-10-13", "2026-10-13")).toEqual({ denominator: 0, preconfirmWaiting: 0, applications: 0, won: 0, excluded: 0 });
    expect(countLpRegisteredRecords(null, "2026-10-13", "2026-10-13")).toBeNull();
  });
});


describe("顧客一覧の受注日集計", () => {
  afterEach(() => vi.unstubAllEnvs());
  const scope = [
    { bizCode: "hikari", bizName: "ヒカリのプロ", customerApp: 226, circuitIds: [], recordOrder: 1 },
    { bizCode: "denki", bizName: "電気開始受付センター", customerApp: 235, circuitIds: [], recordOrder: 2 },
  ];
  it("リスト名の完全一致と受注日の期間で数える", async () => {
    vi.stubEnv("KINTONE_KANRI_CUSTOMER_TOKEN", "orders-token");
    getAllRecords.mockReset();
    const row = (name: string, day: string) => ({ B_リスト名: v(name), 受注日: v(day) });
    getAllRecords.mockResolvedValue([
      row(" WEB_ヒカリのプロ　", "2026-10-16"), row("WEB_ヒカリのプロ", "2026-10-17"),
      row("WEB_電気開始受付センター", "2026-10-16"),
      row("WEB_ヒカリのプロ", "2026-10-15"), row("WEB_ヒカリのプロ", "2026-10-18"),
      row("WEB_ヒカリのプロ別事業", "2026-10-16"), row("ヒカリのプロ", "2026-10-16"), row("WEB_ヒカリのプロ", ""),
    ]);
    expect(await loadLpCustomerOrderCounts(scope, "2026-10-16", "2026-10-17")).toEqual(new Map([["hikari", 2], ["denki", 1]]));
    expect(getAllRecords).toHaveBeenCalledWith(10, "orders-token", 'B_リスト名 like "WEB_" and 受注日 >= "2026-10-16" and 受注日 <= "2026-10-17"', ["$id", "B_リスト名", "受注日"]);
    expect(await loadLpCustomerOrderCounts(scope, "2026-10-17", "2026-10-17")).toEqual(new Map([["hikari", 1], ["denki", 0]]));
  });
  it("取得失敗・鍵なしは null、取得成功の0件は0", async () => {
    getAllRecords.mockReset();
    vi.stubEnv("KINTONE_KANRI_CUSTOMER_TOKEN", "");
    expect(await loadLpCustomerOrderCounts(scope, "2026-10-16", "2026-10-16")).toBeNull();
    expect(getAllRecords).not.toHaveBeenCalled();
    vi.stubEnv("KINTONE_KANRI_CUSTOMER_TOKEN", "orders-token");
    getAllRecords.mockRejectedValue(new Error("unavailable"));
    expect(await loadLpCustomerOrderCounts(scope, "2026-10-16", "2026-10-16")).toBeNull();
    getAllRecords.mockResolvedValue([]);
    expect(await loadLpCustomerOrderCounts(scope, "2026-10-16", "2026-10-16")).toEqual(new Map([["hikari", 0], ["denki", 0]]));
  });
});
