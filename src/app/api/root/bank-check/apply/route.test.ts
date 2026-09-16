import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ requireAdmin: vi.fn(), latest: vi.fn(), insertHistory: vi.fn(), insertAudit: vi.fn() }));

vi.mock("server-only", () => ({}));
vi.mock("@/app/system/mypage/_lib/submission-server", () => ({ requireAdmin: mocks.requireAdmin }));
vi.mock("@/lib/supabase/admin", () => ({ getSupabaseAdmin: () => ({
  from: (table: string) => {
    if (table === "root_employee_profile_current") return { select: () => ({ eq: () => Promise.resolve({ data: [{ category: "bank_account", payload: { bank_name: "楽天銀行", bank_code: "0036", branch_code: "241", account_number: "1234567" } }], error: null }) }) };
    if (table === "root_employee_profile_history") return {
      select: () => ({ eq: () => ({ eq: () => ({ eq: () => ({ order: () => ({ limit: () => ({ maybeSingle: mocks.latest }) }) }) }) }) }),
      insert: mocks.insertHistory,
    };
    return { insert: mocks.insertAudit };
  },
}) }));

import { POST } from "./route";

describe("POST /api/root/bank-check/apply", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.requireAdmin.mockResolvedValue({ employee_number: "0008" });
    mocks.latest.mockResolvedValue({ data: null, error: null });
    mocks.insertHistory.mockResolvedValue({ error: null });
    mocks.insertAudit.mockResolvedValue({ error: null });
  });

  it("source=admin の履歴行を1行足す", async () => {
    const response = await POST(new Request("https://garden.test/api/root/bank-check/apply", {
      method: "POST",
      body: JSON.stringify({ employee_id: "EMP-0001", payload: { branch_name: "テナー" }, issue: "支店名なし" }),
    }));
    expect(response.status).toBe(200);
    expect(mocks.insertHistory).toHaveBeenCalledTimes(1);
    expect(mocks.insertHistory.mock.calls[0][0]).toMatchObject({ employee_id: "EMP-0001", source: "admin", recorded_by: "0008", payload: { account_number: "1234567", branch_name: "テナー" } });
  });

  it("同じ値なら履歴を足さない", async () => {
    mocks.latest.mockResolvedValue({ data: { payload: { bank_name: "楽天銀行", bank_code: "0036", branch_code: "241", branch_name: "テナー", account_number: "1234567" } }, error: null });
    const response = await POST(new Request("https://garden.test/api/root/bank-check/apply", {
      method: "POST",
      body: JSON.stringify({ employee_id: "EMP-0001", payload: { branch_name: "テナー" }, issue: "支店名なし" }),
    }));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ added: 0 });
    expect(mocks.insertHistory).not.toHaveBeenCalled();
  });
});
