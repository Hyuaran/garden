"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { BudGate } from "../../_components/BudGate";
import { BudShell } from "../../_components/BudShell";
import { useBudState } from "../../_state/BudStateContext";
import { supabase } from "../../_lib/supabase";
import {
  fetchStatementList,
  type BudStatementRow,
} from "../../_lib/statement-queries";
import {
  aggregateByCategory,
  aggregateByDate,
  aggregateByBankAccount,
  totalAggregate,
  monthBoundary,
} from "../../_lib/statement-aggregator";

interface BankAccount {
  account_id: string;
  bank_name: string;
  account_number: string;
}

function defaultMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function StatementsSummaryContent() {
  const { sessionUser } = useBudState();
  const [yyyymm, setYyyymm] = useState(defaultMonth());
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [statements, setStatements] = useState<BudStatementRow[]>([]);
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

  const range = useMemo(() => monthBoundary(yyyymm), [yyyymm]);

  useEffect(() => {
    if (!range) {
      setStatements([]);
      setError("月の指定が不正です");
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const data = await fetchStatementList({
          fromDate: range.from,
          toDate: range.to,
          limit: 1000,
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
  }, [range?.from, range?.to]);

  const bankNameMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const a of bankAccounts) {
      m.set(a.account_id, `${a.bank_name} ${a.account_number}`);
    }
    return m;
  }, [bankAccounts]);

  const total = useMemo(() => totalAggregate(statements), [statements]);
  const byCategory = useMemo(
    () => aggregateByCategory(statements),
    [statements],
  );
  const byBank = useMemo(
    () => aggregateByBankAccount(statements),
    [statements],
  );
  const byDate = useMemo(() => aggregateByDate(statements), [statements]);

  if (!sessionUser) return null;

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">月次集計</h1>
          <p className="text-sm text-gray-500 mt-1">
            指定月の入出金を費目別・口座別・日別で集計
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
            href="/bud/statements/imports"
            className="text-emerald-600 hover:underline"
          >
            取込履歴 →
          </Link>
        </nav>
      </div>

      <section className="mb-4 flex items-end gap-3 bg-white border border-gray-200 rounded p-3">
        <label className="block">
          <span className="text-xs text-gray-600">対象月</span>
          <input
            type="month"
            value={yyyymm}
            onChange={(e) => setYyyymm(e.target.value)}
            className="mt-1 block rounded border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
          />
        </label>
        {range && (
          <p className="text-xs text-gray-500 mb-2">
            集計範囲: {range.from} 〜 {range.to}
          </p>
        )}
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
        <>
          <section className="mb-6 grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card label="入金合計" value={`¥${total.inflow.toLocaleString()}`} accent="emerald" />
            <Card label="出金合計" value={`¥${total.outflow.toLocaleString()}`} accent="rose" />
            <Card label="差引" value={`¥${total.netChange.toLocaleString()}`} accent={total.netChange >= 0 ? "emerald" : "rose"} />
            <Card label="件数" value={`${total.count} 件`} accent="blue" />
          </section>

          <BreakdownSection
            title="費目別"
            entries={byCategory}
            keyLabel="費目"
            keyDisplay={(k) => k}
          />
          <BreakdownSection
            title="口座別"
            entries={byBank}
            keyLabel="口座"
            keyDisplay={(k) => bankNameMap.get(k) ?? k}
          />
          <BreakdownSection
            title="日別"
            entries={byDate}
            keyLabel="日付"
            keyDisplay={(k) => k}
            compact
          />
        </>
      )}
    </div>
  );
}

interface BreakdownProps {
  title: string;
  entries: Array<{
    key: string;
    inflow: number;
    outflow: number;
    count: number;
    netChange: number;
  }>;
  keyLabel: string;
  keyDisplay: (key: string) => string;
  compact?: boolean;
}

function BreakdownSection({
  title,
  entries,
  keyLabel,
  keyDisplay,
  compact,
}: BreakdownProps) {
  if (entries.length === 0) return null;
  return (
    <section className="mb-6 bg-white border border-gray-200 rounded-lg overflow-hidden">
      <h2 className="bg-gray-50 px-4 py-2 text-sm font-medium text-gray-700 border-b">
        {title}
      </h2>
      <table className="w-full text-sm">
        <thead className="bg-gray-50 text-gray-600 text-xs">
          <tr>
            <th className="px-3 py-2 text-left">{keyLabel}</th>
            <th className="px-3 py-2 text-right">件数</th>
            <th className="px-3 py-2 text-right">入金</th>
            <th className="px-3 py-2 text-right">出金</th>
            <th className="px-3 py-2 text-right">差引</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 text-gray-900">
          {entries.slice(0, compact ? 31 : 50).map((e) => (
            <tr key={e.key}>
              <td className="px-3 py-2">{keyDisplay(e.key)}</td>
              <td className="px-3 py-2 text-right text-gray-600">{e.count}</td>
              <td className="px-3 py-2 text-right text-emerald-700">
                {e.inflow > 0 ? `¥${e.inflow.toLocaleString()}` : "—"}
              </td>
              <td className="px-3 py-2 text-right text-rose-700">
                {e.outflow > 0 ? `¥${e.outflow.toLocaleString()}` : "—"}
              </td>
              <td
                className={`px-3 py-2 text-right font-medium ${
                  e.netChange >= 0 ? "text-emerald-800" : "text-rose-800"
                }`}
              >
                ¥{e.netChange.toLocaleString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
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

export default function StatementsSummaryPage() {
  return (
    <BudGate>
      <BudShell>
        <StatementsSummaryContent />
      </BudShell>
    </BudGate>
  );
}
