import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ employee: vi.fn(), save: vi.fn(), revalidate: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
vi.mock("@/app/system/onboarding/_lib/onboarding.server", () => ({ onboardingEmployee: mocks.employee, saveOnboarding: mocks.save, OnboardingError: class extends Error { constructor(message: string, public status = 500) { super(message); } } }));
import { POST } from "./route";
import { OnboardingError } from "@/app/system/onboarding/_lib/onboarding.server";
const request = (body: unknown, origin = "https://garden.example") => new Request("https://garden.example/api/system/onboarding", { method: "POST", headers: { "content-type": "application/json", origin }, body: JSON.stringify(body) });
describe("本人用の保存API", () => {
  beforeEach(() => { vi.resetAllMocks(); mocks.employee.mockResolvedValue({ employee: { employee_id: "EMP-9999" } }); mocks.save.mockResolvedValue({ status: "draft", ndaAgreedAt: null, submittedAt: null }); });
  it("本人コンテキストで保存し、個人情報を応答に再添付しない", async () => {
    const response = await POST(request({ action: "save", values: { name: "private" }, employee_id: "other" }));
    expect(response.status).toBe(200); expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(mocks.save).toHaveBeenCalledWith({ employee: { employee_id: "EMP-9999" } }, { name: "private" }, false);
    expect(await response.json()).toEqual({ ok: true, status: "draft", submittedAt: null, ndaAgreedAt: null });
  });
  it("提出アクションを明示して渡す", async () => {
    mocks.save.mockResolvedValue({ status: "submitted" });
    await POST(request({ action: "submit", values: {} })); expect(mocks.save).toHaveBeenCalledWith(expect.anything(), {}, true);
    expect(mocks.revalidate).toHaveBeenCalledWith("/system");
  });
  it("未ログインは保存しない", async () => {
    mocks.employee.mockRejectedValue(new OnboardingError("ログインし直してください。", 401));
    expect((await POST(request({ action: "save", values: {} }))).status).toBe(401); expect(mocks.save).not.toHaveBeenCalled();
  });
  it("別Originからの要求は拒否する", async () => {
    expect((await POST(request({ action: "save", values: {} }, "https://evil.example"))).status).toBe(403); expect(mocks.employee).not.toHaveBeenCalled();
  });
  it("不正JSONと不明アクションは保存しない", async () => {
    const invalid = new Request("https://garden.example/api/system/onboarding", { method: "POST", headers: { "content-type": "application/json" }, body: "{" });
    expect((await POST(invalid)).status).toBe(400);
    expect((await POST(request({ action: "admin" }))).status).toBe(400); expect(mocks.save).not.toHaveBeenCalled();
  });
  it("予期しない例外の内容を公開しない", async () => {
    mocks.save.mockRejectedValue(new Error("sensitive database detail"));
    const response = await POST(request({ action: "save", values: {} }));
    expect(response.status).toBe(500); expect(JSON.stringify(await response.json())).not.toContain("sensitive");
  });
});
