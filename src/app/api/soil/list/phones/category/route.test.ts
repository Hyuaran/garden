import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  readRowToken: vi.fn(),
  update: vi.fn(),
  eq: vi.fn(),
}));

vi.mock("../../_lib/auth", () => ({
  requireSoilListUser: vi.fn(async () => ({ ok: true })),
}));

vi.mock("../../_lib/row-token", () => ({
  readRowToken: (token: string) => mocks.readRowToken(token),
}));

vi.mock("@/lib/supabase/admin", () => ({
  getSupabaseAdmin: () => ({
    from: () => ({
      update: (values: Record<string, unknown>) => mocks.update(values),
    }),
  }),
}));

import { PATCH } from "./route";

function request(body: Record<string, unknown>) {
  return new Request("http://localhost/api/soil/list/phones/category", {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

describe("soil list phone category route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.update.mockReturnValue({ eq: (column: string, value: unknown) => mocks.eq(column, value) });
    mocks.eq.mockResolvedValue({ error: null });
    mocks.readRowToken.mockReturnValue("0721234581");
  });

  it("updates the row resolved from the token", async () => {
    const response = await PATCH(request({ rowToken: "token", category: "法人" }));

    expect(response.status).toBe(200);
    expect(mocks.readRowToken).toHaveBeenCalledWith("token");
    expect(mocks.update).toHaveBeenCalledWith({ 区分: "法人", 区分_判定元: "手入力" });
    expect(mocks.eq).toHaveBeenCalledWith("電話番号", "0721234581");
  });

  it.each([
    ["札なし", {}],
    ["壊れた札", { rowToken: "broken", category: "個人" }],
    ["期限切れ", { rowToken: "expired", category: "個人" }],
    ["古い形", { phoneNumber: "0721234581", category: "個人" }],
  ])("%s is rejected with 400", async (_label, body) => {
    mocks.readRowToken.mockReturnValue(null);

    const response = await PATCH(request(body));
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.error).toBe("画面を読み込み直してから、もう一度選んでください");
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("rejects invalid category values with 400", async () => {
    const response = await PATCH(request({ rowToken: "token", category: "会社" }));
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.error).toBe("区分の値が正しくありません");
    expect(mocks.update).not.toHaveBeenCalled();
  });
});
