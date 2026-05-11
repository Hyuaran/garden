/**
 * Garden-Tree Aporan 画面 — D-02 Step 9.2 テスト
 *
 * テストケース:
 *  T-AP01: アポ済リストの SELECT mock + リスト表示
 *  T-AP02: toss レコードが 0 件の場合「ありません」メッセージを表示
 *  T-AP03: SELECT エラー時にエラーメッセージを表示
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

// --- モック ---
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("../../_state/TreeStateContext", () => ({
  useTreeState: () => ({
    role: "manager",
    treeUser: { employee_id: "EMP001", name: "テストユーザー" },
  }),
}));

// Supabase の深いチェーン構造をまとめてモック
const mockQueryResult = vi.fn();
vi.mock("../../_lib/supabase", () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({
          is: () => ({
            gte: () => ({
              order: mockQueryResult,
            }),
          }),
        }),
      }),
    }),
  },
}));

import AporanPage from "../page";

describe("AporanPage — D-02 Step 9.2 アポ済リスト Supabase 連携", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("T-AP01: toss レコード 2 件を取得してリスト表示する", async () => {
    const mockData = [
      { id: "uuid-001", called_at: new Date().toISOString(), memo: "テストメモA", duration_sec: 120 },
      { id: "uuid-002", called_at: new Date().toISOString(), memo: null, duration_sec: null },
    ];
    mockQueryResult.mockResolvedValue({ data: mockData, error: null });

    render(<AporanPage />);

    await waitFor(() => {
      expect(screen.getByText("テストメモA")).toBeInTheDocument();
    });
    expect(screen.getByText("（メモなし）")).toBeInTheDocument();
  });

  it("T-AP02: toss レコードが 0 件の場合「ありません」メッセージを表示", async () => {
    mockQueryResult.mockResolvedValue({ data: [], error: null });

    render(<AporanPage />);

    await waitFor(() => {
      expect(
        screen.getByText("本日のアポ済（未案件化）はありません")
      ).toBeInTheDocument();
    });
  });

  it("T-AP03: SELECT エラー時にエラーメッセージを表示", async () => {
    mockQueryResult.mockResolvedValue({ data: null, error: { message: "DB error" } });

    render(<AporanPage />);

    await waitFor(() => {
      expect(
        screen.getByText(/アポ済リストの取得に失敗しました/)
      ).toBeInTheDocument();
    });
  });
});
