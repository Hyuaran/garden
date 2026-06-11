"use client";

/**
 * Bud 経費精算 — 承認待ち（経理レビュー）単体ページ
 * 本体は /bud/expenses の承認待ちタブに埋め込み（ExpenseReviewEmbed）。
 * このページは直接リンク用のスタンドアロン版（同じ ExpenseReviewPanel を使用）。
 */

import { BudGate } from "../../_components/BudGate";
import { ExpenseReviewPanel } from "../_components/ExpenseReviewPanel";

export default function ExpenseReviewPage() {
  return (
    <BudGate>
      <main style={{ maxWidth: 1000, margin: "0 auto", padding: "24px 20px 60px" }}>
        <ExpenseReviewPanel />
      </main>
    </BudGate>
  );
}
