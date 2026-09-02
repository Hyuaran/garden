import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/admin", () => ({ getSupabaseAdmin: vi.fn() }));
import { saveAdminOnboardingHouseholder, type AdminContext } from "./onboarding-admin.server";

function chain(result: unknown) {
  return {
    update: vi.fn().mockReturnThis(),
    eq: vi.fn().mockResolvedValue(result),
  };
}

describe("事務用の世帯主保存処理", () => {
  beforeEach(() => vi.resetAllMocks());

  it("氏名だけ、続柄だけ、空欄をそれぞれ保存できる", async () => {
    const systemQuery = chain({ error: null });
    const supabase = { from: vi.fn(() => systemQuery) };
    const context = { supabase, managerEmployeeId: "EMP-M" } as unknown as AdminContext;

    const name = await saveAdminOnboardingHouseholder(context, "EMP-1", { householderName: " 吉田 陽菜 ", email: "変えない" });
    const relation = await saveAdminOnboardingHouseholder(context, "EMP-1", { householderRelation: "本人", address: "変えない" });
    const empty = await saveAdminOnboardingHouseholder(context, "EMP-1", { householderName: "", householderRelation: "" });

    expect(name).toEqual({ householderName: "吉田 陽菜" });
    expect(relation).toEqual({ householderRelation: "本人" });
    expect(empty).toEqual({ householderName: "", householderRelation: "" });
    expect(systemQuery.update).toHaveBeenCalledWith({ householder_name: "吉田 陽菜" });
    expect(systemQuery.update).toHaveBeenCalledWith({ householder_relation: "本人" });
    expect(systemQuery.update).toHaveBeenCalledWith({ householder_name: "", householder_relation: "" });
    expect(JSON.stringify(systemQuery.update.mock.calls)).not.toMatch(/email|address/);
  });

  it("続柄が選択肢以外なら保存しない", async () => {
    const systemQuery = chain({ error: null });
    const supabase = { from: vi.fn(() => systemQuery) };

    await expect(saveAdminOnboardingHouseholder({ supabase, managerEmployeeId: "EMP-M" } as unknown as AdminContext, "EMP-1", { householderRelation: "未登録の続柄" })).rejects.toMatchObject({ status: 400 });

    expect(systemQuery.update).not.toHaveBeenCalled();
  });
});
