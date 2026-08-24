"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createBrowserClient } from "@/app/_lib/supabase/browser";
import { buildEmployeeMap, fetchExpenseEmployeeLookup, type ExpenseEmployeeLookupRow } from "../_lib/expense-employees";
import { buildReexportConfirmation, donePeriodEnd, donePeriodStart, filterAndSortDoneRows, formatYayoiExportRecord, summarizeDoneRows, type DonePeriod } from "../_lib/expense-done";
import { FALLBACK_CORPS, sortCorps, type Corp, type Employee } from "./expenseCorpUtils";

type DoneRow = { id: string; status: string; deleted_at?: string | null; applicant_employee_id: string | null; receipt_date: string | null; category_id: string | null; store_name: string | null; amount: number | null; booking_date: string | null; booking_corp_id: string | null; fiscal_period: string | null; yayoi_exported_at: string | null; yayoi_export_count: number };
type Category = { id: string; name: string };
const SELECT = "id,status,applicant_employee_id,receipt_date,category_id,store_name,amount,booking_date,booking_corp_id,fiscal_period,deleted_at,yayoi_exported_at,yayoi_export_count";

export function ExpenseDonePanel() {
  const supabase = useMemo(() => createBrowserClient(), []);
  const [rows, setRows] = useState<DoneRow[]>([]);
  const [corps, setCorps] = useState<Corp[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [employees, setEmployees] = useState<Record<string, Employee>>({});
  const [corpId, setCorpId] = useState("all");
  // 既定は直近12か月（東海林さん指定・2026-08-24）。今月では短すぎる。
  const [period, setPeriod] = useState<DonePeriod>("year");
  const [loaded, setLoaded] = useState(false);
  const [ledgerBusy, setLedgerBusy] = useState(false);
  const [csvBusy, setCsvBusy] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState<string | null>(null);
  const start = useMemo(() => donePeriodStart(period), [period]);
  const end = useMemo(() => donePeriodEnd(period), [period]);

  const load = useCallback(async () => {
    setLoaded(false);
    let query = supabase.from("bud_expense_requests").select(SELECT).eq("status", "journalized").is("deleted_at", null).order("booking_date", { ascending: false, nullsFirst: false });
    if (start) query = query.gte("booking_date", start);
    if (end) query = query.lt("booking_date", end);
    const [requestRes, corpRes, categoryRes] = await Promise.all([
      query,
      supabase.from("bud_corporations").select("id,name_short").order("id"),
      supabase.from("bud_expense_categories").select("id,name"),
    ]);
    const nextRows = (requestRes.data as DoneRow[] | null) ?? [];
    setRows(nextRows);
    setCorps((corpRes.data as Corp[] | null) ?? FALLBACK_CORPS);
    setCategories((categoryRes.data as Category[] | null) ?? []);
    const employeeIds = Array.from(new Set(nextRows.map((row) => row.applicant_employee_id).filter((id): id is string => Boolean(id))));
    if (employeeIds.length) {
      const lookup = await fetchExpenseEmployeeLookup({ employeeIds, supabase });
      setEmployees(buildEmployeeMap(lookup.employees as Array<Employee & ExpenseEmployeeLookupRow>));
    } else setEmployees({});
    setMessage(requestRes.error ? `読み込みに失敗しました: ${requestRes.error.message}` : null);
    setLoaded(true);
  }, [end, start, supabase]);
  useEffect(() => { void load(); }, [load]);

  const visible = useMemo(() => filterAndSortDoneRows(rows, corpId, start, end), [corpId, end, rows, start]);
  const summary = useMemo(() => summarizeDoneRows(visible), [visible]);
  const corpMap = useMemo(() => new Map(corps.map((corp) => [corp.id, corp.name_short ?? corp.id])), [corps]);
  const categoryMap = useMemo(() => new Map(categories.map((category) => [category.id, category.name])), [categories]);
  const selectedRows = useMemo(() => visible.filter((row) => selectedIds.has(row.id)), [selectedIds, visible]);
  const allVisibleSelected = visible.length > 0 && selectedRows.length === visible.length;
  useEffect(() => {
    const visibleIds = new Set(visible.map((row) => row.id));
    setSelectedIds((current) => new Set(Array.from(current).filter((id) => visibleIds.has(id))));
  }, [visible]);

  const exportLedger = async () => {
    setLedgerBusy(true); setMessage(null);
    try {
      const response = await fetch("/api/bud/expense-booking/ledger-export", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ corpId, scope: "done", start, end }) });
      if (!response.ok) throw new Error(((await response.json().catch(() => null)) as { error?: string } | null)?.error ?? "書き出しに失敗しました");
      const blob = await response.blob(); const url = URL.createObjectURL(blob); const anchor = document.createElement("a");
      anchor.href = url; anchor.download = decodeURIComponent(response.headers.get("Content-Disposition")?.match(/filename\*=UTF-8''([^;]+)/)?.[1] ?? "領収書-Garden経費.xlsx"); anchor.click(); URL.revokeObjectURL(url);
      setMessage(`${visible.length}件を台帳形式で書き出しました。状態は変更していません。`);
    } catch (error) { setMessage(error instanceof Error ? error.message : "書き出しに失敗しました"); }
    finally { setLedgerBusy(false); }
  };

  const reexportYayoi = async () => {
    if (corpId === "all" || selectedRows.length === 0) return;
    const confirmation = buildReexportConfirmation(selectedRows);
    if (confirmation && !window.confirm(confirmation)) return;
    setCsvBusy(true); setMessage(null);
    try {
      const response = await fetch("/api/bud/expense-booking/export", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ corpId, ids: selectedRows.map((row) => row.id), mode: "reexport" }) });
      if (!response.ok) throw new Error(((await response.json().catch(() => null)) as { error?: string } | null)?.error ?? "再出力に失敗しました");
      downloadResponse(await response.blob(), response.headers.get("Content-Disposition"), "弥生CSV.csv");
      const count = selectedRows.length;
      setSelectedIds(new Set());
      await load();
      setMessage(`${count}件を弥生CSVで再出力し、出力履歴を更新しました。`);
    } catch (error) { setMessage(error instanceof Error ? error.message : "再出力に失敗しました"); }
    finally { setCsvBusy(false); }
  };

  return <section style={panel} data-expense-done-tab="true">
    <div style={header}><div><h3 style={title}>完了した経費</h3><div style={meta}>仕訳日が新しい順</div></div><div style={actions}><button type="button" style={button} disabled={ledgerBusy || csvBusy} onClick={() => void exportLedger()}>{ledgerBusy ? "書き出し中..." : "台帳形式で書き出す（Excel）"}</button><button type="button" style={{ ...reexportButton, ...((corpId === "all" || selectedRows.length === 0 || ledgerBusy || csvBusy) ? disabledButton : {}) }} disabled={corpId === "all" || selectedRows.length === 0 || ledgerBusy || csvBusy} onClick={() => void reexportYayoi()}>{csvBusy ? "再出力中..." : "弥生CSVを再出力"}</button></div></div>
    <div style={filters}>
      <label>仕分け法人名 <select value={corpId} onChange={(event) => setCorpId(event.target.value)}><option value="all">全法人</option>{sortCorps(corps).map((corp) => <option key={corp.id} value={corp.id}>{corp.name_short ?? corp.id}</option>)}</select></label>
      <label>期間 <select value={period} onChange={(event) => setPeriod(event.target.value as DonePeriod)}><option value="month">今月</option><option value="three-months">直近3か月</option><option value="year">直近12か月</option><option value="all">全期間</option></select></label>
    </div>
    <div style={summaryStyle}><strong>{summary.count}件</strong><span>税込 {yen(summary.taxIncluded)}</span><span>税抜 {yen(summary.taxExcluded)}</span></div>
    {message && <div style={notice}>{message}</div>}
    {!loaded ? <div style={empty}>読み込み中...</div> : visible.length === 0 ? <div style={empty}>この条件の完了した経費はありません。</div> : <div style={{ overflowX: "auto" }}><table style={table}><thead><tr><th style={checkCell}><input type="checkbox" aria-label="表示中の経費をすべて選択" checked={allVisibleSelected} onChange={(event) => setSelectedIds(event.target.checked ? new Set(visible.map((row) => row.id)) : new Set())} /></th>{["申請者","レシート日付","区分","店名","金額","仕分け日","仕分け法人名","決算区分","出力"].map((label) => <th key={label} style={th}>{label}</th>)}</tr></thead><tbody>{visible.map((row) => <tr key={row.id}><td style={checkCell}><input type="checkbox" aria-label={`${row.store_name ?? "経費"}を選択`} checked={selectedIds.has(row.id)} onChange={(event) => setSelectedIds((current) => { const next = new Set(current); if (event.target.checked) next.add(row.id); else next.delete(row.id); return next; })} /></td><td style={td}>{row.applicant_employee_id ? employees[row.applicant_employee_id]?.name ?? row.applicant_employee_id : "未設定"}</td><td style={td}>{date(row.receipt_date)}</td><td style={td}>{row.category_id ? categoryMap.get(row.category_id) ?? row.category_id : "未設定"}</td><td style={ellipsis}>{row.store_name ?? "—"}</td><td style={numberCell}>{yen(row.amount ?? 0)}</td><td style={td}>{date(row.booking_date)}</td><td style={td}>{row.booking_corp_id ? corpMap.get(row.booking_corp_id) ?? row.booking_corp_id : "未設定"}</td><td style={td}>{row.fiscal_period ?? "—"}</td><td style={exportCell}>{formatYayoiExportRecord(row)}</td></tr>)}</tbody></table></div>}
  </section>;
}

