"use client";

/**
 * Garden モバイル — 自分の経費申請の状況（案B: アプリ内で閲覧）
 * 台帳（bud_expense_requests）から本人の申請を取得し、状態別に表示する。
 * RLS: ber_select が applicant_employee_id = bud_my_employee_id() を許可。
 * 画像は Supabase Storage（storage_path）の署名URLで表示。
 * Google Drive はアーカイブ用ミラー（ここでは参照しない）。
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";

import { createBrowserClient } from "@/app/_lib/supabase/browser";

type Req = {
  id: string;
  status: string;
  expense_kind: string;
  storage_path: string | null;
  drive_file_id: string | null;
  receipt_date: string | null;
  store_name: string | null;
  amount: number | null;
  return_reason: string | null;
  submitted_at: string;
};

type Group = "returned" | "processing" | "approved";

const GROUP_DEF: Record<Group, { label: string; sub: string; color: string; icon: string }> = {
  returned: { label: "差戻し", sub: "確認して再申請してください", color: "#c0392b", icon: "⚠️" },
  processing: { label: "処理中", sub: "経理が確認しています", color: "#b3892e", icon: "⏳" },
  approved: { label: "承認済み", sub: "処理が完了した申請", color: "#5e7d44", icon: "✅" },
};

function groupOf(status: string): Group {
  if (status === "keiri_returned" || status === "final_returned") return "returned";
  if (status === "journalize_pending" || status === "journalized") return "approved";
  return "processing"; // submitted / final_pending
}

export default function MyExpenseStatusPage() {
  const supabase = useMemo(() => createBrowserClient(), []);
  const [rows, setRows] = useState<Req[]>([]);
  const [thumbs, setThumbs] = useState<Record<string, string>>({});
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    const { data: auth } = await supabase.auth.getUser();
    const uid = auth?.user?.id;
    if (!uid) {
      setLoaded(true);
      return;
    }
    const { data: emp } = await supabase
      .from("root_employees")
      .select("employee_id")
      .eq("user_id", uid)
      .maybeSingle<{ employee_id: string }>();
    if (!emp) {
      setLoaded(true);
      return;
    }
    const { data } = await supabase
      .from("bud_expense_requests")
      .select("id,status,expense_kind,storage_path,drive_file_id,receipt_date,store_name,amount,return_reason,submitted_at")
      .eq("applicant_employee_id", emp.employee_id)
      .order("submitted_at", { ascending: false })
      .limit(100);
    const list = (data as Req[] | null) ?? [];
    setRows(list);
    setLoaded(true);

    // サムネイル（署名URL・まとめて取得）
    const paths = list
      .map((r) => r.storage_path ?? (r.drive_file_id?.startsWith("EMP-") ? r.drive_file_id : null))
      .filter((p): p is string => Boolean(p));
    if (paths.length > 0) {
      const { data: signed } = await supabase.storage.from("bud-receipts").createSignedUrls(paths, 600);
      const map: Record<string, string> = {};
      for (const s of signed ?? []) {
        if (s.signedUrl && s.path) map[s.path] = s.signedUrl;
      }
      setThumbs(map);
    }
  }, [supabase]);

  useEffect(() => {
    const t = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(t);
  }, [load]);

  const grouped = useMemo(() => {
    const g: Record<Group, Req[]> = { returned: [], processing: [], approved: [] };
    for (const r of rows) g[groupOf(r.status)].push(r);
    return g;
  }, [rows]);

  const thumbOf = (r: Req) => {
    const p = r.storage_path ?? (r.drive_file_id?.startsWith("EMP-") ? r.drive_file_id : null);
    return p ? thumbs[p] ?? null : null;
  };

  return (
    <main style={page}>
      <header style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
        <Link href="/m/bud" style={{ textDecoration: "none", color: "#7b745f", fontSize: 22, lineHeight: 1 }} aria-label="戻る">
          ‹
        </Link>
        <div>
          <div style={{ fontSize: 17, fontWeight: 700, color: "#3d3528" }}>申請状況</div>
          <div style={{ fontSize: 11, color: "#7b745f" }}>自分の経費申請と承認の状態</div>
        </div>
      </header>

      {!loaded && <div style={notice}>読み込み中…</div>}
      {loaded && rows.length === 0 && (
        <div style={notice}>
          まだ申請がありません。
          <br />
          <Link href="/m/bud/submit" style={{ color: "#b3406a", fontWeight: 700 }}>
            レシートを撮って申請する ›
          </Link>
        </div>
      )}

      {(["returned", "processing", "approved"] as Group[]).map((g) => {
        const items = grouped[g];
        if (items.length === 0) return null;
        const def = GROUP_DEF[g];
        return (
          <section key={g} style={{ marginBottom: 22 }}>
            <h2 style={{ fontSize: 14, color: def.color, margin: "0 0 4px" }}>
              {def.icon} {def.label}（{items.length}件）
            </h2>
            <p style={{ fontSize: 11, color: "#9a8f7d", margin: "0 0 10px" }}>{def.sub}</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {items.map((r) => {
                const t = thumbOf(r);
                return (
                  <div key={r.id} style={{ ...card, borderLeft: `3px solid ${def.color}` }}>
                    {t ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={t} alt="" style={cardImg} />
                    ) : (
                      <div style={{ ...cardImg, display: "flex", alignItems: "center", justifyContent: "center", color: "#9a8f7d", fontSize: 10 }}>
                        画像なし
                      </div>
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "#3d3528", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {r.store_name ?? "（店名 確認中）"}
                      </div>
                      <div style={{ fontSize: 11, color: "#6d6356", marginTop: 2 }}>
                        {r.receipt_date ?? "日付 確認中"}
                        {r.amount != null && r.amount > 0 && ` ・ ¥${r.amount.toLocaleString("ja-JP")}`}
                        {` ・ ${r.expense_kind === "company" ? "会社経費" : "個別経費"}`}
                      </div>
                      <div style={{ fontSize: 10, color: "#9a8f7d", marginTop: 2 }}>
                        申請 {r.submitted_at.slice(0, 10).replaceAll("-", "/")}
                      </div>
                      {g === "returned" && r.return_reason && (
                        <div style={{ fontSize: 11, color: "#c0392b", marginTop: 4, fontWeight: 600 }}>
                          理由: {r.return_reason}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}
    </main>
  );
}

const page: React.CSSProperties = {
  minHeight: "100dvh",
  background: "#f7f4ec",
  padding: "16px 14px 40px",
  maxWidth: 560,
  margin: "0 auto",
};
const notice: React.CSSProperties = {
  background: "#fff",
  border: "1px solid #e2ddcf",
  borderRadius: 14,
  padding: 24,
  textAlign: "center",
  color: "#6d6356",
  fontSize: 13,
  lineHeight: 2,
};
const card: React.CSSProperties = {
  display: "flex",
  gap: 12,
  alignItems: "center",
  background: "#fff",
  borderRadius: 12,
  padding: 10,
  boxShadow: "0 2px 6px rgba(0,0,0,0.04)",
};
const cardImg: React.CSSProperties = {
  width: 56,
  height: 56,
  objectFit: "cover",
  borderRadius: 8,
  background: "#eee",
  flexShrink: 0,
};
