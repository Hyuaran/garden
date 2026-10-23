import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ employee: vi.fn(), rpc: vi.fn() }));
vi.mock("@/app/system/onboarding/_lib/onboarding.server", () => ({ onboardingEmployee: mocks.employee, OnboardingError: class extends Error { status = 401; } }));
vi.mock("@/lib/supabase/admin", () => ({ getSupabaseAdmin: () => ({ rpc: mocks.rpc }) }));
import { GET } from "./route";
beforeEach(() => { vi.clearAllMocks(); mocks.employee.mockResolvedValue({ employee: { employee_id: "EMP-1571" } }); });
it("本人だけの番号でLINE URLと220px SVGを作る", async () => {
  mocks.rpc.mockResolvedValue({ data: { linked: false, employeeNumber: "1571", code: "4K7P" }, error: null });
  const response = await GET(); const body = await response.json();
  expect(mocks.rpc).toHaveBeenCalledWith("system_issue_line_link_code", { p_employee_id: "EMP-1571", p_code: expect.stringMatching(/^[A-HJ-NP-Z2-9]{4}$/) });
  expect(body.message).toBe("連携 1571-4K7P");
  expect(decodeURIComponent(body.url)).toContain("/?連携 1571-4K7P");
  expect(body.svg).toContain('width="220"');
  expect(response.headers.get("cache-control")).toBe("private, no-store");
});
it("登録済みでは番号を返さない", async () => {
  mocks.rpc.mockResolvedValue({ data: { linked: true, name: "太郎" }, error: null });
  expect(await (await GET()).json()).toEqual({ linked: true, name: "太郎" });
});
it("未認証では発行しない", async () => {
  mocks.employee.mockRejectedValue(new Error("no session"));
  expect((await GET()).status).toBe(503);
  expect(mocks.rpc).not.toHaveBeenCalled();
});
