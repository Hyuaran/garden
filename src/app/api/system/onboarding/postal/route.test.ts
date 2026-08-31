import { beforeEach, describe, expect, it, vi } from "vitest";

const lookup = vi.hoisted(() => vi.fn());
vi.mock("@/app/system/onboarding/_lib/postal.server", () => ({ lookupOnboardingPostal: lookup }));
vi.mock("@/app/system/onboarding/_lib/onboarding.server", () => ({ OnboardingError: class extends Error { constructor(message: string, public status = 500) { super(message); } } }));
import { OnboardingError } from "@/app/system/onboarding/_lib/onboarding.server";
import { GET } from "./route";

describe("入社手続きの郵便番号API", () => {
  beforeEach(() => vi.resetAllMocks());
  it("認証付き検索の結果をキャッシュせず返す", async () => {
    const addresses = [{ address: "大阪府大阪市中央区南本町", addressKana: "オオサカフオオサカシチュウオウクミナミホンマチ" }];
    lookup.mockResolvedValue(addresses);
    const response = await GET(new Request("https://garden.example/api/system/onboarding/postal?code=5410054"));
    expect(lookup).toHaveBeenCalledWith("5410054");
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(await response.json()).toEqual({ ok: true, addresses });
  });
  it("郵便番号なしでも検索側の検証を通す", async () => {
    lookup.mockResolvedValue([]);
    await GET(new Request("https://garden.example/api/system/onboarding/postal"));
    expect(lookup).toHaveBeenCalledWith("");
  });
  it("未ログインは401と日本語のみを返す", async () => {
    lookup.mockRejectedValue(new OnboardingError("ログインし直してください。", 401));
    const response = await GET(new Request("https://garden.example/api/system/onboarding/postal?code=5410054"));
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "ログインし直してください。" });
  });
  it("予期しない内部エラーは公開しない", async () => {
    lookup.mockRejectedValue(new Error("private database details"));
    const response = await GET(new Request("https://garden.example/api/system/onboarding/postal"));
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "住所を取得できませんでした。住所を直接入れてください。" });
  });
});
