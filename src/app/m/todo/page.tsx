"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";

import { createBrowserClient } from "@/app/_lib/supabase/browser";

import {
  formatYen,
  getMobileTodoCounts,
  getMyEmployee,
  getReturnedExpenseRequests,
  statusLabel,
  updateReturnedExpenseRequest,
  type MobileEmployee,
  type MobileExpenseAction,
  type MobileExpenseRequest,
  type MobileTodoCounts,
} from "../_lib/mobile-expenses";
import {
  budCard,
  budLead,
  budMobile,
  budNotice,
  budPage,
  budPrimaryButton,
  budSecondaryButton,
  budSectionTitle,
  budTitle,
} from "../_lib/mobile-theme";

type BusyState = { id: string; action: MobileExpenseAction } | null;

export default function MobileTodoPage() {
  const supabase = useMemo(() => createBrowserClient(), []);
  const [employee, setEmployee] = useState<MobileEmployee | null>(null);
  const [rows, setRows] = useState<MobileExpenseRequest[]>([]);
  const [counts, setCounts] = useState<MobileTodoCounts>({ returned: 0, submitted: 0, finalPending: 0, budAccess: false });
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState<BusyState>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoaded(false);
    const emp = await getMyEmployee(supabase);
    setEmployee(emp);
    const [nextCounts, returned] = await Promise.all([
      getMobileTodoCounts(supabase),
      emp ? getReturnedExpenseRequests(supabase, emp.employee_id) : Promise.resolve([]),
    ]);
    setCounts(nextCounts);
    setRows(returned);
    setLoaded(true);
  }, [supabase]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const updateRequest = async (row: MobileExpenseRequest, action: MobileExpenseAction) => {
    if (!employee || busy) return;
    setBusy({ id: row.id, action });
    setMessage(null);
    try {
      await updateReturnedExpenseRequest(supabase, row.id, employee.employee_id, action);
      setMessage(action === "resubmitted" ? "再申請しました。" : "精算不可にしました。");
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "更新に失敗しました。");
    } finally {
      setBusy(null);
    }
  };

  const empty = loaded && rows.length === 0 && (!counts.budAccess || (counts.submitted === 0 && counts.finalPending === 0));

  return (
    <main style={budPage}>
      <header style={{ marginBottom: 18 }}>
        <h1 style={budTitle}>やること</h1>
        <p style={budLead}>差戻しとBud確認を、ひとつの箱にまとめます。</p>
      </header>

      {!loaded && <div style={budNotice}>読み込み中...</div>}
      {message && <div style={{ ...budNotice, padding: 12, marginBottom: 14, color: budMobile.colors.gold }}>{message}</div>}
      {empty && <div style={budNotice}>今のやることはありません。</div>}

      {rows.length > 0 && (
        <section style={section}>
          <h2 style={budSectionTitle}>自分の差戻し申請</h2>
          <div style={stack}>
            {rows.map((row) => {
              const rowBusy = busy?.id === row.id;
              return (
                <article key={row.id} style={requestCard}>
                  <div style={cardTop}>
                    <span style={statusPill}>{statusLabel(row.status)}</span>
                    <span style={amount}>{formatYen(row.amount)}</span>
                  </div>
                  <div style={store}>{row.store_name ?? "店名未入力"}</div>
                  <div style={meta}>
                    {row.receipt_date ?? "日付未入力"} / {row.expense_kind === "company" ? "会社経費" : "個別経費"}
                  </div>
                  {row.return_reason && <div style={reason}>理由: {row.return_reason}</div>}
                  <div style={actions}>
                    <button type="button" style={budPrimaryButton} disabled={rowBusy} onClick={() => void updateRequest(row, "resubmitted")}>
                      {rowBusy && busy?.action === "resubmitted" ? "処理中..." : "再申請する"}
                    </button>
                    <button
                      type="button"
                      style={{ ...budSecondaryButton, color: budMobile.colors.red, borderColor: "rgba(155,58,44,0.35)" }}
                      disabled={rowBusy}
                      onClick={() => void updateRequest(row, "not_reimbursable")}
                    >
                      {rowBusy && busy?.action === "not_reimbursable" ? "処理中..." : "精算不可にする"}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      )}

      {counts.budAccess && (
        <section style={section}>
          <h2 style={budSectionTitle}>Bud確認</h2>
          <div style={reviewGrid}>
            <Link href="/bud/expenses" style={reviewCard}>
              <span style={reviewNumber}>{counts.submitted}</span>
              <span>承認待ち</span>
            </Link>
            <Link href="/bud/expenses" style={reviewCard}>
              <span style={reviewNumber}>{counts.finalPending}</span>
              <span>完了待ち</span>
            </Link>
          </div>
          <p style={hint}>PC画面の経費精算へ移動します。</p>
        </section>
      )}
    </main>
  );
}

const section: React.CSSProperties = { marginBottom: 22 };
const stack: React.CSSProperties = { display: "flex", flexDirection: "column", gap: 10 };
const requestCard: React.CSSProperties = { ...budCard, padding: 14 };
const cardTop: React.CSSProperties = { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, marginBottom: 8 };
const statusPill: React.CSSProperties = {
  background: "rgba(155,58,44,0.12)",
  color: budMobile.colors.red,
  borderRadius: 999,
  padding: "3px 9px",
  fontSize: 11,
  fontWeight: 700,
};
const amount: React.CSSProperties = { color: budMobile.colors.gold, fontFamily: budMobile.font.number, fontWeight: 700, fontSize: 17 };
const store: React.CSSProperties = { color: budMobile.colors.text, fontSize: 16, fontWeight: 700 };
const meta: React.CSSProperties = { color: budMobile.colors.sub, fontSize: 12, marginTop: 3 };
const reason: React.CSSProperties = {
  color: budMobile.colors.red,
  background: "rgba(155,58,44,0.08)",
  borderRadius: 10,
  padding: 9,
  fontSize: 12,
  marginTop: 10,
};
const actions: React.CSSProperties = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 12 };
const reviewGrid: React.CSSProperties = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 };
const reviewCard: React.CSSProperties = {
  ...budCard,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: 4,
  textDecoration: "none",
  padding: 16,
  color: budMobile.colors.text,
};
const reviewNumber: React.CSSProperties = { color: budMobile.colors.gold, fontFamily: budMobile.font.number, fontSize: 32, fontWeight: 700, lineHeight: 1 };
const hint: React.CSSProperties = { color: budMobile.colors.muted, fontSize: 11, margin: "8px 0 0" };
