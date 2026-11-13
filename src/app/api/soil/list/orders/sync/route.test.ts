import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ employee: vi.fn(), query: vi.fn(), sync: vi.fn() }));
vi.mock("@/lib/auth/system-view-api.server", () => ({ requireViewEmployee: mocks.employee }));
vi.mock("@/lib/db/pg", () => ({ withPgClient: (fn: (client: unknown) => unknown) => fn({ query: mocks.query }) }));
vi.mock("@/lib/supabase/admin", () => ({ getSupabaseAdmin: () => ({}) }));
vi.mock("../_lib/order-sync", () => ({ syncOrders: mocks.sync }));
import { POST } from "./route";

beforeEach(() => {
  vi.resetAllMocks();
  mocks.employee.mockResolvedValue({ userId: "viewer" });
  mocks.query.mockImplementation(async (sql: string) => ({ rows: sql.includes("try_advisory") ? [{ acquired: true }] : [] }));
  mocks.sync.mockResolvedValue({ ok: true });
});
it("denies viewers without list permission before touching the database", async () => {
  mocks.employee.mockResolvedValue(null);
  expect((await POST()).status).toBe(403);
  expect(mocks.query).not.toHaveBeenCalled();
});
it("rejects an occupied lock", async () => {
  mocks.query.mockResolvedValue({ rows: [{ acquired: false }] });
  expect((await POST()).status).toBe(429);
  expect(mocks.sync).not.toHaveBeenCalled();
});
it("rejects attempts within one minute and releases the lock", async () => {
  mocks.query.mockImplementation(async (sql: string) => ({ rows: sql.includes("try_advisory") ? [{ acquired: true }] : sql.startsWith("select updated") ? [{ updated_at: new Date() }] : [] }));
  expect((await POST()).status).toBe(429);
  expect(mocks.sync).not.toHaveBeenCalled();
  expect(mocks.query).toHaveBeenLastCalledWith("select pg_advisory_unlock($1)", [53320261113]);
});
it("runs one sync and releases the lock after success", async () => {
  expect((await POST()).status).toBe(200);
  expect(mocks.sync).toHaveBeenCalledTimes(1);
  expect(mocks.query).toHaveBeenLastCalledWith("select pg_advisory_unlock($1)", [53320261113]);
});
it("does not start another sync while the first owns the lock", async () => {
  let locked = false;
  mocks.query.mockImplementation(async (sql: string) => {
    if (sql.includes("try_advisory")) { const acquired = !locked; locked = true; return { rows: [{ acquired }] }; }
    return { rows: [] };
  });
  let finish!: (value: unknown) => void;
  mocks.sync.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
  const first = POST();
  await vi.waitFor(() => expect(mocks.sync).toHaveBeenCalledTimes(1));
  expect((await POST()).status).toBe(429);
  finish({ ok: true });
  expect((await first).status).toBe(200);
});
it("releases the lock after sync failure", async () => {
  mocks.sync.mockRejectedValue(new Error("offline"));
  expect((await POST()).status).toBe(500);
  expect(mocks.query).toHaveBeenLastCalledWith("select pg_advisory_unlock($1)", [53320261113]);
});
