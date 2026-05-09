/**
 * Garden-Soil Phase B-01 Phase 2: CSV Importer orchestrator TDD
 *
 * 対応 spec:
 *   - docs/specs/2026-05-08-soil-phase-b-01-phase-2-filemaker-csv.md §4.1
 *
 * テスト対象:
 *   - runSoilImportFromCsv: CSV 行 stream → transform → load の orchestrator
 */

import { describe, it, expect, vi } from "vitest";
import {
  runSoilImportFromCsv,
  type RunCsvImportInput,
} from "../soil-csv-importer";
import type { FileMakerCsvRow } from "../soil-import-csv-source";

// ============================================================
// Mock helpers
// ============================================================

async function* asyncRows(rows: FileMakerCsvRow[]): AsyncGenerator<FileMakerCsvRow> {
  for (const r of rows) yield r;
}

function makeRow(id: string, overrides: Partial<FileMakerCsvRow> = {}): FileMakerCsvRow {
  return {
    管理番号: id,
    個人法人区分: "個人",
    漢字氏名: `名前${id}`,
    電話番号1: "06-1234-5678",
    ...overrides,
  };
}

function setupSupabaseMock(opts: { upsertOk?: boolean } = {}) {
  const upsertOk = opts.upsertOk ?? true;

  const upsertChain = {
    select: vi.fn().mockResolvedValue(
      upsertOk
        ? { data: [{ id: "soil-uuid-1" }], error: null }
        : { data: null, error: { message: "constraint violation" } },
    ),
  };
  const upsert = vi.fn().mockReturnValue(upsertChain);

  const updateChain = {
    eq: vi.fn().mockResolvedValue({ data: null, error: null }),
  };
  const update = vi.fn().mockReturnValue(updateChain);

  const errorsInsert = vi.fn().mockResolvedValue({ data: null, error: null });

  const from = vi.fn((table: string) => {
    if (table === "soil_lists") return { upsert };
    if (table === "soil_list_imports") return { update };
    if (table === "soil_imports_errors") return { insert: errorsInsert };
    throw new Error(`unexpected table: ${table}`);
  });

  return { from, upsert, update, errorsInsert };
}

// ============================================================
// runSoilImportFromCsv
// ============================================================

describe("runSoilImportFromCsv", () => {
  it("空 source → chunk 0 完走", async () => {
    const mocks = setupSupabaseMock();
    const result = await runSoilImportFromCsv({
      supabase: { from: mocks.from } as unknown as RunCsvImportInput["supabase"],
      csvRows: asyncRows([]),
      importJobId: "job-1",
      chunkSize: 10,
    });

    expect(result.totalChunks).toBe(0);
    expect(result.totalSucceeded).toBe(0);
    expect(mocks.upsert).not.toHaveBeenCalled();
  });

  it("1 chunk 全件成功", async () => {
    const mocks = setupSupabaseMock({ upsertOk: true });
    mocks.upsert.mockReturnValue({
      select: vi.fn().mockResolvedValue({
        data: [{ id: "s-1" }, { id: "s-2" }],
        error: null,
      }),
    });

    const result = await runSoilImportFromCsv({
      supabase: { from: mocks.from } as unknown as RunCsvImportInput["supabase"],
      csvRows: asyncRows([makeRow("FM-1"), makeRow("FM-2")]),
      importJobId: "job-2",
      chunkSize: 100,
    });

    expect(result.totalChunks).toBe(1);
    expect(result.totalSucceeded).toBe(2);
    expect(mocks.upsert).toHaveBeenCalledTimes(1);
  });

  it("chunkSize で複数 chunk に分割", async () => {
    const mocks = setupSupabaseMock();
    let n = 0;
    mocks.upsert.mockImplementation(() => {
      n += 1;
      const data = n === 1
        ? [{ id: "s-1" }, { id: "s-2" }]
        : [{ id: "s-3" }];
      return {
        select: vi.fn().mockResolvedValue({ data, error: null }),
      };
    });

    const result = await runSoilImportFromCsv({
      supabase: { from: mocks.from } as unknown as RunCsvImportInput["supabase"],
      csvRows: asyncRows([makeRow("F1"), makeRow("F2"), makeRow("F3")]),
      importJobId: "job-3",
      chunkSize: 2,
    });

    expect(result.totalChunks).toBe(2);
    expect(result.totalSucceeded).toBe(3);
    expect(mocks.upsert).toHaveBeenCalledTimes(2);
  });

  it("失敗 chunk: failed カウント反映 + 後続 chunk 継続", async () => {
    const mocks = setupSupabaseMock();
    let n = 0;
    mocks.upsert.mockImplementation(() => {
      n += 1;
      if (n === 1) {
        return {
          select: vi.fn().mockResolvedValue({
            data: null,
            error: { message: "duplicate" },
          }),
        };
      }
      return {
        select: vi.fn().mockResolvedValue({
          data: [{ id: "s-2" }],
          error: null,
        }),
      };
    });

    const result = await runSoilImportFromCsv({
      supabase: { from: mocks.from } as unknown as RunCsvImportInput["supabase"],
      csvRows: asyncRows([makeRow("F1"), makeRow("F2")]),
      importJobId: "job-4",
      chunkSize: 1,
    });

    expect(result.totalChunks).toBe(2);
    expect(result.totalFailed).toBe(1);
    expect(result.totalSucceeded).toBe(1);
    expect(mocks.errorsInsert).toHaveBeenCalled();
  });

  it("chunk 完了毎に soil_list_imports.update を呼ぶ", async () => {
    const mocks = setupSupabaseMock({ upsertOk: true });
    mocks.upsert.mockReturnValue({
      select: vi.fn().mockResolvedValue({
        data: [{ id: "s-1" }],
        error: null,
      }),
    });

    await runSoilImportFromCsv({
      supabase: { from: mocks.from } as unknown as RunCsvImportInput["supabase"],
      csvRows: asyncRows([makeRow("F1")]),
      importJobId: "job-5",
      chunkSize: 10,
    });

    // chunk 完了毎 + 完了時 update
    expect(mocks.update).toHaveBeenCalled();
  });

  it("chunkSize <= 0 は例外", async () => {
    const mocks = setupSupabaseMock();
    await expect(
      runSoilImportFromCsv({
        supabase: { from: mocks.from } as unknown as RunCsvImportInput["supabase"],
        csvRows: asyncRows([makeRow("F1")]),
        importJobId: "job-6",
        chunkSize: 0,
      }),
    ).rejects.toThrow(/chunkSize/);
  });

  it("transform 後の SoilListInsert は source_system='filemaker-list2024'", async () => {
    const mocks = setupSupabaseMock({ upsertOk: true });
    mocks.upsert.mockReturnValue({
      select: vi.fn().mockResolvedValue({
        data: [{ id: "s-1" }],
        error: null,
      }),
    });

    await runSoilImportFromCsv({
      supabase: { from: mocks.from } as unknown as RunCsvImportInput["supabase"],
      csvRows: asyncRows([makeRow("FM-X")]),
      importJobId: "job-7",
      chunkSize: 10,
    });

    // upsert 第 1 引数 = SoilListInsert 配列
    const upsertArgs = mocks.upsert.mock.calls[0]?.[0];
    expect(Array.isArray(upsertArgs)).toBe(true);
    expect(upsertArgs[0].source_system).toBe("filemaker-list2024");
    expect(upsertArgs[0].source_channel).toBe("filemaker_export");
    expect(upsertArgs[0].is_outside_list).toBe(false);
    expect(upsertArgs[0].list_no).toBe("FM-X");
  });
});
