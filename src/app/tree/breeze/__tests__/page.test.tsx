/**
 * Garden-Tree Breeze チャット画面 — D-02 Step 9.1 テスト
 *
 * T-BR01: 画面が正常にレンダリングされること（スモークテスト）
 *
 * DONE_WITH_CONCERNS:
 *  spec §3.4 では Breeze = 呼吸連続架電画面として
 *  insertTreeCallRecordWithQueue の呼出を想定しているが、
 *  本画面はチャット画面として実装されており Supabase 架電連携は存在しない。
 *  本テストはチャット画面としての動作確認のみを行う。
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

vi.mock("../../_state/TreeStateContext", () => ({
  useTreeState: () => ({
    treeUser: { name: "テストユーザー" },
  }),
}));

import BreezePage from "../page";

describe("BreezePage（チャット画面）— D-02 Step 9.1", () => {
  it("T-BR01: 画面が正常にレンダリングされる（スモークテスト）", () => {
    render(<BreezePage />);
    // 「🍃 Breeze」ラベルと「Breezeのメッセージ〜」テキストの複数ヒットを考慮
    const matches = screen.getAllByText(/Breeze/);
    expect(matches.length).toBeGreaterThan(0);
  });

  it("T-BR02: チャネル切替ボタンが 4 つ表示される", () => {
    render(<BreezePage />);
    expect(screen.getByText("全体")).toBeInTheDocument();
    expect(screen.getByText("トスチーム")).toBeInTheDocument();
    expect(screen.getByText("クローザーチーム")).toBeInTheDocument();
    expect(screen.getByText("お知らせ")).toBeInTheDocument();
  });

  it("T-BR03: メッセージを入力して送信できる", () => {
    render(<BreezePage />);
    const input = screen.getByPlaceholderText("メッセージを入力...");
    fireEvent.change(input, { target: { value: "テストメッセージ" } });
    fireEvent.click(screen.getByText("送信"));
    expect(screen.getByText("テストメッセージ")).toBeInTheDocument();
  });
});
