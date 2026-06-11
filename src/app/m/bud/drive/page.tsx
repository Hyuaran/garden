"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";

import { createBrowserClient } from "@/app/_lib/supabase/browser";

import {
  folderOfStatus,
  formatYen,
  getMyEmployee,
  getMyExpenseRequests,
  statusLabel,
  updateReturnedExpenseRequest,
  type MobileEmployee,
  type MobileExpenseAction,
  type MobileExpenseFolderKey,
  type MobileExpenseRequest,
} from "../../_lib/mobile-expenses";
import {
  budBackLink,
  budCard,
  budHeader,
  budLead,
  budMobile,
  budNotice,
  budPage,
  budPrimaryButton,
  budSecondaryButton,
  budSectionTitle,
  budTitle,
} from "../../_lib/mobile-theme";

type ViewKey = "root" | MobileExpenseFolderKey;
type BusyState = { id: string; action: MobileExpenseAction } | null;

const ROOT_FOLDERS: { key: MobileExpenseFolderKey; label: string; sub: string }[] = [
  { key: "pending", label: "確認待ち", sub: "提出直後の申請" },
  { key: "approved", label: "1_承認", sub: "経理承認済み" },
  { key: "completed", label: "2_完了", sub: "仕訳化へ進んだ申請" },
  { key: "returned", label: "0_差戻し", sub: "再確認が必要な申請" },
];

export default function MyExpenseStatusPage() {
  const supabase = useMemo(() => createBrowserClient(), []);
  const [employee, setEmployee] = useState<MobileEmployee | null>(null);
  const [rows, setRows] = useState<MobileExpenseRequest[]>([]);
  const [thumbs, setThumbs] = useState<Record<string, string>>({});
  const [loaded, setLoaded] = useState(false);
  const [view, setView] = useState<ViewKey>("root");
  const [busy, setBusy] = useState<BusyState>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoaded(false);
    const emp = await getMyEmployee(supabase);
    setEmployee(emp);
    if (!emp) {
      setRows([]);
      setLoaded(true);
      return;
    }
    const list = await getMyExpenseRequests(supabase, emp.employee_id);
    setRows(list);
    setLoaded(true);

    const paths = list
      .map((row) => row.storage_path ?? (row.drive_file_id?.startsWith("EMP-") ? row.drive_file_id : null))
      .filter((path): path is string => Boolean(path));
    if (paths.length > 0) {
      const { data: signed } = await supabase.storage.from("bud-receipts").createSignedUrls(paths, 600);
      const map: Record<string, string> = {};
      for (const signedRow of signed ?? []) {
        if (signedRow.signedUrl && signedRow.path) map[signedRow.path] = signedRow.signedUrl;
      }
      setThumbs(map);
    } else {
      setThumbs({});
    }
  }, [supabase]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const grouped = useMemo(() => {
    const result: Record<MobileExpenseFolderKey, MobileExpenseRequest[]> = {
      pending: [],
      approved: [],
      completed: [],
      returned: [],
      not_reimbursable: [],
    };
    for (const row of rows) result[folderOfStatus(row.status)].push(row);
    return result;
  }, [rows]);

  const updateRequest = async (row: MobileExpenseRequest, action: MobileExpenseAction) => {
    if (!employee || busy) return;
    setBusy({ id: row.id, action });
    setMessage(null);
    try {
      await updateReturnedExpenseRequest(supabase, row.id, employee.employee_id, action);
      setMessage(action === "resubmitted" ? "再申請しました。" : "0_精算不可へ移動しました。");
      await load();
      setView(action === "not_reimbursable" ? "not_reimbursable" : "pending");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "更新に失敗しました。");
    } finally {
      setBusy(null);
    }
  };

  const currentRows = view === "root" ? [] : grouped[view];

  return (
    <main style={budPage}>
      <header style={budHeader}>
        <Link href="/m/bud" style={budBackLink} aria-label="Budへ戻る">
          ‹
        </Link>
        <div>
          <h1 style={budTitle}>申請状況</h1>
          <p style={budLead}>Driveと同じ感覚で、自分の経費申請をたどります。</p>
        </div>
      </header>

      {!loaded && <div style={budNotice}>読み込み中...</div>}
      {message && <div style={{ ...budNotice, padding: 12, marginBottom: 14, color: budMobile.colors.gold }}>{message}</div>}

      {loaded && view === "root" && (
        <section>
          <h2 style={budSectionTitle}>フォルダ</h2>
          <div style={folderGrid}>
            {ROOT_FOLDERS.map((folder) => (
              <button key={folder.key} type="button" style={folderTile} onClick={() => setView(folder.key)}>
                <span style={folderIcon}>▰</span>
                <span style={folderLabel}>{folder.label}</span>
                <span style={folderSub}>{folder.sub}</span>
                <span style={folderCount}>{grouped[folder.key].length}件</span>
              </button>
            ))}
          </div>
        </section>
      )}

      {loaded && view !== "root" && (
        <section>
          <div style={crumb}>
            <button type="button" style={crumbBtn} onClick={() => setView("root")}>
              フォルダ
            </button>
            <span>›</span>
            <span>{folderTitle(view)}</span>
          </div>

          {view === "returned" && (
            <button type="button" style={subFolderTile} onClick={() => setView("not_reimbursable")}>
              <span style={folderIcon}>▰</span>
              <span style={{ flex: 1 }}>0_精算不可</span>
              <span style={folderCount}>{grouped.not_reimbursable.length}件</span>
            </button>
          )}

          {currentRows.length === 0 ? (
            <div style={budNotice}>このフォルダに申請はありません。</div>
          ) : (
            <div style={list}>
              {currentRows.map((row) => (
                <ExpenseRow
                  key={row.id}
                  row={row}
                  thumb={thumbOf(row, thumbs)}
                  canAct={view === "returned"}
                  busy={busy}
                  onAction={updateRequest}
                />
              ))}
            </div>
          )}
        </section>
      )}
    </main>
  );
}

