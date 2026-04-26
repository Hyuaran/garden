/**
 * Garden-Bloom — CeoStatusEditor regression test
 *
 * 配置目的:
 *   Bloom-002 Phase 4 が src/app/bloom/_components/CeoStatusEditor.tsx を実装した時点で、
 *   form 動作（select 変更 / summary バリデーション / submit 後 toast）を回帰固定する。
 *
 * 前提（実装側に対する要求）:
 *   - props:
 *       - initialStatus: "available" | "busy" | "offline"
 *       - initialSummary?: string
 *       - onSuccess?: () => void   (submit 成功時 callback)
 *   - select でステータス切替（aria-label="ステータス" 想定）
 *   - textarea / input で summary 編集（aria-label="一言メモ" 想定）
 *   - 200 字を超えたらフォーム下にエラー表示「200 字以内」
 *   - submit ボタン押下で PUT /api/ceo-status を呼び、成功時に onSuccess を呼ぶ
 *
 * 制約:
 *   - 親 §13/§開発ルールにより新規 npm パッケージ追加禁止 → @testing-library/user-event は未導入
 *   - したがって fireEvent ベースで記述（既存テストも fireEvent / RTL のみで動作）
 *
 * mock 戦略:
 *   - global fetch を vi.stubGlobal で差し替え、PUT /api/ceo-status の応答を制御
 *
 * 注意:
 *   - import path はテスト先行のため仮置き
 *   - aria-label / placeholder の最終的な文言は Bloom-002 実装側で要確定
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

// 仮 path: Bloom-002 で `src/app/bloom/_components/CeoStatusEditor.tsx` を作成する前提。
import { CeoStatusEditor } from "@/app/bloom/_components/CeoStatusEditor";

// -------------------------------------------------------------------------
// Helpers
// -------------------------------------------------------------------------

function getStatusSelect(): HTMLSelectElement {
  // aria-label / role どちらでも拾えるよう冗長に記述
  const byLabel =
    screen.queryByLabelText(/ステータス/i) ||
    screen.queryByRole("combobox", { name: /ステータス/i });
  if (!byLabel) throw new Error("status select が見つからない（aria-label='ステータス' 想定）");
  return byLabel as HTMLSelectElement;
}

function getSummaryInput(): HTMLTextAreaElement | HTMLInputElement {
  const byLabel =
    screen.queryByLabelText(/一言メモ|summary|メモ/i) ||
    screen.queryByRole("textbox", { name: /一言メモ|summary|メモ/i });
  if (!byLabel) throw new Error("summary input が見つからない");
  return byLabel as HTMLTextAreaElement | HTMLInputElement;
}

function getSubmitButton(): HTMLButtonElement {
  const btn =
    screen.queryByRole("button", { name: /更新|保存|submit|送信/i }) ??
    screen.queryByText(/更新|保存|送信/i)?.closest("button");
  if (!btn) throw new Error("submit ボタンが見つからない");
  return btn as HTMLButtonElement;
}

// -------------------------------------------------------------------------
// Setup
// -------------------------------------------------------------------------

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  // デフォルトは PUT 成功
  fetchMock.mockResolvedValue(
    new Response(
      JSON.stringify({
        status: "busy",
        summary: "会議中",
        updated_at: "2026-04-26T04:00:00.000Z",
      }),
      { status: 200, headers: { "content-type": "application/json" } },
    ),
  );
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

// -------------------------------------------------------------------------
// Tests
// -------------------------------------------------------------------------

describe("CeoStatusEditor", () => {
  it("ステータス変更 select で値が更新される", () => {
    render(<CeoStatusEditor initialStatus="available" />);
    const select = getStatusSelect();
    expect(select.value).toBe("available");

    fireEvent.change(select, { target: { value: "busy" } });
    expect(select.value).toBe("busy");
  });

  it("summary 入力フィールドで 200 字までは受付、201 字でエラー表示", () => {
    render(<CeoStatusEditor initialStatus="available" />);
    const input = getSummaryInput();

    // 200 字: エラーなし
    fireEvent.change(input, { target: { value: "あ".repeat(200) } });
    expect(screen.queryByText(/200\s*字以内/)).not.toBeInTheDocument();

    // 201 字: エラー表示
    fireEvent.change(input, { target: { value: "あ".repeat(201) } });
    expect(screen.getByText(/200\s*字以内/)).toBeInTheDocument();
  });

  it("submit 後、onSuccess callback / toast 通知のいずれかが発火する", async () => {
    const onSuccess = vi.fn();
    render(
      <CeoStatusEditor
        initialStatus="available"
        initialSummary="初期メモ"
        onSuccess={onSuccess}
      />,
    );

    const select = getStatusSelect();
    fireEvent.change(select, { target: { value: "busy" } });

    const input = getSummaryInput();
    fireEvent.change(input, { target: { value: "会議中" } });

    const submit = getSubmitButton();
    fireEvent.click(submit);

    // PUT /api/ceo-status が呼ばれていることを確認
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalled();
    });
    const [calledUrl, calledInit] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(calledUrl).toContain("/api/ceo-status");
    expect(calledInit?.method?.toUpperCase()).toBe("PUT");

    // onSuccess が呼ばれる、または toast 要素が DOM に出現するの OR 検証
    await waitFor(() => {
      const toastShown =
        screen.queryByRole("status") !== null ||
        screen.queryByText(/更新しました|保存しました|success/i) !== null;
      expect(onSuccess.mock.calls.length > 0 || toastShown).toBe(true);
    });
  });
});
