import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const relay = vi.hoisted(() => ({ enqueueRelayJob: vi.fn(), getRelayHeartbeat: vi.fn(), isRelayAlive: vi.fn(), waitRelayJob: vi.fn() }));
vi.mock("@/lib/relay/queue.server", () => relay);
import { fetchKotEmployees, fetchKotDailySchedules } from "../kot-api";
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("KOT_RELAY_MODE", "queue");
  vi.stubEnv("KOT_API_TOKEN", "");
  relay.isRelayAlive.mockReturnValue(true);
  relay.enqueueRelayJob.mockResolvedValue({ id: "job" });
  relay.waitRelayJob.mockResolvedValue([{ code: "001" }]);
  vi.stubGlobal("fetch", vi.fn());
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
describe("KOT queue mode", () => {
  it("queues without a Garden-side token and waits 25 seconds", async () => {
    expect(await fetchKotEmployees({ date: "2026-10-20" })).toEqual([{ code: "001" }]);
    expect(relay.enqueueRelayJob).toHaveBeenCalledWith("kot", { method: "GET", path: "/employees?date=2026-10-20" }, "kot-api");
    expect(relay.waitRelayJob).toHaveBeenCalledWith("job", { timeoutMs: 25000 });
    expect(fetch).not.toHaveBeenCalled();
  });
  it("fails immediately when relay is down", async () => {
    relay.isRelayAlive.mockReturnValue(false);
    await expect(fetchKotEmployees()).rejects.toMatchObject({ code: "NETWORK_ERROR", message: "中継が止まっています" });
    expect(relay.enqueueRelayJob).not.toHaveBeenCalled();
  });
  it.each([["kot: 403 RATE_LIMITED", "RATE_LIMITED", 403], ["kot: 401 HTTP エラー", "UNAUTHORIZED", 401], ["kot: 403 HTTP エラー", "FORBIDDEN", 403], ["kot: 404 HTTP エラー", "NOT_FOUND", 404], ["kot: 429 HTTP エラー", "RATE_LIMITED", 429], ["kot: 503 HTTP エラー", "SERVER_ERROR", 503], ["kot: 400 HTTP エラー", "VALIDATION", 400], ["kot: KOT の鍵がホスト PC にありません", "TOKEN_MISSING", 0], ["kot: JSON を解釈できません", "PARSE_ERROR", 200], ["relay_timeout", "NETWORK_ERROR", 0], ["kot: 応答が大きすぎます", "NETWORK_ERROR", 0]])("maps %s", async (message, code, httpStatus) => {
    relay.waitRelayJob.mockRejectedValue(new Error(String(message)));
    await expect(fetchKotEmployees()).rejects.toMatchObject({ code, httpStatus });
  });
  it("wraps queue failures without leaking details", async () => {
    relay.getRelayHeartbeat.mockRejectedValue(new Error("private"));
    await expect(fetchKotEmployees()).rejects.toMatchObject({ code: "NETWORK_ERROR", message: "KING OF TIME ホストへ到達できませんでした" });
  });
  it.each(["direct", ""])("uses direct fetch in mode %s", async mode => {
    vi.stubEnv("KOT_RELAY_MODE", mode);
    vi.stubEnv("KOT_API_TOKEN", "direct-token");
    vi.mocked(fetch).mockResolvedValue(Response.json([]));
    expect(await fetchKotEmployees()).toEqual([]);
    expect(fetch).toHaveBeenCalled();
    expect(relay.getRelayHeartbeat).not.toHaveBeenCalled();
  });
});

describe("配信用の所属別予定", () => {
  beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date("2026-11-13T15:00:00+09:00")); });
  afterEach(() => { vi.useRealTimers(); });
  it("予定を中継経由で読み、JSONでない空応答を0件にする", async () => {
    relay.waitRelayJob.mockResolvedValueOnce([{ date: "2026-11-13", dailySchedules: [] }]);
    expect(await fetchKotDailySchedules("A B", "2026-11-13")).toEqual([{ date: "2026-11-13", dailySchedules: [] }]);
    expect(relay.enqueueRelayJob).toHaveBeenCalledWith("kot", { method: "GET", path: "/daily-schedules?division=A+B&ondivision=true&start=2026-11-13&end=2026-11-13" }, "kot-api");
    relay.waitRelayJob.mockRejectedValueOnce(new Error("kot: JSON を解釈できません"));
    expect(await fetchKotDailySchedules("A", "2026-11-13")).toEqual([]);
    expect(fetch).not.toHaveBeenCalled();
  });
  it("停止中の中継やその他のエラーを空予定にしない", async () => {
    relay.isRelayAlive.mockReturnValue(false);
    await expect(fetchKotDailySchedules("A", "2026-11-13")).rejects.toMatchObject({ code: "NETWORK_ERROR" });
    relay.isRelayAlive.mockReturnValue(true);
    relay.waitRelayJob.mockRejectedValue(new Error("kot: 503 HTTP エラー"));
    await expect(fetchKotDailySchedules("A", "2026-11-13")).rejects.toMatchObject({ code: "SERVER_ERROR" });
  });
});
