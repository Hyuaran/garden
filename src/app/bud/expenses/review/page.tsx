"use client";

/**
 * Bud 経費精算 — 承認待ち（経理レビュー）画面 MVP
 * スマホから送られた申請(status='submitted')を 1 件ずつ確認：
 *   - 領収書画像を見ながら 日付/店名/金額/区分/適格 を入力・確認
 *   - 承認(→完了待ち final_pending) / 差戻し(→keiri_returned, 理由つき)
 *   - 処理は garden_work_log に記録（工数：開いてから処理までの時間）
 * Ctrl+↓ / Ctrl+↑ で前後のレコード移動（FileMaker 風）。
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { createBrowserClient } from "@/app/_lib/supabase/browser";

import { BudGate } from "../../_components/BudGate";

type Req = {
  id: string;
  applicant_employee_id: string | null;
  expense_kind: string;
  drive_file_id: string | null;
  receipt_date: string | null;
  store_name: string | null;
  amount: number | null;
  qualified_class: string | null;
  qualified_number: string | null;
  category_id: string | null;
  description: string | null;
  submitted_at: string;
};
type Cat = { id: string; name: string };
type Form = {
  receipt_date: string;
  store_name: string;
  amount: string;
  qualified_class: string;
  qualified_number: string;
  category_id: string;
  description: string;
};

export default function ExpenseReviewPage() {
  return (
    <BudGate>
      <Review />
    </BudGate>
  );
}

function Review() {
  const supabase = useMemo(() => createBrowserClient(), []);
  const [list, setList] = useState<Req[]>([]);
  const [cats, setCats] = useState<Cat[]>([]);
  const [idx, setIdx] = useState(0);
  const [form, setForm] = useState<Form | null>(null);
  const [imgUrl, setImgUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [done, setDone] = useState({ approved: 0, rejected: 0 });
  const openedAt = useRef<number>(0);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("bud_expense_requests")
      .select(
        "id,applicant_employee_id,expense_kind,drive_file_id,receipt_date,store_name,amount,qualified_class,qualified_number,category_id,description,submitted_at",
      )
      .eq("status", "submitted")
      .order("submitted_at", { ascending: true });
    setList((data as Req[] | null) ?? []);
    const { data: c } = await supabase
      .from("bud_expense_categories")
      .select("id,name")
      .eq("is_active", true)
      .order("display_order", { ascending: true });
    setCats((c as Cat[] | null) ?? []);
    setIdx(0);
    setLoaded(true);
  }, [supabase]);

  useEffect(() => {
    void load();
  }, [load]);

  const current = list[idx];

  useEffect(() => {
    if (!current) {
      setForm(null);
      setImgUrl(null);
      return;
    }
    openedAt.current = Date.now();
    setForm({
      receipt_date: current.receipt_date ?? "",
      store_name: current.store_name ?? "",
      amount: current.amount != null ? String(current.amount) : "",
      qualified_class: current.qualified_class ?? "",
      qualified_number: current.qualified_number ?? "",
      category_id: current.category_id ?? "",
      description: current.description ?? "",
    });
    let cancelled = false;
    void (async () => {
      if (current.drive_file_id) {
        const { data } = await supabase.storage.from("bud-receipts").createSignedUrl(current.drive_file_id, 600);
        if (!cancelled) setImgUrl(data?.signedUrl ?? null);
      } else {
        setImgUrl(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [current, supabase]);

  // Ctrl+↑↓ で前後移動
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === "ArrowDown") {
        e.preventDefault();
        setIdx((i) => Math.min(i + 1, list.length - 1));
      } else if (e.ctrlKey && e.key === "ArrowUp") {
        e.preventDefault();
        setIdx((i) => Math.max(i - 1, 0));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [list.length]);

  const setF = (k: keyof Form, v: string) => setForm((f) => (f ? { ...f, [k]: v } : f));

  const process = async (action: "approve" | "reject") => {
    if (!current || !form || busy) return;
    let reason: string | null = null;
    if (action === "reject") {
      reason = window.prompt("差戻し理由を入力してください") ?? "";
      if (!reason) return;
    }
    setBusy(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth?.user?.id ?? null;
      const nowIso = new Date().toISOString();
      const up = await supabase
        .from("bud_expense_requests")
        .update({
          receipt_date: form.receipt_date || null,
          store_name: form.store_name || null,
          amount: Number(form.amount) || 0,
          qualified_class: form.qualified_class || null,
          qualified_number: form.qualified_number || null,
          category_id: form.category_id || null,
          description: form.description || null,
          keiri_checked_by: uid,
          keiri_checked_at: nowIso,
          status: action === "approve" ? "final_pending" : "keiri_returned",
          return_reason: action === "reject" ? reason : null,
        })
        .eq("id", current.id);
      if (up.error) throw up.error;
      await supabase.from("garden_work_log").insert({
        user_id: uid,
        module: "bud",
        operation: action === "approve" ? "expense_keiri_approve" : "expense_keiri_return",
        target_kind: "expense_request",
        target_id: current.id,
        started_at: openedAt.current ? new Date(openedAt.current).toISOString() : null,
        ended_at: nowIso,
        duration_ms: openedAt.current ? Date.now() - openedAt.current : null,
      });
      setDone((d) => ({
        approved: d.approved + (action === "approve" ? 1 : 0),
        rejected: d.rejected + (action === "reject" ? 1 : 0),
      }));
      const removedLen = list.length;
      setList((prev) => prev.filter((r) => r.id !== current.id));
      setIdx((i) => Math.max(0, Math.min(i, removedLen - 2)));
    } catch (e) {
      alert("処理に失敗しました：" + (e instanceof Error ? e.message : String(e)));
    } finally {
      setBusy(false);
    }
  };

  return (
    <main style={page}>
      <header style={{ marginBottom: 18 }}>
        <h1 style={{ fontSize: 22, color: "#3d3528", margin: 0 }}>経費精算 — 承認待ち（経理）</h1>
        <p style={{ color: "#7b745f", fontSize: 13, margin: "4px 0 0" }}>
          スマホ申請を確認して承認／差戻し。Ctrl+↓ / Ctrl+↑ で前後に移動。
        </p>
      </header>

      <section style={cards}>
        <Card label="承認待ち" value={loaded ? list.length : "—"} color="#b3892e" />
        <Card label="承認（今セッション）" value={done.approved} color="#5e7d44" />
        <Card label="差戻し（今セッション）" value={done.rejected} color="#b35850" />
      </section>

      {!loaded && <div style={notice}>読み込み中…</div>}
      {loaded && list.length === 0 && <div style={notice}>承認待ちの申請はありません 🎉</div>}

      {loaded && current && form && (
        <>
          <div style={navRow}>
            <button type="button" style={navBtn} disabled={idx <= 0} onClick={() => setIdx((i) => Math.max(0, i - 1))}>
              ‹ 前へ
            </button>
            <span style={{ fontSize: 13, color: "#6d6356" }}>
              {idx + 1} / {list.length} 件
            </span>
            <button
              type="button"
              style={navBtn}
              disabled={idx >= list.length - 1}
              onClick={() => setIdx((i) => Math.min(list.length - 1, i + 1))}
            >
              次へ ›
            </button>
          </div>

          <div style={twoCol}>
            {/* 申請情報 */}
            <div style={panel}>
              <h2 style={panelTitle}>申請情報</h2>
              <Row label="申請者">{current.applicant_employee_id ?? "—"}</Row>
              <Row label="区分">{current.expense_kind === "company" ? "会社経費" : "個別経費"}</Row>
              <Field label="レシート日付">
                <input type="date" value={form.receipt_date} onChange={(e) => setF("receipt_date", e.target.value)} style={input} />
              </Field>
              <Field label="店名">
                <input type="text" value={form.store_name} onChange={(e) => setF("store_name", e.target.value)} style={input} />
              </Field>
              <Field label="金額">
                <input type="number" value={form.amount} onChange={(e) => setF("amount", e.target.value)} style={input} />
              </Field>
              <Field label="経費区分">
                <select value={form.category_id} onChange={(e) => setF("category_id", e.target.value)} style={input}>
                  <option value="">（未選択）</option>
                  {cats.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="適格区分">
                <select value={form.qualified_class} onChange={(e) => setF("qualified_class", e.target.value)} style={input}>
                  <option value="">（未選択）</option>
                  <option value="有">有</option>
                  <option value="無">無</option>
                </select>
              </Field>
              <Field label="適格番号(T)">
                <input type="text" value={form.qualified_number} onChange={(e) => setF("qualified_number", e.target.value)} style={input} />
              </Field>
              <Field label="摘要">
                <input type="text" value={form.description} onChange={(e) => setF("description", e.target.value)} style={input} />
              </Field>

              <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
                <button type="button" disabled={busy} onClick={() => process("reject")} style={rejectBtn}>
                  差戻し
                </button>
                <button type="button" disabled={busy} onClick={() => process("approve")} style={approveBtn}>
                  {busy ? "処理中…" : "承認 → 完了待ちへ"}
                </button>
              </div>
            </div>

            {/* 領収書プレビュー */}
            <div style={panel}>
              <h2 style={panelTitle}>領収書</h2>
              {imgUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={imgUrl} alt="領収書" style={{ width: "100%", borderRadius: 10, border: "1px solid #e2ddcf" }} />
              ) : (
                <div style={{ ...notice, margin: 0 }}>画像なし</div>
              )}
            </div>
          </div>
        </>
      )}
    </main>
  );
}

