import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getAdmin: vi.fn(),
  getAllRecords: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({ getSupabaseAdmin: () => mocks.getAdmin() }));
vi.mock("@/lib/kintone/records", () => ({ getAllRecords: (...args: unknown[]) => mocks.getAllRecords(...args) }));

import { ORDER_FILEMAKER_FIELDS, orderRowsFromRecord, resolveOrderSource } from "../_lib/order-sync";
import { GET } from "./route";

describe("resolveOrderSource", () => {
  it("reads 顧客一覧 by default and 全案件一覧 only when both override values are set", () => {
    const base: Record<string, string | undefined> = { KINTONE_KANRI_CUSTOMER_APP_ID: "10", KINTONE_KANRI_CUSTOMER_TOKEN: "customer-token" };
    expect(resolveOrderSource(base)).toEqual({ appId: "10", token: "customer-token", source: "顧客一覧" });
    expect(resolveOrderSource({ ...base, KINTONE_ORDERS_SOURCE_APP_ID: "233" })).toMatchObject({ appId: "10", source: "顧客一覧" });
    expect(resolveOrderSource({ ...base, KINTONE_ORDERS_SOURCE_APP_ID: "233", KINTONE_ORDERS_SOURCE_TOKEN: "zenken-token" }))
      .toEqual({ appId: "233", token: "zenken-token", source: "全案件一覧" });
    expect(() => resolveOrderSource({})).toThrow("KINTONE_KANRI_CUSTOMER_APP_ID_missing");
  });
});

function kintoneRecord(id: string, phone = "", mobile = "") {
  return {
    レコード番号: { value: id },
    電話番号_ハイフンなし: { value: phone },
    携帯番号_ハイフンなし: { value: mobile },
    営業ID: { value: "E001" },
    チーム名: { value: "Aチーム" },
    商材名区分1: { value: "光" },
    商材名区分2: { value: "auひかり" },
    商流名: { value: "直販" },
    受注日: { value: "2026-09-10" },
    実績日: { value: "" },
    開通日: { value: "2026-09-20" },
    キャンセル日: { value: "" },
    申込者名_姓: { value: "申込姓" },
    申込者名_名: { value: "申込名" },
    申込者名_生年月日: { value: "1990-02-03" },
    連絡担当者名_姓: { value: "連絡姓" },
    連絡担当者名_名: { value: "連絡名" },
    連絡担当者名_生年月日: { value: "" },
    既契約者名_姓: { value: "既契約姓" },
    既契約者名_名: { value: "既契約名" },
    既契約者名_生年月日: { value: "1980-01-02" },
    携帯キャリア: { value: "docomo" },
    設置先_郵便番号: { value: "5300001" },
    設置先_住所_都道府県: { value: "大阪府" },
    設置先_住所_市町村: { value: "大阪市北区" },
    設置先_住所_町域: { value: "梅田" },
    設置先_住所_建物名: { value: "大阪ビル" },
    設置先_住所_部屋番号: { value: "101" },
  };
}

function request(secret = "secret") {
  return new Request("http://test/api/soil/list/orders/cron", { headers: { authorization: `Bearer ${secret}` } });
}

function adminClient() {
  const upserts: unknown[][] = [];
  const updates: Record<string, unknown>[] = [];
  const rpc = vi.fn(async (name: string, _args?: Record<string, unknown>) => {
    void _args;
    if (name === "soil_list_delete_missing_orders") return { data: [{ deleted_rows: 1, phones: ["0999999999"] }], error: null };
    if (name === "soil_list_refresh_phone_latest") return { data: [{ updated: 1 }], error: null };
    if (name === "soil_list_fill_phone_blanks_from_orders") return { data: [{ updated: 1 }], error: null };
    throw new Error(`Unexpected rpc: ${name}`);
  });
  return {
    upserts,
    updates,
    rpc,
    from(table: string) {
      if (table === "soil_list_order") {
        return {
          upsert: async (values: unknown[]) => {
            upserts.push(values);
            return { error: null };
          },
        };
      }
      if (table === "soil_list_order_sync_state") {
        return {
          update: (values: Record<string, unknown>) => ({
            eq: async () => {
              updates.push(values);
              return { error: null };
            },
          }),
        };
      }
      throw new Error(`Unexpected table: ${table}`);
    },
  };
}

