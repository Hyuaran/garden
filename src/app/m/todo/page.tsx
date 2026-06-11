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
  type MobileEmployee,
  type MobileExpenseRequest,
  type MobileTodoCounts,
} from "../_lib/mobile-expenses";

type BusyState = { id: string; action: "resubmitted" | "not_reimbursable" } | null;

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

  const updateRequest = async (row: MobileExpenseRequest, action: "resubmitted" | "not_reimbursable") => {
    if (!employee || busy) return;
    setBusy({ id: row.id, action });
    setMessage(null);
    const nextStatus = action === "resubmitted" ? "submitted" : "not_reimbursable";
    try {
      const { error } = await supabase
        .from("bud_expense_requests")
        .update({ status: nextStatus })
        .eq("id", row.id)
        .eq("applicant_employee_id", employee.employee_id)
        .in("status", ["keiri_returned", "final_returned"]);
      if (error) throw error;

      const moveRes = await fetch("/api/bud/expense-drive/move", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId: row.id, action }),
      });
      const moveJson = (await moveRes.json()) as { ok?: boolean; error?: string };
      if (!moveRes.ok || !moveJson.ok) throw new Error(moveJson.error ?? "Drive移動に失敗しました");

      setMessage(action === "resubmitted" ? "再申請しました" : "精算不可にしました");
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "更新に失敗しました");
    } finally {
      setBusy(null);
    }
  };

  const empty = loaded && rows.length === 0 && (!counts.budAccess || (counts.submitted === 0 && counts.finalPending === 0));

  return (
    <main style={page}>
      <header style={head}>
        <h1 style={title}>やること</h1>
        <p style={lead}>差戻しと承認待ちをまとめて確認します。</p>
      </header>

      {!loaded && <div style={notice}>読み込み中...</div>}
      {message && <div style={messageStyle}>{message}</div>}
      {empty && <div style={notice}>今のやることはありません。</div>}

      {rows.length > 0 && (
        <section style={section}>
          <h2 style={sectionTitle}>自分の差戻し申請</h2>
          <div style={stack}>
            {rows.map((row) => {
              const rowBusy = busy?.id === row.id;
              return (
                <article key={row.id} style={card}>
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
                    <button type="button" style={primaryBtn} disabled={rowBusy} onClick={() => void updateRequest(row, "resubmitted")}>
                      {rowBusy && busy?.action === "resubmitted" ? "処理中..." : "再申請する"}
                    </button>
                    <button type="button" style={secondaryBtn} disabled={rowBusy} onClick={() => void updateRequest(row, "not_reimbursable")}>
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
          <h2 style={sectionTitle}>Bud確認</h2>
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

const page: React.CSSProperties = { minHeight: "100dvh", background: "#f7f4ec", padding: "20px 16px 18px", maxWidth: 560, margin: "0 auto" };
const head: React.CSSProperties = { marginBottom: 18 };
const title: React.CSSProperties = { margin: 0, color: "#3d3528", fontSize: 24, lineHeight: 1.2 };
const lead: React.CSSProperties = { margin: "6px 0 0", color: "#7b745f", fontSize: 12 };
const section: React.CSSProperties = { marginBottom: 22 };
const sectionTitle: React.CSSProperties = { margin: "0 0 10px", color: "#3d3528", fontSize: 15 };
const stack: React.CSSProperties = { display: "flex", flexDirection: "column", gap: 10 };
const notice: React.CSSProperties = { background: "#fffdf6", border: "1px solid #e2ddcf", borderRadius: 14, padding: 22, textAlign: "center", color: "#6d6356", fontSize: 13 };
const messageStyle: React.CSSProperties = { ...notice, padding: 12, marginBottom: 14, color: "#8a6a1f", background: "#fff8df" };
const card: React.CSSProperties = { background: "#fffdf6", border: "1px solid rgba(179,137,46,0.2)", borderRadius: 14, padding: 14, boxShadow: "0 2px 8px rgba(61,53,40,0.05)" };
const cardTop: React.CSSProperties = { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, marginBottom: 8 };
const statusPill: React.CSSProperties = { background: "rgba(197,74,58,0.14)", color: "#a03d31", borderRadius: 999, padding: "3px 9px", fontSize: 11, fontWeight: 700 };
const amount: React.CSSProperties = { color: "#b3892e", fontWeight: 700, fontSize: 15 };
const store: React.CSSProperties = { color: "#3d3528", fontSize: 16, fontWeight: 700 };
const meta: React.CSSProperties = { color: "#6d6356", fontSize: 12, marginTop: 3 };
const reason: React.CSSProperties = { color: "#9b3a2c", background: "rgba(197,74,58,0.08)", borderRadius: 10, padding: 9, fontSize: 12, marginTop: 10 };
const actions: React.CSSProperties = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 12 };
const primaryBtn: React.CSSProperties = { border: "none", borderRadius: 10, padding: "10px 8px", background: "#d4a541", color: "#fff", fontWeight: 700 };
const secondaryBtn: React.CSSProperties = { border: "1px solid #c85b4f", borderRadius: 10, padding: "10px 8px", background: "#fff", color: "#a03d31", fontWeight: 700 };
const reviewGrid: React.CSSProperties = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 };
const reviewCard: React.CSSProperties = { display: "flex", flexDirection: "column", alignItems: "center", gap: 4, textDecoration: "none", background: "#fffdf6", border: "1px solid rgba(179,137,46,0.2)", borderRadius: 14, padding: 16, color: "#3d3528" };
const reviewNumber: React.CSSProperties = { color: "#b3892e", fontSize: 28, fontWeight: 700, lineHeight: 1 };
const hint: React.CSSProperties = { color: "#9a8f7d", fontSize: 11, margin: "8px 0 0" };
