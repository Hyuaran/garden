import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { saveAdminOnboardingDependent, type AdminContext } from "./onboarding-admin.server";
import { decryptMyNumber } from "@/lib/my-number/crypto.server";
afterEach(() => vi.unstubAllEnvs());
function fixture(sensitive = true, canWrite = true) {
  const rpc = vi.fn().mockResolvedValue({ error: null });
  const context = { supabase: { rpc }, managerEmployeeId: "EMP-M", sensitive, canWrite } as unknown as AdminContext;
  return { rpc, context };
}
describe("扶養家族の提出後の修正", () => {
  it("年間収入を正規化し、対象以外の欄を渡さない", async () => {
    const { context, rpc } = fixture(false);
    const result = await saveAdminOnboardingDependent(context, "EMP-1", { index: 1, field: "annual_income", value: " 1,200,000 ", name: "変更しない" });
    expect(result.value).toBe("1200000");
    expect(rpc.mock.calls[0][1].p_changes).toEqual({ annual_income: "1200000" });
    await saveAdminOnboardingDependent(context, "EMP-1", { index: 0, field: "annual_income", value: "0" });
    await saveAdminOnboardingDependent(context, "EMP-1", { index: 0, field: "occupation", value: " 小学2年 " });
    expect(rpc.mock.lastCall?.[1].p_changes).toEqual({ occupation: "小学2年" });
  });
  it.each(["-1", "1.1", "1e3", "1,00", "", "9007199254740992"])("不正な収入 %s を保存しない", async value => {
    const { context, rpc } = fixture();
    await expect(saveAdminOnboardingDependent(context, "EMP-1", { index: 0, field: "annual_income", value })).rejects.toMatchObject({ status: 400 });
    expect(rpc).not.toHaveBeenCalled();
  });
  it("番号は暗号化し、返却にもRPCにも平文を残さない", async () => {
    vi.stubEnv("MY_NUMBER_ENCRYPTION_KEY", Buffer.alloc(32, 5).toString("base64"));
    const { context, rpc } = fixture();
    const result = await saveAdminOnboardingDependent(context, "EMP-1", { index: 1, field: "my_number", value: "123456789018", overwrite: true });
    const payload = rpc.mock.calls[0][1];
    expect(payload.p_changes.my_number).toBe("");
    expect(payload.p_overwrite).toBe(true);
    expect(decryptMyNumber(payload.p_changes.my_number_secret)).toBe("123456789018");
    expect(result.value).toBe("••••••••9018");
    expect(JSON.stringify([payload, result])).not.toContain("123456789018");
  });
  it("全権管理者以外・見るだけの人・不正な番号を拒否する", async () => {
    for (const [sensitive, canWrite, value, status] of [[false, true, "123456789018", 403], [true, false, "123456789018", 403], [true, true, "123456789012", 400], [true, true, "123", 400]] as const) {
      const { context, rpc } = fixture(sensitive, canWrite);
      await expect(saveAdminOnboardingDependent(context, "EMP-1", { index: 0, field: "my_number", value })).rejects.toMatchObject({ status });
      expect(rpc).not.toHaveBeenCalled();
    }
  });
  it("対象外の欄と不正な添字を拒否する", async () => {
    const { context, rpc } = fixture();
    for (const body of [{ index: 0, field: "name", value: "x" }, { index: -1, field: "occupation", value: "x" }]) {
      await expect(saveAdminOnboardingDependent(context, "EMP-1", body)).rejects.toMatchObject({ status: 400 });
    }
    expect(rpc).not.toHaveBeenCalled();
  });
});
