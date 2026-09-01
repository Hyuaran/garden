import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ context: vi.fn(), save: vi.fn(), apply: vi.fn(), readMyNumber: vi.fn(), fuyou: vi.fn(), revalidate: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
vi.mock("@/app/system/onboarding/_lib/onboarding-admin.server", () => ({
  onboardingAdminContext: mocks.context,
  saveAdminOnboarding: mocks.save,
  applyAdminOnboarding: mocks.apply,
  readMyNumberForAdmin: mocks.readMyNumber,
}));
vi.mock("@/app/system/onboarding/_lib/onboarding-fuyou.server", () => ({ createAndSaveFuyouPdf: mocks.fuyou }));
vi.mock("@/app/system/onboarding/_lib/onboarding.server", () => ({ OnboardingError: class extends Error { constructor(message: string, public status = 500) { super(message); } } }));
import { POST } from "./route";

const request = (body: unknown, origin = "https://garden.example") => new Request("https://garden.example/api/system/onboarding/admin/EMP-1", { method: "POST", headers: { "content-type": "application/json", origin }, body: JSON.stringify(body) });

describe("事務用入社手続きAPI", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.context.mockResolvedValue({ managerEmployeeId: "EMP-MANAGER" });
    mocks.readMyNumber.mockResolvedValue({ myNumber: "123456785540" });
    mocks.fuyou.mockResolvedValue({ filename: "扶養.pdf", folderLabel: "経理部 ／ 12_扶養控除申告書" });
  });

  it("扶養控除申告書は責任者コンテキストを通して作り、PDFやマイナンバーを応答しない", async () => {
    const response = await POST(request({ action: "fuyou" }), { params: Promise.resolve({ employeeId: "EMP-1" }) });
    expect(response.status).toBe(200);
    expect(mocks.context).toHaveBeenCalledOnce();
    expect(mocks.fuyou).toHaveBeenCalledWith({ managerEmployeeId: "EMP-MANAGER" }, "EMP-1");
    expect(mocks.save).not.toHaveBeenCalled();
    const json = await response.json();
    expect(json).toEqual({ ok: true, filename: "扶養.pdf", folderLabel: "経理部 ／ 12_扶養控除申告書" });
    expect(JSON.stringify(json)).not.toMatch(/123456789012|my_number/);
  });

  it("責任者未満は実行できず、Drive失敗は利用者向けの日本語だけを返す", async () => {
    const OnboardingError = (await import("@/app/system/onboarding/_lib/onboarding.server")).OnboardingError;
    mocks.context.mockRejectedValueOnce(new OnboardingError("閲覧権限がありません", 403));
    expect((await POST(request({ action: "fuyou" }), { params: Promise.resolve({ employeeId: "EMP-1" }) })).status).toBe(403);
    mocks.fuyou.mockRejectedValueOnce(new Error("Drive API token scope leaked"));
    const response = await POST(request({ action: "fuyou" }), { params: Promise.resolve({ employeeId: "EMP-1" }) });
    const json = await response.json();
    expect(response.status).toBe(500);
    expect(json.error).toBe("保存先のフォルダに書き込めませんでした。管理者へお問い合わせください。");
    expect(JSON.stringify(json)).not.toMatch(/Drive API|token|scope/i);
  });

  it("マイナンバー表示は専用actionで取得し、権限コンテキストと監査つき読み取りに任せる", async () => {
    const response = await POST(request({ action: "myNumber", target: { kind: "dependent", index: 0 } }), { params: Promise.resolve({ employeeId: "EMP-1" }) });
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(mocks.context).toHaveBeenCalledOnce();
    expect(mocks.readMyNumber).toHaveBeenCalledWith({ managerEmployeeId: "EMP-MANAGER" }, "EMP-1", { kind: "dependent", index: 0 });
    expect(json).toEqual({ ok: true, myNumber: "123456785540" });
  });
});
