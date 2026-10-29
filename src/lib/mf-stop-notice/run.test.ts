import { describe, expect, it, vi } from "vitest";
import { cutoffDate, runMfStopNotice, type Employee } from "./run";

const now = new Date("2026-10-28T15:00:00Z"); // JST 10/29
const employee = (overrides: Partial<Employee> = {}): Employee => ({
  employee_id: "EMP-1", employee_number: "1234", name: "山田 太郎",
  email: "yamada@example.com", termination_date: "2026-10-31", mf_stop_notified_at: null,
  ...overrides,
});
const dependencies = (rows: Employee[]) => ({
  load: vi.fn().mockResolvedValue(rows),
  send: vi.fn().mockResolvedValue(undefined),
  mark: vi.fn().mockResolvedValue(undefined),
});

describe("MF stop notice", () => {
  it("uses JST today and includes the 60-day boundary and future dates, excluding old/notified/empty dates", async () => {
    expect(cutoffDate(now)).toBe("2026-08-30");
    const rows = [employee(), employee({ employee_id: "boundary", termination_date: "2026-08-30" }),
      employee({ termination_date: "2026-08-29" }), employee({ termination_date: null }),
      employee({ mf_stop_notified_at: now.toISOString() })];
    const deps = dependencies(rows);
    const result = await runMfStopNotice(deps, { now });
    expect(result.notified).toBe(2);
    expect(deps.load).toHaveBeenCalledExactlyOnceWith("2026-08-30");
    expect(deps.mark).toHaveBeenCalledExactlyOnceWith(rows.slice(0, 2), now.toISOString());
  });

  it("sends one combined message then records success, with fallback email and escaped tags", async () => {
    const deps = dependencies([employee(), employee({ name: "[toall]", email: " " })]);
    await runMfStopNotice(deps, { now });
    expect(deps.send).toHaveBeenCalledTimes(1);
    const message = deps.send.mock.calls[0][0];
    expect(message).toContain("山田 太郎（社員番号 1234・退職日 2026-10-31・メール yamada@example.com）");
    expect(message).toContain("［toall］");
    expect(message).toContain("メールの登録なし");
    expect(message).toContain("最後の給与の支給が済んでから");
    expect(deps.send.mock.invocationCallOrder[0]).toBeLessThan(deps.mark.mock.invocationCallOrder[0]);
  });

  it("does not record failed sends", async () => {
    const deps = dependencies([employee()]);
    deps.send.mockRejectedValue(new Error("send failed"));
    await expect(runMfStopNotice(deps, { now })).rejects.toThrow("send failed");
    expect(deps.mark).not.toHaveBeenCalled();
  });

  it("does nothing when there are no targets", async () => {
    const deps = dependencies([]);
    expect((await runMfStopNotice(deps, { now })).notified).toBe(0);
    expect(deps.send).not.toHaveBeenCalled();
    expect(deps.mark).not.toHaveBeenCalled();
  });

  it("returns only targets without sending or recording in dryRun", async () => {
    const rows = [employee()];
    const deps = dependencies(rows);
    expect(await runMfStopNotice(deps, { now, dryRun: true })).toEqual({ ok: true, dryRun: true, targets: rows, notified: 0 });
    expect(deps.send).not.toHaveBeenCalled();
    expect(deps.mark).not.toHaveBeenCalled();
  });
});
