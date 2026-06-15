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
import { calculateFiscalPeriod, formatFiscalDateRange } from "@/app/bud/expenses/_lib/fiscal-period";

import {
  buildCompanyToCorp,
  FALLBACK_CORPS,
  getEffectiveCorpId,
  sortCorps,
  type Company,
  type Corp,
  type Employee,
} from "./expenseCorpUtils";
import {
  notifyDriveContentUpdate,
  notifyDriveMove,
  notifyDriveRename,
  resolveReceiptStoragePath,
  rotateImageBlob,
} from "./expenseReceiptUtils";

type Req = {
  id: string;
  corp_id: string | null;
  applicant_employee_id: string | null;
  expense_kind: string;
  drive_file_id: string | null;
  storage_path: string | null;
  receipt_date: string | null;
  receipt_time: string | null;
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
type Form = {
  corp_id: string;
  receipt_date: string;
  receipt_time: string;
  store_name: string;
  amount: string;
  qualified_class: string;
  qualified_number: string;
  category_id: string;
  description: string;
};
type StatusRow = Req & { rowKind: "pending" | "processed" };

const REQUEST_SELECT =
  "id,corp_id,applicant_employee_id,expense_kind,drive_file_id,storage_path,receipt_date,receipt_time,store_name,amount,qualified_class,qualified_number,category_id,description,status,return_reason,submitted_at,keiri_checked_at";

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
  // root_companies(COMP-00X) → bud_corporations(hyuaran 等) の対応（法人名の部分一致で構築）
  const [companyToCorp, setCompanyToCorp] = useState<Record<string, string>>({});
  const [corpFilter, setCorpFilterState] = useState(readInitialCorpFilter);
  const [idx, setIdx] = useState(0);
  const [form, setForm] = useState<Form | null>(null);
  const [imgUrl, setImgUrl] = useState<string | null>(null);
  const [rotation, setRotation] = useState(0); // 領収書プレビューの回転（90刻み・処理時に保存画像へ反映）
  const [detail, setDetail] = useState<Req | null>(null);
  const [detailImgUrl, setDetailImgUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [amountFocused, setAmountFocused] = useState(false);
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
    return sortCorps(corps);
  }, [corps]);

  const load = useCallback(async () => {
    setLoaded(false);
    const t = new Date();
    t.setHours(0, 0, 0, 0);
    const todayIso = t.toISOString();

    const [pendingRes, processedRes, catRes, corpRes, companyRes] = await Promise.all([
      supabase.from("bud_expense_requests").select(REQUEST_SELECT).eq("status", "submitted").order("submitted_at", { ascending: true }),
      supabase
        .from("bud_expense_requests")
        .select(REQUEST_SELECT)
        // keiri承認後にさらに先の状態(完了待ち処理など)へ進んでも「本日承認」が減らないよう、
        // keiri_returned 以外の後続ステータスもすべて含める
        .in("status", ["final_pending", "final_returned", "journalize_pending", "journalized", "keiri_returned"])
        .gte("keiri_checked_at", todayIso)
        .order("keiri_checked_at", { ascending: false }),
      supabase.from("bud_expense_categories").select("id,name").eq("is_active", true).order("display_order", { ascending: true }),
      supabase.from("bud_corporations").select("id,name_short,established_on,fiscal_end_month").order("id", { ascending: true }),
      supabase.from("root_companies").select("company_id,company_name"),
    ]);

    const pending = (pendingRes.data as Req[] | null) ?? [];
    const processed = (processedRes.data as Req[] | null) ?? [];
    setPendingAll(pending);
    setProcessedToday(processed);
    setCats((catRes.data as Cat[] | null) ?? []);
    let corpList = ((corpRes.data as Corp[] | null) ?? []).length > 0 ? ((corpRes.data as Corp[] | null) ?? []) : FALLBACK_CORPS;
    if (corpRes.error) {
      const fallbackCorpRes = await supabase.from("bud_corporations").select("id,name_short").order("id", { ascending: true });
      corpList = fallbackCorpRes.error ? FALLBACK_CORPS : ((fallbackCorpRes.data as Corp[] | null) ?? FALLBACK_CORPS);
    }
    setCorps(corpList);

    // COMP-00X → corp.id 対応表（会社名に name_short が含まれるかで結合）
    const companies = (companyRes.data as Company[] | null) ?? [];
    setCompanyToCorp(buildCompanyToCorp(companies, corpList));

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

  // タブがアクティブになった瞬間に最新データを読み直す（スマホからの新着申請を反映）
  useEffect(() => {
    if (!embedded) return;
    const tab = document.getElementById("tab-submit");
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
  const processedFiltered = useMemo(() => processedToday.filter(corpMatches), [processedToday, corpMatches]);
  const current = list[idx];

  const todayStats = useMemo(() => {
    const approved = processedFiltered.filter((row) => row.status !== "keiri_returned");
    const rejected = processedFiltered.filter((row) => row.status === "keiri_returned");
    return {
      approvedCount: approved.length,
      approvedAmount: approved.reduce((sum, row) => sum + (row.amount ?? 0), 0),
      rejectedCount: rejected.length,
      rejectedAmount: rejected.reduce((sum, row) => sum + (row.amount ?? 0), 0),
    };
  }, [processedFiltered]);

  const pendingAmount = useMemo(() => list.reduce((sum, row) => sum + (row.amount ?? 0), 0), [list]);

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

  // 埋め込みモードでは、レガシーHTMLの3カード（モック）を隠し、React側のコンパクトカード＋ナビに置き換える
  useEffect(() => {
    if (!embedded || !loaded) return;
    const tab = document.getElementById("tab-submit");
    const summary = tab?.querySelector<HTMLElement>(".exp-sub-summary");
    if (!summary) return;
    summary.style.setProperty("display", "none");
    return () => {
      summary.style.removeProperty("display");
    };
  }, [embedded, loaded]);

  useEffect(() => {
    if (!current) {
      setForm(null);
      setImgUrl(null);
      return;
    }
    openedAt.current = Date.now();
    setRotation(0);
    setForm({
      corp_id: current.corp_id ?? effectiveCorpId(current) ?? "",
      receipt_date: current.receipt_date ?? "",
      receipt_time: current.receipt_time ? current.receipt_time.slice(0, 5) : "",
      store_name: current.store_name ?? "",
      amount: current.amount != null ? String(current.amount) : "",
      qualified_class: current.qualified_class ?? "",
      qualified_number: current.qualified_number ?? "",
      category_id: current.category_id ?? "",
      description: current.description ?? "",
    });
    let cancelled = false;
    void (async () => {
      const path = resolveReceiptStoragePath(current);
      if (path) {
        const { data } = await supabase.storage.from("bud-receipts").createSignedUrl(path, 600);
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

  const selectedCorp = useMemo(() => {
    const corpId = form?.corp_id || (current ? effectiveCorpId(current) : null);
    return sortedCorps.find((corp) => corp.id === corpId) ?? null;
  }, [current, effectiveCorpId, form?.corp_id, sortedCorps]);

  const fiscalPeriod = useMemo(() => {
    if (!form || !selectedCorp) return null;
    return calculateFiscalPeriod(selectedCorp.established_on, selectedCorp.fiscal_end_month, form.receipt_date);
  }, [form, selectedCorp]);

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
          receipt_time: form.receipt_time || null,
          store_name: form.store_name || null,
          // blur 前に保存ボタンを押された場合に備え、保存時にも正規化（コンマ・全角を除去）
          amount: Number(normalizeAmountInput(form.amount)) || 0,
          qualified_class: form.qualified_class || null,
          qualified_number: normalizeQualifiedNumberInput(form.qualified_number) || null,
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
      // 回転補正があれば保存画像へ反映（Storage を正として上書き＋Drive ミラーも更新）
      const rot = ((rotation % 360) + 360) % 360;
      if (rot !== 0 && imgUrl) {
        try {
          const blob = await (await fetch(imgUrl)).blob();
          const rotated = await rotateImageBlob(blob, rot);
          const path = resolveReceiptStoragePath(current);
          if (path) {
            await supabase.storage
              .from("bud-receipts")
              .upload(path, rotated, { contentType: "image/jpeg", upsert: true });
          }
          void notifyDriveContentUpdate(current.id, rotated);
        } catch {
          // 回転反映の失敗は処理を止めない（表示は次回また回せる）
        }
      }

      // Drive ミラーの自動整理（ベストエフォート）:
      // 差戻し→0_差戻しへ移動 / 承認→リネーム（日付_時刻_社員番号_店名_金額）→1_承認へ移動
      if (action === "reject") {
        void notifyDriveMove(current.id, "returned");
      } else {
        const id = current.id;
        void (async () => {
          await notifyDriveRename(id);
          await notifyDriveMove(id, "approved");
        })();
      }
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
      const path = resolveReceiptStoragePath(row);
      if (!path) return;
      const { data } = await supabase.storage.from("bud-receipts").createSignedUrl(path, 600);
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
        </>
      )}

      {/* コンパクト3カード＋横並びレコード送りを1行に */}
      {loaded && (
        <div style={summaryNavBar}>
          <CompactCard label="承認待ち" count={list.length} amount={pendingAmount} color="#b3892e" />
          <CompactCard label="承認（本日）" count={todayStats.approvedCount} amount={todayStats.approvedAmount} color="#5e7d44" />
          <CompactCard label="差戻し（本日）" count={todayStats.rejectedCount} amount={todayStats.rejectedAmount} color="#b35850" />
          {list.length > 0 && current && (
            <div style={navWrap}>
              <button type="button" style={navBtn(idx <= 0)} disabled={idx <= 0} onClick={() => setIdx((i) => Math.max(0, i - 1))}>
                ← 前へ<span style={navHint}>Ctrl+↑</span>
              </button>
              <span style={navCount}>
                {idx + 1}
                <span style={{ color: "#9a8f7d" }}> / {list.length}</span>
              </span>
              <button
                type="button"
                style={navBtn(idx >= list.length - 1)}
                disabled={idx >= list.length - 1}
                onClick={() => setIdx((i) => Math.min(list.length - 1, i + 1))}
              >
                次へ →<span style={navHint}>Ctrl+↓</span>
              </button>
            </div>
          )}
        </div>
      )}

      {!loaded && <div style={notice}>読み込み中…</div>}
      {loaded && list.length === 0 && <div style={notice}>この法人の承認待ちはありません</div>}

      {loaded && current && form && (
        <div style={reviewShell}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={twoCol}>
              <div style={panel}>
                <h2 style={panelTitle}>申請情報</h2>
                <div style={formRows}>
                  <div style={fieldRow(FISCAL_COLS)}>
                    <InfoValue label="区分">{current.expense_kind === "company" ? "会社経費" : "個人経費"}</InfoValue>
                    <InfoValue label="申請者">{employeeLabel(current, employees)}</InfoValue>
                  </div>

                  <div style={fieldRow(FISCAL_COLS)}>
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
                    <InfoValue label="計上期" emphasis={fiscalPeriod?.expired ? "danger" : "normal"}>
                      {fiscalPeriod ? `第${fiscalPeriod.periodNo}期` : "—"}
                    </InfoValue>
                    <InfoValue label="期の範囲" emphasis={fiscalPeriod?.expired ? "danger" : "normal"}>
                      {fiscalPeriod ? formatFiscalDateRange(fiscalPeriod) : "—"}
                    </InfoValue>
                  </div>
                  {fiscalPeriod?.expired && <div style={fiscalWarning}>⚠ 計上期限超過（期末の翌月末を過ぎています）・要確認</div>}

                  {/* 法人・計上期と同じ列幅に揃える（3列目は空き） */}
                  <div style={fieldRow(FISCAL_COLS)}>
                    <Field label="レシート日付">
                      <input type="date" value={form.receipt_date} onChange={(e) => setF("receipt_date", e.target.value)} style={input} />
                    </Field>
                    <Field label="レシート時刻">
                      <input type="time" value={form.receipt_time} onChange={(e) => setF("receipt_time", e.target.value)} style={input} />
                    </Field>
                  </div>

                  <div style={fieldRow(FISCAL_COLS)}>
                    <Field label="経費区分">
                      {/* OCRで判定できなかった場合（未選択）は赤背景・白文字で「人が選ぶ」ことを促す */}
                      <select
                        value={form.category_id}
                        onChange={(e) => setF("category_id", e.target.value)}
                        style={form.category_id ? input : { ...input, background: "#b35850", color: "#fff", fontWeight: 700 }}
                      >
                        <option value="">（未選択）</option>
                        {cats.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label="適格区分">
                      {/* 経費区分と同じく、未選択のときは赤背景・白文字で人の選択を促す */}
                      <select
                        value={form.qualified_class}
                        onChange={(e) => setF("qualified_class", e.target.value)}
                        style={form.qualified_class ? input : { ...input, background: "#b35850", color: "#fff", fontWeight: 700 }}
                      >
                        <option value="">（未選択）</option>
                        <option value="有">有</option>
                        <option value="無">無</option>
                        <option value="非課税">非課税</option>
                      </select>
                    </Field>
                    <Field label="適格番号(T)">
                      {(() => {
                        // 無・非課税のときは番号入力をグレーアウト（非表示にはしない）
                        const numberDisabled = form.qualified_class === "無" || form.qualified_class === "非課税";
                        const tValid = /^T\d{13}$/.test(form.qualified_number.trim());
                        // 有なのに T+13桁 が拾えていなければ ✖ + 薄赤背景で知らせる
                        const showInvalid = !numberDisabled && form.qualified_class === "有" && !tValid;
                        return (
                          <div style={{ position: "relative" }}>
                            <input
                              type="text"
                              value={form.qualified_number}
                              onChange={(e) => setF("qualified_number", e.target.value)}
                              onBlur={(e) => setF("qualified_number", normalizeQualifiedNumberInput(e.target.value))}
                              disabled={numberDisabled}
                              style={{
                                ...input,
                                paddingRight: 32,
                                ...(numberDisabled ? { background: "#eceae3", color: "#9a8f7d" } : {}),
                                ...(showInvalid ? { background: "rgba(179,88,80,0.12)", borderColor: "rgba(179,88,80,0.45)" } : {}),
                              }}
                            />
                            {!numberDisabled && tValid && <span style={tMarkOk}>✓</span>}
                            {showInvalid && <span style={tMarkNg}>✕</span>}
                          </div>
                        );
                      })()}
                    </Field>
                  </div>

                  <div style={fieldRow(FISCAL_COLS)}>
                    <div style={{ gridColumn: "1 / 3" }}>
                      <Field label="店名">
                        <input type="text" value={form.store_name} onChange={(e) => setF("store_name", e.target.value)} style={input} />
                      </Field>
                    </div>
                    <Field label="金額">
                      {/* 表示はコンマ付き右揃え・編集中は素の数字・保存はコンマ無し（type=text なのでスピナー矢印も出ない） */}
                      <input
                        type="text"
                        inputMode="numeric"
                        value={amountFocused ? form.amount : formatAmountDisplay(form.amount)}
                        onFocus={() => setAmountFocused(true)}
                        onChange={(e) => setF("amount", e.target.value)}
                        onBlur={(e) => {
                          setAmountFocused(false);
                          setF("amount", normalizeAmountInput(e.target.value));
                        }}
                        style={{ ...input, textAlign: "right" }}
                      />
                    </Field>
                  </div>

                  <Field label="摘要">
                    <input type="text" value={form.description} onChange={(e) => setF("description", e.target.value)} style={input} />
                  </Field>
                </div>
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
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <h2 style={panelTitle}>領収書</h2>
                  {imgUrl && (
                    <button
                      type="button"
                      onClick={() => setRotation((r) => (r + 90) % 360)}
                      title="画像を90°回転（承認/差戻し時に保存画像へ反映）"
                      style={rotateImgBtn}
                    >
                      ↻ 回転
                    </button>
                  )}
                </div>
                {imgUrl ? (
                  <div style={{ overflow: "hidden", display: "flex", justifyContent: "center" }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={imgUrl}
                      alt="領収書"
                      style={{
                        width: rotation % 180 === 0 ? "100%" : "auto",
                        maxWidth: "100%",
                        maxHeight: 560,
                        borderRadius: 10,
                        border: "1px solid #e2ddcf",
                        transform: `rotate(${rotation}deg)`,
                      }}
                    />
                  </div>
                ) : (
                  <div style={{ ...notice, margin: 0 }}>画像なし</div>
                )}
              </div>
            </div>
          </div>

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

// 「承認待ち 9件 合計 ¥12,868」を1行に収めるコンパクトカード
function CompactCard({ label, count, amount, color }: { label: string; count: number; amount: number; color: string }) {
  return (
    <div style={{ ...compactCard, borderLeft: `3px solid ${color}` }}>
      <span style={{ color: "#6d6356" }}>{label}</span>
      <strong style={{ fontSize: 16, color, fontVariantNumeric: "tabular-nums" }}>{count}件</strong>
      <span style={{ color: "#6d6356" }}>合計 ¥{amount.toLocaleString("ja-JP")}</span>
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
    <div>
      <label style={{ display: "block", fontSize: 12, color: "#6d6356", marginBottom: 4 }}>{label}</label>
      {children}
    </div>
  );
}

// 表示専用の値。Field と同じ「ラベル上・箱下」構造＋入力欄と同じ箱の高さにして、行内で枠が揃うようにする
function InfoValue({
  label,
  children,
  emphasis = "normal",
}: {
  label: string;
  children: React.ReactNode;
  emphasis?: "normal" | "danger";
}) {
  return (
    <div>
      <div style={{ fontSize: 12, color: emphasis === "danger" ? "#9e3f38" : "#6d6356", marginBottom: 4 }}>{label}</div>
      <div style={infoBox(emphasis)}>{children}</div>
    </div>
  );
}

// 全角英数字→半角
function toHalfWidth(value: string) {
  return value.replace(/[０-９Ａ-Ｚａ-ｚ]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xfee0));
}

// 適格番号の確定時正規化: 全角→半角・小文字t→大文字T・空白除去
function normalizeQualifiedNumberInput(value: string) {
  return toHalfWidth(value).replace(/[\s　]/g, "").toUpperCase();
}

// 金額の確定時正規化: 全角→半角・コンマ等を除去して数字のみに
function normalizeAmountInput(value: string) {
  return toHalfWidth(value).replace(/[^\d]/g, "");
}

function formatAmountDisplay(raw: string) {
  if (!raw) return "";
  const n = Number(raw);
  return Number.isFinite(n) ? n.toLocaleString("ja-JP") : raw;
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
// コンパクト3カード＋横並びレコード送りの1行
const summaryNavBar: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  flexWrap: "wrap",
  marginBottom: 16,
};
const compactCard: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "baseline",
  gap: 10,
  padding: "8px 14px",
  background: "#faf6ec",
  border: "1px solid rgba(179,137,46,0.18)",
  borderRadius: 10,
  fontSize: 13,
  whiteSpace: "nowrap",
};
const navWrap: React.CSSProperties = { marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 };
const navBtn = (disabled: boolean): React.CSSProperties => ({
  display: "inline-flex",
  alignItems: "center",
  gap: 7,
  padding: "8px 14px",
  borderRadius: 8,
  border: "1px solid #cdbf9a",
  background: "#fff",
  color: "#6d6356",
  fontSize: 13,
  cursor: disabled ? "not-allowed" : "pointer",
  opacity: disabled ? 0.45 : 1,
  whiteSpace: "nowrap",
});
const navHint: React.CSSProperties = { fontSize: 10, color: "#9a8f7d" };
const navCount: React.CSSProperties = { fontSize: 13, color: "#3d3528", fontVariantNumeric: "tabular-nums", padding: "0 2px" };
const twoCol: React.CSSProperties = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, alignItems: "start", marginBottom: 0 };
const panel: React.CSSProperties = { background: "#faf6ec", border: "1px solid rgba(179,137,46,0.18)", borderRadius: 12, padding: "18px 20px" };
const panelTitle: React.CSSProperties = { fontSize: 15, color: "#b3892e", margin: "0 0 12px", borderBottom: "1px dashed rgba(179,137,46,0.35)", paddingBottom: 8 };
// 「法人/計上期/期の範囲」行と「レシート日付/時刻」行で共有する列幅（枠の縦ラインを揃える）
const FISCAL_COLS = "1.1fr 0.8fr 1.3fr";
const formRows: React.CSSProperties = { display: "grid", gap: 10 };
const fieldRow = (columns: string): React.CSSProperties => ({
  display: "grid",
  gridTemplateColumns: columns,
  gap: 10,
  alignItems: "end",
});
// 入力欄（input/select）と同じ padding・角丸・文字サイズで、行内の箱の高さが揃うようにする
const infoBox = (emphasis: "normal" | "danger"): React.CSSProperties => ({
  padding: "8px 10px",
  borderRadius: 6,
  fontSize: 14,
  lineHeight: "22px",
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
  color: emphasis === "danger" ? "#b35850" : "#3d3528",
  fontWeight: emphasis === "danger" ? 700 : 500,
  border: emphasis === "danger" ? "1px solid rgba(179,88,80,0.35)" : "1px solid rgba(179,137,46,0.16)",
  background: emphasis === "danger" ? "rgba(179,88,80,0.08)" : "rgba(255,253,246,0.72)",
});
// 適格番号の判定マーク（右端に重ねる）
const tMark: React.CSSProperties = {
  position: "absolute",
  right: 9,
  top: "50%",
  transform: "translateY(-50%)",
  width: 18,
  height: 18,
  borderRadius: 999,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 12,
  fontWeight: 700,
  color: "#fff",
};
const tMarkOk: React.CSSProperties = { ...tMark, background: "#5e7d44" };
const tMarkNg: React.CSSProperties = { ...tMark, background: "#b35850" };
const fiscalWarning: React.CSSProperties = {
  padding: "7px 10px",
  borderRadius: 8,
  background: "rgba(179,88,80,0.1)",
  border: "1px solid rgba(179,88,80,0.28)",
  color: "#9e3f38",
  fontSize: 12,
  fontWeight: 700,
};
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
const rotateImgBtn: React.CSSProperties = {
  padding: "6px 14px",
  borderRadius: 8,
  border: "1px solid rgba(179,137,46,0.35)",
  background: "#fff",
  color: "#b3892e",
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer",
  flexShrink: 0,
  marginLeft: 10,
};
