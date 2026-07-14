"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";

import { useBudState } from "../../_state/BudStateContext";
import { supabase } from "../../_lib/supabase";
import {
  classifyTransferUrgency,
  type TransferUrgency,
} from "../_lib/approval-urgency";
import {
  formatPaymentCategory,
  normalizePaymentCategory,
  type PaymentCategory,
} from "../_lib/payment-category";
import { TransferDetailContent } from "./TransferDetailContent";
import { TransferInboxTray } from "./TransferInboxTray";

type ApprovalRow = {
  transfer_id: string;
  status: string | null;
  scheduled_date: string | null;
  company_id: string | null;
  request_company_id: string | null;
  execute_company_id: string | null;
  payee_name: string | null;
  amount: number | null;
  description: string | null;
  payment_category?: string | null;
  rejection_reason?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  deleted_at?: string | null;
  deleted_by?: string | null;
  delete_reason?: string | null;
};

type Urgency = TransferUrgency;
type CategoryFilter = "all" | PaymentCategory;

const BASE_SELECT =
  "transfer_id,status,scheduled_date,company_id,request_company_id,execute_company_id,payee_name,amount,description,payment_category,rejection_reason,created_at,updated_at";
const SOFT_DELETE_SELECT = `${BASE_SELECT},deleted_at,deleted_by,delete_reason`;
const PAGE_SIZE = 50;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const CORPS = [
  { id: "all", label: "全法人合算" },
  { id: "COMP-001", label: "ヒュアラン" },
  { id: "COMP-002", label: "センターライズ" },
  { id: "COMP-003", label: "リンクサポート" },
  { id: "COMP-004", label: "ARATA" },
  { id: "COMP-005", label: "たいよう" },
  { id: "COMP-006", label: "壱" },
] as const;

const CATEGORY_OPTIONS: Array<{ value: CategoryFilter; label: string }> = [
  { value: "all", label: "すべて" },
  { value: "transfer", label: "振込" },
  { value: "payeasy", label: "ペイジー" },
  { value: "cash", label: "現金" },
  { value: "deposit", label: "預金" },
  { value: "registered", label: "決済登録済" },
];

