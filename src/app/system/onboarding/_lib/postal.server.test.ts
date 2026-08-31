import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({ employee: vi.fn(), admin: vi.fn() }));
vi.mock("./onboarding.server", () => ({ onboardingEmployee: mocks.employee, OnboardingError: class extends Error { constructor(message: string, public status: number) { super(message); } } }));
vi.mock("@/lib/supabase/admin", () => ({ getSupabaseAdmin: mocks.admin }));
import { lookupOnboardingPostal } from "./postal.server";

function fixture() {
  const dataset = { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), maybeSingle: vi.fn().mockResolvedValue({ data: { id: "active-dataset" }, error: null }) };
  const result = { data: [{ prefecture: "大阪府", city: "大阪市中央区", town: "南本町", prefecture_kana: "オオサカフ", city_kana: "オオサカシチュウオウク", town_kana: "ミナミホンマチ", is_special: false }], error: null };
  const address = { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), order: vi.fn() };
  address.order.mockReturnValueOnce(address).mockReturnValueOnce(address).mockResolvedValueOnce(result);
  const admin = { from: vi.fn((table: string) => table === "system_postal_datasets" ? dataset : address) };
  mocks.admin.mockReturnValue(admin); return { dataset, result, address, admin };
}
describe("既存の郵便番号データによる住所補完", () => {
  beforeEach(() => { vi.resetAllMocks(); mocks.employee.mockResolvedValue({}); });
  it("認証・在籍確認後、activeのdatasetと完全一致の郵便番号だけを読む", async () => {
    const f = fixture(); const result = await lookupOnboardingPostal("5410054");
    expect(result).toEqual([{ address: "大阪府大阪市中央区南本町", addressKana: "オオサカフオオサカシチュウオウクミナミホンマチ" }]);
    expect(f.dataset.eq).toHaveBeenCalledWith("active", true);
    expect(f.address.eq).toHaveBeenCalledWith("dataset_id", "active-dataset"); expect(f.address.eq).toHaveBeenCalledWith("postal_code", "5410054");
    expect(mocks.employee.mock.invocationCallOrder[0]).toBeLessThan(mocks.admin.mock.invocationCallOrder[0]);
  });
  it("未認証の場合はadminを呼ばない", async () => {
    fixture(); mocks.employee.mockRejectedValue(new Error("unauthorized"));
    await expect(lookupOnboardingPostal("5410054")).rejects.toThrow(); expect(mocks.admin).not.toHaveBeenCalled();
  });
  it("桁不足は検索せず、未該当は空配列", async () => {
    await expect(lookupOnboardingPostal("12")).rejects.toThrow("7桁"); expect(mocks.admin).not.toHaveBeenCalled();
    const f = fixture(); f.result.data = [];
    expect(await lookupOnboardingPostal("0000000")).toEqual([]);
  });
  it("以下に掲載がない等の特殊行は都道府県と市区だけを使う", async () => {
    const f = fixture(); f.result.data[0].is_special = true;
    expect((await lookupOnboardingPostal("5410054"))[0].address).toBe("大阪府大阪市中央区");
  });
  it("データ未取得時は手入力案内にする", async () => {
    const f = fixture(); f.dataset.maybeSingle.mockResolvedValue({ data: null, error: null });
    await expect(lookupOnboardingPostal("5410054")).rejects.toThrow("住所を直接入れてください");
    expect(f.address.select).not.toHaveBeenCalled();
  });
});
