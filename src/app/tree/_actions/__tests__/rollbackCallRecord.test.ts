/**
 * rollbackCallRecord.ts — ユニットテスト
 *
 * テストケース（最低 5 件）:
 *   1. UNAUTHENTICATED — accessToken が無効
 *   2. NOT_FOUND — call_id が空文字
 *   3. NOT_FOUND — DB に存在しない call_id
 *   4. EXPIRED — called_at から 5s 超過
 *   5. DB_ERROR — UPDATE 失敗
 *   6. 成功 — 5s 以内の正常巻き戻し
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
// テスト対象インポート
// ============================================================

import { rollbackCallRecord } from "../rollbackCallRecord";

// ============================================================
// テストデータ
// ============================================================

const MOCK_USER = { id: "user-uuid-123" };

/** 5s 以内の called_at（現在時刻の 2s 前） */
function recentCalledAt(): string {
  return new Date(Date.now() - 2000).toISOString();
}

/** 5s 超過の called_at（現在時刻の 10s 前） */
function expiredCalledAt(): string {
  return new Date(Date.now() - 10000).toISOString();
}

const VALID_INPUT = {
  call_id: "call-uuid-001",
  accessToken: "valid-access-token",
};

// ============================================================
// ヘルパー: admin from チェーン用モックビルダー
// ============================================================

type AdminChainOptions = {
  selectData?: object | null;
  selectError?: unknown;
  updateError?: unknown;
};

function buildAdminChain({
  selectData,
  selectError = null,
  updateError = null,
}: AdminChainOptions) {
  const selectChain = {
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        is: vi.fn().mockReturnValue({
          maybeSingle: vi
            .fn()
            .mockResolvedValue({ data: selectData ?? null, error: selectError }),
        }),
      }),
    }),
  };

  const updateChain = {
    update: vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: updateError }),
    }),
  };

  mockAdminFrom.mockImplementation((table: string) => {
    if (table === "tree_call_records") {
      return { ...selectChain, ...updateChain };
    }
    return {};
  });
}

// ============================================================
// テスト
// ============================================================

describe("rollbackCallRecord", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";
  });

  it("UNAUTHENTICATED — accessToken が無効な場合", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: null },
      error: new Error("invalid token"),
    });

    const result = await rollbackCallRecord(VALID_INPUT);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errorCode).toBe("UNAUTHENTICATED");
    }
  });

  it("NOT_FOUND — call_id が空文字の場合", async () => {
    mockGetUser.mockResolvedValue({ data: { user: MOCK_USER }, error: null });

    const result = await rollbackCallRecord({ ...VALID_INPUT, call_id: "" });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errorCode).toBe("NOT_FOUND");
    }
  });

  it("NOT_FOUND — DB に該当レコードが存在しない場合", async () => {
    mockGetUser.mockResolvedValue({ data: { user: MOCK_USER }, error: null });
    buildAdminChain({ selectData: null });

    const result = await rollbackCallRecord(VALID_INPUT);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errorCode).toBe("NOT_FOUND");
    }
  });

  it("EXPIRED — called_at から 5s 超過している場合", async () => {
    mockGetUser.mockResolvedValue({ data: { user: MOCK_USER }, error: null });
    buildAdminChain({
      selectData: {
        call_id: VALID_INPUT.call_id,
        called_at: expiredCalledAt(),
        result_code: "toss",
        session_id: "sess-001",
        result_group: "positive",
      },
    });

    const result = await rollbackCallRecord(VALID_INPUT);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errorCode).toBe("EXPIRED");
    }
  });

  it("DB_ERROR — UPDATE に失敗した場合", async () => {
    mockGetUser.mockResolvedValue({ data: { user: MOCK_USER }, error: null });
    buildAdminChain({
      selectData: {
        call_id: VALID_INPUT.call_id,
        called_at: recentCalledAt(),
        result_code: "toss",
        session_id: "sess-001",
        result_group: "positive",
      },
      updateError: { message: "DB error" },
    });

    const result = await rollbackCallRecord(VALID_INPUT);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errorCode).toBe("DB_ERROR");
    }
  });

  it("成功 — 5s 以内の正常巻き戻し", async () => {
    mockGetUser.mockResolvedValue({ data: { user: MOCK_USER }, error: null });
    buildAdminChain({
      selectData: {
        call_id: VALID_INPUT.call_id,
        called_at: recentCalledAt(),
        result_code: "ng_refuse",
        session_id: "sess-001",
        result_group: "negative",
      },
      updateError: null,
    });

    const result = await rollbackCallRecord(VALID_INPUT);

    expect(result.success).toBe(true);
  });

  it("成功 — rollback_reason を指定した場合も正常完了する", async () => {
    mockGetUser.mockResolvedValue({ data: { user: MOCK_USER }, error: null });
    buildAdminChain({
      selectData: {
        call_id: VALID_INPUT.call_id,
        called_at: recentCalledAt(),
        result_code: "unreach",
        session_id: "sess-001",
        result_group: "neutral",
      },
      updateError: null,
    });

    const result = await rollbackCallRecord({
      ...VALID_INPUT,
      rollback_reason: "operator_error",
    });

    expect(result.success).toBe(true);
  });
});
