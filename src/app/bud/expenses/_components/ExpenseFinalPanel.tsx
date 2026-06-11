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

  const effectiveCorpId = useCallback((row: Req) => getEffectiveCorpId(row, employees, companyToCorp), [employees, companyToCorp]);
  const corpMatches = useCallback((row: Req) => corpFilter === "all" || effectiveCorpId(row) === corpFilter, [corpFilter, effectiveCorpId]);
  const list = useMemo(() => pendingAll.filter(corpMatches), [pendingAll, corpMatches]);
  const finalProcessedFiltered = useMemo(() => finalProcessedToday.filter(corpMatches), [finalProcessedToday, corpMatches]);
  const keiriReturnedFiltered = useMemo(() => keiriReturnedToday.filter(corpMatches), [keiriReturnedToday, corpMatches]);
  const current = list[idx];

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
  }, [corpFilter, embedded, loaded, setCorpFilter, sortedCorps]);

  useEffect(() => {
    if (!embedded || !loaded) return;
    const tab = document.getElementById("tab-approve");
    if (!tab) return;
    const cards = tab.querySelectorAll<HTMLElement>(".exp-summary-card");
    const setCard = (card: HTMLElement | undefined, count: number, meta: string, extra?: string) => {
      if (!card) return;
      const value = card.querySelector<HTMLElement>(".exp-sum-value");
      if (value) {
        const unit = value.querySelector(".exp-sum-unit");
        value.textContent = String(count) + " ";
        if (unit) value.appendChild(unit);
      }
      const metaEl = card.querySelector<HTMLElement>(".exp-sum-meta");
      if (metaEl) {
        metaEl.textContent = meta;
        if (extra) {
          const small = document.createElement("div");
          small.style.fontSize = "0.72rem";
          small.style.marginTop = "3px";
          small.style.color = "#9a8f7d";
          small.textContent = extra;
          metaEl.appendChild(small);
        }
      }
    };
    const pendingAmount = list.reduce((sum, row) => sum + (row.amount ?? 0), 0);
    setCard(cards[0], list.length, `総額 ${yen(pendingAmount)}`);
    setCard(cards[1], todayStats.approvedCount, `合計 ${yen(todayStats.approvedAmount)}`);
    setCard(cards[2], todayStats.returnedCount, `合計 ${yen(todayStats.returnedAmount)}`, `経理差戻し: ${todayStats.keiriReturnedCount}件（本日）`);
  }, [embedded, list, loaded, todayStats]);

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
      // 申請者の Drive ミラーを状態フォルダへ移動（完了→1_承認 / 差戻し→0_差戻し・ベストエフォート）
      void notifyDriveMove(row.id, action === "approve" ? "approved" : "returned");
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
            <h1 style={{ fontSize: 22, color: "#3d3528", margin: 0 }}>経費精算 — 完了待ち</h1>
            <p style={{ color: "#7b745f", fontSize: 13, margin: "4px 0 0" }}>
              経理承認済みの申請を最終チェックし、仕訳化待ちへ送ります。
            </p>
          </header>
          <CorpFilter value={corpFilter} corps={sortedCorps} onChange={setCorpFilter} />
          <section style={cards3}>
            <Card label="完了待ち" value={loaded ? list.length : "—"} color="#b3892e" />
            <Card label="完了（本日）" value={todayStats.approvedCount} color="#5e7d44" />
            <Card label="差戻し（本日）" value={todayStats.returnedCount} color="#b35850" />
          </section>
        </>
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

          <aside style={recordRail} aria-label="レコード送り">
            <button type="button" style={railBtn} disabled={idx <= 0 || list.length === 0} onClick={() => setIdx((value) => Math.max(0, value - 1))}>
              ↑
              <span style={railBtnLabel}>前へ</span>
            </button>
            <span style={railCount}>
              {list.length === 0 ? 0 : idx + 1}
              <span style={{ color: "#9a8f7d" }}> / {list.length}</span>
            </span>
            <button
              type="button"
              style={railBtn}
              disabled={idx >= list.length - 1 || list.length === 0}
              onClick={() => setIdx((value) => Math.min(list.length - 1, value + 1))}
            >
              ↓
              <span style={railBtnLabel}>次へ</span>
            </button>
            <span style={railHint}>Ctrl+↑/↓</span>
          </aside>
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
                <label style={{ display: "block", color: "#6d6356", fontSize: 12, marginBottom: 6 }}>差戻し理由</label>
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
              <img src={imageUrl} alt="領収書" style={{ width: "100%", borderRadius: 10, border: "1px solid #e2ddcf" }} />
            ) : (
              <div style={{ ...notice, margin: 0 }}>領収書画像なし</div>
            )}
          </div>
        </div>
      </div>
    </div>
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

