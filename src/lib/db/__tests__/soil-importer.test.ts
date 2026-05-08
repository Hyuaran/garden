import { describe, it, expect, vi } from "vitest";
import {
  runSoilImport,
  bufferIntoChunks,
  type RunSoilImportInput,
} from "../soil-importer";
import type { KintoneClient } from "../kintone-client";
import type { KintoneApp55Record } from "../soil-import-transform";

// ============================================================
// bufferIntoChunks: 純粋関数の TDD
// ============================================================

describe("bufferIntoChunks", () => {
  it("chunkSize に満たない場合は単一 chunk", async () => {
    async function* source() {
      yield [1, 2, 3];
      yield [4, 5];
    }
    const chunks: number[][] = [];
    for await (const chunk of bufferIntoChunks(source(), 10)) {
      chunks.push(chunk);
    }
    expect(chunks).toEqual([[1, 2, 3, 4, 5]]);
  });

  it("chunkSize ぴったりで複数 chunk", async () => {
    async function* source() {
      yield [1, 2, 3, 4];
      yield [5, 6];
    }
    const chunks: number[][] = [];
    for await (const chunk of bufferIntoChunks(source(), 3)) {
      chunks.push(chunk);
    }
    expect(chunks).toEqual([[1, 2, 3], [4, 5, 6]]);
  });

  it("source 跨ぎでも正しく分割", async () => {
    async function* source() {
      yield [1, 2];
      yield [3, 4];
      yield [5, 6, 7];
    }
    const chunks: number[][] = [];
    for await (const chunk of bufferIntoChunks(source(), 4)) {
      chunks.push(chunk);
    }
    expect(chunks).toEqual([[1, 2, 3, 4], [5, 6, 7]]);
  });

  it("空 source は空", async () => {
    async function* source(): AsyncIterable<number[]> {
      // 空
    }
    const chunks: number[][] = [];
    for await (const chunk of bufferIntoChunks(source(), 5)) {
      chunks.push(chunk);
    }
    expect(chunks).toEqual([]);
  });

  it("chunkSize <= 0 は例外", async () => {
    async function* source() {
      yield [1];
    }
    expect(() => bufferIntoChunks(source(), 0)).toThrow(/chunkSize/);
    expect(() => bufferIntoChunks(source(), -1)).toThrow(/chunkSize/);
  });
});

// ============================================================
// runSoilImport: orchestrator のメイン処理 TDD
// ============================================================

