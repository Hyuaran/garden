import { beforeEach, describe, expect, it, vi } from "vitest";
import type { RelayJobRow } from "./types";

vi.mock("server-only", () => ({}));

const state = vi.hoisted(() => ({
  jobs: [] as RelayJobRow[],
  heartbeat: null as { id: string; last_seen_at: string; agent_version: string | null; notified_down_at: string | null; updated_at: string | null } | null,
}));

function matches(row: Record<string, unknown>, filters: Array<{ op: string; key: string; value: unknown }>) {
  return filters.every((filter) => {
    const value = row[filter.key];
    if (filter.op === "eq") return value === filter.value;
    if (filter.op === "gt") return String(value) > String(filter.value);
    if (filter.op === "lte") return String(value) <= String(filter.value);
    if (filter.op === "in") return Array.isArray(filter.value) && filter.value.includes(value);
    return true;
  });
}

class Query {
  private filters: Array<{ op: string; key: string; value: unknown }> = [];
  private mode: "select" | "insert" | "update" | "upsert" = "select";
  private payload: Record<string, unknown> | null = null;
  private ordered = false;
  private table: string;

  constructor(table: string) {
    this.table = table;
  }

  insert(value: Record<string, unknown>) {
    this.mode = "insert";
    this.payload = value;
    return this;
  }

  update(value: Record<string, unknown>) {
    this.mode = "update";
    this.payload = value;
    return this;
  }

  upsert(value: Record<string, unknown>) {
    this.mode = "upsert";
    this.payload = value;
    return this;
  }

  select() {
    return this;
  }

  eq(key: string, value: unknown) {
    this.filters.push({ op: "eq", key, value });
    return this;
  }

  gt(key: string, value: unknown) {
    this.filters.push({ op: "gt", key, value });
    return this;
  }

  lte(key: string, value: unknown) {
    this.filters.push({ op: "lte", key, value });
    return this;
  }

  in(key: string, value: unknown[]) {
    this.filters.push({ op: "in", key, value });
    return this;
  }

  order() {
    this.ordered = true;
    return this;
  }

  async limit(count: number) {
    let rows = this.readRows() as RelayJobRow[];
    if (this.ordered) rows = [...rows].sort((a, b) => a.created_at.localeCompare(b.created_at));
    return { data: rows.slice(0, count), error: null };
  }

  async single() {
    const row = this.applyWrite() ?? this.readRows()[0] ?? null;
    return { data: row, error: row ? null : { message: "not found", code: "PGRST116" } };
  }

  async maybeSingle() {
    const row = this.applyWrite() ?? this.readRows()[0] ?? null;
    return { data: row, error: null };
  }

  private readRows() {
    if (this.table === "system_relay_heartbeat") return state.heartbeat ? [state.heartbeat] : [];
    return state.jobs.filter((job) => matches(job as unknown as Record<string, unknown>, this.filters));
  }

  then<TResult1 = { data: unknown; error: null }, TResult2 = never>(
    onfulfilled?: ((value: { data: unknown; error: null }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ) {
    return Promise.resolve({ data: this.applyWrite(), error: null }).then(onfulfilled, onrejected);
  }

  private applyWrite() {
    if (this.table === "system_relay_heartbeat") {
      if (this.mode === "upsert" && this.payload) {
        state.heartbeat = { ...(state.heartbeat ?? {}), ...this.payload } as typeof state.heartbeat;
        return state.heartbeat;
      }
      return null;
    }

    if (this.mode === "insert" && this.payload) {
      const row = {
        id: `job-${state.jobs.length + 1}`,
        status: "queued",
        result: null,
        error: null,
        created_at: new Date().toISOString(),
        started_at: null,
        finished_at: null,
        ...this.payload,
      } as RelayJobRow;
      state.jobs.push(row);
      return row;
    }

    if (this.mode === "update" && this.payload) {
      const row = state.jobs.find((job) => matches(job as unknown as Record<string, unknown>, this.filters));
      if (!row) return null;
      Object.assign(row, this.payload);
      return row;
    }
    return null;
  }
}

vi.mock("@/lib/supabase/admin", () => ({
  getSupabaseAdmin: () => ({
    from: (table: string) => new Query(table),
  }),
}));

import { completeRelayJob, enqueueRelayJob, isRelayAlive, pullRelayJob, touchRelayHeartbeat, waitRelayJob } from "./queue.server";

describe("relay queue", () => {
  beforeEach(() => {
    state.jobs = [];
    state.heartbeat = null;
    vi.useRealTimers();
  });

  it("enqueues and pulls the oldest queued job as running", async () => {
    const first = await enqueueRelayJob("innovera", { ckey: "cdr", akey: "search" }, "screen");
    await enqueueRelayJob("kot", { api: "daily" }, "cron");

    const pulled = await pullRelayJob({ waitMs: 0 });
    expect(pulled?.id).toBe(first.id);
    expect(pulled?.status).toBe("running");
    expect(state.jobs[0].status).toBe("running");
  });

  it("returns null when no queued job appears within waitMs", async () => {
    await expect(pullRelayJob({ waitMs: 0 })).resolves.toBeNull();
  });

  it("completes jobs and waitRelayJob returns or throws the final state", async () => {
    const ok = await enqueueRelayJob("innovera", { ckey: "users", akey: "search" }, "screen");
    await completeRelayJob(ok.id, { ok: true, result: { result: true, data: [{ id: "u1" }] } });
    await expect(waitRelayJob(ok.id, { timeoutMs: 0 })).resolves.toEqual({ result: true, data: [{ id: "u1" }] });

    const failed = await enqueueRelayJob("innovera", { ckey: "users", akey: "search" }, "screen");
    await completeRelayJob(failed.id, { ok: false, error: "ng" });
    await expect(waitRelayJob(failed.id, { timeoutMs: 0 })).rejects.toThrow("ng");
  });

  it("expires timed-out jobs", async () => {
    const job = await enqueueRelayJob("innovera", { ckey: "cdr", akey: "search" }, "screen");
    await expect(waitRelayJob(job.id, { timeoutMs: 0, intervalMs: 0 })).rejects.toThrow("relay_timeout");
    expect(state.jobs[0].status).toBe("expired");
  });

  it("records heartbeat and detects alive window", async () => {
    const heartbeat = await touchRelayHeartbeat("v1");
    expect(heartbeat.agent_version).toBe("v1");
    expect(isRelayAlive(heartbeat, new Date(Date.now() + 60_000))).toBe(true);
    expect(isRelayAlive(heartbeat, new Date(Date.now() + 3 * 60_000))).toBe(false);
  });
});
