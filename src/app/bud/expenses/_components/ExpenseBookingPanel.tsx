"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { createBrowserClient } from "@/app/_lib/supabase/browser";
import { useBudState } from "@/app/bud/_state/BudStateContext";
import { buildExpenseDeleteConfirmMessage, normalizeDeleteReason, type ExpenseSoftDeleteRow } from "@/app/bud/expenses/_lib/expense-soft-delete";
import { isMissingSoftDeleteColumnError } from "@/app/bud/expenses/_lib/expense-soft-delete-query";
import { classifyExpenseJournal } from "../_lib/expense-journal-rules";

import {
  buildCompanyToCorp,
  FALLBACK_CORPS,
  getEffectiveCorpId,
  sortCorps,
  type Company,
  type Corp,
  type Employee,
} from "./expenseCorpUtils";

type Req = {
  id: string;
  corp_id: string | null;
  applicant_employee_id: string | null;
  receipt_date: string | null;
  store_name: string | null;
  amount: number | null;
  qualified_class: string | null;
  category_id: string | null;
  description: string | null;
  status: string;
  submitted_at: string;
  final_checked_at: string | null;
  deleted_at?: string | null;
  deleted_by?: string | null;
  delete_reason?: string | null;
};

type Cat = {
  id: string;
  name: string;
};

const REQUEST_SELECT =
  "id,corp_id,applicant_employee_id,receipt_date,store_name,amount,qualified_class,category_id,description,status,submitted_at,final_checked_at";
const REQUEST_SELECT_WITH_SOFT_DELETE = `${REQUEST_SELECT},deleted_at,deleted_by,delete_reason`;
const CORP_FILTER_STORAGE_KEY = "bud-expense-booking-corp-filter";

type ExpenseQueryResult = {
  data: unknown[] | null;
  error: { code?: string | null; message?: string | null; details?: string | null; hint?: string | null } | null;
};

async function readActiveExpenseRequests(
  makePrimaryQuery: (select: string) => PromiseLike<ExpenseQueryResult>,
  makeFallbackQuery: (select: string) => PromiseLike<ExpenseQueryResult>,
) {
  const primary = await makePrimaryQuery(REQUEST_SELECT_WITH_SOFT_DELETE);
  if (!isMissingSoftDeleteColumnError(primary.error)) return primary;
  return makeFallbackQuery(REQUEST_SELECT);
}

function readInitialCorpFilter() {
  if (typeof window === "undefined") return "all";
  try {
    return window.sessionStorage.getItem(CORP_FILTER_STORAGE_KEY) ?? "all";
  } catch {
    return "all";
  }
}

