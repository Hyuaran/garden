import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createServerClient: vi.fn(),
  getAdmin: vi.fn(),
  queryPg: vi.fn(),
}));

vi.mock("@/app/_lib/supabase/server", () => ({ createServerClient: () => mocks.createServerClient() }));
vi.mock("@/lib/supabase/admin", () => ({ getSupabaseAdmin: () => mocks.getAdmin() }));
vi.mock("@/lib/db/pg", () => ({ queryPg: (...args: unknown[]) => mocks.queryPg(...args) }));

import { GET as cronGET } from "./cron/route";
import { GET as detailGET } from "./detail/route";
import { clearAnalysisCache, refreshAnalysis, type AnalysisCellRow, type AnalysisDb } from "./_lib/analysis";
import { GET } from "./route";
import { POST as refreshPOST } from "./refresh/route";

function serverClient() {
  return { auth: { getUser: async () => ({ data: { user: { id: "user-1" } } }) } };
}

const cells: AnalysisCellRow[] = [
  {
    block: "vendor",
    segment: "データ総研",
    result: "留守",
    list_name: "リストA",
    list_loaded_on: "2026-09-10",
    row_count: 10,
    called_count: 10,
    call_total: 20,
    invalid_count: 0,
    order_count: 2,
    acquired_count: 0,
    last_called_on: "2026-09-12",
    segment_last_called_on: null,
  },
  {
    block: "vendor",
    segment: "データ総研",
    result: "無効",
    list_name: "リストA",
    list_loaded_on: "2026-09-10",
    row_count: 3,
    called_count: 3,
    call_total: 3,
    invalid_count: 3,
    order_count: 0,
    acquired_count: 0,
    last_called_on: "2026-09-11",
    segment_last_called_on: null,
  },
  {
    block: "active_list",
    segment: "リストA",
    result: "獲得",
    list_name: "リストA",
    list_loaded_on: "2026-09-10",
    row_count: 5,
    called_count: 5,
    call_total: 6,
    invalid_count: 0,
    order_count: 1,
    acquired_count: 5,
    last_called_on: "2026-09-12",
    segment_last_called_on: "2026-09-12",
  },
  {
    block: "contract",
    segment: "ドコモ光",
    result: "留守",
    list_name: "リストB",
    list_loaded_on: "2026-09-11",
    row_count: 7,
    called_count: 6,
    call_total: 12,
    invalid_count: 0,
    order_count: 1,
    acquired_count: 0,
    last_called_on: "2026-09-12",
    segment_last_called_on: null,
  },
];

function adminClient(role = "manager", contractSnapshotAt: string | null = "2026-09-13T15:27:00+09:00", analysisCells = cells) {
  const rpc = vi.fn(async (name: string) => {
    if (name === "soil_list_analysis_finish") return { data: [{ refreshed_at: "2026-09-13T06:45:00+09:00", rows: 3, elapsed_ms: 1234 }], error: null };
    return { data: [{ rows: 1 }], error: null };
  });
  const updates: unknown[] = [];
  const client = {
    rpc,
    updates,
    from(table: string) {
      if (table === "root_employees") {
        const query = {
          select: () => query,
          eq: () => query,
          maybeSingle: async () => ({ data: { name: "東海林 美琴", garden_role: role }, error: null }),
        };
        return query;
      }
      if (table === "soil_list_analysis_state") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: { refreshed_at: "2026-09-13T06:45:00+09:00", last_elapsed_ms: 1200, last_error: null, rows: analysisCells.length },
                error: null,
              }),
            }),
          }),
          update: (values: unknown) => ({
            eq: async () => {
              updates.push(values);
              return { error: null };
            },
          }),
        };
      }
      if (table === "soil_list_analysis_cell") {
        return {
          select: () => ({
            order: () => ({
              range: async (from: number) => ({ data: from === 0 ? analysisCells : [], error: null }),
            }),
          }),
        };
      }
      if (table === "system_fm_shineigyo_sync_log") {
        return {
          select: () => ({
            eq: () => ({
              order: () => ({
                limit: () => ({
                  maybeSingle: async () => ({ data: contractSnapshotAt ? { completed_at: contractSnapshotAt } : null, error: null }),
                }),
              }),
            }),
          }),
        };
      }
      if (table === "soil_list_analysis_vendor_repurchase") {
        return {
          select: () => ({
            order: () => ({
              range: async () => ({
                data: [{ segment: "データ総研", repurchase_count: 4, source_summary: "Luna 3／ABC 1" }],
                error: null,
              }),
            }),
          }),
        };
      }
      if (table === "soil_list_analysis_repurchase_pair") {
        return {
          select: () => ({
            order: () => ({
              range: async () => ({
                data: [{ source_vendor: "Luna", target_vendor: "データ総研", phone_count: 3, order_count: 1 }],
                error: null,
              }),
            }),
          }),
        };
      }
      throw new Error(`Unexpected table: ${table}`);
    },
  };
  return client as unknown as AnalysisDb & { rpc: typeof rpc; updates: unknown[] };
}