const cards3: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 18 };
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
const corpSwitch: React.CSSProperties = {
  display: "flex",
  gap: 4,
  marginBottom: 18,
  padding: 6,
  background: "rgba(255,253,246,0.55)",
  borderRadius: 999,
  width: "fit-content",
  border: "1px solid rgba(180,165,130,0.2)",
  flexWrap: "wrap",
};
const corpTab = (active: boolean): React.CSSProperties => ({
  padding: "8px 20px",
  borderRadius: 999,
  border: "none",
  background: active ? "#d4a541" : "transparent",
  color: active ? "#fff" : "#6d6356",
  boxShadow: active ? "0 2px 8px rgba(212,165,65,0.3)" : "none",
  cursor: "pointer",
  fontSize: 13,
});
const finalShell: React.CSSProperties = { display: "flex", gap: 12, alignItems: "stretch", marginBottom: 18 };
const panel: React.CSSProperties = { background: "#faf6ec", border: "1px solid rgba(179,137,46,0.18)", borderRadius: 12, padding: "18px 20px" };
const panelHead: React.CSSProperties = {
  display: "flex",
  alignItems: "baseline",
  justifyContent: "space-between",
  gap: 16,
  borderBottom: "1px dashed rgba(179,137,46,0.35)",
  paddingBottom: 8,
  marginBottom: 12,
};
const panelTitle: React.CSSProperties = { fontSize: 16, color: "#3d3528", margin: 0, fontWeight: 600 };
const panelMeta: React.CSSProperties = { fontSize: 12, color: "#9a8f7d" };
const table: React.CSSProperties = { width: "100%", borderCollapse: "collapse", fontSize: 13 };
const th: React.CSSProperties = {
  textAlign: "left",
  color: "#6d6356",
  fontWeight: 500,
  padding: "9px 8px",
  borderBottom: "1px solid rgba(180,165,130,0.25)",
  whiteSpace: "nowrap",
};
const td: React.CSSProperties = { padding: "10px 8px", borderBottom: "1px dashed rgba(180,165,130,0.18)", color: "#3d3528", verticalAlign: "middle" };
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
  background: "#fff",
  color: "#b35850",
  cursor: "pointer",
  whiteSpace: "nowrap",
  fontSize: 12,
};
const iconBtn: React.CSSProperties = { border: "none", background: "transparent", cursor: "pointer", fontSize: 18, padding: 2 };
const recordRail: React.CSSProperties = {
  width: 74,
  flexShrink: 0,
  alignSelf: "stretch",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: 10,
  border: "1px solid rgba(179,137,46,0.18)",
  borderRadius: 12,
  background: "#fffdf6",
  padding: "12px 8px",
};
const railBtn: React.CSSProperties = {
  width: 48,
  height: 48,
  borderRadius: 10,
  border: "1px solid #cdbf9a",
  background: "#fff",
  color: "#6d6356",
  fontSize: 18,
  cursor: "pointer",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: 1,
};
const railBtnLabel: React.CSSProperties = { fontSize: 10, lineHeight: 1, color: "#6d6356" };
const railCount: React.CSSProperties = { fontSize: 13, color: "#3d3528", fontVariantNumeric: "tabular-nums" };
const railHint: React.CSSProperties = { writingMode: "vertical-rl", fontSize: 11, color: "#9a8f7d", letterSpacing: "0.08em" };
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
  background: "#fffdf6",
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
  background: "#fff",
  color: "#6d6356",
  fontSize: 20,
  cursor: "pointer",
};
const modalGrid: React.CSSProperties = { display: "grid", gridTemplateColumns: "0.9fr 1.1fr", gap: 18, alignItems: "start" };
const textarea: React.CSSProperties = {
  width: "100%",
  borderRadius: 8,
  border: "1px solid rgba(179,137,46,0.3)",
  padding: 10,
  background: "#fff",
  color: "#3d3528",
  resize: "vertical",
};
