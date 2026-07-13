"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";

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

const serifFont = "'Shippori Mincho', 'Noto Serif JP', serif";
const panelStyle: CSSProperties = {
  background: "var(--bg-paper-soft)",
  border: "1px solid rgba(179,137,46,0.18)",
  borderRadius: 12,
  padding: "18px 20px",
  fontFamily: serifFont,
};
const panelHeadStyle: CSSProperties = {
  display: "flex",
  alignItems: "baseline",
  justifyContent: "space-between",
  gap: 16,
  borderBottom: "1px dashed rgba(179,137,46,0.35)",
  paddingBottom: 8,
  marginBottom: 12,
  flexWrap: "wrap",
};
const panelTitleStyle: CSSProperties = {
  fontSize: 16,
  color: "var(--text-main)",
  margin: 0,
  fontWeight: 600,
};
const panelMetaStyle: CSSProperties = {
  fontSize: 12,
  color: "var(--text-muted)",
};
const toolbarStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
  flexWrap: "wrap",
  marginBottom: 12,
};
const searchBoxStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  flex: "1 1 440px",
  flexWrap: "wrap",
  minWidth: 280,
};
const searchLabelStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  color: "var(--text-sub)",
  fontSize: 13,
  fontWeight: 500,
  whiteSpace: "nowrap",
};
const searchControlStyle: CSSProperties = {
  padding: "7px 10px",
  borderRadius: 6,
  border: "1px solid rgba(179,137,46,0.3)",
  fontFamily: serifFont,
  fontSize: 13,
  background: "var(--bg-card-solid)",
  color: "var(--text-main)",
};
const searchInputStyle: CSSProperties = {
  ...searchControlStyle,
  width: 260,
  maxWidth: "100%",
};
const summaryPillsStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "flex-end",
  gap: 8,
  flexWrap: "wrap",
};
const summaryPillStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  minHeight: 30,
  padding: "5px 12px",
  borderRadius: 999,
  border: "1px solid rgba(179,137,46,0.22)",
  background: "var(--bg-card-solid)",
  color: "var(--text-main)",
  fontSize: 13,
  fontWeight: 700,
  fontVariantNumeric: "tabular-nums",
  whiteSpace: "nowrap",
};
const tableStyle: CSSProperties = {
  width: "100%",
  minWidth: 1100,
  borderCollapse: "collapse",
  fontFamily: serifFont,
  fontSize: 13,
};
const tableHeadStyle: CSSProperties = {
  textAlign: "left",
  color: "var(--text-sub)",
  fontWeight: 500,
  padding: "9px 8px",
  borderBottom: "1px solid rgba(180,165,130,0.25)",
};
const tableCellStyle: CSSProperties = {
  padding: "10px 8px",
  borderBottom: "1px dashed rgba(180,165,130,0.18)",
  color: "var(--text-main)",
  verticalAlign: "middle",
};
const subtlePillStyle: CSSProperties = {
  display: "inline-block",
  padding: "3px 10px",
  borderRadius: 999,
  background: "rgba(212,165,65,0.16)",
  color: "#b3892e",
  fontSize: 12,
  fontWeight: 600,
  whiteSpace: "nowrap",
};
const categoryPillStyle: CSSProperties = {
  ...subtlePillStyle,
  border: "1px solid rgba(179,137,46,0.2)",
  background: "rgba(255,253,246,0.64)",
  color: "var(--text-sub)",
};
const actionButtonStyle: CSSProperties = {
  border: "1px solid rgba(179,137,46,0.28)",
  borderRadius: 6,
  padding: "5px 10px",
  background: "var(--bg-card-solid)",
  color: "var(--text-sub)",
  fontFamily: serifFont,
  fontSize: 12,
  cursor: "pointer",
  whiteSpace: "nowrap",
};
const noticeStyle: CSSProperties = {
  padding: 14,
  border: "1px solid rgba(179,137,46,0.18)",
  borderRadius: 8,
  background: "var(--bg-card-solid)",
  color: "var(--text-sub)",
  fontSize: 13,
};

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
    <section style={panelStyle} data-transfer-payment-panel={scope}>
      <div style={panelHeadStyle}>
        <h2 style={panelTitleStyle}>
          {scope === "pending" ? "振込予定" : "振込一覧"}
        </h2>
        <span style={panelMetaStyle}>
          {scope === "pending"
            ? "これから振り込むもの（承認待ち・下書き）"
            : "未処理と処理済み（全期間）"}
          {!schemaReady && (
            <span style={{ marginLeft: 8, color: "#8f3b36" }}>
              新列未適用のため振込データとして表示しています。
            </span>
          )}
        </span>
      </div>

      <div style={toolbarStyle}>
        <div style={searchBoxStyle}>
          <label style={searchLabelStyle}>
            支払区分
            <select
              value={activeCategory}
              onChange={(event) => {
                setActiveCategory(event.target.value as PaymentCategoryFilter);
                setPage(1);
              }}
              style={{ ...searchControlStyle, width: 176 }}
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
            style={searchInputStyle}
          />
        </div>
        <div style={summaryPillsStyle}>
          <span style={summaryPillStyle}>
            レコード {visibleRows.length}/{scopedRows.length}
          </span>
          <span style={summaryPillStyle}>
            合計 ¥{visibleTotal.toLocaleString("ja-JP")}
          </span>
        </div>
      </div>

      {error && (
        <div
          style={{
            ...noticeStyle,
            marginBottom: 12,
            borderColor: "rgba(143,59,54,0.28)",
            background: "rgba(143,59,54,0.07)",
            color: "#8f3b36",
          }}
        >
          {error}
        </div>
      )}
      {loading ? (
        <div style={noticeStyle}>読み込み中…</div>
      ) : visibleRows.length === 0 ? (
        <div style={noticeStyle}>対象の支払はありません。</div>
      ) : (
        <div>
          <div style={{ overflowX: "auto" }}>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th
                    style={{
                      ...tableHeadStyle,
                      width: 40,
                      textAlign: "center",
                    }}
                  >
                    <input
                      type="checkbox"
                      aria-label="このページをすべて選択"
                      checked={allPageRowsSelected}
                      onChange={togglePageSelection}
                    />
                  </th>
                  <th style={tableHeadStyle}>予定日</th>
                  <th style={tableHeadStyle}>支払先</th>
                  <th style={tableHeadStyle}>支払区分</th>
                  <th style={{ ...tableHeadStyle, textAlign: "right" }}>
                    金額
                  </th>
                  <th style={tableHeadStyle}>支払情報</th>
                  <th style={tableHeadStyle}>状態</th>
                  <th style={{ ...tableHeadStyle, textAlign: "right" }}>
                    操作
                  </th>
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
                      style={{
                        background:
                          selected || paid
                            ? "rgba(212,165,65,0.055)"
                            : "transparent",
                      }}
                    >
                      <td style={{ ...tableCellStyle, textAlign: "center" }}>
                        <input
                          type="checkbox"
                          aria-label={`${row.payee_name ?? row.transfer_id}を選択`}
                          checked={selected}
                          onChange={() => toggleRowSelection(row.transfer_id)}
                        />
                      </td>
                      <td style={{ ...tableCellStyle, whiteSpace: "nowrap" }}>
                        {row.scheduled_date ?? "—"}
                      </td>
                      <td style={tableCellStyle}>
                        <div style={{ fontWeight: 600 }}>
                          {row.payee_name ?? "—"}
                        </div>
                        <div style={{ color: "var(--text-sub)", fontSize: 12 }}>
                          {row.description || "摘要なし"}
                        </div>
                        <div
                          style={{ color: "var(--text-muted)", fontSize: 11 }}
                        >
                          {row.transfer_id}
                        </div>
                      </td>
                      <td style={tableCellStyle}>
                        <span style={categoryPillStyle}>
                          {formatPaymentCategory(rowCategory)}
                        </span>
                      </td>
                      <td
                        style={{
                          ...tableCellStyle,
                          textAlign: "right",
                          fontWeight: 600,
                          fontVariantNumeric: "tabular-nums",
                          whiteSpace: "nowrap",
                        }}
                      >
                        ¥{(row.amount ?? 0).toLocaleString("ja-JP")}
                      </td>
                      <td style={tableCellStyle}>
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
                      <td style={tableCellStyle}>
                        <span style={subtlePillStyle}>
                          {paid ? (
                            <>
                              ✓{" "}
                              {rowCategory === "cash"
                                ? "精算済み"
                                : rowCategory === "deposit"
                                  ? "引落済み"
                                  : "支払済み"}
                            </>
                          ) : (
                            (row.status ?? "—")
                          )}
                        </span>
                      </td>
                      <td style={{ ...tableCellStyle, textAlign: "right" }}>
                        {(rowCategory === "payeasy" ||
                          rowCategory === "cash" ||
                          rowCategory === "deposit") && (
                          <button
                            type="button"
                            onClick={() => void toggleManualPaid(row)}
                            disabled={busyId === row.transfer_id}
                            style={{
                              ...actionButtonStyle,
                              opacity: busyId === row.transfer_id ? 0.5 : 1,
                            }}
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
                          <span
                            style={{
                              color: "var(--text-muted)",
                              fontSize: 12,
                              whiteSpace: "nowrap",
                            }}
                          >
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
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              flexWrap: "wrap",
              marginTop: 12,
              color: "var(--text-sub)",
              fontSize: 13,
            }}
          >
            <span>
              {rangeStart}〜{rangeEnd}件 / 全{visibleRows.length}件
            </span>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <button
                type="button"
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                disabled={page === 1}
                style={{
                  ...actionButtonStyle,
                  cursor: page === 1 ? "not-allowed" : "pointer",
                  opacity: page === 1 ? 0.4 : 1,
                }}
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
                style={{
                  ...actionButtonStyle,
                  cursor: page === pageCount ? "not-allowed" : "pointer",
                  opacity: page === pageCount ? 0.4 : 1,
                }}
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
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "2px 0",
      }}
    >
      <span style={{ width: 48, color: "var(--text-muted)", fontSize: 12 }}>
        {label}
      </span>
      <code
        style={{
          minWidth: 96,
          padding: "2px 8px",
          borderRadius: 5,
          background: "rgba(212,165,65,0.08)",
          color: "var(--text-main)",
          fontSize: 12,
        }}
      >
        {value || "—"}
      </code>
      <button
        type="button"
        onClick={() => void onCopy(key, value)}
        disabled={!value}
        style={{
          ...actionButtonStyle,
          padding: "2px 8px",
          cursor: value ? "pointer" : "not-allowed",
          opacity: value ? 1 : 0.4,
        }}
      >
        {copiedKey === key ? "コピー済み" : "コピー"}
      </button>
    </div>
  );
}
