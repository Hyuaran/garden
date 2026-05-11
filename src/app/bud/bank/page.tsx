"use client";

/**
 * Garden-Bud — 03_Bank 銀行口座 + 残高ダッシュボード
 *
 * 対応 dispatch: main- No. 276（5/12 後道さんデモ前 alpha = 残高表示のみ）
 *
 * alpha 版スコープ:
 *   - 6 法人 × 4 銀行の残高サマリ表示
 *   - 5/11 11:48 mock data 埋め込み（Supabase 移行は後続）
 *   - 総合計 ¥103,703,627（東海林さん手作業集計値と一致）
 *
 * 後続スコープ（PR 別段階）:
 *   - Supabase テーブル接続（migration は本 PR に同梱）
 *   - CSV パーサー連動（Forest 既実装 import）
 *   - 手入力残高 UI（admin 用）
 *   - 後道さん Chatwork 通知
 */

import { BudGate } from "../_components/BudGate";
import { BudShell } from "../_components/BudShell";
import { CorpSummaryCard } from "./_components/CorpSummaryCard";
import { GrandTotalCard } from "./_components/GrandTotalCard";
import { getMockAllCorpsSummary } from "./_lib/mock-balance-20260511";

function BankPageContent() {
  const summary = getMockAllCorpsSummary();

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">
          銀行口座管理
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          6 法人 × 4 銀行（みずほ / 楽天 / PayPay / 京都）の残高サマリ
        </p>
        <div className="mt-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2 inline-block">
          🚧 alpha 版: 5/11 11:48 mock data 表示中。CSV 取込 / 手入力 UI / 後道さん通知は後続段階で実装。
        </div>
      </header>

      <GrandTotalCard summary={summary} />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {summary.corpSummaries.map((corp) => (
          <CorpSummaryCard key={corp.corpCode} summary={corp} />
        ))}
      </div>

      <footer className="mt-8 text-xs text-gray-500">
        <p>
          💡 みずほ全 4 法人 / PayPay 2 法人は通帳ベース手入力（CSV に残高列なし or システム障害）。
          楽天 / 京都は CSV 自動取込予定（Forest 既実装 import 後）。
        </p>
        <p className="mt-1">
          MF API エラー期間中の暫定 UI。MF API 復旧後は api_sync ソースに自動切替。
        </p>
      </footer>
    </div>
  );
}

export default function BankPage() {
  return (
    <BudGate>
      <BudShell>
        <BankPageContent />
      </BudShell>
    </BudGate>
  );
}