describe("/api/soil/list/analysis", () => {
  beforeEach(() => {
    clearAnalysisCache();
    mocks.createServerClient.mockReset().mockResolvedValue(serverClient());
    mocks.getAdmin.mockReset();
    mocks.queryPg.mockReset();
    vi.unstubAllEnvs();
    vi.stubEnv("CRON_SECRET", "secret");
  });

  it("returns 403 below manager", async () => {
    mocks.getAdmin.mockReturnValue(adminClient("staff"));
    const response = await GET(new Request("http://test/api/soil/list/analysis"));
    expect(response.status).toBe(403);
  });

  it("builds segment totals and rates from analysis cells", async () => {
    mocks.getAdmin.mockReturnValue(adminClient());
    const response = await GET(new Request("http://test/api/soil/list/analysis"));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      analysis: {
        blocks: {
          vendor: {
            segments: [
              { segment: "合計", rowCount: 13, validCount: 10, orderCount: 2, orderCaseCount: 0, orderRateValid: 0.2, orderRateTotal: 2 / 13 },
              { segment: "データ総研", rowCount: 13, callTotal: 23, rotation: 23 / 13, repurchaseCount: 4, repurchaseSources: "Luna 3／ABC 1" },
            ],
          },
          contract: {
            snapshotAt: "2026-09-13T15:27:00+09:00",
            segments: [
              { segment: "合計", rowCount: 7, calledCount: 6, orderCount: 1 },
              { segment: "ドコモ光", rowCount: 7, callTotal: 12 },
            ],
          },
        },
        repurchasePairs: [{ sourceVendor: "Luna", targetVendor: "データ総研", phoneCount: 3, orderCount: 1 }],
      },
    });
  });

  it("returns fixed result order (前確OK・獲得 stay even at zero) and groups the rest as その他", async () => {
    const analysisCells: AnalysisCellRow[] = [
      ...cells,
      { ...cells[0], result: "テスト", row_count: 6, called_count: 6, call_total: 6, order_count: 0 },
      { ...cells[0], result: "前確NG", row_count: 4, called_count: 4, call_total: 4, order_count: 0 },
    ];
    mocks.getAdmin.mockReturnValue(adminClient("manager", "2026-09-13T15:27:00+09:00", analysisCells));
    const response = await GET(new Request("http://test/api/soil/list/analysis"));
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.analysis.blocks.vendor.segments[0].results).toEqual([
      { result: "留守", rowCount: 10 },
      { result: "無効", rowCount: 3 },
      { result: "前確OK", rowCount: 0 },
      { result: "獲得", rowCount: 0 },
      { result: "その他", rowCount: 10 },
    ]);

    const detail = await detailGET(new Request(`http://test/api/soil/list/analysis/detail?block=vendor&segment=__all__&result=${encodeURIComponent("その他")}`));
    expect(detail.status).toBe(200);
    await expect(detail.json()).resolves.toMatchObject({
      ok: true,
      rows: [{ listName: "リストA", rowCount: 10, callTotal: 10 }],
    });
  });

  it("returns null contract snapshot when the sync log has no success row", async () => {
    mocks.getAdmin.mockReturnValue(adminClient("manager", null));
    const response = await GET(new Request("http://test/api/soil/list/analysis"));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      analysis: { blocks: { contract: { snapshotAt: null } } },
    });
  });

  it("returns detail rows filtered by block, segment and result", async () => {
    mocks.getAdmin.mockReturnValue(adminClient());
    const response = await detailGET(new Request("http://test/api/soil/list/analysis/detail?block=vendor&segment=データ総研&result=留守"));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ ok: true, rows: [{ listName: "リストA", rowCount: 10, callTotal: 20 }] });
  });

  it("loads filtered aggregation through PostgreSQL for the selected filters", async () => {
    mocks.getAdmin.mockReturnValue(adminClient());
    mocks.queryPg.mockResolvedValue({
      rows: [
        {
          block: "line_type",
          segment: "au",
          result: "留守",
          list_name: "リストA",
          list_loaded_on: "2026-09-10",
          row_count: 8,
          called_count: 8,
          call_total: 16,
          invalid_count: 0,
          order_count: 2,
          order_case_count: 3,
          acquired_count: 1,
          last_called_on: "2026-09-12",
          segment_last_called_on: null,
        },
      ],
    });
    const response = await GET(new Request("http://test/api/soil/list/analysis?axis=line_type&vendor=Luna&vendor=%E3%83%87%E3%83%BC%E3%82%BF%E7%B7%8F%E7%A0%94&lineType=%E3%83%95%E3%83%AC%E3%83%83%E3%83%84&contractYear=2024"));
    expect(response.status).toBe(200);
    expect(mocks.queryPg).toHaveBeenCalledWith("select * from public.soil_list_analysis_filtered($1::text[], $2::text[], $3::text[], $4::text)", [["Luna", "データ総研"], ["フレッツ"], ["2024"], "line_type"]);
    const data = await response.json();
    expect(data.ok).toBe(true);
    expect(data.block.segments[0]).toMatchObject({ segment: "合計", rowCount: 8, orderCount: 2, orderCaseCount: 3 });
  });

  it("sums purchase filter cells for one vendor with line type and contract year filters", async () => {
    mocks.getAdmin.mockReturnValue(adminClient());
    mocks.queryPg.mockResolvedValueOnce({
      rows: [
        {
          block: "line_type",
          segment: "フレッツ",
          result: "留守",
          list_name: "（詳細なし）",
          list_loaded_on: null,
          row_count: 8,
          called_count: 8,
          call_total: 16,
          invalid_count: 0,
          order_count: 2,
          order_case_count: 3,
          acquired_count: 1,
          last_called_on: null,
          segment_last_called_on: null,
        },
        {
          block: "line_type",
          segment: "au",
          result: "未コール",
          list_name: "（詳細なし）",
          list_loaded_on: null,
          row_count: 4,
          called_count: 0,
          call_total: 0,
          invalid_count: 0,
          order_count: 0,
          order_case_count: 0,
          acquired_count: 0,
          last_called_on: null,
          segment_last_called_on: null,
        },
      ],
    });
    const response = await GET(new Request("http://test/api/soil/list/analysis?axis=line_type&vendor=Luna&lineType=%E3%83%95%E3%83%AC%E3%83%83%E3%83%84&lineType=au&contractYear=2024"));
    expect(response.status).toBe(200);
    expect(mocks.queryPg).toHaveBeenCalledTimes(1);
    expect(mocks.queryPg.mock.calls[0][0]).toContain("soil_list_analysis_purchase_filter_cell");
    expect(mocks.queryPg.mock.calls[0][1]).toEqual([["Luna"], ["フレッツ", "au"], ["2024"], "line_type"]);
    const data = await response.json();
    expect(data.block.segments[0]).toMatchObject({ segment: "合計", rowCount: 12, calledCount: 8, orderCount: 2, orderCaseCount: 3 });
    expect(data.block.segments[1]).toMatchObject({ segment: "フレッツ", rowCount: 8, results: [{ result: "留守", rowCount: 8 }, { result: "前確OK", rowCount: 0 }, { result: "獲得", rowCount: 0 }] });
  });

  it("uses the direct filtered function when two vendors are selected", async () => {
    mocks.getAdmin.mockReturnValue(adminClient());
    mocks.queryPg.mockResolvedValue({ rows: [] });
    const response = await GET(new Request("http://test/api/soil/list/analysis?axis=vendor&vendor=A&vendor=B"));
    expect(response.status).toBe(200);
    expect(mocks.queryPg).toHaveBeenCalledTimes(1);
    expect(mocks.queryPg).toHaveBeenCalledWith("select * from public.soil_list_analysis_filtered($1::text[], $2::text[], $3::text[], $4::text)", [["A", "B"], [], [], "vendor"]);
  });

  it("falls back to the direct filtered function when the purchase filter cell is empty", async () => {
    mocks.getAdmin.mockReturnValue(adminClient());
    mocks.queryPg
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ has_rows: false }] })
      .mockResolvedValueOnce({
        rows: [
          {
            block: "contract_year",
            segment: "2024",
            result: "獲得",
            list_name: "リストB",
            list_loaded_on: "2026-09-10",
            row_count: 2,
            called_count: 2,
            call_total: 4,
            invalid_count: 0,
            order_count: 1,
            order_case_count: 1,
            acquired_count: 2,
            last_called_on: "2026-09-12",
            segment_last_called_on: null,
          },
        ],
      });
    const response = await GET(new Request("http://test/api/soil/list/analysis?axis=contract_year&vendor=Luna&contractYear=2024"));
    expect(response.status).toBe(200);
    expect(mocks.queryPg.mock.calls[0][0]).toContain("soil_list_analysis_purchase_filter_cell");
    expect(mocks.queryPg.mock.calls[1][0]).toContain("exists(select 1 from public.soil_list_analysis_purchase_filter_cell)");
    expect(mocks.queryPg.mock.calls[2]).toEqual(["select * from public.soil_list_analysis_filtered($1::text[], $2::text[], $3::text[], $4::text)", [["Luna"], [], ["2024"], "contract_year"]]);
    const data = await response.json();
    expect(data.block.segments[0]).toMatchObject({ segment: "合計", rowCount: 2, orderCount: 1, orderCaseCount: 1 });
  });

  it("returns the agreed broad-condition message when vendor AND query times out", async () => {
    mocks.getAdmin.mockReturnValue(adminClient());
    mocks.queryPg.mockRejectedValue(new Error("canceling statement due to statement timeout"));
    const response = await GET(new Request("http://test/api/soil/list/analysis?axis=vendor&vendor=A&vendor=B"));
    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toMatchObject({ ok: false, error: "条件が広すぎます。絞り込みを減らしてください" });
  });

  it("accepts contract detail rows", async () => {
    mocks.getAdmin.mockReturnValue(adminClient());
    const response = await detailGET(new Request("http://test/api/soil/list/analysis/detail?block=contract&segment=ドコモ光&result=留守"));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ ok: true, rows: [{ listName: "リストB", rowCount: 7, callTotal: 12 }] });
  });

  it("refresh calls begin, collect x100 and finish in order", async () => {
    const client = adminClient();
    mocks.getAdmin.mockReturnValue(client);
    const response = await refreshPOST();
    expect(response.status).toBe(200);
    expect(client.rpc.mock.calls[0][0]).toBe("soil_list_analysis_begin");
    expect(client.rpc.mock.calls.slice(1, 101).map((call) => call[0])).toEqual(Array.from({ length: 100 }, () => "soil_list_analysis_collect"));
    expect(client.rpc.mock.calls[101][0]).toBe("soil_list_analysis_finish");
  });

  it("does not call finish when collect fails and saves last_error", async () => {
    const client = adminClient();
    vi.mocked(client.rpc).mockImplementation(async (name: string, args?: Record<string, unknown>) => {
      if (name === "soil_list_analysis_collect" && args?.p_chunk === 2) return { data: null, error: { message: "timeout" } };
      return { data: [{ rows: 1 }], error: null };
    });
    await expect(refreshAnalysis(client)).rejects.toThrow("timeout");
    expect(client.rpc.mock.calls.some((call) => call[0] === "soil_list_analysis_finish")).toBe(false);
    expect(client.rpc).toHaveBeenCalledWith("soil_list_analysis_fail", { p_error: "timeout" });
  });

  it("cron returns 401 when CRON_SECRET does not match", async () => {
    mocks.getAdmin.mockReturnValue(adminClient());
    const response = await cronGET(new Request("http://test/api/soil/list/analysis/cron", { headers: { authorization: "Bearer wrong" } }));
    expect(response.status).toBe(401);
  });
});
