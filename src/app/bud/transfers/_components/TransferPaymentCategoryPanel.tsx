"use client";

import { useEffect, useMemo, useState } from "react";

import { supabase } from "../../_lib/supabase";
import {
  PAYMENT_CATEGORY_TABS,
  filterByPaymentCategory,
  formatPaymentCategory,
  formatRegisteredMethod,
  normalizePaymentCategory,
  type PaymentCategory,
} from "../_lib/payment-category";

type TransferRow = {
  transfer_id: string;
  payment_category?: string | null;
  registered_method?: string | null;
  manual_paid_at?: string | null;
  payeasy_biller_no?: string | null;
  payeasy_customer_no?: string | null;
  payeasy_confirm_no?: string | null;
  payee_name: string | null;
  amount: number | null;
  scheduled_date: string | null;
  status: string | null;
  description: string | null;
};

const SELECT_WITH_PAYMENT =
  "transfer_id,payment_category,registered_method,manual_paid_at,payeasy_biller_no,payeasy_customer_no,payeasy_confirm_no,payee_name,amount,scheduled_date,status,description";
const SELECT_FALLBACK =
  "transfer_id,payee_name,amount,scheduled_date,status,description";

export function TransferPaymentCategoryPanel() {
  const [rows, setRows] = useState<TransferRow[]>([]);
  const [schemaReady, setSchemaReady] = useState(true);
  const [activeTab, setActiveTab] = useState<PaymentCategory>("transfer");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadRows = async () => {
    setLoading(true);
    setError(null);
    const primary = await supabase
      .from("bud_transfers")
      .select(SELECT_WITH_PAYMENT)
      .order("scheduled_date", { ascending: true });

    if (primary.error) {
      const fallback = await supabase
        .from("bud_transfers")
        .select(SELECT_FALLBACK)
        .order("scheduled_date", { ascending: true });
      if (fallback.error) {
        setError(fallback.error.message);
        setRows([]);
      } else {
        setSchemaReady(false);
        setActiveTab("transfer");
        setRows((fallback.data ?? []) as TransferRow[]);
      }
    } else {
      setSchemaReady(true);
      setRows((primary.data ?? []) as TransferRow[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    const timer = window.setTimeout(() => void loadRows(), 0);
    return () => window.clearTimeout(timer);
  }, []);

  const tabs = schemaReady ? PAYMENT_CATEGORY_TABS : (["transfer"] as const);
  const counts = useMemo(() => {
    return Object.fromEntries(PAYMENT_CATEGORY_TABS.map((category) => [category, filterByPaymentCategory(rows, category).length])) as Record<
      PaymentCategory,
      number
    >;
  }, [rows]);

  const visibleRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = filterByPaymentCategory(rows, activeTab).filter((row) => {
      if (!q) return true;
      return [row.transfer_id, row.payee_name, row.description].some((value) => (value ?? "").toLowerCase().includes(q));
    });
    if (activeTab !== "payeasy") return filtered;
    return [...filtered].sort((a, b) => {
      if (Boolean(a.manual_paid_at) !== Boolean(b.manual_paid_at)) return a.manual_paid_at ? 1 : -1;
      return (a.scheduled_date ?? "").localeCompare(b.scheduled_date ?? "");
    });
  }, [activeTab, query, rows]);

  const copyValue = async (key: string, value: string | null | undefined) => {
    if (!value) return;
    await navigator.clipboard.writeText(value);
    setCopiedKey(key);
    window.setTimeout(() => setCopiedKey((current) => (current === key ? null : current)), 1600);
  };

  const toggleManualPaid = async (row: TransferRow) => {
    if (!schemaReady) return;
    const category = normalizePaymentCategory(row.payment_category);
    const paid = Boolean(row.manual_paid_at);
    const actionLabel = category === "cash" ? "精算済み" : "支払済み";
    const next = paid ? null : new Date().toISOString();
    if (!paid && !window.confirm(`${row.payee_name ?? row.transfer_id} を${actionLabel}にします。よろしいですか？`)) return;
    setBusyId(row.transfer_id);
    setError(null);
    const { error: updateError } = await supabase
      .from("bud_transfers")
      .update({ manual_paid_at: next })
      .eq("transfer_id", row.transfer_id);
    if (updateError) {
      setError(updateError.message);
    } else {
      setRows((current) => current.map((item) => (item.transfer_id === row.transfer_id ? { ...item, manual_paid_at: next } : item)));
    }
    setBusyId(null);
  };

  return (
    <section className="mx-auto mt-6 max-w-6xl rounded-lg border border-amber-200 bg-white/80 p-5 shadow-sm">
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="font-shippori text-lg font-semibold text-amber-950">支払区分別 一覧</h2>
          <p className="mt-1 text-xs leading-6 text-amber-800">
            振込・ペイジー・現金・決済登録済を分けて確認します。
            {!schemaReady && <span className="ml-2 text-red-700">新列未適用のため振込一覧のみ表示しています。</span>}
          </p>
        </div>
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="振込先 / 摘要 / ID"
          className="h-10 rounded border border-amber-200 bg-white px-3 text-sm text-gray-800 outline-none focus:border-amber-400"
        />
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {tabs.map((category) => (
          <button
            type="button"
            key={category}
            onClick={() => setActiveTab(category)}
            className={`rounded-full border px-4 py-2 text-sm ${
              activeTab === category
                ? "border-amber-500 bg-amber-500 text-white shadow-sm"
                : "border-amber-200 bg-amber-50 text-amber-900 hover:bg-amber-100"
            }`}
          >
            {formatPaymentCategory(category)}
            <span className="ml-2 rounded-full bg-white/70 px-2 py-0.5 text-xs text-amber-900">{counts[category]}</span>
          </button>
        ))}
      </div>

      {error && <div className="mb-3 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div>}
      {loading ? (
        <div className="rounded border border-amber-100 bg-amber-50/60 p-4 text-sm text-amber-800">読み込み中…</div>
      ) : visibleRows.length === 0 ? (
        <div className="rounded border border-amber-100 bg-amber-50/60 p-4 text-sm text-amber-800">対象の支払はありません。</div>
      ) : (
        <div className="overflow-x-auto rounded border border-amber-100 bg-white">
          <table className="w-full min-w-[880px] border-collapse text-sm">
            <thead className="bg-amber-100/70 text-left text-xs text-amber-950">
              <tr>
                <th className="px-4 py-3 font-medium">予定日</th>
                <th className="px-4 py-3 font-medium">支払先</th>
                <th className="px-4 py-3 text-right font-medium">金額</th>
                {activeTab === "payeasy" && <th className="px-4 py-3 font-medium">ペイジー番号</th>}
                {activeTab === "registered" && <th className="px-4 py-3 font-medium">決済方法</th>}
                <th className="px-4 py-3 font-medium">状態</th>
                <th className="px-4 py-3 text-right font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((row) => {
                const paid = Boolean(row.manual_paid_at);
                return (
                  <tr key={row.transfer_id} className={paid ? "border-t border-amber-100 bg-amber-50/40" : "border-t border-amber-100"}>
                    <td className="px-4 py-3 text-gray-700">{row.scheduled_date ?? "—"}</td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{row.payee_name ?? "—"}</div>
                      <div className="text-xs text-gray-500">{row.transfer_id}</div>
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-gray-900">¥{(row.amount ?? 0).toLocaleString("ja-JP")}</td>
                    {activeTab === "payeasy" && (
                      <td className="px-4 py-3">
                        <PayeasyCopyRow label="収納" value={row.payeasy_biller_no} rowId={row.transfer_id} copiedKey={copiedKey} onCopy={copyValue} />
                        <PayeasyCopyRow label="お客様" value={row.payeasy_customer_no} rowId={row.transfer_id} copiedKey={copiedKey} onCopy={copyValue} />
                        <PayeasyCopyRow label="確認" value={row.payeasy_confirm_no} rowId={row.transfer_id} copiedKey={copiedKey} onCopy={copyValue} />
                      </td>
                    )}
                    {activeTab === "registered" && (
                      <td className="px-4 py-3 text-gray-700">{formatRegisteredMethod(row.registered_method)}</td>
                    )}
                    <td className="px-4 py-3 text-gray-700">
                      {paid ? <span className="text-green-700">✓ {activeTab === "cash" ? "精算済み" : "支払済み"}</span> : row.status ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {(activeTab === "payeasy" || activeTab === "cash") && (
                        <button
                          type="button"
                          onClick={() => void toggleManualPaid(row)}
                          disabled={busyId === row.transfer_id}
                          className="rounded border border-amber-300 px-3 py-1.5 text-xs text-amber-900 hover:bg-amber-50 disabled:opacity-50"
                        >
                          {paid ? "取消" : activeTab === "cash" ? "精算済みにする" : "支払済みにする"}
                        </button>
                      )}
                      {activeTab === "registered" && <span className="text-xs text-gray-500">振込実行なし</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function PayeasyCopyRow({
  label,
  value,
  rowId,
  copiedKey,
  onCopy,
}: {
  label: string;
  value: string | null | undefined;
  rowId: string;
  copiedKey: string | null;
  onCopy: (key: string, value: string | null | undefined) => Promise<void>;
}) {
  const key = `${rowId}:${label}`;
  return (
    <div className="flex items-center gap-2 py-0.5">
      <span className="w-12 text-xs text-gray-500">{label}</span>
      <code className="min-w-[96px] rounded bg-amber-50 px-2 py-0.5 text-xs text-gray-800">{value || "—"}</code>
      <button
        type="button"
        onClick={() => void onCopy(key, value)}
        disabled={!value}
        className="rounded border border-amber-200 px-2 py-0.5 text-xs text-amber-800 hover:bg-amber-50 disabled:opacity-40"
      >
        {copiedKey === key ? "コピー済み" : "コピー"}
      </button>
    </div>
  );
}
