"use client";

/**
 * Garden-Bud — 07_Shiwakechou 仕訳帳ダッシュボード
 *
 * 対応 dispatch: main- No. 277（5/12 後段 alpha = 仕訳閲覧 + 弥生 export ボタン）
 *
 * alpha 版スコープ:
 *   - 仕訳サマリ（件数 / 借方貸方 / status 別）
 *   - 仕訳一覧テーブル（10 件 mock data、4 status 網羅）
 *   - 弥生 export ボタン（mock 動作、後続段階で実装）
 *
 * 後続スコープ（PR 別段階）:
 *   - Supabase テーブル接続（migration は本 PR 同梱）
 *   - # 276 Bank の bud_bank_transactions → 仕訳自動生成（Forest 既実装 import）
 *   - 勘定科目自動判定ルールエンジン
 *   - 弥生 CSV エンコーダー（Shift-JIS + CRLF）
 *   - 検索 + フィルター UI（年月 / 法人 / 科目 / status / 金額範囲）
 *   - ページネーション
 */

import { BudGate } from "../_components/BudGate";
import { BudShell } from "../_components/BudShell";
import { JournalSummaryBar } from "./_components/JournalSummaryBar";
import { JournalTable } from "./_components/JournalTable";
import { getMockJournalSummary } from "./_lib/mock-journal-data";

function ShiwakechouPageContent() {
  const summary = getMockJournalSummary();

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <header className="mb-6 flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">仕訳帳</h1>
          <p className="text-sm text-gray-500 mt-1">
            仕訳一覧 + 弥生エクスポート連動
          </p>
          <div className="mt-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2 inline-block">
            🚧 alpha 版: mock 仕訳 10 件表示中。# 276 Bank からの自動仕訳化 / 弥生
            export / 検索 UI は後続段階で実装。
          </div>
        </div>

        <button
          type="button"
          className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded font-semibold text-sm shadow"
          title="alpha では未実装、後続段階で実装"
          disabled
        >
          📤 弥生エクスポート（alpha 未実装）
        </button>
      </header>

      <JournalSummaryBar summary={summary} />

      <JournalTable
        entries={summary.entries}
        accounts={summary.accounts}
      />

      <footer className="mt-6 text-xs text-gray-500 space-y-1">
        <p>
          💡 仕訳帳は本来 Bud（経理スコープ）に配置。本 PR で Forest から Bud へ正式移管。
        </p>
        <p>
          🔗 # 276 Bank の bud_bank_transactions と FK 連動。CSV 取込時に
          source_bank_transaction_id 付与で自動仕訳化可能。
        </p>
        <p>
          📤 弥生 export は Forest 既実装（commit 105e322 / e73329e）の Bud import 後に動作。
        </p>
      </footer>
    </div>
  );
}

export default function ShiwakechouPage() {
  return (
    <BudGate>
      <BudShell>
        <ShiwakechouPageContent />
      </BudShell>
    </BudGate>
  );
}
