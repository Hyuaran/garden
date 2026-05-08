"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { BudGate } from "../../_components/BudGate";
import { BudShell } from "../../_components/BudShell";
import { useBudState } from "../../_state/BudStateContext";
import { supabase } from "../../_lib/supabase";
import {
  fetchImportBatches,
  type BudStatementImportBatchRow,
} from "../../_lib/statement-queries";

interface BankAccount {
  account_id: string;
  bank_name: string;
  account_number: string;
}

const SOURCE_TYPE_LABELS: Record<string, string> = {
  rakuten_csv: "楽天銀行",
  mizuho_csv: "みずほ銀行",
  paypay_csv: "PayPay 銀行",
  manual: "手動",
};

const STATUS_LABELS: Record<string, string> = {
  completed: "完了",
  partial: "一部成功",
  failed: "失敗",
};

const STATUS_BG: Record<string, string> = {
  completed: "bg-emerald-100 text-emerald-800",
  partial: "bg-amber-100 text-amber-800",
  failed: "bg-rose-100 text-rose-800",
};

function StatementsImportsContent() {
  const { sessionUser } = useBudState();
  const [batches, setBatches] = useState<BudStatementImportBatchRow[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [bankFilter, setBankFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("root_bank_accounts")
        .select("account_id, bank_name, account_number")
        .order("bank_name");
      if (!cancelled) setBankAccounts((data ?? []) as BankAccount[]);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const data = await fetchImportBatches(bankFilter || undefined);
        if (!cancelled) setBatches(data);
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [bankFilter]);

  const bankNameMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const a of bankAccounts) {
      m.set(a.account_id, `${a.bank_name} ${a.account_number}`);
    }
    return m;
  }, [bankAccounts]);

  if (!sessionUser) return null;

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">取込バッチ履歴</h1>
          <p className="text-sm text-gray-500 mt-1">
            銀行 CSV 取込の実行履歴・件数・成否
          </p>
        </div>
        <nav className="flex gap-2 text-sm">
          <Link
            href="/bud/statements"
            className="text-emerald-600 hover:underline"
          >
            ← 明細一覧
          </Link>
          <Link
            href="/bud/statements/summary"
            className="text-emerald-600 hover:underline"
          >
            ← 月次集計
          </Link>
        </nav>
      </div>

      <section className="mb-3 flex items-center gap-3 bg-white border border-gray-200 rounded p-3">
        <label className="text-sm">
          <span className="text-xs text-gray-600 mr-2">口座:</span>
          <select
            value={bankFilter}
            onChange={(e) => setBankFilter(e.target.value)}
            className="rounded border border-gray-300 bg-white px-2 py-1 text-sm text-gray-900"
          >
            <option value="">すべて</option>
            {bankAccounts.map((a) => (
              <option key={a.account_id} value={a.account_id}>
                {a.bank_name} {a.account_number}
              </option>
            ))}
          </select>
        </label>
      </section>

      {loading ? (
        <div className="text-center py-8 text-gray-500">読み込み中…</div>
      ) : error ? (
        <div
          role="alert"
          className="bg-red-50 border border-red-200 text-red-800 rounded p-4"
        >
          {error}
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600 text-xs">
              <tr>
                <th className="px-3 py-2 text-left">取込日時</th>
                <th className="px-3 py-2 text-left">口座</th>
                <th className="px-3 py-2 text-left">形式</th>
                <th className="px-3 py-2 text-left">ファイル名</th>
                <th className="px-3 py-2 text-right">行数</th>
                <th className="px-3 py-2 text-right">成功</th>
                <th className="px-3 py-2 text-right">スキップ</th>
                <th className="px-3 py-2 text-right">エラー</th>
                <th className="px-3 py-2 text-right">自動照合</th>
                <th className="px-3 py-2 text-left">状態</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-gray-900">
              {batches.length === 0 ? (
                <tr>
                  <td
                    colSpan={10}
                    className="px-3 py-8 text-center text-gray-400"
                  >
                    取込履歴がありません
                  </td>
                </tr>
              ) : (
                batches.map((b) => (
                  <tr key={b.id} className="hover:bg-gray-50">
                    <td className="px-3 py-2 text-xs text-gray-700">
                      {new Date(b.imported_at).toLocaleString("ja-JP")}
                    </td>
                    <td className="px-3 py-2 text-gray-700 text-xs">
                      {bankNameMap.get(b.bank_account_id) ?? b.bank_account_id}
                    </td>
                    <td className="px-3 py-2 text-gray-700 text-xs">
                      {SOURCE_TYPE_LABELS[b.source_type] ?? b.source_type}
                    </td>
                    <td className="px-3 py-2 text-gray-700 text-xs truncate max-w-xs">
                      {b.file_name}
                    </td>
                    <td className="px-3 py-2 text-right text-gray-700">
                      {b.row_count}
                    </td>
                    <td className="px-3 py-2 text-right text-emerald-700 font-medium">
                      {b.success_count}
                    </td>
                    <td className="px-3 py-2 text-right text-gray-600">
                      {b.skipped_count}
                    </td>
                    <td
                      className={`px-3 py-2 text-right ${
                        b.error_count > 0
                          ? "text-rose-700 font-medium"
                          : "text-gray-400"
                      }`}
                    >
                      {b.error_count}
                    </td>
                    <td className="px-3 py-2 text-right text-blue-700">
                      {b.auto_matched_count}
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={`text-xs px-2 py-0.5 rounded ${
                          STATUS_BG[b.status] ?? "bg-gray-100 text-gray-700"
                        }`}
                      >
                        {STATUS_LABELS[b.status] ?? b.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      <p className="mt-3 text-xs text-gray-400">
        {batches.length} 件表示（最新 50 件まで）
      </p>
    </div>
  );
}

export default function StatementsImportsPage() {
  return (
    <BudGate>
      <BudShell>
        <StatementsImportsContent />
      </BudShell>
    </BudGate>
  );
}
