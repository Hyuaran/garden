/**
 * session.ts — openSession / closeSession Server Action のユニットテスト
 *
 * TDD: テスト先行。5 ケース（UNAUTHENTICATED / INVALID_INPUT mode /
 * INVALID_INPUT campaign_code 空 / EMPLOYEE_NOT_FOUND / 成功）
 *
 * モック戦略:
 *   - @supabase/supabase-js の createClient を vi.mock で差し替え
 *   - @/lib/supabase/admin の getSupabaseAdmin を vi.mock で差し替え
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ============================================================
// Supabase モック
// ============================================================

const mockGetUser = vi.fn();
const mockAdminFrom = vi.fn();

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({
    auth: {
      getUser: mockGetUser,
    },
  })),
}));

vi.mock("@/lib/supabase/admin", () => ({
  getSupabaseAdmin: vi.fn(() => ({
    from: mockAdminFrom,
  })),
}));

// ============================================================
// テスト対象インポート（モック設定後）
// ============================================================

import { openSession, closeSession } from "../session";

// ============================================================
// テストデータ
// ============================================================

const VALID_INPUT = {
  campaign_code: "kanden",
  mode: "sprout" as const,
  accessToken: "valid-access-token",
};

const MOCK_USER = { id: "user-uuid-123" };
const MOCK_EMPLOYEE = { employee_number: "0001" };
const MOCK_SESSION = { session_id: "sess-uuid-456" };

// ============================================================
// ヘルパー: admin from チェーン用モックビルダー
// ============================================================

function buildAdminChain({
  employeeData,
  employeeError = null,
  insertData,
  insertError = null,
  updateError = null,
}: {
  employeeData?: { employee_number: string } | null;
  employeeError?: unknown;
  insertData?: { session_id: string } | null;
  insertError?: unknown;
  updateError?: unknown;
}) {
  // update chain（アクティブセッション close 用）
  const updateChain = {
    update: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        is: vi.fn().mockResolvedValue({ error: updateError }),
      }),
    }),
  };

  // insert chain
  const insertChain = {
    insert: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data: insertData, error: insertError }),
      }),
    }),
  };

  // select chain（employee lookup）
  const selectChain = {
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        maybeSingle: vi.fn().mockResolvedValue({ data: employeeData, error: employeeError }),
      }),
    }),
  };

  mockAdminFrom.mockImplementation((table: string) => {
    if (table === "root_employees") return { ...selectChain, ...updateChain };
    if (table === "tree_calling_sessions") return { ...updateChain, ...insertChain };
    return {};
  });
}

// ============================================================
// openSession テスト
// ============================================================

describe("openSession", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // 環境変数設定
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";
  });

  it("UNAUTHENTICATED — accessToken が無効な場合、success:false / UNAUTHENTICATED を返す", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: new Error("invalid token") });

    const result = await openSession(VALID_INPUT);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errorCode).toBe("UNAUTHENTICATED");
    }
  });

  it("INVALID_INPUT — mode が不正な場合、success:false / INVALID_INPUT を返す", async () => {
    const result = await openSession({
      ...VALID_INPUT,
      mode: "invalid_mode" as "sprout",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errorCode).toBe("INVALID_INPUT");
    }
  });

  it("INVALID_INPUT — campaign_code が空文字の場合、success:false / INVALID_INPUT を返す", async () => {
    const result = await openSession({
      ...VALID_INPUT,
      campaign_code: "",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errorCode).toBe("INVALID_INPUT");
    }
  });

  it("EMPLOYEE_NOT_FOUND — user は認証済みだが root_employees に行がない場合、EMPLOYEE_NOT_FOUND を返す", async () => {
    mockGetUser.mockResolvedValue({ data: { user: MOCK_USER }, error: null });

    buildAdminChain({ employeeData: null });

    const result = await openSession(VALID_INPUT);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errorCode).toBe("EMPLOYEE_NOT_FOUND");
    }
  });

  it("成功 — 認証済み + employee あり + INSERT 成功で、success:true / session_id を返す", async () => {
    mockGetUser.mockResolvedValue({ data: { user: MOCK_USER }, error: null });

    buildAdminChain({
      employeeData: MOCK_EMPLOYEE,
      insertData: MOCK_SESSION,
    });

    const result = await openSession(VALID_INPUT);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.session_id).toBe(MOCK_SESSION.session_id);
    }
  });
});

// ============================================================
// closeSession テスト
// ============================================================

describe("closeSession", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";
  });

  it("UNAUTHENTICATED — 認証失敗で success:false / UNAUTHENTICATED を返す", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: new Error("invalid") });

    const result = await closeSession({ session_id: "sess-123", accessToken: "bad-token" });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errorCode).toBe("UNAUTHENTICATED");
    }
  });

  it("成功 — 認証済み + employee あり + UPDATE 成功で success:true を返す", async () => {
    mockGetUser.mockResolvedValue({ data: { user: MOCK_USER }, error: null });

    // closeSession 用: employee select + session update
    const updateIsChain = vi.fn().mockResolvedValue({ error: null });
    const updateEqChain2 = vi.fn().mockReturnValue({ is: updateIsChain });
    const updateEqChain1 = vi.fn().mockReturnValue({ eq: updateEqChain2 });
    const updateFn = vi.fn().mockReturnValue({ eq: updateEqChain1 });

    const selectMaybeSingle = vi.fn().mockResolvedValue({ data: MOCK_EMPLOYEE, error: null });
    const selectEq = vi.fn().mockReturnValue({ maybeSingle: selectMaybeSingle });
    const selectFn = vi.fn().mockReturnValue({ eq: selectEq });

    mockAdminFrom.mockImplementation((table: string) => {
      if (table === "root_employees") return { select: selectFn };
      if (table === "tree_calling_sessions") return { update: updateFn };
      return {};
    });

    const result = await closeSession({ session_id: "sess-123", accessToken: "valid-token" });

    expect(result.success).toBe(true);
  });
});
