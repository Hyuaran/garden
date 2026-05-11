/**
 * Garden-Tree Branch 画面 — Supabase 連携テスト
 *
 * D-02 Step 4: tree_call_records INSERT 呼出の確認
 *
 * テストケース:
 *  T-B01: 結果ボタン押下時に insertTreeCallRecord が呼ばれること
 *  T-B02: localStorage に session_id / campaign_code が無い場合は
 *          insertTreeCallRecord を呼ばずに insertCall のみ完了すること
 *  T-B03: insertTreeCallRecord がエラーを返した場合にエラー表示されること
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";

// --- モック ---
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("../../../_state/TreeStateContext", () => ({
  useTreeState: () => ({
    treeUser: {
      employee_id: "EMP001",
      employee_number: "001",
      name: "テストユーザー",
    },
  }),
}));

vi.mock("../../../_lib/queries", () => ({
  insertCall: vi.fn().mockResolvedValue({ success: true }),
}));

vi.mock("../../../_actions/insertTreeCallRecord", () => ({
  insertTreeCallRecord: vi.fn().mockResolvedValue({ success: true, call_id: "uuid-test" }),
}));

vi.mock("../../../_lib/supabase", () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: { session: { access_token: "test-token" } },
      }),
    },
  },
}));

import { insertCall } from "../../../_lib/queries";
import { insertTreeCallRecord } from "../../../_actions/insertTreeCallRecord";
import CallingBranchPage from "../page";

// --- localStorage ヘルパー ---
function setLocalStorage(sessionId: string | null, campaignCode: string | null) {
  if (sessionId !== null) {
    localStorage.setItem("tree.current_session_id", sessionId);
  } else {
    localStorage.removeItem("tree.current_session_id");
  }
  if (campaignCode !== null) {
    localStorage.setItem("tree.current_campaign_code", campaignCode);
  } else {
    localStorage.removeItem("tree.current_campaign_code");
  }
}

describe("CallingBranchPage — tree_call_records 連携", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    // insertCall は毎回 success にリセット
    (insertCall as ReturnType<typeof vi.fn>).mockResolvedValue({ success: true });
    (insertTreeCallRecord as ReturnType<typeof vi.fn>).mockResolvedValue({
      success: true,
      call_id: "uuid-test",
    });
  });

  /**
   * T-B01: 結果ボタン押下時に insertTreeCallRecord が呼ばれること
   *
   * - localStorage に session_id / campaign_code を設定済み
   * - 「inputting」フェーズに遷移して「受注」ボタンを押す
   * - insertTreeCallRecord が result_code='order' で呼ばれること
   */
  it("T-B01: 結果ボタン押下時に insertTreeCallRecord が呼ばれる", async () => {
    setLocalStorage("session-abc", "campaign-xyz");

    render(<CallingBranchPage />);

    // 発信ボタンで calling フェーズへ
    const dialButton = screen.getByText("発信");
    await act(async () => {
      fireEvent.click(dialButton);
    });

    // 切電で inputting フェーズへ
    const hangupButton = screen.getByText("切電");
    await act(async () => {
      fireEvent.click(hangupButton);
    });

    // 「受注」ボタンを押す
    const orderButton = screen.getByText("受注");
    await act(async () => {
      fireEvent.click(orderButton);
    });

    expect(insertCall).toHaveBeenCalledOnce();
    expect(insertTreeCallRecord).toHaveBeenCalledOnce();
    expect(insertTreeCallRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        session_id: "session-abc",
        campaign_code: "campaign-xyz",
        result_code: "order",
        result_group: "positive",
      })
    );
  });

  /**
   * T-B02: localStorage に session_id / campaign_code が無い場合は
   *         insertTreeCallRecord を呼ばないこと
   */
  it("T-B02: localStorage が空の場合 insertTreeCallRecord をスキップ", async () => {
    // localStorage にセットしない
    setLocalStorage(null, null);

    render(<CallingBranchPage />);

    // 発信 → 切電 → 結果ボタン
    await act(async () => {
      fireEvent.click(screen.getByText("発信"));
    });
    await act(async () => {
      fireEvent.click(screen.getByText("切電"));
    });
    await act(async () => {
      fireEvent.click(screen.getByText("担不"));
    });

    expect(insertCall).toHaveBeenCalledOnce();
    expect(insertTreeCallRecord).not.toHaveBeenCalled();
  });

  /**
   * T-B03: insertTreeCallRecord がエラーを返した場合にエラー表示されること
   */
  it("T-B03: insertTreeCallRecord エラー時にエラーメッセージが表示される", async () => {
    setLocalStorage("session-abc", "campaign-xyz");
    (insertTreeCallRecord as ReturnType<typeof vi.fn>).mockResolvedValue({
      success: false,
      errorCode: "DB_ERROR",
      errorMessage: "コール記録の保存に失敗しました",
    });

    render(<CallingBranchPage />);

    await act(async () => {
      fireEvent.click(screen.getByText("発信"));
    });
    await act(async () => {
      fireEvent.click(screen.getByText("切電"));
    });
    await act(async () => {
      fireEvent.click(screen.getByText("受注"));
    });

    expect(
      await screen.findByText(/コール記録の保存に失敗しました/)
    ).toBeInTheDocument();
  });
});