describe("orderRowsFromRecord", () => {
  it("expands phone and mobile into two rows, stores 18 FileMaker fields, and skips records without phones", () => {
    const rows = orderRowsFromRecord(kintoneRecord("1", "06-1234-5678", "090-1111-2222"), "2026-09-11T00:00:00.000Z");
    expect(rows).toMatchObject([
      { 電話番号: "0612345678", 顧客一覧レコード番号: "1", 受注日: "2026-09-10", 既契約者名_姓: "既契約姓", 設置先_住所_建物名: "大阪ビル" },
      { 電話番号: "09011112222", 顧客一覧レコード番号: "1", 受注日: "2026-09-10", 携帯キャリア: "docomo", 携帯番号_ハイフンなし: "09011112222" },
    ]);
    for (const field of ORDER_FILEMAKER_FIELDS) expect(rows[0]).toHaveProperty(field);
    expect(orderRowsFromRecord(kintoneRecord("2"), "2026-09-11T00:00:00.000Z")).toEqual([]);
  });
});

describe("/api/soil/list/orders/cron", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  beforeEach(() => {
    vi.stubEnv("CRON_SECRET", "secret");
    vi.stubEnv("KINTONE_KANRI_CUSTOMER_APP_ID", "10");
    vi.stubEnv("KINTONE_KANRI_CUSTOMER_TOKEN", "token");
    mocks.getAdmin.mockReset();
    mocks.getAllRecords.mockReset();
  });

  it("returns 401 when CRON_SECRET does not match", async () => {
    const client = adminClient();
    mocks.getAdmin.mockReturnValue(client);
    const response = await GET(request("wrong"));
    expect(response.status).toBe(401);
    expect(mocks.getAllRecords).not.toHaveBeenCalled();
    expect(client.rpc).not.toHaveBeenCalled();
  });

  it("upserts orders, refreshes latest values, and fills blank ledger fields in 1,000 phone chunks", async () => {
    const client = adminClient();
    mocks.getAdmin.mockReturnValue(client);
    mocks.getAllRecords.mockResolvedValue([
      kintoneRecord("1", "0600000001", "09000000001"),
      ...Array.from({ length: 1000 }, (_, index) => kintoneRecord(String(index + 2), `07${String(index).padStart(8, "0")}`)),
      kintoneRecord("empty"),
      kintoneRecord("zero", "0000000000", "00000000000"),
    ]);

    const response = await GET(request());
    expect(response.status).toBe(200);
    expect(client.upserts.map((chunk) => chunk.length)).toEqual([1000, 2]);
    expect(client.rpc).toHaveBeenCalledWith("soil_list_delete_missing_orders", { p_record_ids: expect.arrayContaining(["1", "2"]) });
    const refreshCalls = client.rpc.mock.calls.filter(([name]) => name === "soil_list_refresh_phone_latest");
    const fillCalls = client.rpc.mock.calls.filter(([name]) => name === "soil_list_fill_phone_blanks_from_orders");
    expect(refreshCalls.map(([, args]) => (args as { p_phones: string[] }).p_phones.length)).toEqual([1000, 3]);
    expect(fillCalls.map(([, args]) => (args as { p_phones: string[] }).p_phones.length)).toEqual([1000, 3]);
    await expect(response.json()).resolves.toMatchObject({ ok: true, records: 1003, orderRows: 1002, deletedRows: 1 });
  });

  it("does not refresh the ledger when Kintone fails", async () => {
    const client = adminClient();
    mocks.getAdmin.mockReturnValue(client);
    mocks.getAllRecords.mockRejectedValue(new Error("kintone_500"));
    const response = await GET(request());
    expect(response.status).toBe(500);
    expect(client.upserts).toEqual([]);
    expect(client.rpc).not.toHaveBeenCalled();
  });
});