export function ExpenseBookingPanel({ embedded = false }: { embedded?: boolean }) {
  const supabase = useMemo(() => createBrowserClient(), []);
  const { hasGardenRoleAtLeast } = useBudState();
  const canManageSoftDelete = hasGardenRoleAtLeast("super_admin");
  const [queueAll, setQueueAll] = useState<Req[]>([]);
  const [journalizedThisMonth, setJournalizedThisMonth] = useState<Req[]>([]);
  const [cats, setCats] = useState<Cat[]>([]);
  const [corps, setCorps] = useState<Corp[]>([]);
  const [employees, setEmployees] = useState<Record<string, Employee>>({});
  const [companyToCorp, setCompanyToCorp] = useState<Record<string, string>>({});
  const [corpFilter, setCorpFilterState] = useState(readInitialCorpFilter);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const setCorpFilter = useCallback((next: string) => {
    setCorpFilterState(next);
    try {
      window.sessionStorage.setItem(CORP_FILTER_STORAGE_KEY, next);
    } catch {
      // sessionStorage is optional; filtering still works without persistence.
    }
  }, []);

  const sortedCorps = useMemo(() => sortCorps(corps), [corps]);
  const catMap = useMemo(() => new Map(cats.map((cat) => [cat.id, cat.name])), [cats]);

  const load = useCallback(async () => {
    setLoaded(false);
    setMessage(null);
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    const [queueRes, journalizedRes, catRes, corpRes, companyRes] = await Promise.all([
      readActiveExpenseRequests(
        (select) =>
          supabase
            .from("bud_expense_requests")
            .select(select)
            .eq("status", "journalize_pending")
            .is("deleted_at", null)
            .order("receipt_date", { ascending: true, nullsFirst: false })
            .order("submitted_at", { ascending: true }),
        (select) =>
          supabase
            .from("bud_expense_requests")
            .select(select)
            .eq("status", "journalize_pending")
            .order("receipt_date", { ascending: true, nullsFirst: false })
            .order("submitted_at", { ascending: true }),
      ),
      readActiveExpenseRequests(
        (select) =>
          supabase
            .from("bud_expense_requests")
            .select(select)
            .eq("status", "journalized")
            .is("deleted_at", null)
            .gte("journalized_at", monthStart)
            .order("journalized_at", { ascending: false }),
        (select) =>
          supabase
            .from("bud_expense_requests")
            .select(select)
            .eq("status", "journalized")
            .gte("journalized_at", monthStart)
            .order("journalized_at", { ascending: false }),
      ),
      supabase.from("bud_expense_categories").select("id,name").eq("is_active", true).order("display_order", { ascending: true }),
      supabase.from("bud_corporations").select("id,name_short").order("id", { ascending: true }),
      supabase.from("root_companies").select("company_id,company_name"),
    ]);

    const queue = (queueRes.data as Req[] | null) ?? [];
    const done = (journalizedRes.data as Req[] | null) ?? [];
    setQueueAll(queue);
    setJournalizedThisMonth(done);
    setCats((catRes.data as Cat[] | null) ?? []);
    const corpList = corpRes.error ? FALLBACK_CORPS : ((corpRes.data as Corp[] | null) ?? FALLBACK_CORPS);
    setCorps(corpList);
    setCompanyToCorp(buildCompanyToCorp((companyRes.data as Company[] | null) ?? [], corpList));

    const employeeIds = Array.from(
      new Set([...queue, ...done].map((row) => row.applicant_employee_id).filter((id): id is string => Boolean(id))),
    );
    if (employeeIds.length > 0) {
      const { data } = await supabase.from("root_employees").select("employee_id,company_id,name").in("employee_id", employeeIds);
      const map: Record<string, Employee> = {};
      for (const employee of ((data as Employee[] | null) ?? [])) {
        map[employee.employee_id] = employee;
      }
      setEmployees(map);
    } else {
      setEmployees({});
    }

    setLoaded(true);
  }, [supabase]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!embedded) return;
    const tab = document.getElementById("tab-booking");
    if (!tab) return;
    let wasActive = tab.classList.contains("active");
    const obs = new MutationObserver(() => {
      const isActive = tab.classList.contains("active");
      if (isActive && !wasActive) void load();
      wasActive = isActive;
    });
    obs.observe(tab, { attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, [embedded, load]);

  const effectiveCorpId = useCallback((row: Req) => getEffectiveCorpId(row, employees, companyToCorp), [employees, companyToCorp]);
  const corpMatches = useCallback((row: Req) => corpFilter === "all" || effectiveCorpId(row) === corpFilter, [corpFilter, effectiveCorpId]);
  const list = useMemo(() => queueAll.filter(corpMatches), [queueAll, corpMatches]);
  const doneFiltered = useMemo(() => journalizedThisMonth.filter(corpMatches), [journalizedThisMonth, corpMatches]);
  const rows = useMemo(() => {
    return list.map((row) => {
      const applicant = employeeLabel(row, employees);
      const category = categoryLabel(row.category_id, catMap);
      return {
        row,
        applicant,
        category,
        corpId: effectiveCorpId(row),
        journal: classifyExpenseJournal({
          id: row.id,
          receiptDate: row.receipt_date,
          categoryName: category,
          storeName: row.store_name,
          amount: row.amount,
          qualifiedClass: row.qualified_class,
          applicantName: applicant,
        }),
      };
    });
  }, [catMap, effectiveCorpId, employees, list]);

  const selectableIds = useMemo(() => rows.filter((row) => row.journal.ok).map((row) => row.row.id), [rows]);
  const selectedRows = useMemo(() => rows.filter((row) => selectedIds.has(row.row.id) && row.journal.ok), [rows, selectedIds]);
  const selectedTotal = selectedRows.reduce((sum, row) => sum + row.journal.amount, 0);
  const queueTotal = rows.reduce((sum, row) => sum + row.journal.amount, 0);
  const errorCount = rows.filter((row) => !row.journal.ok).length;
  const canExport = corpFilter !== "all" && selectedRows.length > 0 && !busy;

  useEffect(() => {
    setSelectedIds(new Set(selectableIds));
  }, [selectableIds]);

  useEffect(() => {
    if (!embedded || !loaded) return;
    const tab = document.getElementById("tab-booking");
    if (!tab) return;
    const hiddenBlocks = Array.from(
      tab.querySelectorAll<HTMLElement>(".exp-bk-view-label, .exp-bk-summary, .exp-bk-main-row, .exp-bk-done-card"),
    );
    hiddenBlocks.forEach((block) => block.style.setProperty("display", "none"));

    const host = tab.querySelector<HTMLElement>(".bud-corp-switch");
    if (!host) {
      return () => hiddenBlocks.forEach((block) => block.style.removeProperty("display"));
    }

    host.replaceChildren();
    const options = [
      { id: "all", label: "全法人合算" },
      ...sortedCorps.map((corp) => ({ id: corp.id, label: corp.name_short ?? corp.id })),
    ];
    for (const option of options) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `bud-corp-tab${corpFilter === option.id ? " active" : ""}`;
      button.dataset.corpId = option.id;
      button.textContent = option.label;
      host.appendChild(button);
    }
    const onClick = (event: MouseEvent) => {
      const button = (event.target as HTMLElement).closest<HTMLButtonElement>("[data-corp-id]");
      if (!button) return;
      setCorpFilter(button.dataset.corpId ?? "all");
    };
    host.addEventListener("click", onClick);
    return () => {
      host.removeEventListener("click", onClick);
      hiddenBlocks.forEach((block) => block.style.removeProperty("display"));
    };
  }, [corpFilter, embedded, loaded, setCorpFilter, sortedCorps]);

  const toggle = (id: string, checked: boolean) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const toggleAll = (checked: boolean) => {
    setSelectedIds(checked ? new Set(selectableIds) : new Set());
  };

  const softDeleteRows = async (targetRows: ExpenseSoftDeleteRow[]) => {
    if (!canManageSoftDelete || targetRows.length === 0 || busy) return;
    const reason = normalizeDeleteReason(window.prompt("削除理由を入力してください") ?? "");
    if (!reason) {
      setMessage("削除理由は必須です");
      return;
    }
    if (!window.confirm(buildExpenseDeleteConfirmMessage(targetRows, reason))) return;
    setBusy(true);
    setMessage(null);
    try {
      const { error } = await supabase.rpc("bud_expense_soft_delete", {
        p_ids: targetRows.map((row) => row.id),
        p_reason: reason,
      });
      if (error) throw error;
      setSelectedIds(new Set());
      await load();
      setMessage(`${targetRows.length}件を削除済みに移動しました`);
    } catch (error) {
      setMessage("削除済みへの移動に失敗しました: " + (error instanceof Error ? error.message : String(error)));
    } finally {
      setBusy(false);
    }
  };

  const exportCsv = async () => {
    if (!canExport) return;
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/bud/expense-booking/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ corpId: corpFilter, ids: selectedRows.map((row) => row.row.id) }),
      });
      if (!res.ok) {
        const json = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(json?.error ?? "CSV書き出しに失敗しました");
      }
      const blob = await res.blob();
      const filename = parseFilename(res.headers.get("Content-Disposition")) ?? `弥生インポート_経費_${corpFilter}.csv`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setMessage(`${selectedRows.length}件を書き出し、仕訳済みに更新しました。`);
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "CSV書き出しに失敗しました");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={shell}>
      {!embedded && (
        <header style={{ marginBottom: 18 }}>
          <h1 style={title}>経費精算 - 仕訳化</h1>
          <p style={lead}>完了済みの経費を弥生インポートCSVへ書き出します。</p>
          <CorpFilter value={corpFilter} corps={sortedCorps} onChange={setCorpFilter} />
        </header>
      )}

      <section style={cards}>
        <Card label="仕訳化待ち" value={loaded ? rows.length : "-"} meta={`合計 ${yen(queueTotal)}`} color="#b3892e" />
        <Card label="選択中" value={selectedRows.length} meta={`合計 ${yen(selectedTotal)}`} color="#5e7d44" />
        <Card label="要確認" value={errorCount} meta="CSV対象外" color="#b35850" />
        <Card label="今月仕訳済" value={doneFiltered.length} meta={`合計 ${yen(doneFiltered.reduce((sum, row) => sum + (row.amount ?? 0), 0))}`} color="var(--text-sub)" />
      </section>

      {message && <div style={notice}>{message}</div>}
      {corpFilter === "all" && <div style={warning}>CSV書き出しは法人を1つ選択すると有効になります。</div>}

      <section style={panel}>
        <div style={panelHead}>
          <div>
            <h3 style={panelTitle}>仕訳プレビュー</h3>
            <div style={panelMeta}>status=journalize_pending / {rows.length}件</div>
          </div>
          <div style={toolbar}>
            <label style={checkAllLabel}>
              <input
                type="checkbox"
                checked={selectableIds.length > 0 && selectedRows.length === selectableIds.length}
                disabled={selectableIds.length === 0}
                onChange={(event) => toggleAll(event.target.checked)}
              />
              全選択
            </label>
            <button type="button" style={exportBtn(canExport)} disabled={!canExport} onClick={() => void exportCsv()}>
              {busy ? "書き出し中..." : "弥生CSVを書き出す"}
            </button>
            {canManageSoftDelete && (
              <button type="button" style={deleteBtn} disabled={busy || selectedRows.length === 0} onClick={() => void softDeleteRows(selectedRows.map((item) => item.row))}>
                Delete selected
              </button>
            )}
          </div>
        </div>

        {!loaded ? (
          <div style={empty}>読み込み中...</div>
        ) : rows.length === 0 ? (
          <div style={empty}>この条件の仕訳化待ちはありません。</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={table}>
              <thead>
                <tr>
                  <th style={th}></th>
                  <th style={th}>申請者</th>
                  <th style={th}>日付</th>
                  <th style={th}>区分</th>
                  <th style={th}>店名</th>
                  <th style={{ ...th, textAlign: "right" }}>金額</th>
                  <th style={th}>借方科目</th>
                  <th style={th}>税区分</th>
                  <th style={{ ...th, textAlign: "right" }}>消費税</th>
                  <th style={th}>貸方</th>
                  <th style={th}>摘要</th>
                  <th style={th}>注記</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ row, applicant, category, journal }) => {
                  const checked = selectedIds.has(row.id) && journal.ok;
                  return (
                    <tr key={row.id} style={journal.ok ? (checked ? checkedTr : tr) : errorTr}>
                      <td style={td}>
                        <input
                          type="checkbox"
                          disabled={!journal.ok}
                          checked={checked}
                          onChange={(event) => toggle(row.id, event.target.checked)}
                        />
                      </td>
                      <td style={td}>{applicant}</td>
                      <td style={td}>{formatDate(row.receipt_date)}</td>
                      <td style={td}>{category}</td>
                      <td style={td}>{row.store_name ?? "-"}</td>
                      <td style={{ ...td, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{yen(row.amount ?? 0)}</td>
                      <td style={td}>{journal.debitAccount}</td>
                      <td style={td}><span style={taxBadge(journal.debitTaxClass)}>{journal.debitTaxClass}</span></td>
                      <td style={{ ...td, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{yen(journal.debitTaxAmount)}</td>
                      <td style={td}>現金</td>
                      <td style={td}>{journal.description}</td>
                      <td style={td}><span style={journal.ok ? okBadge : errorBadge}>{journal.note}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function CorpFilter({ value, corps, onChange }: { value: string; corps: Corp[]; onChange: (value: string) => void }) {
  return (
    <div style={corpSwitch}>
      <button type="button" style={corpTab(value === "all")} onClick={() => onChange("all")}>
        全法人合算
      </button>
      {corps.map((corp) => (
        <button key={corp.id} type="button" style={corpTab(value === corp.id)} onClick={() => onChange(corp.id)}>
          {corp.name_short ?? corp.id}
        </button>
      ))}
    </div>
  );
}

// 完了待ち/承認待ちタブと同じコンパクトカード（上に余白を確保し主要部は下寄せ＝3タブで高さ統一）
function Card({ label, value, meta, color }: { label: string; value: number | string; meta: string; color: string }) {
  return (
    <div style={{ ...compactCard, borderLeft: `3px solid ${color}` }}>
      <div style={compactCardSub} />
      <div style={compactCardMain}>
        <span style={{ color: "var(--text-sub)", overflow: "hidden", textOverflow: "ellipsis" }}>{label}</span>
        <strong style={{ fontSize: 16, color, fontVariantNumeric: "tabular-nums" }}>
          {value}
          {typeof value === "number" ? "件" : ""}
        </strong>
        <span style={{ color: "var(--text-sub)", marginLeft: "auto", overflow: "hidden", textOverflow: "ellipsis" }}>{meta}</span>
      </div>
    </div>
  );
}

function employeeLabel(row: Req, employees: Record<string, Employee>) {
  if (!row.applicant_employee_id) return "未設定";
  return employees[row.applicant_employee_id]?.name ?? row.applicant_employee_id;
}

function categoryLabel(categoryId: string | null, cats: Map<string, string>) {
  if (!categoryId) return "未設定";
  return cats.get(categoryId) ?? categoryId;
}

function formatDate(value: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("ja-JP", { year: "2-digit", month: "2-digit", day: "2-digit" });
}

function yen(value: number) {
  return "¥" + value.toLocaleString("ja-JP");
}

function parseFilename(header: string | null) {
  if (!header) return null;
  const encoded = header.match(/filename\*=UTF-8''([^;]+)/)?.[1];
  if (encoded) return decodeURIComponent(encoded);
  return header.match(/filename="([^"]+)"/)?.[1] ?? null;
}

const shell: React.CSSProperties = { marginBottom: 24 };
const title: React.CSSProperties = { margin: 0, fontSize: 22, color: "var(--text-main)", fontFamily: "'Shippori Mincho', serif" };
const lead: React.CSSProperties = { margin: "4px 0 14px", color: "var(--text-sub)", fontSize: 13 };
const cards: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 10, marginBottom: 16 };
const compactCard: React.CSSProperties = {
  boxSizing: "border-box",
  display: "flex",
  flexDirection: "column",
  gap: 3,
  padding: "8px 14px",
  background: "var(--bg-paper-soft)",
  border: "1px solid rgba(179,137,46,0.18)",
  borderRadius: 10,
  fontSize: 13,
  whiteSpace: "nowrap",
};
// 完了待ちタブの「経理差戻し」行と同じ高さの余白（3タブでカード高さを揃える）
const compactCardSub: React.CSSProperties = { height: 16, lineHeight: "16px", fontSize: 11 };
const compactCardMain: React.CSSProperties = { marginTop: "auto", display: "flex", alignItems: "baseline", gap: 8 };
const panel: React.CSSProperties = { background: "var(--bg-paper-soft)", border: "1px solid rgba(179,137,46,0.18)", borderRadius: 12, padding: "18px 20px" };
const panelHead: React.CSSProperties = { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, marginBottom: 12 };
const panelTitle: React.CSSProperties = { margin: 0, fontSize: 17, color: "var(--text-main)", fontWeight: 600 };
const panelMeta: React.CSSProperties = { color: "var(--text-muted)", fontSize: 12, marginTop: 3 };
const toolbar: React.CSSProperties = { display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", justifyContent: "flex-end" };
const checkAllLabel: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 6, color: "var(--text-sub)", fontSize: 13 };
const table: React.CSSProperties = { width: "100%", borderCollapse: "collapse", fontSize: 13 };
const th: React.CSSProperties = { textAlign: "left", color: "var(--text-sub)", fontWeight: 500, padding: "9px 8px", borderBottom: "1px solid rgba(180,165,130,0.25)", whiteSpace: "nowrap" };
const td: React.CSSProperties = { padding: "10px 8px", borderBottom: "1px dashed rgba(180,165,130,0.18)", color: "var(--text-main)", verticalAlign: "middle", whiteSpace: "nowrap" };
const tr: React.CSSProperties = {};
const checkedTr: React.CSSProperties = { background: "rgba(212,165,65,0.08)" };
const errorTr: React.CSSProperties = { background: "rgba(179,88,80,0.08)" };
const empty: React.CSSProperties = { padding: 28, textAlign: "center", color: "var(--text-sub)", background: "var(--bg-card-solid)", borderRadius: 10 };
const notice: React.CSSProperties = { padding: "10px 14px", marginBottom: 12, background: "rgba(94,125,68,0.12)", border: "1px solid rgba(94,125,68,0.25)", borderRadius: 10, color: "#4d6838", fontSize: 13 };
const warning: React.CSSProperties = { padding: "10px 14px", marginBottom: 12, background: "rgba(212,165,65,0.12)", border: "1px solid rgba(212,165,65,0.25)", borderRadius: 10, color: "#8a6822", fontSize: 13 };
const okBadge: React.CSSProperties = { display: "inline-block", padding: "3px 9px", borderRadius: 999, background: "rgba(94,125,68,0.14)", color: "#5e7d44", fontSize: 12 };
const errorBadge: React.CSSProperties = { display: "inline-block", padding: "3px 9px", borderRadius: 999, background: "rgba(179,88,80,0.16)", color: "#8a3a32", fontSize: 12 };
const corpSwitch: React.CSSProperties = { display: "flex", gap: 4, marginBottom: 18, padding: 6, background: "var(--bg-card)", borderRadius: 999, width: "fit-content", border: "1px solid rgba(180,165,130,0.2)", flexWrap: "wrap" };
const corpTab = (active: boolean): React.CSSProperties => ({ padding: "8px 20px", borderRadius: 999, border: "none", background: active ? "#d4a541" : "transparent", color: active ? "#fff" : "var(--text-sub)", cursor: "pointer", boxShadow: active ? "0 2px 8px rgba(212,165,65,0.3)" : "none" });
const deleteBtn: React.CSSProperties = { border: "1px solid #8f3b36", borderRadius: 999, padding: "9px 14px", background: "rgba(179,80,72,0.08)", color: "#8f3b36", cursor: "pointer", whiteSpace: "nowrap" };
const exportBtn = (active: boolean): React.CSSProperties => ({ border: "none", borderRadius: 999, padding: "10px 18px", background: active ? "#d4a541" : "#d8d0bd", color: "#fff", cursor: active ? "pointer" : "not-allowed", boxShadow: active ? "0 3px 10px rgba(212,165,65,0.25)" : "none" });
const taxBadge = (taxClass: string): React.CSSProperties => ({
  display: "inline-block",
  padding: "3px 8px",
  borderRadius: 5,
  background: taxClass === "対象外" ? "rgba(138,94,138,0.14)" : taxClass.includes("80%") ? "rgba(212,165,65,0.16)" : "rgba(91,138,168,0.14)",
  color: taxClass === "対象外" ? "#8a5e8a" : taxClass.includes("80%") ? "#9b711d" : "#4a728a",
  fontSize: 12,
});