function Card({ label, value, color }: { label: string; value: number | string; color: string }) {
  return (
    <div style={{ ...cardBox, borderLeft: `3px solid ${color}` }}>
      <div style={{ fontSize: 12, color: "#6d6356" }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 700, color }}>{value}</div>
    </div>
  );
}
function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", gap: 10, padding: "6px 0", fontSize: 14 }}>
      <span style={{ width: 96, color: "#6d6356", flexShrink: 0 }}>{label}</span>
      <span style={{ color: "#3d3528" }}>{children}</span>
    </div>
  );
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <label style={{ display: "block", fontSize: 12, color: "#6d6356", marginBottom: 4 }}>{label}</label>
      {children}
    </div>
  );
}

const page: React.CSSProperties = { maxWidth: 1000, margin: "0 auto", padding: "24px 20px 60px" };
const cards: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 18 };
const cardBox: React.CSSProperties = { background: "#faf6ec", border: "1px solid rgba(179,137,46,0.18)", borderRadius: 12, padding: "12px 16px" };
const notice: React.CSSProperties = {
  background: "#faf6ec",
  border: "1px solid rgba(179,137,46,0.18)",
  borderRadius: 12,
  padding: 24,
  textAlign: "center",
  color: "#6d6356",
  margin: "12px 0",
};
const navRow: React.CSSProperties = { display: "flex", alignItems: "center", justifyContent: "space-between", margin: "8px 0 14px" };
const navBtn: React.CSSProperties = {
  padding: "8px 16px",
  borderRadius: 8,
  border: "1px solid #cdbf9a",
  background: "#fff",
  color: "#6d6356",
  fontSize: 13,
  cursor: "pointer",
};
const twoCol: React.CSSProperties = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, alignItems: "start" };
const panel: React.CSSProperties = { background: "#faf6ec", border: "1px solid rgba(179,137,46,0.18)", borderRadius: 12, padding: "18px 20px" };
const panelTitle: React.CSSProperties = { fontSize: 15, color: "#b3892e", margin: "0 0 12px", borderBottom: "1px dashed rgba(179,137,46,0.35)", paddingBottom: 8 };
const input: React.CSSProperties = {
  width: "100%",
  padding: "8px 10px",
  borderRadius: 6,
  border: "1px solid rgba(179,137,46,0.3)",
  fontSize: 14,
  background: "#fff",
  color: "#3d362a",
};
const approveBtn: React.CSSProperties = {
  flex: 1,
  padding: 13,
  borderRadius: 10,
  border: "none",
  background: "#5e7d44",
  color: "#fff",
  fontSize: 15,
  fontWeight: 700,
  cursor: "pointer",
};
const rejectBtn: React.CSSProperties = {
  flex: 1,
  padding: 13,
  borderRadius: 10,
  border: "1px solid #b35850",
  background: "#fff",
  color: "#b35850",
  fontSize: 15,
  fontWeight: 700,
  cursor: "pointer",
};
