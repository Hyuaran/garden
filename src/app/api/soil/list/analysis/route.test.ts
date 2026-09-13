import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createServerClient: vi.fn(),
  getAdmin: vi.fn(),
}));

vi.mock("@/app/_lib/supabase/server", () => ({ createServerClient: () => mocks.createServerClient() }));
vi.mock("@/lib/supabase/admin", () => ({ getSupabaseAdmin: () => mocks.getAdmin() }));

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
];

function adminClient(role = "manager") {
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
                data: { refreshed_at: "2026-09-13T06:45:00+09:00", last_elapsed_ms: 1200, last_error: null, rows: cells.length },
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
              range: async (from: number) => ({ data: from === 0 ? cells : [], error: null }),
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
    vi.unstubAllEnvs();
    vi.stubEnv("CRON_SECRET", "secret");
  });

  it("returns 403 below manager", async () => {
    mocks.getAdmin.mockReturnValue(adminClient("staff"));
    const response = await GET();
    expect(response.status).toBe(403);
  });

  it("builds segment totals and rates from analysis cells", async () => {
    mocks.getAdmin.mockReturnValue(adminClient());
    const response = await GET();
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      analysis: {
        blocks: {
          vendor: {
            segments: [
              { segment: "合計", rowCount: 13, validCount: 10, orderCount: 2, orderRateValid: 0.2, orderRateTotal: 2 / 13 },
              { segment: "データ総研", rowCount: 13, callTotal: 23, rotation: 23 / 13 },
            ],
          },
        },
      },
    });
  });

  it("returns detail rows filtered by block, segment and result", async () => {
    mocks.getAdmin.mockReturnValue(adminClient());
    const response = await detailGET(new Request("http://test/api/soil/list/analysis/detail?block=vendor&segment=データ総研&result=留守"));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ ok: true, rows: [{ listName: "リストA", rowCount: 10, callTotal: 20 }] });
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