function ExpenseRow({
  row,
  thumb,
  canAct,
  busy,
  onAction,
}: {
  row: MobileExpenseRequest;
  thumb: string | null;
  canAct: boolean;
  busy: BusyState;
  onAction: (row: MobileExpenseRequest, action: MobileExpenseAction) => void;
}) {
  const rowBusy = busy?.id === row.id;
  return (
    <article style={rowCard}>
      {thumb ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={thumb} alt="" style={thumbStyle} />
      ) : (
        <div style={thumbEmpty}>領収書</div>
      )}
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={rowHead}>
          <span style={rowStore}>{row.store_name ?? "店名未入力"}</span>
          <span style={rowAmount}>{formatYen(row.amount)}</span>
        </div>
        <div style={rowMeta}>
          {row.receipt_date ?? "日付未入力"} / {statusLabel(row.status)}
        </div>
        {row.return_reason && <div style={rowReason}>理由: {row.return_reason}</div>}
        {canAct && (
          <div style={actions}>
            <button type="button" style={budPrimaryButton} disabled={rowBusy} onClick={() => onAction(row, "resubmitted")}>
              {rowBusy && busy?.action === "resubmitted" ? "処理中..." : "再申請する"}
            </button>
            <button
              type="button"
              style={{ ...budSecondaryButton, color: budMobile.colors.red, borderColor: "rgba(155,58,44,0.35)" }}
              disabled={rowBusy}
              onClick={() => onAction(row, "not_reimbursable")}
            >
              {rowBusy && busy?.action === "not_reimbursable" ? "処理中..." : "精算不可"}
            </button>
          </div>
        )}
      </div>
    </article>
  );
}

function folderTitle(view: MobileExpenseFolderKey) {
  if (view === "pending") return "確認待ち";
  if (view === "approved") return "1_承認";
  if (view === "completed") return "2_完了";
  if (view === "returned") return "0_差戻し";
  return "0_精算不可";
}

function thumbOf(row: MobileExpenseRequest, thumbs: Record<string, string>) {
  const path = row.storage_path ?? (row.drive_file_id?.startsWith("EMP-") ? row.drive_file_id : null);
  return path ? thumbs[path] ?? null : null;
}

const folderGrid: React.CSSProperties = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 };
const folderTile: React.CSSProperties = {
  ...budCard,
  border: `1px solid ${budMobile.colors.border}`,
  padding: 14,
  textAlign: "left",
  minHeight: 132,
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-start",
  gap: 5,
  color: budMobile.colors.text,
  fontFamily: budMobile.font.serif,
};
const folderIcon: React.CSSProperties = { color: budMobile.colors.goldStrong, fontSize: 25, lineHeight: 1 };
const folderLabel: React.CSSProperties = { fontSize: 16, fontWeight: 700, letterSpacing: "0.04em" };
const folderSub: React.CSSProperties = { color: budMobile.colors.sub, fontSize: 11, lineHeight: 1.4, flex: 1 };
const folderCount: React.CSSProperties = { color: budMobile.colors.gold, fontFamily: budMobile.font.number, fontSize: 20, lineHeight: 1 };
const crumb: React.CSSProperties = { display: "flex", alignItems: "center", gap: 8, color: budMobile.colors.sub, fontSize: 12, marginBottom: 12 };
const crumbBtn: React.CSSProperties = { border: "none", background: "transparent", color: budMobile.colors.gold, padding: 0, fontFamily: budMobile.font.serif };
const subFolderTile: React.CSSProperties = {
  ...budCard,
  width: "100%",
  display: "flex",
  alignItems: "center",
  gap: 12,
  padding: 14,
  marginBottom: 12,
  color: budMobile.colors.text,
  fontFamily: budMobile.font.serif,
  border: `1px solid ${budMobile.colors.border}`,
};
const list: React.CSSProperties = { display: "flex", flexDirection: "column", gap: 10 };
const rowCard: React.CSSProperties = { ...budCard, display: "flex", gap: 12, padding: 12, alignItems: "flex-start" };
const thumbStyle: React.CSSProperties = { width: 60, height: 60, objectFit: "cover", borderRadius: 10, border: `1px solid ${budMobile.colors.border}`, flexShrink: 0 };
const thumbEmpty: React.CSSProperties = {
  width: 60,
  height: 60,
  borderRadius: 10,
  background: "rgba(179,137,46,0.08)",
  color: budMobile.colors.muted,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 10,
  flexShrink: 0,
};
const rowHead: React.CSSProperties = { display: "flex", justifyContent: "space-between", gap: 8, alignItems: "baseline" };
const rowStore: React.CSSProperties = { minWidth: 0, color: budMobile.colors.text, fontSize: 14, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" };
const rowAmount: React.CSSProperties = { color: budMobile.colors.gold, fontFamily: budMobile.font.number, fontSize: 16, flexShrink: 0 };
const rowMeta: React.CSSProperties = { marginTop: 3, color: budMobile.colors.sub, fontSize: 11 };
const rowReason: React.CSSProperties = { marginTop: 8, color: budMobile.colors.red, background: "rgba(155,58,44,0.08)", borderRadius: 8, padding: 8, fontSize: 11 };
const actions: React.CSSProperties = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 10 };
