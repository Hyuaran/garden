import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  verify: vi.fn(),
  getAdmin: vi.fn(),
}));

vi.mock("@/lib/cron-auth", () => ({ verifyBearerRequest: (...args: unknown[]) => mocks.verify(...args) }));
vi.mock("@/lib/supabase/admin", () => ({ getSupabaseAdmin: () => mocks.getAdmin() }));

import { POST } from "./route";

const validRow = { 主キー: "1001", コール日: "2026-08-11", コール時間: "09:00:00", 結果フラグ: "留守" };
const body = (rows: unknown[]) => ({
  run_id: "123e4567-e89b-42d3-a456-426614174000", batch_index: 0,
  range_from: "2026-08-10", range_to: "2026-08-11", rows,
});
const request = (rows: unknown[]) => new Request("http://localhost/api/system/call-ingest", {
  method: "POST", headers: { authorization: "Bearer test", "content-type": "application/json" },
  body: JSON.stringify(body(rows)),
});

function admin(options: { existing?: Array<string | { id: string; callDate: string }>; upsertError?: string; refreshError?: string } = {}) {
  const insertedLogs: unknown[] = [];
  const updatedLogs: unknown[] = [];
  const upserts: unknown[] = [];
  return {
    insertedLogs, updatedLogs, upserts,
    rpc: vi.fn().mockResolvedValue({ data: null, error: options.refreshError ? { message: options.refreshError } : null }),
    from(table: string) {
      if (table === "system_call_sync_log") return {
        insert(payload: unknown) {
          insertedLogs.push(payload);
          return { select: () => ({ single: async () => ({ data: { id: "log-1" }, error: null }) }) };
        },
        update(payload: unknown) {
          updatedLogs.push(payload);
          return { eq: async () => ({ error: null }) };
        },
      };
      if (table === "system_call_history") return {
        select: () => ({ in: async () => ({ data: (options.existing ?? []).map((value) => typeof value === "string"
          ? { external_call_id: value, call_date: "2026-08-11" }
          : { external_call_id: value.id, call_date: value.callDate }), error: null }) }),
        async upsert(payload: unknown) {
          upserts.push(payload);
          return { error: options.upsertError ? { message: options.upsertError } : null };
        },
      };
      throw new Error(`Unexpected table: ${table}`);
    },
  };
}

describe("POST /api/system/call-ingest", () => {
  beforeEach(() => {
    mocks.verify.mockReset().mockReturnValue({ ok: true });
    mocks.getAdmin.mockReset();
  });

  it("rejects unauthenticated requests before creating an admin client", async () => {
    mocks.verify.mockReturnValue({ ok: false, status: 401, reason: "Invalid token" });
    const response = await POST(request([validRow]));
    expect(response.status).toBe(401);
    expect(mocks.getAdmin).not.toHaveBeenCalled();
  });

  it("upserts a valid batch and records success counts", async () => {
    const client = admin();
    mocks.getAdmin.mockReturnValue(client);
    const response = await POST(request([validRow]));
    const result = await response.json();
    expect(response.status).toBe(200);
    expect(result).toMatchObject({ status: "success", records_inserted: 1, records_updated: 0, records_rejected: 0 });
    expect(client.upserts[0]).toEqual([expect.objectContaining({ external_call_id: "1001", source: "callcenter-fm-agent" })]);
    expect(client.rpc).toHaveBeenCalledWith("system_call_rollup_refresh", { p_dates: ["2026-08-11"] });
    expect(client.updatedLogs.at(-1)).toEqual(expect.objectContaining({ status: "success", records_inserted: 1, rollup_refresh_status: "success" }));
  });

  it("refreshes both old and new dates when an upsert moves a call", async () => {
    const client = admin({ existing: [{ id: "1001", callDate: "2026-08-10" }] });
    mocks.getAdmin.mockReturnValue(client);
    const response = await POST(request([validRow]));
    expect(response.status).toBe(200);
    expect(client.rpc).toHaveBeenCalledWith("system_call_rollup_refresh", { p_dates: ["2026-08-10", "2026-08-11"] });
  });

  it("keeps ingest successful and records a warning when rollup refresh fails", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const client = admin({ refreshError: "database detail" });
    mocks.getAdmin.mockReturnValue(client);
    const response = await POST(request([validRow]));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ status: "success", records_inserted: 1 });
    expect(client.updatedLogs.at(-1)).toEqual(expect.objectContaining({
      status: "success", rollup_refresh_status: "failure",
      rollup_refresh_error: "日次ロールアップ更新に失敗しました。手動再構築が必要です",
    }));
  });

  it("stores valid rows and returns 207 for a partial batch", async () => {
    const client = admin({ existing: ["1001"] });
    mocks.getAdmin.mockReturnValue(client);
    const response = await POST(request([validRow, { コール日: "2026-08-11" }]));
    const result = await response.json();
    expect(response.status).toBe(207);
    expect(result).toMatchObject({ status: "partial", records_inserted: 0, records_updated: 1, records_rejected: 1 });
    expect(result.rejected[0]).toEqual(expect.objectContaining({ index: 1, code: "INVALID_EXTERNAL_CALL_ID" }));
  });

  it("records failure and returns a sanitized response when upsert fails", async () => {
    const client = admin({ upsertError: "database detail" });
    mocks.getAdmin.mockReturnValue(client);
    const response = await POST(request([validRow]));
    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toMatchObject({ error: "取込処理に失敗しました" });
    expect(client.updatedLogs.at(-1)).toEqual(expect.objectContaining({ status: "failure", error_code: "INGEST_FAILED" }));
  });
});
