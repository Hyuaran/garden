"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { BudGate } from "../_components/BudGate";
import { BudShell } from "../_components/BudShell";
import { useBudState } from "../_state/BudStateContext";
import { supabase } from "../_lib/supabase";
import {
  fetchStatementList,
  type BudStatementRow,
} from "../_lib/statement-queries";
import { StatementImportModal } from "./_components/StatementImportModal";
import { ManualAssignModal } from "./_components/ManualAssignModal";

interface BankAccount {
  account_id: string;
  bank_name: string;
  branch_name: string;
  account_number: string;
}

function StatementsContent() {
  const { sessionUser } = useBudState();
  const [statements, setStatements] = useState<BudStatementRow[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "matched" | "unmatched">("all");
  const [bankFilter, setBankFilter] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  const [importOpen, setImportOpen] = useState(false);
  const [assignTarget, setAssignTarget] = useState<BudStatementRow | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("root_bank_accounts")
        .select("account_id, bank_name, branch_name, account_number")
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
        const data = await fetchStatementList({
          bankAccountId: bankFilter || undefined,
          matchedOnly: filter === "matched",
          unmatchedOnly: filter === "unmatched",
          limit: 200,
        });
        if (!cancelled) setStatements(data);
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [filter, bankFilter, reloadKey]);

  const reload = useCallback(() => {
    setReloadKey((n) => n + 1);
  }, []);

  const summary = useMemo(() => {
    let inflow = 0;
    let outflow = 0;
    let matched = 0;
    let unmatched = 0;
    for (const s of statements) {
      if (s.amount > 0) inflow += s.amount;
      else outflow += -s.amount;
      if (s.matched_transfer_id) matched++;
      else unmatched++;
    }
    return { inflow, outflow, matched, unmatched };
  }, [statements]);

  if (!sessionUser) return null;

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">明細管理</h1>
          <p className="text-sm text-gray-500 mt-1">
            銀行入出金の取込・自動照合・手動割当
          </p>
        </div>
        <div className="flex gap-2 items-center">
          <Link
            href="/bud/statements/summary"
            className="text-sm text-emerald-700 hover:underline"
          >
            月次集計
          </Link>
          <Link
            href="/bud/statements/imports"
            className="text-sm text-emerald-700 hover:underline"
          >
            取込履歴
          </Link>
          <button
            type="button"
            onClick={() => setImportOpen(true)}
            className="bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-emerald-700"
          >
            + CSV 取込
          </button>
        </div>
      </div>

      <section className="mb-4 grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card label="入金合計" value={`¥${summary.inflow.toLocaleString()}`} accent="emerald" />
        <Card label="出金合計" value={`¥${summary.outflow.toLocaleString()}`} accent="rose" />
        <Card label="照合済" value={`${summary.matched} 件`} accent="blue" />
        <Card label="未照合" value={`${summary.unmatched} 件`} accent="amber" />
      </section>

      <section className="mb-3 flex flex-wrap gap-3 items-center bg-white border border-gray-200 rounded p-3">
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
        <div className="flex gap-1">
          {(["all", "matched", "unmatched"] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={`px-3 py-1 text-xs rounded ${
                filter === f
                  ? "bg-emerald-600 text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              {f === "all" ? "すべて" : f === "matched" ? "照合済" : "未照合"}
            </button>
          ))}
        </div>
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
                <th className="px-3 py-2 text-left">取引日</th>
                <th className="px-3 py-2 text-left">摘要</th>
                <th className="px-3 py-2 text-right">金額</th>
                <th className="px-3 py-2 text-left">照合状況</th>
                <th className="px-3 py-2 text-left">アクション</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-gray-900">
              {statements.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-3 py-8 text-center text-gray-400"
                  >
                    該当する明細がありません
                  </td>
                </tr>
              ) : (
                statements.map((s) => (
                  <tr key={s.id} className="hover:bg-gray-50">
                    <td className="px-3 py-2 text-gray-700">
                      {s.transaction_date}
                    </td>
                    <td className="px-3 py-2">{s.description}</td>
                    <td
                      className={`px-3 py-2 text-right font-medium ${
                        s.amount < 0 ? "text-rose-700" : "text-emerald-700"
                      }`}
                    >
                      ¥{Math.abs(s.amount).toLocaleString()}
                      {s.amount < 0 && (
                        <span className="text-xs ml-1">(出)</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {s.matched_transfer_id ? (
                        <span className="text-xs text-blue-700">
                          ✓ {s.match_confidence}（{s.matched_transfer_id}）
                        </span>
                      ) : (
                        <span className="text-xs text-amber-700">未照合</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {!s.matched_transfer_id && s.amount < 0 && (
                        <button
                          type="button"
                          onClick={() => setAssignTarget(s)}
                          className="text-xs text-emerald-700 hover:underline"
                        >
                          手動割当
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-3 text-xs text-gray-400">
        {statements.length} 件表示
      </div>

      <StatementImportModal
        open={importOpen}
        bankAccounts={bankAccounts}
        onClose={() => setImportOpen(false)}
        onImported={() => {
          reload();
        }}
      />
      <ManualAssignModal
        open={!!assignTarget}
        statement={assignTarget}
        onClose={() => setAssignTarget(null)}
        onAssigned={() => {
          setAssignTarget(null);
          reload();
        }}
      />
    </div>
  );
}

function Card({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent: "emerald" | "rose" | "blue" | "amber";
}) {
  const bg = {
    emerald: "bg-emerald-50 border-emerald-200 text-emerald-900",
    rose: "bg-rose-50 border-rose-200 text-rose-900",
    blue: "bg-blue-50 border-blue-200 text-blue-900",
    amber: "bg-amber-50 border-amber-200 text-amber-900",
  }[accent];
  return (
    <div className={`border rounded-lg p-3 ${bg}`}>
      <div className="text-xs">{label}</div>
      <div className="text-lg font-bold mt-1">{value}</div>
    </div>
  );
}

export default function StatementsPage() {
  return (
    <BudGate>
      <BudShell>
        <StatementsContent />
      </BudShell>
    </BudGate>
  );
}
