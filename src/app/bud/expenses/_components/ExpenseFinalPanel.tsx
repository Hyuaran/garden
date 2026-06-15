"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { createBrowserClient } from "@/app/_lib/supabase/browser";

import {
  buildCompanyToCorp,
  FALLBACK_CORPS,
  getEffectiveCorpId,
  sortCorps,
  type Company,
  type Corp,
  type Employee,
} from "./expenseCorpUtils";
import { notifyDriveMove, resolveReceiptStoragePath } from "./expenseReceiptUtils";

type Req = {
  id: string;
  corp_id: string | null;
  applicant_employee_id: string | null;
  expense_kind: string;
  drive_file_id: string | null;
  storage_path: string | null;
  receipt_date: string | null;
  store_name: string | null;
  amount: number | null;
  qualified_class: string | null;
  qualified_number: string | null;
  category_id: string | null;
  description: string | null;
  status: string;
  return_reason: string | null;
  submitted_at: string;
  keiri_checked_at: string | null;
  final_checked_at: string | null;
};
type Cat = { id: string; name: string };
type DetailMode = "detail" | "return";
type TodayStats = {
  approvedCount: number;
  approvedAmount: number;
  returnedCount: number;
  returnedAmount: number;
  keiriReturnedCount: number;
};

const REQUEST_SELECT =
  "id,corp_id,applicant_employee_id,expense_kind,drive_file_id,storage_path,receipt_date,store_name,amount,qualified_class,qualified_number,category_id,description,status,return_reason,submitted_at,keiri_checked_at,final_checked_at";
const CORP_FILTER_STORAGE_KEY = "bud-expense-final-corp-filter";

function readInitialCorpFilter() {
  if (typeof window === "undefined") return "all";
  try {
    return window.sessionStorage.getItem(CORP_FILTER_STORAGE_KEY) ?? "all";
  } catch {
    return "all";
  }
}

