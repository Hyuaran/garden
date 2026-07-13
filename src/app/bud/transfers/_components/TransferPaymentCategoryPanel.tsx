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
const FETCH_RANGE_END = 4_999;
const FETCH_BATCH_SIZE = 1_000;
const PAGE_SIZE = 50;
const PENDING_STATUSES = new Set(["承認待ち", "下書き"]);
type PaymentCategoryFilter = "all" | PaymentCategory;
type TransferPanelScope = "all" | "pending";

async function fetchTransferRows(columns: string) {
  const rows: TransferRow[] = [];
  for (let from = 0; from <= FETCH_RANGE_END; from += FETCH_BATCH_SIZE) {
    const to = Math.min(from + FETCH_BATCH_SIZE - 1, FETCH_RANGE_END);
    const result = await supabase
      .from("bud_transfers")
      .select(columns)
      .order("scheduled_date", { ascending: true })
      .order("transfer_id", { ascending: true })
      .range(from, to);
    if (result.error) return { rows: [] as TransferRow[], error: result.error };
    const batch = (result.data ?? []) as unknown as TransferRow[];
    rows.push(...batch);
    if (batch.length < FETCH_BATCH_SIZE) break;
  }
  return { rows, error: null };
}

export function TransferPaymentCategoryPanel({
  scope = "all",
}: {
  scope?: TransferPanelScope;
}) {
  const [rows, setRows] = useState<TransferRow[]>([]);
  const [schemaReady, setSchemaReady] = useState(true);
  const [activeCategory, setActiveCategory] =
    useState<PaymentCategoryFilter>("all");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadRows = async () => {
    setLoading(true);
    setError(null);
    const primary = await fetchTransferRows(SELECT_WITH_PAYMENT);

    if (primary.error) {
      const fallback = await fetchTransferRows(SELECT_FALLBACK);
      if (fallback.error) {
        setError(fallback.error.message);
        setRows([]);
      } else {
        setSchemaReady(false);
        setActiveCategory("all");
        setPage(1);
        setRows(fallback.rows);
      }
    } else {
      setSchemaReady(true);
      setRows(primary.rows);
    }
    setLoading(false);
  };

  useEffect(() => {
    const timer = window.setTimeout(() => void loadRows(), 0);
    return () => window.clearTimeout(timer);
  }, []);

  const categories = schemaReady
    ? PAYMENT_CATEGORY_TABS
    : (["transfer"] as const);
  const scopedRows = useMemo(
    () =>
      scope === "pending"
        ? rows.filter((row) => PENDING_STATUSES.has(row.status ?? ""))
        : rows,
    [rows, scope],
  );
  const counts = useMemo(() => {
    return Object.fromEntries(
      PAYMENT_CATEGORY_TABS.map((category) => [
        category,
        filterByPaymentCategory(scopedRows, category).length,
      ]),
    ) as Record<PaymentCategory, number>;
  }, [scopedRows]);

  const visibleRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const categoryRows =
      activeCategory === "all"
        ? scopedRows
        : filterByPaymentCategory(scopedRows, activeCategory);
    const filtered = categoryRows.filter((row) => {
      if (!q) return true;
      return [row.transfer_id, row.payee_name, row.description].some((value) =>
        (value ?? "").toLowerCase().includes(q),
      );
    });
    if (activeCategory !== "payeasy") return filtered;
    return [...filtered].sort((a, b) => {
      if (Boolean(a.manual_paid_at) !== Boolean(b.manual_paid_at))
        return a.manual_paid_at ? 1 : -1;
      return (a.scheduled_date ?? "").localeCompare(b.scheduled_date ?? "");
    });
  }, [activeCategory, query, scopedRows]);

  const pageCount = Math.max(1, Math.ceil(visibleRows.length / PAGE_SIZE));
  const pageStartIndex = (page - 1) * PAGE_SIZE;
  const pagedRows = visibleRows.slice(
    pageStartIndex,
    pageStartIndex + PAGE_SIZE,
  );
  const rangeStart = visibleRows.length === 0 ? 0 : pageStartIndex + 1;
  const rangeEnd = Math.min(pageStartIndex + PAGE_SIZE, visibleRows.length);
  const visibleTotal = visibleRows.reduce(
    (total, row) => total + (row.amount ?? 0),
    0,
  );
  const allPageRowsSelected =
    pagedRows.length > 0 &&
    pagedRows.every((row) => selectedIds.has(row.transfer_id));

  const togglePageSelection = () => {
    setSelectedIds((current) => {
      const next = new Set(current);
      pagedRows.forEach((row) => {
        if (allPageRowsSelected) next.delete(row.transfer_id);
        else next.add(row.transfer_id);
      });
      return next;
    });
  };

  const toggleRowSelection = (transferId: string) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(transferId)) next.delete(transferId);
      else next.add(transferId);
      return next;
    });
  };

  const copyValue = async (key: string, value: string | null | undefined) => {
    if (!value) return;
    await navigator.clipboard.writeText(value);
    setCopiedKey(key);
    window.setTimeout(
      () => setCopiedKey((current) => (current === key ? null : current)),
      1600,
    );
  };

  const toggleManualPaid = async (row: TransferRow) => {
    if (!schemaReady) return;
    const category = normalizePaymentCategory(row.payment_category);
    const paid = Boolean(row.manual_paid_at);
    const actionLabel =
      category === "cash"
        ? "精算済み"
        : category === "deposit"
          ? "引落済み"
          : "支払済み";
    const next = paid ? null : new Date().toISOString();
    if (
      !paid &&
      !window.confirm(
        `${row.payee_name ?? row.transfer_id} を${actionLabel}にします。よろしいですか？`,
      )
    )
      return;
    setBusyId(row.transfer_id);
    setError(null);
    const { error: updateError } = await supabase
      .from("bud_transfers")
      .update({ manual_paid_at: next })
      .eq("transfer_id", row.transfer_id);
    if (updateError) {
      setError(updateError.message);
    } else {
      setRows((current) =>
        current.map((item) =>
          item.transfer_id === row.transfer_id
            ? { ...item, manual_paid_at: next }
            : item,
        ),
      );
    }
    setBusyId(null);
  };

  return (
    <section className="rounded-xl border border-amber-200 bg-[rgba(255,253,246,0.88)] p-5 shadow-sm">
      <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="font-shippori text-lg font-semibold tracking-wide text-amber-950">
            {scope === "pending" ? "振込予定" : "振込一覧"}
          </h2>
          <p className="mt-1 text-xs leading-6 text-amber-800">
            {scope === "pending"
              ? "これから振り込むもの（承認待ち・下書き）"
              : "未処理と処理済み（全期間）"}
            {!schemaReady && (
              <span className="ml-2 text-red-700">
                新列未適用のため振込データとして表示しています。
              </span>
            )}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs text-amber-900">
          <span className="rounded-full border border-amber-200 bg-white/80 px-3 py-1.5">
            レコード {visibleRows.length}/{scopedRows.length}
          </span>
          <span className="rounded-full bg-amber-500 px-4 py-1.5 font-semibold text-white shadow-sm">
            合計 ¥{visibleTotal.toLocaleString("ja-JP")}
          </span>
        </div>
      </div>

      <div className="mb-4 flex flex-col gap-3 rounded-lg border border-amber-100 bg-white/65 p-3 sm:flex-row sm:items-center">
        <label className="flex items-center gap-2 text-xs font-medium text-amber-950">
          支払区分
          <select
            value={activeCategory}
            onChange={(event) => {
              setActiveCategory(event.target.value as PaymentCategoryFilter);
              setPage(1);
            }}
            className="h-10 min-w-44 rounded border border-amber-200 bg-white px-3 text-sm text-gray-800 outline-none focus:border-amber-400"
          >
            <option value="all">すべて（{scopedRows.length}）</option>
            {categories.map((category) => (
              <option key={category} value={category}>
                {formatPaymentCategory(category)}（{counts[category]}）
              </option>
            ))}
          </select>
        </label>
        <input
          type="search"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setPage(1);
          }}
          placeholder="振込先 / 摘要 / ID"
          className="h-10 min-w-64 flex-1 rounded border border-amber-200 bg-white px-3 text-sm text-gray-800 outline-none focus:border-amber-400"
        />
      </div>

      {error && (
        <div className="mb-3 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {error}
        </div>
      )}
      {loading ? (
        <div className="rounded border border-amber-100 bg-white/70 p-4 text-sm text-amber-800">
          読み込み中…
        </div>
      ) : visibleRows.length === 0 ? (
        <div className="rounded border border-amber-100 bg-white/70 p-4 text-sm text-amber-800">
          対象の支払はありません。
        </div>
      ) : (
        <div>
          <div className="overflow-x-auto rounded-lg border border-amber-100 bg-white">
            <table className="w-full min-w-[1100px] border-collapse text-sm">
              <thead className="bg-amber-100/70 text-left text-xs text-amber-950">
                <tr>
                  <th className="w-10 px-3 py-3 text-center font-medium">
                    <input
                      type="checkbox"
                      aria-label="このページをすべて選択"
                      checked={allPageRowsSelected}
                      onChange={togglePageSelection}
                      className="accent-amber-500"
                    />
                  </th>
                  <th className="px-3 py-3 font-medium">予定日</th>
                  <th className="px-3 py-3 font-medium">支払先</th>
                  <th className="px-3 py-3 font-medium">支払区分</th>
                  <th className="px-3 py-3 text-right font-medium">金額</th>
                  <th className="px-3 py-3 font-medium">支払情報</th>
                  <th className="px-3 py-3 font-medium">状態</th>
                  <th className="px-3 py-3 text-right font-medium">操作</th>
                </tr>
              </thead>
              <tbody>
                {pagedRows.map((row) => {
                  const paid = Boolean(row.manual_paid_at);
                  const rowCategory = normalizePaymentCategory(
                    row.payment_category,
                  );
                  const selected = selectedIds.has(row.transfer_id);
                  return (
                    <tr
                      key={row.transfer_id}
                      className={`border-t border-amber-100 ${
                        selected || paid ? "bg-amber-50/50" : "hover:bg-amber-50/25"
                      }`}
                    >
                      <td className="px-3 py-3 text-center">
                        <input
                          type="checkbox"
                          aria-label={`${row.payee_name ?? row.transfer_id}を選択`}
                          checked={selected}
                          onChange={() => toggleRowSelection(row.transfer_id)}
                          className="accent-amber-500"
                        />
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 text-gray-700">
                        {row.scheduled_date ?? "—"}
                      </td>
                      <td className="px-3 py-3">
                        <div className="font-medium text-gray-900">
                          {row.payee_name ?? "—"}
                        </div>
                        <div className="text-xs text-gray-500">
                          {row.description || "摘要なし"}
                        </div>
                        <div className="text-[11px] text-gray-400">
                          {row.transfer_id}
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <span className="whitespace-nowrap rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs text-amber-900">
                          {formatPaymentCategory(rowCategory)}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 text-right font-medium text-gray-900">
                        ¥{(row.amount ?? 0).toLocaleString("ja-JP")}
                      </td>
                      <td className="px-3 py-3 text-gray-700">
                        {rowCategory === "payeasy" ? (
                          <>
                            <PayeasyCopyRow
                              label="収納"
                              value={row.payeasy_biller_no}
                              rowId={row.transfer_id}
                              copiedKey={copiedKey}
                              onCopy={copyValue}
                            />
                            <PayeasyCopyRow
                              label="お客様"
                              value={row.payeasy_customer_no}
                              rowId={row.transfer_id}
                              copiedKey={copiedKey}
                              onCopy={copyValue}
                            />
                            <PayeasyCopyRow
                              label="確認"
                              value={row.payeasy_confirm_no}
                              rowId={row.transfer_id}
                              copiedKey={copiedKey}
                              onCopy={copyValue}
                            />
                          </>
                        ) : rowCategory === "registered" ? (
                          formatRegisteredMethod(row.registered_method)
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-3 py-3 text-gray-700">
                        {paid ? (
                          <span className="whitespace-nowrap text-green-700">
                            ✓{" "}
                            {rowCategory === "cash"
                              ? "精算済み"
                              : rowCategory === "deposit"
                                ? "引落済み"
                                : "支払済み"}
                          </span>
                        ) : (
                          (row.status ?? "—")
                        )}
                      </td>
                      <td className="px-3 py-3 text-right">
                        {(rowCategory === "payeasy" ||
                          rowCategory === "cash" ||
                          rowCategory === "deposit") && (
                          <button
                            type="button"
                            onClick={() => void toggleManualPaid(row)}
                            disabled={busyId === row.transfer_id}
                            className="whitespace-nowrap rounded border border-amber-300 px-3 py-1.5 text-xs text-amber-900 hover:bg-amber-50 disabled:opacity-50"
                          >
                            {paid
                              ? "取消"
                              : rowCategory === "cash"
                                ? "精算済みにする"
                                : rowCategory === "deposit"
                                  ? "引落済みにする"
                                  : "支払済みにする"}
                          </button>
                        )}
                        {rowCategory === "registered" && (
                          <span className="whitespace-nowrap text-xs text-gray-500">
                            振込実行なし
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-sm text-amber-900">
            <span>
              {rangeStart}〜{rangeEnd}件 / 全{visibleRows.length}件
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                disabled={page === 1}
                className="rounded border border-amber-300 px-3 py-1.5 hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                前へ
              </button>
              <span>
                {page} / {pageCount}ページ
              </span>
              <button
                type="button"
                onClick={() =>
                  setPage((current) => Math.min(pageCount, current + 1))
                }
                disabled={page === pageCount}
                className="rounded border border-amber-300 px-3 py-1.5 hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                次へ
              </button>
            </div>
          </div>
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
      <code className="min-w-[96px] rounded bg-amber-50 px-2 py-0.5 text-xs text-gray-800">
        {value || "—"}
      </code>
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
