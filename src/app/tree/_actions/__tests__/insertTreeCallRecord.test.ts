/**
 * insertTreeCallRecord.ts — ユニットテスト
 *
 * テストケース（最低 5 件）:
 *   1. UNAUTHENTICATED — accessToken が無効
 *   2. INVALID_INPUT — session_id が空
 *   3. INVALID_INPUT — result_code が不正
 *   4. MEMO_REQUIRED — toss でメモ未入力
 *   5. EMPLOYEE_NOT_FOUND — employee が存在しない
 *   6. 成功 — 全入力正常
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

import { insertTreeCallRecord } from "../insertTreeCallRecord";

// ============================================================
// テストデータ
// ============================================================

const VALID_INPUT = {
  session_id: "sess-uuid-001",
  campaign_code: "kanden",
  result_code: "toss" as const,
  result_group: "positive" as const,
  memo: "良い感触、トスします",
  accessToken: "valid-access-token",
};

const MOCK_USER = { id: "user-uuid-123" };
const MOCK_EMPLOYEE = { employee_number: "0001" };
const MOCK_CALL_RECORD = { call_id: "call-uuid-789" };

// ============================================================
// ヘルパー: admin from チェーン用モックビルダー
// ============================================================

function buildAdminChain({
  employeeData,
  employeeError = null,
  insertData,
  insertError = null,
}: {
  employeeData?: { employee_number: string } | null;
  employeeError?: unknown;
  insertData?: { call_id: string } | null;
  insertError?: unknown;
}) {
  const selectChain = {
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        maybeSingle: vi.fn().mockResolvedValue({ data: employeeData, error: employeeError }),
      }),
    }),
  };

  const insertChain = {
    insert: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data: insertData, error: insertError }),
      }),
    }),
  };

  mockAdminFrom.mockImplementation((table: string) => {
    if (table === "root_employees") return selectChain;
    if (table === "tree_call_records") return insertChain;
    return {};
  });
}

// ============================================================
// テスト
// ============================================================

describe("insertTreeCallRecord", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";
  });

  it("UNAUTHENTICATED — accessToken が無効な場合", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: new Error("invalid token") });

    const result = await insertTreeCallRecord(VALID_INPUT);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errorCode).toBe("UNAUTHENTICATED");
    }
  });

  it("INVALID_INPUT — session_id が空文字の場合", async () => {
    const result = await insertTreeCallRecord({
      ...VALID_INPUT,
      session_id: "",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errorCode).toBe("INVALID_INPUT");
    }
  });

  it("INVALID_INPUT — result_code が不正な値の場合", async () => {
    const result = await insertTreeCallRecord({
      ...VALID_INPUT,
      result_code: "invalid_code" as "toss",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errorCode).toBe("INVALID_INPUT");
    }
  });

  it("MEMO_REQUIRED — toss でメモが空の場合", async () => {
    mockGetUser.mockResolvedValue({ data: { user: MOCK_USER }, error: null });

    const result = await insertTreeCallRecord({
      ...VALID_INPUT,
      result_code: "toss",
      memo: "",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errorCode).toBe("MEMO_REQUIRED");
    }
  });

  it("MEMO_REQUIRED — toss でメモが空白のみの場合", async () => {
    mockGetUser.mockResolvedValue({ data: { user: MOCK_USER }, error: null });

    const result = await insertTreeCallRecord({
      ...VALID_INPUT,
      result_code: "toss",
      memo: "   ",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errorCode).toBe("MEMO_REQUIRED");
    }
  });

  it("EMPLOYEE_NOT_FOUND — user は認証済みだが root_employees に行がない場合", async () => {
    mockGetUser.mockResolvedValue({ data: { user: MOCK_USER }, error: null });
    buildAdminChain({ employeeData: null });

    const result = await insertTreeCallRecord(VALID_INPUT);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errorCode).toBe("EMPLOYEE_NOT_FOUND");
    }
  });

  it("成功 — 認証済み + employee あり + INSERT 成功で call_id を返す", async () => {
    mockGetUser.mockResolvedValue({ data: { user: MOCK_USER }, error: null });
    buildAdminChain({
      employeeData: MOCK_EMPLOYEE,
      insertData: MOCK_CALL_RECORD,
    });

    const result = await insertTreeCallRecord(VALID_INPUT);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.call_id).toBe(MOCK_CALL_RECORD.call_id);
    }
  });

  it("成功 — toss 以外（unreach）はメモ未入力でも成功する", async () => {
    mockGetUser.mockResolvedValue({ data: { user: MOCK_USER }, error: null });
    buildAdminChain({
      employeeData: MOCK_EMPLOYEE,
      insertData: MOCK_CALL_RECORD,
    });

    const result = await insertTreeCallRecord({
      ...VALID_INPUT,
      result_code: "unreach",
      result_group: "neutral",
      memo: undefined,
    });

    expect(result.success).toBe(true);
  });

  it("メモ 500 文字超過は truncate して保存成功する", async () => {
    mockGetUser.mockResolvedValue({ data: { user: MOCK_USER }, error: null });

    const insertSingleMock = vi.fn().mockResolvedValue({ data: MOCK_CALL_RECORD, error: null });
    const insertMock = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({ single: insertSingleMock }),
    });
    const selectMaybeSingleMock = vi.fn().mockResolvedValue({ data: MOCK_EMPLOYEE, error: null });
    const selectMock = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({ maybeSingle: selectMaybeSingleMock }),
    });

    mockAdminFrom.mockImplementation((table: string) => {
      if (table === "root_employees") return { select: selectMock };
      if (table === "tree_call_records") return { insert: insertMock };
      return {};
    });

    const longMemo = "a".repeat(600);
    const result = await insertTreeCallRecord({
      ...VALID_INPUT,
      memo: longMemo,
    });

    expect(result.success).toBe(true);
    // INSERT に渡されたデータを確認: memo は 500 文字に truncate
    const insertedRow = insertMock.mock.calls[0][0];
    expect(insertedRow.memo).toHaveLength(500);
  });
});
