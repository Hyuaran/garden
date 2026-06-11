"use client";

/**
 * Bud 経費精算 — 承認待ち（経理レビュー）パネル
 * /bud/expenses の承認待ちタブへの埋め込み(embedded)と、/bud/expenses/review 単体ページの両方で使う。
 * - submitted の申請を 1 件ずつ：領収書画像を見ながら入力・確認 → 承認(final_pending)/差戻し(keiri_returned)
 * - 処理を garden_work_log に記録（工数）
 * - Ctrl+↓ / Ctrl+↑ で前後移動（FileMaker 風）
 * - embedded 時は、タブ内の既存3カード(.exp-sub-card)の数字と法人フィルターを実データで更新
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { createBrowserClient } from "@/app/_lib/supabase/browser";

type Req = {
  id: string;
  corp_id: string | null;
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
  status: string;
  return_reason: string | null;
  submitted_at: string;
  keiri_checked_at: string | null;
};
type Cat = { id: string; name: string };
type Corp = { id: string; name_short: string | null };
type Employee = { employee_id: string; company_id: string | null; name: string | null };
type Form = {
  corp_id: string;
  receipt_date: string;
  store_name: string;
  amount: string;
  qualified_class: string;
  qualified_number: string;
  category_id: string;
  description: string;
};
type StatusRow = Req & { rowKind: "pending" | "processed" };

const REQUEST_SELECT =
  "id,corp_id,applicant_employee_id,expense_kind,drive_file_id,receipt_date,store_name,amount,qualified_class,qualified_number,category_id,description,status,return_reason,submitted_at,keiri_checked_at";

const FALLBACK_CORPS: Corp[] = [
  { id: "hyuaran", name_short: "ヒュアラン" },
  { id: "centerrise", name_short: "センターライズ" },
  { id: "linksupport", name_short: "リンクサポート" },
  { id: "arata", name_short: "ARATA" },
  { id: "taiyou", name_short: "たいよう" },
  { id: "ichi", name_short: "壱" },
];
const CORP_ORDER = FALLBACK_CORPS.map((corp) => corp.id);
const CORP_FILTER_STORAGE_KEY = "bud-expense-review-corp-filter";

function readInitialCorpFilter() {
  if (typeof window === "undefined") return "all";
  try {
    return window.sessionStorage.getItem(CORP_FILTER_STORAGE_KEY) ?? "all";
  } catch {
    return "all";
  }
}

export function ExpenseReviewPanel({ embedded = false }: { embedded?: boolean }) {
  const supabase = useMemo(() => createBrowserClient(), []);
  const [pendingAll, setPendingAll] = useState<Req[]>([]);
  const [processedToday, setProcessedToday] = useState<Req[]>([]);
  const [cats, setCats] = useState<Cat[]>([]);
  const [corps, setCorps] = useState<Corp[]>([]);
  const [employees, setEmployees] = useState<Record<string, Employee>>({});
  const [corpFilter, setCorpFilterState] = useState(readInitialCorpFilter);
  const [idx, setIdx] = useState(0);
  const [form, setForm] = useState<Form | null>(null);
  const [imgUrl, setImgUrl] = useState<string | null>(null);
  const [detail, setDetail] = useState<Req | null>(null);
  const [detailImgUrl, setDetailImgUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
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

  const sortedCorps = useMemo(() => {
    const source = corps.length > 0 ? corps : FALLBACK_CORPS;
    return [...source].sort((a, b) => {
      const ai = CORP_ORDER.indexOf(a.id);
      const bi = CORP_ORDER.indexOf(b.id);
      if (ai !== -1 || bi !== -1) return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
      return (a.name_short ?? a.id).localeCompare(b.name_short ?? b.id, "ja");
    });
  }, [corps]);

  const load = useCallback(async () => {
    setLoaded(false);
    const t = new Date();
    t.setHours(0, 0, 0, 0);
    const todayIso = t.toISOString();

    const [pendingRes, processedRes, catRes, corpRes] = await Promise.all([
      supabase.from("bud_expense_requests").select(REQUEST_SELECT).eq("status", "submitted").order("submitted_at", { ascending: true }),
      supabase
        .from("bud_expense_requests")
        .select(REQUEST_SELECT)
        .in("status", ["final_pending", "keiri_returned"])
        .gte("keiri_checked_at", todayIso)
        .order("keiri_checked_at", { ascending: false }),
      supabase.from("bud_expense_categories").select("id,name").eq("is_active", true).order("display_order", { ascending: true }),
      supabase.from("bud_corporations").select("id,name_short").order("id", { ascending: true }),
    ]);

    const pending = (pendingRes.data as Req[] | null) ?? [];
    const processed = (processedRes.data as Req[] | null) ?? [];
    setPendingAll(pending);
    setProcessedToday(processed);
    setCats((catRes.data as Cat[] | null) ?? []);
    setCorps(corpRes.error ? FALLBACK_CORPS : ((corpRes.data as Corp[] | null) ?? FALLBACK_CORPS));

    const employeeIds = Array.from(
      new Set([...pending, ...processed].map((row) => row.applicant_employee_id).filter((id): id is string => Boolean(id))),
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

  const effectiveCorpId = useCallback(
    (row: Req) => row.corp_id ?? (row.applicant_employee_id ? employees[row.applicant_employee_id]?.company_id ?? null : null),
    [employees],
  );

  const corpMatches = useCallback((row: Req) => corpFilter === "all" || effectiveCorpId(row) === corpFilter, [corpFilter, effectiveCorpId]);
  const list = useMemo(() => pendingAll.filter(corpMatches), [pendingAll, corpMatches]);
  const processedFiltered = useMemo(() => processedToday.filter(corpMatches), [processedToday, corpMatches]);
  const current = list[idx];

  const todayStats = useMemo(() => {
    const approved = processedFiltered.filter((row) => row.status === "final_pending");
    const rejected = processedFiltered.filter((row) => row.status === "keiri_returned");
    return {
      approvedCount: approved.length,
      approvedAmount: approved.reduce((sum, row) => sum + (row.amount ?? 0), 0),
      rejectedCount: rejected.length,
      rejectedAmount: rejected.reduce((sum, row) => sum + (row.amount ?? 0), 0),
    };
  }, [processedFiltered]);

  const statusRows: StatusRow[] = useMemo(
    () => [
      ...list.map((row) => ({ ...row, rowKind: "pending" as const })),
      ...processedFiltered.map((row) => ({ ...row, rowKind: "processed" as const })),
    ],
    [list, processedFiltered],
  );

  useEffect(() => {
    setIdx(0);
  }, [corpFilter]);

  useEffect(() => {
    setIdx((value) => Math.max(0, Math.min(value, Math.max(0, list.length - 1))));
  }, [list.length]);

  useEffect(() => {
    if (!embedded) return;
    const styleId = "expense-review-finish-075-style";
    if (document.getElementById(styleId)) return;
    const style = document.createElement("style");
    style.id = styleId;
    style.textContent = `
      #tab-submit .exp-sub-summary { gap: 12px !important; margin-bottom: 14px !important; }
      #tab-submit .exp-sub-card { padding: 12px 16px !important; min-height: 0 !important; }
      #tab-submit .exp-sub-card-head { margin-bottom: 6px !important; }
      #tab-submit .exp-sub-card-value { font-size: 1.55rem !important; line-height: 1.05 !important; }
      #tab-submit .exp-sub-card-amount { margin-top: 4px !important; font-size: 0.78rem !important; }
    `;
    document.head.appendChild(style);
  }, [embedded]);

  useEffect(() => {
    if (!embedded || !loaded) return;
    const tab = document.getElementById("tab-submit");
    if (!tab) return;

    const legacyHistory = tab.querySelector<HTMLElement>(".exp-sub-history-card:not([data-exp-status-react])");
    if (legacyHistory) legacyHistory.style.display = "none";

    const switches = Array.from(tab.querySelectorAll<HTMLElement>(".bud-corp-switch"));
    const host = switches.find((node) => node.dataset.expCorpFilterHost === "true" || node.querySelector(".exp-sub-view-label")) ?? switches[0];
    if (!host) return;
    host.dataset.expCorpFilterHost = "true";
    host.replaceChildren();

    const options: Array<{ id: string; label: string }> = [
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
    return () => host.removeEventListener("click", onClick);
  }, [corpFilter, embedded, loaded, setCorpFilter, sortedCorps]);

  useEffect(() => {
    if (!embedded || !loaded) return;
    const tab = document.getElementById("tab-submit");
    if (!tab) return;
    const cards = tab.querySelectorAll<HTMLElement>(".exp-sub-card");
    const yen = (n: number) => "¥" + n.toLocaleString("ja-JP");
    const set = (card: HTMLElement | undefined, count: number, amountText: string) => {
      if (!card) return;
      const v = card.querySelector<HTMLElement>(".exp-sub-card-value");
      if (v) {
        const unit = v.querySelector(".exp-sub-card-unit");
        v.textContent = String(count);
        if (unit) v.appendChild(unit);
      }
      const a = card.querySelector<HTMLElement>(".exp-sub-card-amount");
      if (a) a.textContent = amountText;
    };
    const pendingAmount = list.reduce((s, r) => s + (r.amount ?? 0), 0);
    set(cards[0], list.length, `合計 ${yen(pendingAmount)}`);
    set(cards[1], todayStats.approvedCount, `合計 ${yen(todayStats.approvedAmount)}`);
    set(cards[2], todayStats.rejectedCount, yen(todayStats.rejectedAmount));
  }, [embedded, list, loaded, todayStats]);

  useEffect(() => {
    if (!current) {
      setForm(null);
      setImgUrl(null);
      return;
    }
    openedAt.current = Date.now();
    setForm({
      corp_id: current.corp_id ?? effectiveCorpId(current) ?? "",
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
  }, [current, effectiveCorpId, supabase]);

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
      const nextCorpId = form.corp_id || effectiveCorpId(current) || null;
      const up = await supabase
        .from("bud_expense_requests")
        .update({
          corp_id: nextCorpId,
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
        corp_id: nextCorpId,
        started_at: openedAt.current ? new Date(openedAt.current).toISOString() : null,
        ended_at: nowIso,
        duration_ms: openedAt.current ? Date.now() - openedAt.current : null,
      });
      await load();
    } catch (e) {
      alert("処理に失敗しました：" + (e instanceof Error ? e.message : String(e)));
    } finally {
      setBusy(false);
    }
  };

  const jumpToPending = (row: Req) => {
    const next = list.findIndex((item) => item.id === row.id);
    if (next >= 0) {
      setIdx(next);
      document.getElementById("exp-review-mount")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  const openDetail = (row: Req) => {
    setDetail(row);
    setDetailImgUrl(null);
    void (async () => {
      if (!row.drive_file_id) return;
      const { data } = await supabase.storage.from("bud-receipts").createSignedUrl(row.drive_file_id, 600);
      setDetailImgUrl(data?.signedUrl ?? null);
    })();
  };

  return (
    <div>
      {!embedded && (
        <>
          <header style={{ marginBottom: 18 }}>
            <h1 style={{ fontSize: 22, color: "#3d3528", margin: 0 }}>経費精算 — 承認待ち（経理）</h1>
            <p style={{ color: "#7b745f", fontSize: 13, margin: "4px 0 0" }}>
              スマホ申請を確認して承認／差戻し。Ctrl+↓ / Ctrl+↑ で前後に移動。
            </p>
          </header>
          <CorpFilter value={corpFilter} corps={sortedCorps} onChange={setCorpFilter} />
          <section style={cards3}>
            <Card label="承認待ち" value={loaded ? list.length : "—"} color="#b3892e" />
            <Card label="承認（本日）" value={todayStats.approvedCount} color="#5e7d44" />
            <Card label="差戻し（本日）" value={todayStats.rejectedCount} color="#b35850" />
          </section>
        </>
      )}

      {!loaded && <div style={notice}>読み込み中…</div>}
      {loaded && list.length === 0 && <div style={notice}>この法人の承認待ちはありません</div>}

      {loaded && current && form && (
        <div style={reviewShell}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={twoCol}>
              <div style={panel}>
                <h2 style={panelTitle}>申請情報</h2>
                <Row label="申請者">{employeeLabel(current, employees)}</Row>
                <Field label="法人">
                  <select value={form.corp_id} onChange={(e) => setF("corp_id", e.target.value)} style={input}>
                    <option value="">未設定</option>
                    {sortedCorps.map((corp) => (
                      <option key={corp.id} value={corp.id}>
                        {corp.name_short ?? corp.id}
                      </option>
                    ))}
                  </select>
                </Field>
                <Row label="区分">{current.expense_kind === "company" ? "会社経費" : "個人経費"}</Row>
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
          </div>

          <aside style={recordRail} aria-label="レコード送り">
            <button type="button" style={railBtn} disabled={idx <= 0} onClick={() => setIdx((i) => Math.max(0, i - 1))}>
              ↑
              <span style={railBtnLabel}>前へ</span>
            </button>
            <span style={railCount}>
              {idx + 1}
              <span style={{ color: "#9a8f7d" }}> / {list.length}</span>
            </span>
            <button
              type="button"
              style={railBtn}
              disabled={idx >= list.length - 1}
              onClick={() => setIdx((i) => Math.min(list.length - 1, i + 1))}
            >
              ↓
              <span style={railBtnLabel}>次へ</span>
            </button>
            <span style={railHint}>Ctrl+↑/↓</span>
          </aside>
        </div>
      )}

      {loaded && (
        <StatusList
          rows={statusRows}
          cats={cats}
          employees={employees}
          onPendingClick={jumpToPending}
          onProcessedClick={openDetail}
        />
      )}

      {detail && (
        <DetailModal
          row={detail}
          cats={cats}
          employees={employees}
          imageUrl={detailImgUrl}
          onClose={() => {
            setDetail(null);
            setDetailImgUrl(null);
          }}
        />
      )}
    </div>
  );
}

function CorpFilter({
  value,
  corps,
  onChange,
}: {
  value: string;
  corps: Corp[];
  onChange: (value: string) => void;
}) {
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

function StatusList({
  rows,
  cats,
  employees,
  onPendingClick,
  onProcessedClick,
}: {
  rows: StatusRow[];
  cats: Cat[];
  employees: Record<string, Employee>;
  onPendingClick: (row: Req) => void;
  onProcessedClick: (row: Req) => void;
}) {
  return (
    <section style={statusPanel} data-exp-status-react="true">
      <div style={statusHead}>
        <h3 style={statusTitle}>承認状況一覧</h3>
        <span style={statusMeta}>承認待ち残件 + 本日処理分</span>
      </div>
      {rows.length === 0 ? (
        <div style={{ ...notice, margin: 0 }}>表示できる申請はありません</div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={statusTable}>
            <thead>
              <tr>
                <th style={th}>申請日</th>
                <th style={th}>申請者</th>
                <th style={th}>日付</th>
                <th style={th}>区分</th>
                <th style={{ ...th, textAlign: "right" }}>金額</th>
                <th style={th}>状態</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={`${row.rowKind}-${row.id}`}
                  style={tr}
                  onClick={() => (row.rowKind === "pending" ? onPendingClick(row) : onProcessedClick(row))}
                  title={row.rowKind === "pending" ? "レビューUIで表示" : "申請詳細を表示"}
                >
                  <td style={td}>{formatDate(row.submitted_at)}</td>
                  <td style={td}>{employeeLabel(row, employees)}</td>
                  <td style={td}>{formatDate(row.receipt_date)}</td>
                  <td style={td}>{categoryLabel(row.category_id, cats)}</td>
                  <td style={{ ...td, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{yen(row.amount ?? 0)}</td>
                  <td style={td}>
                    <span style={statusPill(row.status)}>{statusLabel(row.status)}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function DetailModal({
  row,
  cats,
  employees,
  imageUrl,
  onClose,
}: {
  row: Req;
  cats: Cat[];
  employees: Record<string, Employee>;
  imageUrl: string | null;
  onClose: () => void;
}) {
  return (
    <div style={modalBackdrop} role="dialog" aria-modal="true" aria-label="申請詳細">
      <div style={modalCard}>
        <div style={modalHead}>
          <h3 style={statusTitle}>申請詳細</h3>
          <button type="button" onClick={onClose} style={closeBtn} aria-label="閉じる">
            ×
          </button>
        </div>
        <div style={modalGrid}>
          <div>
            <Row label="状態">{statusLabel(row.status)}</Row>
            <Row label="申請者">{employeeLabel(row, employees)}</Row>
            <Row label="申請日">{formatDate(row.submitted_at)}</Row>
            <Row label="日付">{formatDate(row.receipt_date)}</Row>
            <Row label="区分">{categoryLabel(row.category_id, cats)}</Row>
            <Row label="店名">{row.store_name ?? "—"}</Row>
            <Row label="金額">{yen(row.amount ?? 0)}</Row>
            <Row label="摘要">{row.description ?? "—"}</Row>
            {row.return_reason && <Row label="差戻し">{row.return_reason}</Row>}
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
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <label style={{ display: "block", fontSize: 12, color: "#6d6356", marginBottom: 4 }}>{label}</label>
      {children}
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

function statusLabel(status: string) {
  if (status === "submitted") return "承認待ち";
  if (status === "final_pending") return "承認済";
  if (status === "keiri_returned") return "差戻し";
  return status;
}

function statusPill(status: string): React.CSSProperties {
  if (status === "submitted") return { ...pill, background: "rgba(212,165,65,0.16)", color: "#b3892e" };
  if (status === "keiri_returned") return { ...pill, background: "rgba(179,88,80,0.16)", color: "#b35850" };
  return { ...pill, background: "rgba(94,125,68,0.16)", color: "#5e7d44" };
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
const reviewShell: React.CSSProperties = { display: "flex", gap: 12, alignItems: "stretch", marginBottom: 18 };
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
const twoCol: React.CSSProperties = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, alignItems: "start", marginBottom: 0 };
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
const statusPanel: React.CSSProperties = {
  background: "#faf6ec",
  border: "1px solid rgba(179,137,46,0.18)",
  borderRadius: 12,
  padding: "18px 20px",
  marginTop: 18,
};
const statusHead: React.CSSProperties = {
  display: "flex",
  alignItems: "baseline",
  justifyContent: "space-between",
  gap: 16,
  borderBottom: "1px dashed rgba(179,137,46,0.35)",
  paddingBottom: 8,
  marginBottom: 12,
};
const statusTitle: React.CSSProperties = { fontSize: 16, color: "#3d3528", margin: 0, fontWeight: 600 };
const statusMeta: React.CSSProperties = { fontSize: 12, color: "#9a8f7d" };
const statusTable: React.CSSProperties = { width: "100%", borderCollapse: "collapse", fontSize: 13 };
const th: React.CSSProperties = {
  textAlign: "left",
  color: "#6d6356",
  fontWeight: 500,
  padding: "9px 8px",
  borderBottom: "1px solid rgba(180,165,130,0.25)",
};
const td: React.CSSProperties = { padding: "10px 8px", borderBottom: "1px dashed rgba(180,165,130,0.18)", color: "#3d3528" };
const tr: React.CSSProperties = { cursor: "pointer" };
const pill: React.CSSProperties = { display: "inline-block", padding: "3px 10px", borderRadius: 999, fontSize: 12, fontWeight: 600 };
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
