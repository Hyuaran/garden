import { describe, it, expect, vi } from "vitest";
import {
  loadNormalizedToSoilLists,
  buildErrorRecords,
  type LoadResult,
  type LoadInput,
} from "../soil-import-load";
import type { SoilListInsert } from "../soil-types";

const sampleRecord = (overrides: Partial<SoilListInsert> = {}): SoilListInsert =>
  ({
    source_system: "kintone-app-55",
    source_record_id: "rec-1",
    customer_type: "individual",
    name_kanji: "山田 太郎",
    name_kana: null,
    representative_name_kanji: null,
    representative_name_kana: null,
    phone_primary: "+81901234567",
    phone_alternates: null,
    email_primary: null,
    email_alternates: null,
    postal_code: null,
    prefecture: null,
    city: null,
    address_line: null,
    addresses_jsonb: null,
    industry_type: null,
    business_size: null,
    status_changed_at: null,
    status_changed_by: null,
    donotcall_reason: null,
    merged_into_id: null,
    primary_case_module: null,
    primary_case_id: null,
    supply_point_22: null,
    pd_number: null,
    old_pd_numbers: null,
    source_channel: "kintone_app55",
    list_no: null,
    created_by: null,
    updated_by: null,
    deleted_at: null,
    deleted_by: null,
    deleted_reason: null,
    ...overrides,
  });

describe("buildErrorRecords", () => {
  it("失敗レコードを soil_imports_errors 用 INSERT 行に変換", () => {
    const errors = buildErrorRecords({
      importJobId: "job-1",
      chunkId: 3,
      failures: [
        { sourceRecordId: "rec-1", message: "duplicate phone" },
        { sourceRecordId: "rec-2", message: "constraint violation: NOT NULL" },
      ],
    });

    expect(errors).toHaveLength(2);
    expect(errors[0]).toMatchObject({
      import_job_id: "job-1",
      chunk_id: 3,
      source_record_id: "rec-1",
      error_phase: "load",
      error_type: "load_failure",
      error_message: "duplicate phone",
    });
    expect(errors[1]?.source_record_id).toBe("rec-2");
  });

  it("空の failures は空配列", () => {
    const errors = buildErrorRecords({
      importJobId: "job-1",
      chunkId: 1,
      failures: [],
    });
    expect(errors).toEqual([]);
  });
});

describe("loadNormalizedToSoilLists", () => {
  function setupSupabaseMock(opts: {
    upsertReturn?: { data: unknown; error: { message: string } | null };
  }) {
    const upsertResult = opts.upsertReturn ?? {
      data: [{ id: "soil-1" }],
      error: null,
    };
    const insertResult = { data: null, error: null };

    const upsertChain = {
      select: vi.fn().mockResolvedValue(upsertResult),
    };
    const upsert = vi.fn().mockReturnValue(upsertChain);

    const errorsInsert = vi.fn().mockResolvedValue(insertResult);

    const from = vi.fn((table: string) => {
      if (table === "soil_lists") return { upsert };
      if (table === "soil_imports_errors") return { insert: errorsInsert };
      throw new Error(`unexpected table ${table}`);
    });

    return { from, upsert, upsertChain, errorsInsert };
  }

  it("成功: ON CONFLICT (source_system, source_record_id) で upsert + 結果集計", async () => {
    const { from, upsert } = setupSupabaseMock({
      upsertReturn: {
        data: [{ id: "soil-1" }, { id: "soil-2" }],
        error: null,
      },
    });

    const supabase = { from } as unknown as LoadInput["supabase"];
    const records = [
      sampleRecord({ source_record_id: "rec-1" }),
      sampleRecord({ source_record_id: "rec-2" }),
    ];

    const result: LoadResult = await loadNormalizedToSoilLists({
      supabase,
      records,
      importJobId: "job-x",
      chunkId: 1,
    });

    expect(from).toHaveBeenCalledWith("soil_lists");
    expect(upsert).toHaveBeenCalledTimes(1);
    const [payload, options] = upsert.mock.calls[0]!;
    expect(payload).toHaveLength(2);
    expect(options).toEqual({
      onConflict: "source_system,source_record_id",
      ignoreDuplicates: false,
    });

    expect(result).toEqual({
      total: 2,
      succeeded: 2,
      failed: 0,
      soilListIds: ["soil-1", "soil-2"],
      errorMessages: [],
    });
  });

  it("失敗: error 返却時は failed カウントに反映 + soil_imports_errors に書込", async () => {
    const { from, errorsInsert } = setupSupabaseMock({
      upsertReturn: {
        data: null,
        error: { message: "duplicate key value violates constraint" },
      },
    });

    const supabase = { from } as unknown as LoadInput["supabase"];
    const records = [sampleRecord()];

    const result = await loadNormalizedToSoilLists({
      supabase,
      records,
      importJobId: "job-x",
      chunkId: 5,
    });

    expect(result.succeeded).toBe(0);
    expect(result.failed).toBe(1);
    expect(result.errorMessages[0]).toContain("duplicate key");

    // errors テーブル INSERT 確認
    expect(errorsInsert).toHaveBeenCalledTimes(1);
    const [errorRows] = errorsInsert.mock.calls[0]!;
    expect(errorRows).toHaveLength(1);
    expect(errorRows[0].import_job_id).toBe("job-x");
    expect(errorRows[0].chunk_id).toBe(5);
  });

  it("空の records は no-op で success 0/0/0 を返す", async () => {
    const { from, upsert } = setupSupabaseMock({});
    const supabase = { from } as unknown as LoadInput["supabase"];

    const result = await loadNormalizedToSoilLists({
      supabase,
      records: [],
      importJobId: "job-x",
      chunkId: 1,
    });

    expect(upsert).not.toHaveBeenCalled();
    expect(result).toEqual({
      total: 0,
      succeeded: 0,
      failed: 0,
      soilListIds: [],
      errorMessages: [],
    });
  });
});