export function TransferApprovalPanel({
  onInboxCountChange,
}: {
  onInboxCountChange?: (count: number) => void;
}) {
  const { gardenRole, sessionUser } = useBudState();
  const canDelete = gardenRole === "super_admin";
  const [rows, setRows] = useState<ApprovalRow[]>([]);
  const [corpId, setCorpId] = useState("all");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<CategoryFilter>("all");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [busyAction, setBusyAction] = useState<
    "approve" | "return" | "delete" | null
  >(null);
  const [schemaReady, setSchemaReady] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const detailPushedRef = useRef(false);

  const loadRows = useCallback(async () => {
    setLoading(true);
    setError(null);
    const primary = await supabase
      .from("bud_transfers")
      .select(SOFT_DELETE_SELECT)
      .eq("status", "承認待ち")
      .is("deleted_at", null)
      .order("scheduled_date", { ascending: true })
      .order("transfer_id", { ascending: true });

    if (primary.error && isMissingSoftDeleteError(primary.error)) {
      const fallback = await supabase
        .from("bud_transfers")
        .select(BASE_SELECT)
        .eq("status", "承認待ち")
        .order("scheduled_date", { ascending: true })
        .order("transfer_id", { ascending: true });
      if (fallback.error) {
        setRows([]);
        setError(fallback.error.message);
      } else {
        setRows((fallback.data ?? []) as unknown as ApprovalRow[]);
        setSchemaReady(false);
      }
    } else if (primary.error) {
      setRows([]);
      setError(primary.error.message);
    } else {
      setRows((primary.data ?? []) as unknown as ApprovalRow[]);
      setSchemaReady(true);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadRows(), 0);
    return () => window.clearTimeout(timer);
  }, [loadRows]);

  useEffect(() => {
    const syncDetailFromUrl = () => {
      const id = new URLSearchParams(window.location.search).get("detail");
      setDetailId(id);
      if (!id) detailPushedRef.current = false;
    };
    syncDetailFromUrl();
    window.addEventListener("popstate", syncDetailFromUrl);
    return () => window.removeEventListener("popstate", syncDetailFromUrl);
  }, []);

  useEffect(() => {
    if (!detailId) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeDetail();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [detailId]);

  const corpRows = useMemo(
    () =>
      rows.filter(
        (row) => corpId === "all" || effectiveCompanyId(row) === corpId,
      ),
    [corpId, rows],
  );
  const stats = useMemo(
    () => ({
      urgent: summarize(
        corpRows.filter(
          (row) => classifyTransferUrgency(row.scheduled_date) === "urgent",
        ),
      ),
      normal: summarize(
        corpRows.filter(
          (row) => classifyTransferUrgency(row.scheduled_date) === "normal",
        ),
      ),
      later: summarize(
        corpRows.filter(
          (row) => classifyTransferUrgency(row.scheduled_date) === "later",
        ),
      ),
    }),
    [corpRows],
  );
  const visibleRows = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return corpRows
      .filter(
        (row) =>
          category === "all" ||
          normalizePaymentCategory(row.payment_category) === category,
      )
      .filter((row) => {
        if (!normalizedQuery) return true;
        return [row.transfer_id, row.payee_name, row.description].some(
          (value) => (value ?? "").toLowerCase().includes(normalizedQuery),
        );
      })
      .sort(compareRows);
  }, [category, corpRows, query]);
  const pageCount = Math.max(1, Math.ceil(visibleRows.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pageRows = visibleRows.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  );
  const selectedRows = rows.filter((row) => selectedIds.has(row.transfer_id));
  const selectedAmount = selectedRows.reduce(
    (sum, row) => sum + (row.amount ?? 0),
    0,
  );
  const allPageSelected =
    pageRows.length > 0 &&
    pageRows.every((row) => selectedIds.has(row.transfer_id));

  const togglePage = () => {
    setSelectedIds((current) => {
      const next = new Set(current);
      for (const row of pageRows) {
        if (allPageSelected) next.delete(row.transfer_id);
        else next.add(row.transfer_id);
      }
      return next;
    });
  };

  const toggleRow = (id: string) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const openDetail = (id: string) => {
    if (detailId === id) return;
    const url = new URL(window.location.href);
    url.searchParams.set("detail", id);
    window.history.pushState(
      null,
      "",
      `${url.pathname}${url.search}${url.hash}`,
    );
    detailPushedRef.current = true;
    setDetailId(id);
  };

  const closeDetail = () => {
    if (detailPushedRef.current) {
      window.history.back();
      return;
    }
    const url = new URL(window.location.href);
    url.searchParams.delete("detail");
    window.history.replaceState(
      null,
      "",
      `${url.pathname}${url.search}${url.hash}`,
    );
    setDetailId(null);
  };

  const actorUserId = async () => {
    if (sessionUser?.user_id && UUID_PATTERN.test(sessionUser.user_id))
      return sessionUser.user_id;
    const auth = await supabase.auth.getUser();
    return auth.data.user?.id ?? null;
  };

  const runApproval = async () => {
    if (selectedRows.length === 0 || busyAction) return;
    if (
      !window.confirm(
        `${selectedRows.length}件を承認済みにします。よろしいですか？`,
      )
    )
      return;
    setBusyAction("approve");
    setError(null);
    setMessage(null);
    try {
      const userId = await actorUserId();
      if (!userId)
        throw new Error("承認者を特定できません。再ログインしてください。");
      const { error: updateError } = await supabase
        .from("bud_transfers")
        .update({
          status: "承認済み",
          approved_by: userId,
          approved_at: new Date().toISOString(),
        })
        .in(
          "transfer_id",
          selectedRows.map((row) => row.transfer_id),
        )
        .eq("status", "承認待ち");
      if (updateError) throw updateError;
      setMessage(`${selectedRows.length}件を承認しました。`);
      setSelectedIds(new Set());
      await loadRows();
    } catch (reason) {
      setError(actionError(reason));
    } finally {
      setBusyAction(null);
    }
  };

  const runReturn = async () => {
    if (selectedRows.length === 0 || busyAction) return;
    const rejectionReason = window
      .prompt(`${selectedRows.length}件に共通する差戻し理由を入力してください`)
      ?.trim();
    if (!rejectionReason) return;
    setBusyAction("return");
    setError(null);
    setMessage(null);
    try {
      const userId = await actorUserId();
      if (!userId)
        throw new Error(
          "差戻し担当者を特定できません。再ログインしてください。",
        );
      const { error: updateError } = await supabase
        .from("bud_transfers")
        .update({
          status: "差戻し",
          rejection_reason: rejectionReason,
          returned_by: userId,
          returned_at: new Date().toISOString(),
        })
        .in(
          "transfer_id",
          selectedRows.map((row) => row.transfer_id),
        )
        .eq("status", "承認待ち");
      if (updateError) throw updateError;
      setMessage(`${selectedRows.length}件を差戻しました。`);
      setSelectedIds(new Set());
      await loadRows();
    } catch (reason) {
      setError(actionError(reason));
    } finally {
      setBusyAction(null);
    }
  };

  const runDelete = async () => {
    if (!canDelete || selectedRows.length === 0 || busyAction) return;
    const deleteReason = window
      .prompt(`${selectedRows.length}件の削除理由を入力してください`)
      ?.trim();
    if (!deleteReason) return;
    if (
      !window.confirm(
        `${selectedRows.length}件（${yen(selectedAmount)}）を削除済みに移動します。`,
      )
    )
      return;
    setBusyAction("delete");
    setError(null);
    setMessage(null);
    try {
      const { error: rpcError } = await supabase.rpc(
        "bud_transfer_soft_delete",
        {
          p_ids: selectedRows.map((row) => row.transfer_id),
          p_reason: deleteReason,
        },
      );
      if (rpcError) throw rpcError;
      setMessage(`${selectedRows.length}件を削除済みに移動しました。`);
      setSelectedIds(new Set());
      await loadRows();
    } catch (reason) {
      setError(actionError(reason));
    } finally {
      setBusyAction(null);
    }
  };

  return (
    <div style={{ fontFamily: serifFont }} data-transfer-approval-panel>
      <div
        className="bud-corp-switch"
        style={{ marginBottom: 20 }}
        data-approval-corp-filter
      >
        {CORPS.map((corp) => (
          <button
            key={corp.id}
            type="button"
            className={`bud-corp-tab${corpId === corp.id ? " active" : ""}`}
            onClick={() => {
              setCorpId(corp.id);
              setPage(1);
            }}
          >
            {corp.label}
          </button>
        ))}
      </div>

      <TransferInboxTray onCountChange={onInboxCountChange} />

      <div style={summaryGridStyle} data-approval-summary>
        <SummaryCard
          icon="●"
          title="緊急"
          note="今日以前・7日以内"
          summary={stats.urgent}
          tone="urgent"
        />
        <SummaryCard
          icon="◆"
          title="通常"
          note="8〜30日先"
          summary={stats.normal}
          tone="normal"
        />
        <SummaryCard
          icon="◇"
          title="先送り可"
          note="31日以降"
          summary={stats.later}
          tone="later"
        />
      </div>

      <section style={panelStyle} data-approval-list>
        <div style={panelHeadStyle}>
          <div>
            <h2 style={panelTitleStyle}>承認待ち一覧</h2>
            <p style={panelMetaStyle}>
              承認待ちの振込だけを予定日順に表示しています。
            </p>
          </div>
          <div style={summaryPillsStyle}>
            <span style={summaryPillStyle}>
              レコード {visibleRows.length}/{corpRows.length}
            </span>
            <span style={summaryPillStyle}>
              合計{" "}
              {yen(
                visibleRows.reduce((sum, row) => sum + (row.amount ?? 0), 0),
              )}
            </span>
          </div>
        </div>

        <div style={toolbarStyle}>
          <input
            type="search"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setPage(1);
            }}
            placeholder="振込先 / 摘要 / ID"
            style={{ ...controlStyle, width: 300, maxWidth: "100%" }}
          />
          <label style={filterLabelStyle}>
            支払区分
            <select
              value={category}
              onChange={(event) => {
                setCategory(event.target.value as CategoryFilter);
                setPage(1);
              }}
              style={{ ...controlStyle, width: 170 }}
            >
              {CATEGORY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        {!schemaReady && (
          <div style={schemaNoticeStyle}>
            論理削除SQLは未適用です。表示は既存列で継続しています。
          </div>
        )}
        {message && <div style={successStyle}>{message}</div>}
        {error && <div style={errorStyle}>{error}</div>}

        {loading ? (
          <div style={noticeStyle}>読み込み中…</div>
        ) : visibleRows.length === 0 ? (
          <div style={noticeStyle}>承認待ちの振込はありません。</div>
        ) : (
          <>
            <div style={{ overflowX: "auto" }}>
              <table style={tableStyle}>
                <thead>
                  <tr>
                    <th style={{ ...thStyle, width: 38, textAlign: "center" }}>
                      <input
                        type="checkbox"
                        checked={allPageSelected}
                        onChange={togglePage}
                        aria-label="このページをすべて選択"
                      />
                    </th>
                    <th style={thStyle}>緊急度</th>
                    <th style={thStyle}>予定日</th>
                    <th style={thStyle}>支払先</th>
                    <th style={thStyle}>支払区分</th>
                    <th style={{ ...thStyle, textAlign: "right" }}>金額</th>
                    <th style={thStyle}>状態</th>
                    <th style={{ ...thStyle, textAlign: "right" }}>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {pageRows.map((row) => {
                    const urgency = classifyTransferUrgency(row.scheduled_date);
                    const selected = selectedIds.has(row.transfer_id);
                    return (
                      <tr
                        key={row.transfer_id}
                        onClick={() => openDetail(row.transfer_id)}
                        style={{
                          background: selected
                            ? "rgba(212,165,65,0.07)"
                            : "transparent",
                          cursor: "pointer",
                        }}
                      >
                        <td style={{ ...tdStyle, textAlign: "center" }}>
                          <input
                            type="checkbox"
                            checked={selected}
                            onChange={() => toggleRow(row.transfer_id)}
                            onClick={(event) => event.stopPropagation()}
                            aria-label={`${row.payee_name ?? row.transfer_id}を選択`}
                          />
                        </td>
                        <td style={tdStyle}>
                          <UrgencyBadge urgency={urgency} />
                        </td>
                        <td style={{ ...tdStyle, whiteSpace: "nowrap" }}>
                          {row.scheduled_date ?? "—"}
                        </td>
                        <td style={tdStyle}>
                          <div style={{ fontWeight: 600 }}>
                            {row.payee_name ?? "—"}
                          </div>
                          <div style={subTextStyle}>
                            {row.description || "摘要なし"}
                          </div>
                          <div style={idTextStyle}>{row.transfer_id}</div>
                        </td>
                        <td style={tdStyle}>
                          <span style={categoryPillStyle}>
                            {formatPaymentCategory(
                              normalizePaymentCategory(row.payment_category),
                            )}
                          </span>
                        </td>
                        <td
                          style={{
                            ...tdStyle,
                            textAlign: "right",
                            fontWeight: 600,
                            whiteSpace: "nowrap",
                          }}
                        >
                          {yen(row.amount ?? 0)}
                        </td>
                        <td style={tdStyle}>
                          <span style={statusPillStyle}>
                            {row.status ?? "—"}
                          </span>
                        </td>
                        <td style={{ ...tdStyle, textAlign: "right" }}>
                          <button
                            type="button"
                            style={detailButtonStyle}
                            onClick={(event) => {
                              event.stopPropagation();
                              openDetail(row.transfer_id);
                            }}
                          >
                            詳細
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div style={pagerStyle}>
              <span>
                {visibleRows.length === 0
                  ? 0
                  : (currentPage - 1) * PAGE_SIZE + 1}
                〜{Math.min(currentPage * PAGE_SIZE, visibleRows.length)}件 / 全
                {visibleRows.length}件
              </span>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <button
                  type="button"
                  style={pagerButtonStyle}
                  disabled={currentPage === 1}
                  onClick={() => setPage((value) => Math.max(1, value - 1))}
                >
                  前へ
                </button>
                <span>
                  {currentPage} / {pageCount}ページ
                </span>
                <button
                  type="button"
                  style={pagerButtonStyle}
                  disabled={currentPage === pageCount}
                  onClick={() =>
                    setPage((value) => Math.min(pageCount, value + 1))
                  }
                >
                  次へ
                </button>
              </div>
            </div>
          </>
        )}
      </section>

      <div style={bulkRowStyle} data-approval-bulk-actions>
        <BulkButton
          tone="approve"
          disabled={selectedRows.length === 0 || busyAction !== null}
          onClick={() => void runApproval()}
        >
          {selectedRows.length > 0
            ? `✓ ${selectedRows.length}件を承認 ${yen(selectedAmount)}`
            : "一括承認を選択してください"}
        </BulkButton>
        <BulkButton
          tone="return"
          disabled={selectedRows.length === 0 || busyAction !== null}
          onClick={() => void runReturn()}
        >
          {selectedRows.length > 0
            ? `✓ ${selectedRows.length}件を差戻し ${yen(selectedAmount)}`
            : "一括差戻しを選択してください"}
        </BulkButton>
        {canDelete && (
          <BulkButton
            tone="delete"
            disabled={selectedRows.length === 0 || busyAction !== null}
            onClick={() => void runDelete()}
          >
            {selectedRows.length > 0
              ? `✓ ${selectedRows.length}件を削除 ${yen(selectedAmount)}`
              : "一括削除を選択してください"}
          </BulkButton>
        )}
      </div>

      {detailId && (
        <div
          role="presentation"
          style={backdropStyle}
          onMouseDown={(event) =>
            event.target === event.currentTarget && closeDetail()
          }
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-label="振込詳細"
            style={modalStyle}
          >
            <div style={modalHeadStyle}>
              <div>
                <div style={modalEyebrowStyle}>BUD / TRANSFER DETAIL</div>
                <h2 style={modalTitleStyle}>振込レコード詳細</h2>
              </div>
              <button
                type="button"
                aria-label="詳細を閉じる"
                style={closeButtonStyle}
                onClick={closeDetail}
              >
                ×
              </button>
            </div>
            <div style={modalBodyStyle}>
              <TransferDetailContent transferId={detailId} />
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

function SummaryCard({
  icon,
  title,
  note,
  summary,
  tone,
}: {
  icon: string;
  title: string;
  note: string;
  summary: { count: number; amount: number };
  tone: Urgency;
}) {
  const colors =
    tone === "urgent"
      ? ["#8f3b36", "rgba(143,59,54,0.09)"]
      : tone === "normal"
        ? ["#9a7227", "rgba(212,165,65,0.1)"]
        : ["#667158", "rgba(125,138,107,0.1)"];
  return (
    <article style={{ ...summaryCardStyle, borderTopColor: colors[0] }}>
      <div style={summaryHeadStyle}>
        <span
          style={{
            ...summaryIconStyle,
            color: colors[0],
            background: colors[1],
          }}
        >
          {icon}
        </span>
        <div>
          <div style={summaryTitleStyle}>{title}</div>
          <div style={summaryNoteStyle}>{note}</div>
        </div>
      </div>
      <div style={summaryAmountStyle}>{yen(summary.amount)}</div>
      <div style={summaryCountStyle}>{summary.count} 件</div>
    </article>
  );
}

function UrgencyBadge({ urgency }: { urgency: Urgency }) {
  const details =
    urgency === "urgent"
      ? ["● 緊急", "#8f3b36", "rgba(143,59,54,0.1)"]
      : urgency === "normal"
        ? ["◆ 通常", "#987128", "rgba(212,165,65,0.12)"]
        : ["◇ 先送り可", "#667158", "rgba(125,138,107,0.11)"];
  return (
    <span
      style={{ ...urgencyPillStyle, color: details[1], background: details[2] }}
    >
      {details[0]}
    </span>
  );
}

function BulkButton({
  tone,
  disabled,
  onClick,
  children,
}: {
  tone: "approve" | "return" | "delete";
  disabled: boolean;
  onClick: () => void;
  children: string;
}) {
  const toneStyle =
    tone === "approve"
      ? { borderColor: "rgba(108,132,76,0.36)", color: "#5f7547" }
      : tone === "return"
        ? { borderColor: "rgba(179,137,46,0.35)", color: "#8d6923" }
        : { borderColor: "rgba(143,59,54,0.32)", color: "#8f3b36" };
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      style={{
        ...bulkButtonStyle,
        ...toneStyle,
        opacity: disabled ? 0.48 : 1,
        cursor: disabled ? "not-allowed" : "pointer",
      }}
    >
      {children}
    </button>
  );
}

function effectiveCompanyId(row: ApprovalRow) {
  return row.execute_company_id ?? row.request_company_id ?? row.company_id;
}

function summarize(rows: ApprovalRow[]) {
  return {
    count: rows.length,
    amount: rows.reduce((sum, row) => sum + (row.amount ?? 0), 0),
  };
}

function compareRows(a: ApprovalRow, b: ApprovalRow) {
  const order: Record<Urgency, number> = { urgent: 0, normal: 1, later: 2 };
  return (
    order[classifyTransferUrgency(a.scheduled_date)] -
      order[classifyTransferUrgency(b.scheduled_date)] ||
    (a.scheduled_date ?? "").localeCompare(b.scheduled_date ?? "") ||
    a.transfer_id.localeCompare(b.transfer_id)
  );
}

function isMissingSoftDeleteError(error: {
  code?: string | null;
  message?: string | null;
}) {
  return (
    error.code === "42703" ||
    /deleted_at|deleted_by|delete_reason/i.test(error.message ?? "")
  );
}

function actionError(reason: unknown) {
  return reason instanceof Error
    ? reason.message
    : typeof reason === "object" && reason && "message" in reason
      ? String(reason.message)
      : String(reason);
}

function yen(value: number) {
  return `¥${value.toLocaleString("ja-JP")}`;
}

const serifFont = "'Shippori Mincho', 'Noto Serif JP', serif";
const summaryGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
  gap: 16,
  marginBottom: 20,
};
const summaryCardStyle: CSSProperties = {
  padding: "18px 20px",
  border: "1px solid rgba(180,165,130,0.22)",
  borderTop: "2px solid",
  borderRadius: 11,
  background: "rgba(255,253,246,0.72)",
  boxShadow: "0 4px 16px rgba(94,75,42,0.05)",
};
const summaryHeadStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  marginBottom: 13,
};
const summaryIconStyle: CSSProperties = {
  display: "inline-flex",
  width: 30,
  height: 30,
  borderRadius: 999,
  alignItems: "center",
  justifyContent: "center",
  fontSize: 11,
};
const summaryTitleStyle: CSSProperties = {
  color: "var(--text-main)",
  fontSize: 14,
  fontWeight: 600,
  letterSpacing: "0.06em",
};
const summaryNoteStyle: CSSProperties = {
  color: "var(--text-muted)",
  fontSize: 11,
  marginTop: 2,
};
const summaryAmountStyle: CSSProperties = {
  color: "var(--text-main)",
  fontFamily: "'EB Garamond', serif",
  fontSize: 24,
  fontWeight: 600,
  fontVariantNumeric: "tabular-nums",
};
const summaryCountStyle: CSSProperties = {
  color: "var(--text-sub)",
  fontSize: 12,
  marginTop: 3,
};
const panelStyle: CSSProperties = {
  padding: "18px 20px",
  border: "1px solid rgba(180,165,130,0.22)",
  borderRadius: 12,
  background: "rgba(255,253,246,0.72)",
  boxShadow: "0 4px 18px rgba(94,75,42,0.05)",
};
const panelHeadStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-end",
  gap: 16,
  flexWrap: "wrap",
  paddingBottom: 10,
  marginBottom: 12,
  borderBottom: "1px dashed rgba(179,137,46,0.32)",
};
const panelTitleStyle: CSSProperties = {
  margin: 0,
  color: "var(--text-main)",
  fontSize: 16,
  fontWeight: 600,
  letterSpacing: "0.05em",
};
const panelMetaStyle: CSSProperties = {
  margin: "4px 0 0",
  color: "var(--text-muted)",
  fontSize: 12,
};
const summaryPillsStyle: CSSProperties = {
  display: "flex",
  gap: 7,
  flexWrap: "wrap",
};
const summaryPillStyle: CSSProperties = {
  display: "inline-flex",
  padding: "5px 11px",
  border: "1px solid rgba(179,137,46,0.22)",
  borderRadius: 999,
  background: "rgba(255,255,255,0.48)",
  color: "var(--text-sub)",
  fontSize: 12,
  fontWeight: 600,
  whiteSpace: "nowrap",
};
const toolbarStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 12,
  flexWrap: "wrap",
  padding: 12,
  marginBottom: 12,
  border: "1px solid rgba(180,165,130,0.18)",
  borderRadius: 8,
  background: "rgba(247,239,216,0.44)",
};
const filterLabelStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  color: "var(--text-sub)",
  fontSize: 12,
};
const controlStyle: CSSProperties = {
  minHeight: 34,
  padding: "6px 10px",
  border: "1px solid rgba(179,137,46,0.28)",
  borderRadius: 6,
  background: "rgba(255,255,255,0.72)",
  color: "var(--text-main)",
  fontFamily: serifFont,
  fontSize: 12,
};
const tableStyle: CSSProperties = {
  width: "100%",
  minWidth: 1040,
  borderCollapse: "collapse",
  fontFamily: serifFont,
  fontSize: 12,
};
const thStyle: CSSProperties = {
  padding: "9px 8px",
  borderBottom: "1px solid rgba(180,165,130,0.25)",
  background: "rgba(247,239,216,0.34)",
  color: "var(--text-sub)",
  fontWeight: 500,
  textAlign: "left",
  whiteSpace: "nowrap",
};
const tdStyle: CSSProperties = {
  padding: "10px 8px",
  borderBottom: "1px dashed rgba(180,165,130,0.18)",
  color: "var(--text-main)",
  verticalAlign: "middle",
};
const subTextStyle: CSSProperties = {
  marginTop: 2,
  color: "var(--text-sub)",
  fontSize: 11,
};
const idTextStyle: CSSProperties = {
  marginTop: 2,
  color: "var(--text-muted)",
  fontFamily: "'EB Garamond', monospace",
  fontSize: 10,
};
const urgencyPillStyle: CSSProperties = {
  display: "inline-flex",
  padding: "3px 9px",
  borderRadius: 999,
  fontSize: 11,
  fontWeight: 600,
  whiteSpace: "nowrap",
};
const categoryPillStyle: CSSProperties = {
  display: "inline-flex",
  padding: "3px 9px",
  border: "1px solid rgba(179,137,46,0.2)",
  borderRadius: 999,
  background: "rgba(255,253,246,0.7)",
  color: "var(--text-sub)",
  fontSize: 11,
  whiteSpace: "nowrap",
};
const statusPillStyle: CSSProperties = {
  display: "inline-flex",
  padding: "3px 10px",
  borderRadius: 999,
  background: "rgba(212,165,65,0.13)",
  color: "#8d6923",
  fontSize: 11,
  fontWeight: 600,
  whiteSpace: "nowrap",
};
const detailButtonStyle: CSSProperties = {
  padding: "5px 10px",
  border: "1px solid rgba(179,137,46,0.28)",
  borderRadius: 6,
  background: "rgba(255,255,255,0.56)",
  color: "var(--text-sub)",
  fontFamily: serifFont,
  fontSize: 11,
  cursor: "pointer",
};
const pagerStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 12,
  flexWrap: "wrap",
  marginTop: 12,
  color: "var(--text-sub)",
  fontSize: 12,
};
const pagerButtonStyle: CSSProperties = { ...detailButtonStyle, minWidth: 54 };
const bulkRowStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
  gap: 12,
  marginTop: 16,
};
const bulkButtonStyle: CSSProperties = {
  minHeight: 46,
  padding: "10px 14px",
  border: "1px solid",
  borderRadius: 9,
  background: "rgba(255,253,246,0.72)",
  fontFamily: serifFont,
  fontSize: 12,
  fontWeight: 600,
  boxShadow: "0 2px 8px rgba(94,75,42,0.04)",
};
const noticeStyle: CSSProperties = {
  padding: 20,
  border: "1px solid rgba(180,165,130,0.18)",
  borderRadius: 8,
  background: "rgba(255,255,255,0.42)",
  color: "var(--text-sub)",
  textAlign: "center",
  fontSize: 12,
};
const schemaNoticeStyle: CSSProperties = {
  ...noticeStyle,
  padding: 10,
  marginBottom: 10,
  color: "#8d6923",
  background: "rgba(212,165,65,0.07)",
};
const successStyle: CSSProperties = {
  ...noticeStyle,
  padding: 10,
  marginBottom: 10,
  borderColor: "rgba(108,132,76,0.24)",
  background: "rgba(108,132,76,0.07)",
  color: "#5f7547",
};
const errorStyle: CSSProperties = {
  ...noticeStyle,
  padding: 10,
  marginBottom: 10,
  borderColor: "rgba(143,59,54,0.25)",
  background: "rgba(143,59,54,0.07)",
  color: "#8f3b36",
};
const backdropStyle: CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: 1000,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 24,
  background: "rgba(45,38,29,0.46)",
  backdropFilter: "blur(3px)",
};
const modalStyle: CSSProperties = {
  width: "min(920px, 96vw)",
  maxHeight: "90vh",
  overflow: "hidden",
  border: "1px solid rgba(180,165,130,0.36)",
  borderRadius: 14,
  background: "#fffdf6",
  boxShadow: "0 24px 70px rgba(45,38,29,0.24)",
  fontFamily: serifFont,
};
const modalHeadStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 16,
  padding: "16px 20px",
  borderBottom: "1px solid rgba(180,165,130,0.24)",
  background: "rgba(247,239,216,0.48)",
};
const modalEyebrowStyle: CSSProperties = {
  color: "#a27a2f",
  fontFamily: "'EB Garamond', serif",
  fontSize: 10,
  letterSpacing: "0.16em",
};
const modalTitleStyle: CSSProperties = {
  margin: "3px 0 0",
  color: "var(--text-main)",
  fontSize: 17,
  fontWeight: 600,
};
const closeButtonStyle: CSSProperties = {
  width: 34,
  height: 34,
  border: "1px solid rgba(179,137,46,0.25)",
  borderRadius: 999,
  background: "rgba(255,255,255,0.62)",
  color: "var(--text-sub)",
  fontFamily: serifFont,
  fontSize: 21,
  cursor: "pointer",
};
const modalBodyStyle: CSSProperties = {
  maxHeight: "calc(90vh - 70px)",
  overflowY: "auto",
  padding: "18px 20px 22px",
};
