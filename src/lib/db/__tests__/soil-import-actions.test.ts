import { describe, it, expect, vi } from "vitest";
import {
  startImportJob,
  pauseImportJob,
  resumeImportJob,
  retryImportJob,
  cancelImportJob,
  markImportJobFailed,
  markImportJobCompleted,
} from "../soil-import-actions";

function setupSupabase() {
  const eq = vi.fn().mockResolvedValue({ data: null, error: null });
  const update = vi.fn().mockReturnValue({ eq });
  const truncate = vi.fn().mockResolvedValue({ data: null, error: null });
  const delete_ = vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ data: null, error: null }) });
  const from = vi.fn().mockReturnValue({ update, delete: delete_ });
  return { from, update, eq, delete_ };
}

describe("startImportJob", () => {
  it("status=running + started_at=now をセット", async () => {
    const mocks = setupSupabase();
    const supabase = { from: mocks.from } as never;

    const result = await startImportJob({
      supabase,
      importJobId: "job-1",
    });

    expect(mocks.from).toHaveBeenCalledWith("soil_list_imports");
    expect(mocks.update).toHaveBeenCalledTimes(1);
    const payload = mocks.update.mock.calls[0]![0]!;
    expect(payload.job_status).toBe("running");
    expect(typeof payload.started_at).toBe("string");
    expect(mocks.eq).toHaveBeenCalledWith("id", "job-1");
    expect(result.ok).toBe(true);
  });

  it("Supabase error は ok=false で返却", async () => {
    const mocks = setupSupabase();
    mocks.eq.mockResolvedValueOnce({ data: null, error: { message: "rls denied" } });
    const supabase = { from: mocks.from } as never;

    const result = await startImportJob({ supabase, importJobId: "job-1" });
    expect(result.ok).toBe(false);
    expect(result.error).toContain("rls denied");
  });
});

describe("pauseImportJob", () => {
  it("status=paused をセット", async () => {
    const mocks = setupSupabase();
    const supabase = { from: mocks.from } as never;

    await pauseImportJob({ supabase, importJobId: "job-2" });

    const payload = mocks.update.mock.calls[0]![0]!;
    expect(payload.job_status).toBe("paused");
    expect(mocks.eq).toHaveBeenCalledWith("id", "job-2");
  });
});

describe("resumeImportJob", () => {
  it("status=running を再セット（resume）", async () => {
    const mocks = setupSupabase();
    const supabase = { from: mocks.from } as never;

    await resumeImportJob({ supabase, importJobId: "job-3" });

    const payload = mocks.update.mock.calls[0]![0]!;
    expect(payload.job_status).toBe("running");
  });
});

describe("retryImportJob", () => {
  it("status=running + chunks_completed=0 + staging/normalized/errors の job 分を削除", async () => {
    const mocks = setupSupabase();
    const supabase = { from: mocks.from } as never;

    await retryImportJob({ supabase, importJobId: "job-4" });

    // staging / normalized / errors の delete が呼ばれる
    const calls = mocks.from.mock.calls.map((c) => c[0]);
    expect(calls).toContain("soil_imports_staging");
    expect(calls).toContain("soil_imports_normalized");
    expect(calls).toContain("soil_imports_errors");
    expect(calls).toContain("soil_list_imports");

    // soil_list_imports は update（status=running, chunks_completed=0）
    const updatePayloads = mocks.update.mock.calls.map((c) => c[0]);
    const importsUpdate = updatePayloads.find((p) => p.job_status === "running");
    expect(importsUpdate).toBeDefined();
    expect(importsUpdate.chunks_completed).toBe(0);
    expect(importsUpdate.failed_count).toBe(0);
  });
});

describe("cancelImportJob", () => {
  it("status=cancelled + completed_at=now", async () => {
    const mocks = setupSupabase();
    const supabase = { from: mocks.from } as never;

    await cancelImportJob({ supabase, importJobId: "job-5" });

    const payload = mocks.update.mock.calls[0]![0]!;
    expect(payload.job_status).toBe("cancelled");
    expect(typeof payload.completed_at).toBe("string");
  });
});

describe("markImportJobFailed", () => {
  it("status=failed + error_summary を設定", async () => {
    const mocks = setupSupabase();
    const supabase = { from: mocks.from } as never;

    await markImportJobFailed({
      supabase,
      importJobId: "job-6",
      errorMessage: "API token expired",
    });

    const payload = mocks.update.mock.calls[0]![0]!;
    expect(payload.job_status).toBe("failed");
    expect(payload.error_summary).toEqual({ error_message: "API token expired" });
    expect(typeof payload.completed_at).toBe("string");
  });
});

describe("markImportJobCompleted", () => {
  it("status=completed + completed_at=now", async () => {
    const mocks = setupSupabase();
    const supabase = { from: mocks.from } as never;

    await markImportJobCompleted({ supabase, importJobId: "job-7" });

    const payload = mocks.update.mock.calls[0]![0]!;
    expect(payload.job_status).toBe("completed");
    expect(typeof payload.completed_at).toBe("string");
  });
});