export function ExpenseFinalPanel({ embedded = false }: { embedded?: boolean }) {
  const supabase = useMemo(() => createBrowserClient(), []);
  const [pendingAll, setPendingAll] = useState<Req[]>([]);
  const [finalProcessedToday, setFinalProcessedToday] = useState<Req[]>([]);
  const [keiriReturnedToday, setKeiriReturnedToday] = useState<Req[]>([]);
  const [cats, setCats] = useState<Cat[]>([]);
  const [corps, setCorps] = useState<Corp[]>([]);
  const [employees, setEmployees] = useState<Record<string, Employee>>({});
  const [companyToCorp, setCompanyToCorp] = useState<Record<string, string>>({});
  const [corpFilter, setCorpFilterState] = useState(readInitialCorpFilter);
  const [idx, setIdx] = useState(0);
  const [detail, setDetail] = useState<Req | null>(null);
  const [detailMode, setDetailMode] = useState<DetailMode>("detail");
  const [detailImgUrl, setDetailImgUrl] = useState<string | null>(null);
  const [returnReason, setReturnReason] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const openedAt = useRef<number>(0);

  const setCorpFilter = useCallback((next: string) => {
    setCorpFilterState(next);
    try {
      window.sessionStorage.setItem(CORP_FILTER_STORAGE_KEY, next);
    } catch {
      // セッション保持に失敗してもフィルター自体は動く。
    }
  }, []);

  const sortedCorps = useMemo(() => sortCorps(corps), [corps]);

  const load = useCallback(async () => {
    setLoaded(false);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayIso = today.toISOString();

    const [pendingRes, finalProcessedRes, keiriReturnedRes, catRes, corpRes, companyRes] = await Promise.all([
      supabase.from("bud_expense_requests").select(REQUEST_SELECT).eq("status", "final_pending").order("submitted_at", { ascending: true }),
      supabase
        .from("bud_expense_requests")
        .select(REQUEST_SELECT)
        .in("status", ["journalize_pending", "journalized", "final_returned"])
        .gte("final_checked_at", todayIso)
        .order("final_checked_at", { ascending: false }),
      supabase
        .from("bud_expense_requests")
        .select(REQUEST_SELECT)
        .eq("status", "keiri_returned")
        .gte("keiri_checked_at", todayIso)
        .order("keiri_checked_at", { ascending: false }),
      supabase.from("bud_expense_categories").select("id,name").eq("is_active", true).order("display_order", { ascending: true }),
      supabase.from("bud_corporations").select("id,name_short").order("id", { ascending: true }),
      supabase.from("root_companies").select("company_id,company_name"),
    ]);

    const pending = (pendingRes.data as Req[] | null) ?? [];
    const finalProcessed = (finalProcessedRes.data as Req[] | null) ?? [];
    const keiriReturned = (keiriReturnedRes.data as Req[] | null) ?? [];
    setPendingAll(pending);
    setFinalProcessedToday(finalProcessed);
    setKeiriReturnedToday(keiriReturned);
    setCats((catRes.data as Cat[] | null) ?? []);

    const corpList = corpRes.error ? FALLBACK_CORPS : ((corpRes.data as Corp[] | null) ?? FALLBACK_CORPS);
    setCorps(corpList);
    setCompanyToCorp(buildCompanyToCorp((companyRes.data as Company[] | null) ?? [], corpList));

    const employeeIds = Array.from(
      new Set(
        [...pending, ...finalProcessed, ...keiriReturned]
          .map((row) => row.applicant_employee_id)
          .filter((id): id is string => Boolean(id)),
      ),
    );
    if (employeeIds.length === 0) {
      setEmployees({});
    } else {
      const { data } = await supabase.from("root_employees").select("employee_id,company_id,name").in("employee_id", employeeIds);
      const map: Record<string, Employee> = {};
      for (const employee of ((data as Employee[] | null) ?? [])) {
        map[employee.employee_id] = employee;
      }
      setEmployees(map);
    }

    setIdx(0);
    setLoaded(true);
  }, [supabase]);

  useEffect(() => {
    void load();
  }, [load]);

  // タブがアクティブになった瞬間に最新データを読み直す
  // （承認待ちタブで承認した直後に切り替えても、ページ更新なしで反映されるように）
  useEffect(() => {
    if (!embedded) return;
    const tab = document.getElementById("tab-approve");
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
  const list = useMemo(() => pendingAll.filter(corpMatches), [pendingAll, corpMatches]);
  const finalProcessedFiltered = useMemo(() => finalProcessedToday.filter(corpMatches), [finalProcessedToday, corpMatches]);
  const keiriReturnedFiltered = useMemo(() => keiriReturnedToday.filter(corpMatches), [keiriReturnedToday, corpMatches]);
  const current = list[idx];

  const pendingAmount = useMemo(() => list.reduce((sum, row) => sum + (row.amount ?? 0), 0), [list]);

  const todayStats: TodayStats = useMemo(() => {
    const approved = finalProcessedFiltered.filter((row) => row.status === "journalize_pending" || row.status === "journalized");
    const returned = finalProcessedFiltered.filter((row) => row.status === "final_returned");
    return {
      approvedCount: approved.length,
      approvedAmount: approved.reduce((sum, row) => sum + (row.amount ?? 0), 0),
      returnedCount: returned.length,
      returnedAmount: returned.reduce((sum, row) => sum + (row.amount ?? 0), 0),
      keiriReturnedCount: keiriReturnedFiltered.length,
    };
  }, [finalProcessedFiltered, keiriReturnedFiltered.length]);

  useEffect(() => {
    setIdx(0);
  }, [corpFilter]);

  useEffect(() => {
    setIdx((value) => Math.max(0, Math.min(value, Math.max(0, list.length - 1))));
  }, [list.length]);

  useEffect(() => {
    if (!current) return;
    openedAt.current = Date.now();
  }, [current]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.ctrlKey && event.key === "ArrowDown") {
        event.preventDefault();
        setIdx((value) => Math.min(value + 1, list.length - 1));
      } else if (event.ctrlKey && event.key === "ArrowUp") {
        event.preventDefault();
        setIdx((value) => Math.max(value - 1, 0));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [list.length]);

  useEffect(() => {
    if (!embedded || !loaded) return;
    const tab = document.getElementById("tab-approve");
    if (!tab) return;
    const oldBlocks = Array.from(
      tab.querySelectorAll<HTMLElement>(".exp-main-layout, .exp-flow-card, .bud-mirror-panel"),
    );
    oldBlocks.forEach((block) => block.style.setProperty("display", "none"));

    const host = tab.querySelector<HTMLElement>(".bud-corp-switch");
    if (host) {
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
      // 法人フィルター(pill)を flex 行でラップし、右端にレコード番号(1/9)を置く（承認待ちタブと同じ）
      let row = host.parentElement;
      if (row && row.dataset.expFilterRow !== "true") {
        const wrapper = document.createElement("div");
        wrapper.dataset.expFilterRow = "true";
        wrapper.style.display = "flex";
        wrapper.style.alignItems = "center";
        wrapper.style.gap = "12px";
        wrapper.style.marginBottom = "14px";
        row.insertBefore(wrapper, host);
        wrapper.appendChild(host);
        host.style.marginBottom = "0";
        const count = document.createElement("span");
        count.dataset.expRecordCount = "true";
        count.style.marginLeft = "auto";
        count.style.fontSize = "13px";
        count.style.color = "var(--text-sub)";
        count.style.fontVariantNumeric = "tabular-nums";
        count.style.whiteSpace = "nowrap";
        wrapper.appendChild(count);
        row = wrapper;
      }
      const countEl = row?.querySelector<HTMLElement>("[data-exp-record-count]");
      if (countEl) countEl.textContent = list.length > 0 ? `レコード ${idx + 1} / ${list.length}` : "";

      const onClick = (event: MouseEvent) => {
        const button = (event.target as HTMLElement).closest<HTMLButtonElement>("[data-corp-id]");
        if (!button) return;
        setCorpFilter(button.dataset.corpId ?? "all");
      };
      host.addEventListener("click", onClick);
      return () => {
        host.removeEventListener("click", onClick);
        oldBlocks.forEach((block) => block.style.removeProperty("display"));
      };
    }
  }, [corpFilter, embedded, loaded, setCorpFilter, sortedCorps, idx, list.length]);

  // 埋め込みモードでは、レガシーHTMLの3カード（モック）を隠し、React側のコンパクトカード＋ナビに置き換える
  useEffect(() => {
    if (!embedded || !loaded) return;
    const tab = document.getElementById("tab-approve");
    const summary = tab?.querySelector<HTMLElement>(".exp-summary-grid");
    if (!summary) return;
    summary.style.setProperty("display", "none");
    return () => {
      summary.style.removeProperty("display");
    };
  }, [embedded, loaded]);

  const openDetail = (row: Req, mode: DetailMode) => {
    setDetail(row);
    setDetailMode(mode);
    setReturnReason(row.return_reason ?? "");
    setDetailImgUrl(null);
    void (async () => {
      const path = resolveReceiptStoragePath(row);
      if (!path) return;
      const { data } = await supabase.storage.from("bud-receipts").createSignedUrl(path, 600);
      setDetailImgUrl(data?.signedUrl ?? null);
    })();
  };

  const process = async (row: Req, action: "approve" | "return", reason?: string) => {
    if (busyId) return;
    if (action === "return" && !reason?.trim()) {
      alert("差戻し理由を入力してください");
      return;
    }
    setBusyId(row.id);
    try {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth?.user?.id ?? null;
      const nowIso = new Date().toISOString();
      const corpId = effectiveCorpId(row);
      const up = await supabase
        .from("bud_expense_requests")
        .update({
          corp_id: corpId,
          status: action === "approve" ? "journalize_pending" : "final_returned",
          return_reason: action === "return" ? reason?.trim() ?? "" : null,
          final_checked_by: uid,
          final_checked_at: nowIso,
        })
        .eq("id", row.id);
      if (up.error) throw up.error;
      await supabase.from("garden_work_log").insert({
        user_id: uid,
        module: "bud",
        operation: action === "approve" ? "expense_final_approve" : "expense_final_return",
        target_kind: "expense_request",
        target_id: row.id,
        corp_id: corpId,
        started_at: openedAt.current ? new Date(openedAt.current).toISOString() : null,
        ended_at: nowIso,
        duration_ms: openedAt.current ? Date.now() - openedAt.current : null,
      });
      // 申請者の Drive ミラーを状態フォルダへ移動（完了→2_完了 / 差戻し→0_差戻し・ベストエフォート）
      void notifyDriveMove(row.id, action === "approve" ? "completed" : "returned");
      setDetail(null);
      setDetailImgUrl(null);
      await load();
    } catch (error) {
      alert("処理に失敗しました：" + (error instanceof Error ? error.message : String(error)));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div>
      {!embedded && (
        <>
          <header style={{ marginBottom: 18 }}>
            <h1 style={{ fontSize: 22, color: "var(--text-main)", margin: 0 }}>経費精算 — 完了待ち</h1>
            <p style={{ color: "var(--text-sub)", fontSize: 13, margin: "4px 0 0" }}>
              経理承認済みの申請を最終チェックし、仕訳化待ちへ送ります。
            </p>
          </header>
          <CorpFilter value={corpFilter} corps={sortedCorps} onChange={setCorpFilter} />
        </>
      )}

      {/* コンパクト3カード＋横並びレコード送りを1行に（承認待ちタブと同デザイン・差戻しに経理差戻し行あり） */}
      {loaded && (
        <div style={summaryNavBar}>
          <CompactCard label="完了待ち" count={list.length} amount={pendingAmount} color="#b3892e" />
          <CompactCard label="完了（本日）" count={todayStats.approvedCount} amount={todayStats.approvedAmount} color="#5e7d44" />
          <CompactCard
            label="差戻し（本日）"
            count={todayStats.returnedCount}
            amount={todayStats.returnedAmount}
            color="#b35850"
            sub={`経理差戻し: ${todayStats.keiriReturnedCount}件（本日）`}
          />
          {list.length > 0 && (
            <div style={navWrap}>
              <button type="button" style={navBtn(idx <= 0)} disabled={idx <= 0} onClick={() => setIdx((value) => Math.max(0, value - 1))}>
                <span style={navCircle}>◀</span>前へ<span style={navHint}>Ctrl+↑</span>
              </button>
              {!embedded && (
                <span style={navCount}>
                  {idx + 1}
                  <span style={{ color: "var(--text-muted)" }}> / {list.length}</span>
                </span>
              )}
              <button
                type="button"
                style={navBtn(idx >= list.length - 1)}
                disabled={idx >= list.length - 1}
                onClick={() => setIdx((value) => Math.min(list.length - 1, value + 1))}
              >
                次へ<span style={navHint}>Ctrl+↓</span><span style={navCircle}>▶</span>
              </button>
            </div>
          )}
        </div>
      )}

      {!loaded && <div style={notice}>読み込み中…</div>}
      {loaded && (
        <div style={finalShell}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <section style={panel}>
              <div style={panelHead}>
                <h3 style={panelTitle}>完了待ち一覧</h3>
                <span style={panelMeta}>final_pending / {list.length} 件</span>
              </div>
              {list.length === 0 ? (
                <div style={{ ...notice, margin: 0 }}>この法人の完了待ちはありません</div>
              ) : (
                <div style={{ overflowX: "auto" }}>
                  <table style={table}>
                    <thead>
                      <tr>
                        <th style={th}>申請日</th>
                        <th style={th}>申請者</th>
                        <th style={th}>日付</th>
                        <th style={th}>区分</th>
                        <th style={{ ...th, textAlign: "right" }}>金額</th>
                        <th style={th}>領収書</th>
                        <th style={th}>摘要</th>
                        <th style={th}>操作</th>
                      </tr>
                    </thead>
                    <tbody>
                      {list.map((row, rowIndex) => (
                        <tr key={row.id} style={rowIndex === idx ? selectedTr : tr} onClick={() => setIdx(rowIndex)}>
                          <td style={td}>{formatDate(row.submitted_at)}</td>
                          <td style={td}>{employeeLabel(row, employees)}</td>
                          <td style={td}>{formatDate(row.receipt_date)}</td>
                          <td style={td}>{categoryLabel(row.category_id, cats)}</td>
                          <td style={{ ...td, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{yen(row.amount ?? 0)}</td>
                          <td style={td}>
                            <button type="button" style={iconBtn} onClick={(event) => {
                              event.stopPropagation();
                              openDetail(row, "detail");
                            }}>
                              📄
                            </button>
                          </td>
                          <td style={td}>{row.description || row.store_name || "—"}</td>
                          <td style={td}>
                            <div style={actions}>
                              <button type="button" disabled={busyId === row.id} style={approveBtn} onClick={(event) => {
                                event.stopPropagation();
                                void process(row, "approve");
                              }}>
                                完了
                              </button>
                              <button type="button" disabled={busyId === row.id} style={returnBtn} onClick={(event) => {
                                event.stopPropagation();
                                openDetail(row, "return");
                              }}>
                                差戻し
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </div>

        </div>
      )}

      {detail && (
        <DetailModal
          row={detail}
          mode={detailMode}
          cats={cats}
          employees={employees}
          imageUrl={detailImgUrl}
          returnReason={returnReason}
          busy={busyId === detail.id}
          onReasonChange={setReturnReason}
          onReturn={() => void process(detail, "return", returnReason)}
          onClose={() => {
            setDetail(null);
            setDetailImgUrl(null);
          }}
        />
      )}
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

function DetailModal({
  row,
  mode,
  cats,
  employees,
  imageUrl,
  returnReason,
  busy,
  onReasonChange,
  onReturn,
  onClose,
}: {
  row: Req;
  mode: DetailMode;
  cats: Cat[];
  employees: Record<string, Employee>;
  imageUrl: string | null;
  returnReason: string;
  busy: boolean;
  onReasonChange: (value: string) => void;
  onReturn: () => void;
  onClose: () => void;
}) {
  return (
    <div style={modalBackdrop} role="dialog" aria-modal="true" aria-label={mode === "return" ? "差戻し" : "領収書詳細"}>
      <div style={modalCard}>
        <div style={modalHead}>
          <h3 style={panelTitle}>{mode === "return" ? "差戻し" : "領収書詳細"}</h3>
          <button type="button" onClick={onClose} style={closeBtn} aria-label="閉じる">
            ×
          </button>
        </div>
        <div style={modalGrid}>
          <div>
            <Row label="申請者">{employeeLabel(row, employees)}</Row>
            <Row label="申請日">{formatDate(row.submitted_at)}</Row>
            <Row label="日付">{formatDate(row.receipt_date)}</Row>
            <Row label="区分">{categoryLabel(row.category_id, cats)}</Row>
            <Row label="店名">{row.store_name ?? "—"}</Row>
            <Row label="金額">{yen(row.amount ?? 0)}</Row>
            <Row label="摘要">{row.description ?? "—"}</Row>
            <Row label="適格">{row.qualified_class ?? "—"}</Row>
            <Row label="登録番号">{row.qualified_number ?? "—"}</Row>
            {mode === "return" && (
              <div style={{ marginTop: 14 }}>
                <label style={{ display: "block", color: "var(--text-sub)", fontSize: 12, marginBottom: 6 }}>差戻し理由</label>
                <textarea value={returnReason} onChange={(event) => onReasonChange(event.target.value)} style={textarea} rows={4} />
                <button type="button" disabled={busy} style={{ ...returnBtn, width: "100%", marginTop: 10, padding: "11px 14px" }} onClick={onReturn}>
                  {busy ? "処理中…" : "差戻しを確定"}
                </button>
              </div>
            )}
          </div>
          <div>
            {imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={imageUrl} alt="領収書" style={{ width: "100%", borderRadius: 10, border: "1px solid var(--border-card)" }} />
            ) : (
              <div style={{ ...notice, margin: 0 }}>領収書画像なし</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// 承認待ちタブと同じコンパクトカード。差戻しカードのみ経理差戻し行(sub)を持つため、
// 3枚とも sub 行の高さを確保して縦幅を揃える（件数・金額は固定列で右揃え）
function CompactCard({
  label,
  count,
  amount,
  color,
  sub,
}: {
  label: string;
  count: number;
  amount: number;
  color: string;
  sub?: string;
}) {
  return (
    <div style={{ ...compactCard, borderLeft: `3px solid ${color}` }}>
      {/* 経理差戻し行は上に、主要部(件数・金額)は下に揃える */}
      <div style={compactCardSub}>{sub ?? ""}</div>
      <div style={compactCardMain}>
        <span style={{ color: "var(--text-sub)", overflow: "hidden", textOverflow: "ellipsis" }}>{label}</span>
        <strong style={{ fontSize: 16, color, fontVariantNumeric: "tabular-nums", textAlign: "right" }}>{count}件</strong>
        <span style={{ display: "flex", justifyContent: "space-between", gap: 6, color: "var(--text-sub)", fontVariantNumeric: "tabular-nums" }}>
          <span>合計</span>
          <span>¥{amount.toLocaleString("ja-JP")}</span>
        </span>
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", gap: 10, padding: "6px 0", fontSize: 14 }}>
      <span style={{ width: 96, color: "var(--text-sub)", flexShrink: 0 }}>{label}</span>
      <span style={{ color: "var(--text-main)" }}>{children}</span>
    </div>
  );
}

function employeeLabel(row: Req, employees: Record<string, Employee>) {
  if (!row.applicant_employee_id) return "—";
  return employees[row.applicant_employee_id]?.name ?? row.applicant_employee_id;
}

function categoryLabel(categoryId: string | null, cats: Cat[]) {
  if (!categoryId) return "未設定";
  return cats.find((cat) => cat.id === categoryId)?.name ?? categoryId;
}

function formatDate(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("ja-JP", { year: "2-digit", month: "2-digit", day: "2-digit" });
}

function yen(value: number) {
  return "¥" + value.toLocaleString("ja-JP");
}

// コンパクト3カード＋横並びレコード送りの1行（承認待ちタブと同デザイン）
const summaryNavBar: React.CSSProperties = { display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 16 };
const compactCard: React.CSSProperties = {
  width: 316,
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
const compactCardMain: React.CSSProperties = { marginTop: "auto", display: "grid", gridTemplateColumns: "96px 58px 1fr", alignItems: "baseline", gap: 8 };
// 経理差戻し行。3枚とも同じ高さ(16px)を確保して縦幅を揃える
const compactCardSub: React.CSSProperties = { height: 16, lineHeight: "16px", fontSize: 11, color: "var(--text-muted)", textAlign: "right", fontVariantNumeric: "tabular-nums", overflow: "hidden" };
const navWrap: React.CSSProperties = { marginLeft: "auto", display: "flex", alignItems: "center", gap: 6 };
const navBtn = (disabled: boolean): React.CSSProperties => ({
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  padding: "8px 11px",
  borderRadius: 8,
  border: "1px solid var(--border-card)",
  background: "var(--bg-card-solid)",
  color: "var(--text-sub)",
  fontSize: 13,
  cursor: disabled ? "not-allowed" : "pointer",
  opacity: disabled ? 0.45 : 1,
  whiteSpace: "nowrap",
});
const navHint: React.CSSProperties = { fontSize: 10, color: "var(--text-muted)" };
const navCircle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: 17,
  height: 17,
  borderRadius: "50%",
  border: "1.5px solid currentColor",
  fontSize: 8,
  lineHeight: 1,
  flexShrink: 0,
};
const navCount: React.CSSProperties = { fontSize: 13, color: "var(--text-main)", fontVariantNumeric: "tabular-nums", padding: "0 2px" };
const notice: React.CSSProperties = {
  background: "var(--bg-paper-soft)",
  border: "1px solid rgba(179,137,46,0.18)",
  borderRadius: 12,
  padding: 24,
  textAlign: "center",
  color: "var(--text-sub)",
  margin: "12px 0",
};
const corpSwitch: React.CSSProperties = {
  display: "flex",
  gap: 4,
  marginBottom: 18,
  padding: 6,
  background: "var(--bg-card)",
  borderRadius: 999,
  width: "fit-content",
  border: "1px solid var(--border-card)",
  flexWrap: "wrap",
};
const corpTab = (active: boolean): React.CSSProperties => ({
  padding: "8px 20px",
  borderRadius: 999,
  border: "none",
  background: active ? "#d4a541" : "transparent",
  color: active ? "#fff" : "var(--text-sub)",
  boxShadow: active ? "0 2px 8px rgba(212,165,65,0.3)" : "none",
  cursor: "pointer",
  fontSize: 13,
});
const finalShell: React.CSSProperties = { display: "flex", gap: 12, alignItems: "stretch", marginBottom: 18 };
const panel: React.CSSProperties = { background: "var(--bg-paper-soft)", border: "1px solid rgba(179,137,46,0.18)", borderRadius: 12, padding: "18px 20px" };
const panelHead: React.CSSProperties = {
  display: "flex",
  alignItems: "baseline",
  justifyContent: "space-between",
  gap: 16,
  borderBottom: "1px dashed rgba(179,137,46,0.35)",
  paddingBottom: 8,
  marginBottom: 12,
};
const panelTitle: React.CSSProperties = { fontSize: 16, color: "var(--text-main)", margin: 0, fontWeight: 600 };
const panelMeta: React.CSSProperties = { fontSize: 12, color: "var(--text-muted)" };
const table: React.CSSProperties = { width: "100%", borderCollapse: "collapse", fontSize: 13 };
const th: React.CSSProperties = {
  textAlign: "left",
  color: "var(--text-sub)",
  fontWeight: 500,
  padding: "9px 8px",
  borderBottom: "1px solid var(--border-card)",
  whiteSpace: "nowrap",
};
const td: React.CSSProperties = { padding: "10px 8px", borderBottom: "1px dashed var(--border-card)", color: "var(--text-main)", verticalAlign: "middle" };
const tr: React.CSSProperties = { cursor: "pointer" };
const selectedTr: React.CSSProperties = { ...tr, background: "rgba(212,165,65,0.08)" };
const actions: React.CSSProperties = { display: "flex", gap: 6, alignItems: "center" };
const approveBtn: React.CSSProperties = {
  border: "none",
  borderRadius: 999,
  padding: "7px 14px",
  background: "#5e7d44",
  color: "#fff",
  cursor: "pointer",
  whiteSpace: "nowrap",
  fontSize: 12,
};
const returnBtn: React.CSSProperties = {
  border: "1px solid #b35850",
  borderRadius: 999,
  padding: "7px 14px",
  background: "var(--bg-card-solid)",
  color: "#b35850",
  cursor: "pointer",
  whiteSpace: "nowrap",
  fontSize: 12,
};
const iconBtn: React.CSSProperties = { border: "none", background: "transparent", cursor: "pointer", fontSize: 18, padding: 2 };
const modalBackdrop: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: 1000,
  background: "rgba(40,34,25,0.42)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 24,
};
const modalCard: React.CSSProperties = {
  width: "min(980px, 92vw)",
  maxHeight: "88vh",
  overflow: "auto",
  background: "var(--bg-card-solid)",
  borderRadius: 14,
  border: "1px solid rgba(179,137,46,0.25)",
  boxShadow: "0 18px 48px rgba(40,34,25,0.22)",
  padding: 22,
};
const modalHead: React.CSSProperties = { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 };
const closeBtn: React.CSSProperties = {
  width: 34,
  height: 34,
  borderRadius: 999,
  border: "1px solid rgba(179,137,46,0.25)",
  background: "var(--bg-card-solid)",
  color: "var(--text-sub)",
  fontSize: 20,
  cursor: "pointer",
};
const modalGrid: React.CSSProperties = { display: "grid", gridTemplateColumns: "0.9fr 1.1fr", gap: 18, alignItems: "start" };
const textarea: React.CSSProperties = {
  width: "100%",
  borderRadius: 8,
  border: "1px solid rgba(179,137,46,0.3)",
  padding: 10,
  background: "var(--bg-card-solid)",
  color: "var(--text-main)",
  resize: "vertical",
};
