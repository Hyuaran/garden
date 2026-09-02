import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  context: vi.fn(),
  save: vi.fn(),
  saveEmail: vi.fn(),
  saveHouseholder: vi.fn(),
  apply: vi.fn(),
  readMyNumber: vi.fn(),
  revalidate: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
vi.mock("@/app/system/onboarding/_lib/onboarding-admin.server", () => ({
  onboardingAdminContext: mocks.context,
  saveAdminOnboarding: mocks.save,
  saveAdminOnboardingEmail: mocks.saveEmail,
  saveAdminOnboardingHouseholder: mocks.saveHouseholder,
  applyAdminOnboarding: mocks.apply,
  readMyNumberForAdmin: mocks.readMyNumber,
}));
vi.mock("@/app/system/onboarding/_lib/onboarding-fuyou.server", () => ({ createAndSaveFuyouPdf: vi.fn() }));
vi.mock("@/app/system/onboarding/_lib/renrakuhyo.server", () => ({ createAndSaveRenrakuhyo: vi.fn() }));
vi.mock("@/app/system/onboarding/_lib/onboarding.server", () => ({ OnboardingError: class extends Error { constructor(message: string, public status = 500) { super(message); } } }));
vi.mock("@/app/system/onboarding/_lib/fuyou-pdf", () => ({ safeFuyouErrorMessage: vi.fn() }));
vi.mock("@/app/system/onboarding/_lib/renrakuhyo", () => ({ safeRenrakuhyoErrorMessage: vi.fn() }));
import { POST } from "./route";

const request = (body: unknown) => new Request("https://garden.example/api/system/onboarding/admin/EMP-1", { method: "POST", headers: { "content-type": "application/json", origin: "https://garden.example" }, body: JSON.stringify(body) });

describe("事務用世帯主保存API", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.context.mockResolvedValue({ managerEmployeeId: "EMP-MANAGER" });
    mocks.saveHouseholder.mockResolvedValue({ householderName: "吉田 陽菜" });
  });

  it("householder actionを専用保存関数に渡して再検証する", async () => {
    const body = { action: "householder", householderName: "吉田 陽菜", values: { name: "変えない" } };
    const response = await POST(request(body), { params: Promise.resolve({ employeeId: "EMP-1" }) });
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(mocks.context).toHaveBeenCalledOnce();
    expect(mocks.saveHouseholder).toHaveBeenCalledWith({ managerEmployeeId: "EMP-MANAGER" }, "EMP-1", body);
    expect(mocks.save).not.toHaveBeenCalled();
    expect(mocks.apply).not.toHaveBeenCalled();
    expect(mocks.revalidate).toHaveBeenCalledWith("/system/onboarding/admin");
    expect(mocks.revalidate).toHaveBeenCalledWith("/system/onboarding/admin/EMP-1");
    expect(json).toEqual({ ok: true, householderName: "吉田 陽菜" });
  });
});
