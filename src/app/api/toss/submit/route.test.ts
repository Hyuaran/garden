import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  addRecord: vi.fn(),
  requirePartnerOrStaff: vi.fn(),
}));

vi.mock("@/app/p/toss/_lib/kintone.server", () => ({ addRecord: mocks.addRecord }));
vi.mock("@/app/p/_lib/server-auth", () => ({
  requirePartnerOrStaff: mocks.requirePartnerOrStaff,
  TossApiError: class TossApiError extends Error { constructor(message: string, public status: number) { super(message); } },
  tossError: (error: unknown) => ({ status: 500, message: error instanceof Error ? error.message : "error" }),
}));

import { POST } from "./route";

const input = {
  partnerCode: "7654321", useTossCb: "利用しない", tossCbAmount: "", tossUpItems: ["電気"],
  comment: "", rank: "A", preferredTimes: [], listCategory: "リスト外", pdManagementNumber: "", pd: "",
  applicantType: "本人", applicantLastName: "庭", applicantFirstName: "太郎", applicantLastKana: "ニワ",
  applicantFirstKana: "タロウ", birthDate: "1990-01-01", addressType: "現住所", postalCode: "1000001",
  prefecture: "東京都", city: "千代田区", town: "千代田1", building: "", room: "", contactType: "本人",
  contactPhone: "09000000000", smartphoneCarrier: "その他",
};

const request = () => new Request("http://localhost/api/toss/submit", {
  method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input),
});

describe("POST /api/toss/submit partner identity", () => {
  beforeEach(() => {
    mocks.addRecord.mockReset().mockResolvedValue({ id: "1", revision: "1" });
    mocks.requirePartnerOrStaff.mockReset();
  });

  it("uses the trusted staff partner code and account name", async () => {
    mocks.requirePartnerOrStaff.mockResolvedValue({ kind: "staff", name: "萩尾 拓也", tossPartnerCode: "1010003" });

    expect((await POST(request())).status).toBe(200);
    const record = mocks.addRecord.mock.calls[0][2];
    expect(record.ルックアップ.value).toBe("1010003");
    expect(record.文字列__1行__37.value).toBe("萩尾 拓也");
  });

  it("keeps manual code entry and an empty toss person name for staff without a configured code", async () => {
    mocks.requirePartnerOrStaff.mockResolvedValue({ kind: "staff", name: "コード未設定社員" });

    expect((await POST(request())).status).toBe(200);
    const record = mocks.addRecord.mock.calls[0][2];
    expect(record.ルックアップ.value).toBe("7654321");
    expect(record.文字列__1行__37.value).toBe("");
  });

  it("keeps using the authenticated partner code without a staff toss person name", async () => {
    mocks.requirePartnerOrStaff.mockResolvedValue({ kind: "partner", partnerCode: "1234567" });

    expect((await POST(request())).status).toBe(200);
    const record = mocks.addRecord.mock.calls[0][2];
    expect(record.ルックアップ.value).toBe("1234567");
    expect(record.文字列__1行__37.value).toBe("");
  });
});
