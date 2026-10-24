import { beforeEach, afterEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ enqueueRelayJob: vi.fn(), waitRelayJob: vi.fn(), getRelayHeartbeat: vi.fn(), isRelayAlive: vi.fn() }));
vi.mock("@/lib/relay/queue.server", () => mocks);
import { fetchKotEmployeeByCode, updateKotEmployee } from "./kot-api";
beforeEach(() => { vi.clearAllMocks(); vi.useFakeTimers(); vi.setSystemTime(new Date("2026-10-24T03:00:00Z")); vi.stubEnv("KOT_EMPLOYEE_UPDATE_ENABLED", "true"); mocks.isRelayAlive.mockReturnValue(true); mocks.enqueueRelayJob.mockResolvedValue({ id: "job" }); });
afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); });
it("stops updates before queue access by default", async () => {
 vi.stubEnv("KOT_EMPLOYEE_UPDATE_ENABLED", "");
 await expect(updateKotEmployee("key", { divisionCode: "2" }, "2026-10-24")).rejects.toThrow("KOT の変更は止めています");
 expect(mocks.enqueueRelayJob).not.toHaveBeenCalled();
});
it("sends only provided fields with one relay job", async () => {
 await updateKotEmployee("key-123", { divisionCode: "2", typeCode: undefined }, "2026-10-24");
 expect(mocks.enqueueRelayJob).toHaveBeenCalledExactlyOnceWith("kot", { method: "PUT", path: "/employees/key-123?updateDate=2026-10-24", body: { divisionCode: "2" } }, "kot-api");
});
it("looks up the employee through relay only", async () => {
 await fetchKotEmployeeByCode("1571");
 expect(mocks.enqueueRelayJob).toHaveBeenCalledWith("kot", { method: "GET", path: "/employees/1571?includeResigner=true" }, "kot-api");
});
it("rejects invalid date and unavailable time", async () => {
 await expect(updateKotEmployee("key", { typeCode: "1" }, "2026-02-30")).rejects.toThrow();
 vi.setSystemTime(new Date("2026-10-24T00:00:00Z"));
 await expect(updateKotEmployee("key", { typeCode: "1" }, "2026-10-24")).rejects.toThrow("KOT が止まっている時間です");
 expect(mocks.enqueueRelayJob).not.toHaveBeenCalled();
});