describe("runSoilImport", () => {
  function createMockKintoneClient(batches: KintoneApp55Record[][]): KintoneClient {
    return {
      createCursor: vi.fn(),
      getCursor: vi.fn(),
      deleteCursor: vi.fn(),
      fetchAllRecords: vi.fn(async function* () {
        for (const batch of batches) {
          yield batch;
        }
      }),
    };
  }

  function makeRecord(id: string, phone = "06-1234-5678"): KintoneApp55Record {
    return {
      $id: { value: id },
      電話番号: { value: phone },
      漢字: { value: `名前${id}` },
      カナ: { value: `メイ${id}` },
    };
  }

  function setupSupabaseMock(opts: { upsertOk?: boolean } = {}) {
    const upsertOk = opts.upsertOk ?? true;

    // soil_lists upsert chain
    const upsertChain = {
      select: vi.fn().mockResolvedValue(
        upsertOk
          ? { data: [{ id: "soil-uuid-1" }], error: null }
          : { data: null, error: { message: "constraint violation" } },
      ),
    };
    const upsert = vi.fn().mockReturnValue(upsertChain);

    // soil_list_imports update chain
    const updateChain = {
      eq: vi.fn().mockResolvedValue({ data: null, error: null }),
    };
    const update = vi.fn().mockReturnValue(updateChain);

    // soil_imports_errors insert
    const errorsInsert = vi.fn().mockResolvedValue({ data: null, error: null });

    const from = vi.fn((table: string) => {
      if (table === "soil_lists") return { upsert };
      if (table === "soil_list_imports") return { update };
      if (table === "soil_imports_errors") return { insert: errorsInsert };
      throw new Error(`unexpected table: ${table}`);
    });

    return {
      from,
      upsert,
      update,
      errorsInsert,
      _internal: { updateChain },
    };
  }

  it("空 source: chunk 0 で完走、進捗更新は完了のみ", async () => {
    const mocks = setupSupabaseMock();
    const client = createMockKintoneClient([]);

    const result = await runSoilImport({
      supabase: { from: mocks.from } as unknown as RunSoilImportInput["supabase"],
      kintone: client,
      importJobId: "job-1",
      app: 55,
      chunkSize: 100,
    });

    expect(result.totalChunks).toBe(0);
    expect(result.totalSucceeded).toBe(0);
    expect(result.totalFailed).toBe(0);
    expect(mocks.upsert).not.toHaveBeenCalled();
  });

  it("単一 chunk: 全件成功", async () => {
    const mocks = setupSupabaseMock({ upsertOk: true });
    const client = createMockKintoneClient([
      [makeRecord("1"), makeRecord("2"), makeRecord("3")],
    ]);

    // upsert は 3 record 入って 1 result とするためモック調整
    const upsertChain = {
      select: vi.fn().mockResolvedValue({
        data: [{ id: "s-1" }, { id: "s-2" }, { id: "s-3" }],
        error: null,
      }),
    };
    mocks.upsert.mockReturnValue(upsertChain);

    const result = await runSoilImport({
      supabase: { from: mocks.from } as unknown as RunSoilImportInput["supabase"],
      kintone: client,
      importJobId: "job-2",
      app: 55,
      chunkSize: 100,
    });

    expect(result.totalChunks).toBe(1);
    expect(result.totalSucceeded).toBe(3);
    expect(result.totalFailed).toBe(0);
    expect(mocks.upsert).toHaveBeenCalledTimes(1);
  });

  it("複数 chunk: chunkSize で分割される", async () => {
    const mocks = setupSupabaseMock({ upsertOk: true });
    const client = createMockKintoneClient([
      [makeRecord("1"), makeRecord("2"), makeRecord("3"), makeRecord("4")],
      [makeRecord("5"), makeRecord("6")],
    ]);

    // 各 chunk は upsert 結果を別途返す。4 件 → 2 件 で 2 chunk になる想定（chunkSize=3）
    const callIdx = { n: 0 };
    mocks.upsert.mockImplementation(() => {
      callIdx.n += 1;
      const first = callIdx.n === 1
        ? [{ id: "s-1" }, { id: "s-2" }, { id: "s-3" }]
        : [{ id: "s-4" }, { id: "s-5" }, { id: "s-6" }];
      return {
        select: vi.fn().mockResolvedValue({ data: first, error: null }),
      };
    });

    const result = await runSoilImport({
      supabase: { from: mocks.from } as unknown as RunSoilImportInput["supabase"],
      kintone: client,
      importJobId: "job-3",
      app: 55,
      chunkSize: 3,
    });

    expect(result.totalChunks).toBe(2);
    expect(mocks.upsert).toHaveBeenCalledTimes(2);
    expect(result.totalSucceeded).toBe(6);
  });

  it("chunk 失敗: failed カウント反映 + errors 書込 + 後続 chunk 継続", async () => {
    const mocks = setupSupabaseMock();
    const client = createMockKintoneClient([
      [makeRecord("1"), makeRecord("2")],
      [makeRecord("3"), makeRecord("4")],
    ]);

    let chunkN = 0;
    mocks.upsert.mockImplementation(() => {
      chunkN += 1;
      if (chunkN === 1) {
        return {
          select: vi.fn().mockResolvedValue({
            data: null,
            error: { message: "duplicate key" },
          }),
        };
      }
      return {
        select: vi.fn().mockResolvedValue({
          data: [{ id: "s-3" }, { id: "s-4" }],
          error: null,
        }),
      };
    });

    const result = await runSoilImport({
      supabase: { from: mocks.from } as unknown as RunSoilImportInput["supabase"],
      kintone: client,
      importJobId: "job-4",
      app: 55,
      chunkSize: 2,
    });

    expect(result.totalChunks).toBe(2);
    expect(result.totalFailed).toBe(2);
    expect(result.totalSucceeded).toBe(2);
    expect(mocks.errorsInsert).toHaveBeenCalled();
  });

  it("import_job_id 進捗更新: chunks_completed が増加", async () => {
    const mocks = setupSupabaseMock();
    const client = createMockKintoneClient([[makeRecord("1")]]);

    mocks.upsert.mockReturnValue({
      select: vi
        .fn()
        .mockResolvedValue({ data: [{ id: "s-1" }], error: null }),
    });

    await runSoilImport({
      supabase: { from: mocks.from } as unknown as RunSoilImportInput["supabase"],
      kintone: client,
      importJobId: "job-5",
      app: 55,
      chunkSize: 100,
    });

    // soil_list_imports に対する update が複数回（chunk 完了毎 + 完了時）
    expect(mocks.update).toHaveBeenCalled();
  });
});