function yen(value: number) { return `¥${value.toLocaleString("ja-JP")}`; }
function date(value: string | null) { return value ? value.replaceAll("-", "/") : "—"; }
function downloadResponse(blob: Blob, disposition: string | null, fallback: string) { const url = URL.createObjectURL(blob); const anchor = document.createElement("a"); anchor.href = url; anchor.download = decodeURIComponent(disposition?.match(/filename\*=UTF-8''([^;]+)/)?.[1] ?? fallback); anchor.click(); URL.revokeObjectURL(url); }
const panel: React.CSSProperties = { background: "var(--bg-paper-soft)", border: "1px solid rgba(179,137,46,.18)", borderRadius: 12, padding: "18px 20px" };
const header: React.CSSProperties = { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" };
const title: React.CSSProperties = { margin: 0, color: "var(--text-main)", fontSize: 18 }; const meta: React.CSSProperties = { color: "var(--text-sub)", fontSize: 12 };
const filters: React.CSSProperties = { display: "flex", gap: 16, flexWrap: "wrap", margin: "16px 0", color: "var(--text-main)" };
const summaryStyle: React.CSSProperties = { display: "flex", gap: 20, flexWrap: "wrap", padding: "12px 14px", marginBottom: 14, borderRadius: 9, background: "var(--bg-card-solid)", color: "var(--text-main)", fontVariantNumeric: "tabular-nums" };
const button: React.CSSProperties = { border: "1px solid #b3892e", borderRadius: 999, padding: "9px 16px", background: "var(--bg-card-solid)", color: "var(--text-main)" };
const actions: React.CSSProperties = { display: "flex", gap: 8, flexWrap: "wrap" };
const reexportButton: React.CSSProperties = { border: "1px solid #642723", borderRadius: 999, padding: "9px 16px", background: "#7b312d", color: "#ffffff", fontWeight: 700 };
const disabledButton: React.CSSProperties = { opacity: .48, cursor: "not-allowed" };
const table: React.CSSProperties = { width: "100%", borderCollapse: "collapse", fontSize: 13 }; const th: React.CSSProperties = { padding: "9px 8px", textAlign: "left", whiteSpace: "nowrap", color: "var(--text-sub)", borderBottom: "1px solid rgba(180,165,130,.25)" }; const td: React.CSSProperties = { padding: "10px 8px", whiteSpace: "nowrap", color: "var(--text-main)", borderBottom: "1px dashed rgba(180,165,130,.18)" };
const ellipsis: React.CSSProperties = { ...td, maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis" }; const numberCell: React.CSSProperties = { ...td, textAlign: "right", fontVariantNumeric: "tabular-nums" };
const checkCell: React.CSSProperties = { ...td, width: 36, textAlign: "center" }; const exportCell: React.CSSProperties = { ...td, maxWidth: 190, overflow: "hidden", textOverflow: "ellipsis" };
const notice: React.CSSProperties = { padding: 10, marginBottom: 12, color: "var(--text-main)", background: "rgba(94,125,68,.12)", borderRadius: 8 }; const empty: React.CSSProperties = { padding: 28, textAlign: "center", color: "var(--text-sub)" };
