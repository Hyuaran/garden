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
import { createPortal } from "react-dom";

import { createBrowserClient } from "@/app/_lib/supabase/browser";
import { calculateFiscalPeriod, formatFiscalDateRange } from "@/app/bud/expenses/_lib/fiscal-period";
import {
  sortExpenseReviewRows,
  type ExpenseReviewSortDirection,
  type ExpenseReviewSortField,
} from "@/app/bud/expenses/_lib/expense-review-sort";
import {
  executeFileMakerSearch,
  hasSearchConditions,
  type SearchField,
  type SearchRecord,
  type SearchSheet,
} from "@/app/bud/expenses/_lib/filemaker-search";

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
type SearchForm = Record<SearchField, string>;
type StatusRow = Req & { rowKind: "pending" | "processed" };
type LoadOptions = { preserveIndex?: number; resetSearch?: boolean };

const OCR_CONFIRM_DESCRIPTION = "OCR要確認";
const REQUEST_SELECT =
  "id,corp_id,applicant_employee_id,expense_kind,drive_file_id,storage_path,receipt_date,receipt_time,store_name,amount,qualified_class,qualified_number,category_id,description,status,return_reason,submitted_at,keiri_checked_at";

const CORP_FILTER_STORAGE_KEY = "bud-expense-review-corp-filter";
const CARD_ORDER_STORAGE_KEY = "bud-expense-review-card-order";

const EMPTY_SEARCH_FORM: SearchForm = {
  corp_id: "",
  expense_kind: "",
  category_id: "",
  qualified_class: "",
  receipt_date: "",
  receipt_time: "",
  amount: "",
  store_name: "",
  qualified_number: "",
  description: "",
  applicant_employee_id: "",
};

function createSearchSheet(mode: "include" | "omit" = "include"): SearchSheet {
  return { ...EMPTY_SEARCH_FORM, mode };
}

function readInitialCorpFilter() {
  if (typeof window === "undefined") return "all";
  try {
    return window.sessionStorage.getItem(CORP_FILTER_STORAGE_KEY) ?? "all";
  } catch {
    return "all";
  }
}

function readInitialCardReversed() {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(CARD_ORDER_STORAGE_KEY) === "receipt-left";
  } catch {
    return false;
  }
}

function displayDescription(value: string | null) {
  return value === OCR_CONFIRM_DESCRIPTION ? "" : value ?? "";
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
  // 領収書表示枠の実寸を測り、回転しても最大サイズ(contain)で表示する
  const recBoxRef = useRef<HTMLDivElement>(null);
  const [recBox, setRecBox] = useState({ w: 0, h: 0 });
  const [natSize, setNatSize] = useState({ w: 0, h: 0 }); // 画像の元サイズ
  const [detail, setDetail] = useState<Req | null>(null);
  const [detailImgUrl, setDetailImgUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [amountFocused, setAmountFocused] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [searchMode, setSearchMode] = useState(false);
  const [searchSheets, setSearchSheets] = useState<SearchSheet[]>(() => [createSearchSheet()]);
  const [activeSearchSheet, setActiveSearchSheet] = useState(0);
  const [foundIds, setFoundIds] = useState<string[] | null>(null);
  const [searchSummary, setSearchSummary] = useState("");
  const [cardsReversed, setCardsReversed] = useState(readInitialCardReversed);
  const [receiptZoomOpen, setReceiptZoomOpen] = useState(false);
  const [receiptZoomScale, setReceiptZoomScale] = useState(1.6);
  const [receiptInlineScale, setReceiptInlineScale] = useState(1);
  const [sortField, setSortField] = useState<ExpenseReviewSortField>("default");
  const [sortDirection, setSortDirection] = useState<ExpenseReviewSortDirection>("asc");
  const [listTabHost, setListTabHost] = useState<HTMLElement | null>(null);
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

  const load = useCallback(async (options: LoadOptions = {}) => {
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
      const employeeResWithDefault = await supabase
        .from("root_employees")
        .select("employee_id,company_id,name,expense_default_corp_id")
        .in("employee_id", employeeIds);
      let employeeData = (employeeResWithDefault.data as Employee[] | null) ?? [];
      if (employeeResWithDefault.error) {
        const employeeFallbackRes = await supabase.from("root_employees").select("employee_id,company_id,name").in("employee_id", employeeIds);
        employeeData = (employeeFallbackRes.data as Employee[] | null) ?? [];
      }
      const map: Record<string, Employee> = {};
      for (const employee of employeeData) {
        map[employee.employee_id] = employee;
      }
      setEmployees(map);
    }

    setIdx(options.preserveIndex ?? 0);
    if (options.resetSearch !== false) {
      setFoundIds(null);
      setSearchSummary("");
    }
    setLoaded(true);
  }, [supabase]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    try {
      window.localStorage.setItem(CARD_ORDER_STORAGE_KEY, cardsReversed ? "receipt-left" : "info-left");
    } catch {
      // 表示順の記憶に失敗してもレビュー操作は継続できる。
    }
  }, [cardsReversed]);

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
  const baseList = useMemo(() => {
    const rows = pendingAll.filter(corpMatches).map((row) => ({
      ...row,
      applicant_label: employeeLabel(row, employees),
      effective_corp_id: effectiveCorpId(row),
    }));
    return sortExpenseReviewRows(rows, sortField, sortDirection);
  }, [corpMatches, effectiveCorpId, employees, pendingAll, sortDirection, sortField]);
  const list = useMemo(() => {
    if (!foundIds) return baseList;
    const idSet = new Set(foundIds);
    return baseList.filter((row) => idSet.has(row.id));
  }, [baseList, foundIds]);
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

  // 領収書表示枠のサイズを監視（回転時の最大表示計算に使う）
  useEffect(() => {
    const el = recBoxRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const update = () => setRecBox({ w: el.clientWidth, h: el.clientHeight });
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [loaded, current, imgUrl]);

  useEffect(() => {
    setIdx(0);
    setFoundIds(null);
    setSearchSummary("");
  }, [corpFilter]);

  useEffect(() => {
    setIdx(0);
  }, [sortDirection, sortField]);

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
    const main = document.querySelector<HTMLElement>('main[data-bud-port="/bud/expenses"]');
    const nav = main?.querySelector<HTMLElement>(".tab-nav");
    const categoriesTab = nav?.querySelector<HTMLElement>('.tab-item[data-tab="categories"]');
    if (!main || !nav || !categoriesTab) return;

    let listButton = nav.querySelector<HTMLButtonElement>('.tab-item[data-tab="list"]');
    if (!listButton) {
      listButton = document.createElement("button");
      listButton.type = "button";
      listButton.className = "tab-item";
      listButton.dataset.tab = "list";
      listButton.innerHTML = '<span class="tab-item-jp">一覧</span>/ List';
      nav.insertBefore(listButton, categoriesTab);
    }

    let host = document.getElementById("tab-list");
    if (!host) {
      host = document.createElement("div");
      host.id = "tab-list";
      host.className = "tab-content";
      const categoriesContent = document.getElementById("tab-categories");
      if (categoriesContent?.parentElement) {
        categoriesContent.parentElement.insertBefore(host, categoriesContent);
      } else {
        main.appendChild(host);
      }
    }
    setListTabHost(host);
  }, [embedded, loaded]);

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

    // 法人フィルター(pill)を flex 行でラップし、右端にレコード番号(1/9)を置く。
    // これによりカード＋前へ次へ行から番号を外せ、中央が狭くても横並びを維持できる。
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
    return () => host.removeEventListener("click", onClick);
  }, [corpFilter, embedded, loaded, setCorpFilter, sortedCorps, idx, list.length]);

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
    setReceiptInlineScale(1);
    setForm({
      corp_id: current.corp_id ?? effectiveCorpId(current) ?? "",
      receipt_date: current.receipt_date ?? "",
      receipt_time: current.receipt_time ? current.receipt_time.slice(0, 5) : "",
      store_name: current.store_name ?? "",
      amount: current.amount != null ? String(current.amount) : "",
      qualified_class: current.qualified_class ?? "",
      qualified_number: current.qualified_number ?? "",
      category_id: current.category_id ?? "",
      description: displayDescription(current.description),
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

  const setSearchField = useCallback((field: SearchField, value: string) => {
    setSearchSheets((sheets) =>
      sheets.map((sheet, index) => (index === activeSearchSheet ? { ...sheet, [field]: value } : sheet)),
    );
  }, [activeSearchSheet]);

  const clearActiveSearchSheet = useCallback(() => {
    setSearchSheets((sheets) =>
      sheets.map((sheet, index) => (index === activeSearchSheet ? createSearchSheet(sheet.mode ?? "include") : sheet)),
    );
  }, [activeSearchSheet]);

  const enterSearchMode = useCallback(() => {
    setSearchMode(true);
    setSearchSheets((sheets) => (sheets.length > 0 ? sheets : [createSearchSheet()]));
    setActiveSearchSheet((index) => Math.max(0, Math.min(index, searchSheets.length - 1)));
  }, [searchSheets.length]);

  const clearFoundSet = useCallback(() => {
    setFoundIds(null);
    setSearchSummary("");
    setIdx(0);
  }, []);

  const buildSearchRecord = useCallback((row: Req): SearchRecord => ({
    id: row.id,
    corp_id: row.corp_id ?? effectiveCorpId(row) ?? "",
    expense_kind: expenseKindLabel(row.expense_kind),
    category_id: row.category_id ?? "",
    qualified_class: row.qualified_class ?? "",
    receipt_date: row.receipt_date ?? "",
    receipt_time: row.receipt_time ? row.receipt_time.slice(0, 5) : "",
    amount: row.amount,
    store_name: row.store_name ?? "",
    qualified_number: row.qualified_number ?? "",
    description: displayDescription(row.description),
    applicant_employee_id: employeeLabel(row, employees),
  }), [effectiveCorpId, employees]);

  const executeSearch = useCallback(() => {
    const valid = searchSheets.filter((sheet) => hasSearchConditions(sheet));
    if (valid.length === 0) {
      alert("検索条件を入力してください");
      return;
    }
    const searchRecords = baseList.map(buildSearchRecord);
    const result = executeFileMakerSearch(searchRecords, searchSheets);
    setFoundIds(result.records.map((record) => record.id));
    setSearchSummary(result.summary);
    setSearchMode(false);
    setIdx(0);
  }, [baseList, buildSearchRecord, searchSheets]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key.toLowerCase() === "g") {
        e.preventDefault();
        if (searchMode) {
          setSearchMode(false);
        } else if (foundIds) {
          clearFoundSet();
        } else {
          enterSearchMode();
        }
      } else if (searchMode && e.key === "Escape") {
        e.preventDefault();
        setSearchMode(false);
      } else if (searchMode && e.ctrlKey && e.key === "/") {
        e.preventDefault();
        clearActiveSearchSheet();
      } else if (searchMode && e.ctrlKey && e.key === "Enter") {
        e.preventDefault();
        setSearchSheets((sheets) => [...sheets, createSearchSheet()]);
        setActiveSearchSheet(searchSheets.length);
      } else if (searchMode && !e.ctrlKey && !e.metaKey && !e.altKey && e.key === "Enter") {
        e.preventDefault();
        executeSearch();
      } else if (!searchMode && e.ctrlKey && e.key === "ArrowDown") {
        e.preventDefault();
        setIdx((i) => Math.min(i + 1, list.length - 1));
      } else if (!searchMode && e.ctrlKey && e.key === "ArrowUp") {
        e.preventDefault();
        setIdx((i) => Math.max(i - 1, 0));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [clearActiveSearchSheet, clearFoundSet, enterSearchMode, executeSearch, foundIds, list.length, searchMode, searchSheets.length]);

  const setF = (k: keyof Form, v: string) => setForm((f) => (f ? { ...f, [k]: v } : f));
  const activeSearch = searchSheets[activeSearchSheet] ?? createSearchSheet();

  const selectedCorp = useMemo(() => {
    const corpId = form?.corp_id || (current ? effectiveCorpId(current) : null);
    return sortedCorps.find((corp) => corp.id === corpId) ?? null;
  }, [current, effectiveCorpId, form?.corp_id, sortedCorps]);

  const corpChangeBadge = useMemo(() => {
    if (!current?.corp_id || !current.applicant_employee_id) return null;
    const defaultCorpId = employees[current.applicant_employee_id]?.expense_default_corp_id ?? null;
    if (!defaultCorpId || defaultCorpId === current.corp_id) return null;
    const defaultName = sortedCorps.find((corp) => corp.id === defaultCorpId)?.name_short ?? defaultCorpId;
    const selectedName = sortedCorps.find((corp) => corp.id === current.corp_id)?.name_short ?? current.corp_id;
    return { defaultName, selectedName };
  }, [current, employees, sortedCorps]);

  const fiscalPeriod = useMemo(() => {
    if (!form || !selectedCorp) return null;
    return calculateFiscalPeriod(selectedCorp.established_on, selectedCorp.fiscal_end_month, form.receipt_date);
  }, [form, selectedCorp]);

  const process = async (action: "approve" | "reject") => {
    if (!current || !form || busy || searchMode) return;
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
      const nextDescription = displayDescription(form.description).trim() || null;
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
          description: nextDescription,
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
      await load({ preserveIndex: idx, resetSearch: false });
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
            <h1 style={{ fontSize: 22, color: "var(--text-main)", margin: 0 }}>経費精算 — 承認待ち（経理）</h1>
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
            <div style={{ ...navWrap, justifyContent: "center" }}>
              <div style={navButtonRow}>
              <button type="button" style={navBtn(idx <= 0)} disabled={idx <= 0} onClick={() => setIdx((i) => Math.max(0, i - 1))}>
                <span style={navCircle}>◀</span>前へ<span style={navHint}>Ctrl+↑</span>
              </button>
              {/* 埋め込み時はレコード番号を法人フィルター行の右端に出すのでここでは省略 */}
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
                onClick={() => setIdx((i) => Math.min(list.length - 1, i + 1))}
              >
                次へ<span style={navHint}>Ctrl+↓</span><span style={navCircle}>▶</span>
              </button>
              </div>
            </div>
          )}
        </div>
      )}

      {searchMode && (
        <div style={searchBanner}>
          <strong>検索モード</strong>
          <span>条件を入力して Enter。Ctrl+EnterでORシート追加、Ctrl+/で条件クリア、Escで解除。</span>
        </div>
      )}

      {searchMode && (
        <div style={searchSheetBar}>
          {searchSheets.map((sheet, index) => (
            <button
              key={index}
              type="button"
              style={searchSheetTab(index === activeSearchSheet, sheet.mode === "omit")}
              onClick={() => setActiveSearchSheet(index)}
            >
              {index + 1}
              {sheet.mode === "omit" ? " 除外" : ""}
              {searchSheets.length > 1 && (
                <span
                  style={searchSheetClose}
                  onClick={(event) => {
                    event.stopPropagation();
                    setSearchSheets((sheets) => sheets.filter((_, i) => i !== index));
                    setActiveSearchSheet((currentIndex) => Math.max(0, Math.min(currentIndex, searchSheets.length - 2)));
                  }}
                >
                  x
                </span>
              )}
            </button>
          ))}
          <button
            type="button"
            style={searchSheetAdd}
            onClick={() => {
              setSearchSheets((sheets) => [...sheets, createSearchSheet()]);
              setActiveSearchSheet(searchSheets.length);
            }}
          >
            +
          </button>
          <div style={searchModeToggle}>
            <button
              type="button"
              style={searchModeBtn(activeSearch.mode !== "omit")}
              onClick={() => setSearchSheets((sheets) => sheets.map((sheet, index) => (index === activeSearchSheet ? { ...sheet, mode: "include" } : sheet)))}
            >
              含む
            </button>
            <button
              type="button"
              style={searchModeBtn(activeSearch.mode === "omit")}
              onClick={() => setSearchSheets((sheets) => sheets.map((sheet, index) => (index === activeSearchSheet ? { ...sheet, mode: "omit" } : sheet)))}
            >
              除外
            </button>
          </div>
        </div>
      )}

      {foundIds && !searchMode && (
        <div style={foundBar}>
          <strong>検索結果: {list.length}件 / 全{baseList.length}件</strong>
          <span style={foundSummaryText}>[{searchSummary}]</span>
          <button type="button" style={foundClearBtn} onClick={clearFoundSet}>
            x 解除
          </button>
        </div>
      )}

      {!loaded && <div style={notice}>読み込み中…</div>}
      {loaded && list.length === 0 && <div style={notice}>この法人の承認待ちはありません</div>}

      {loaded && current && form && (
        <div style={reviewShell}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={layoutToolRow}>
              <div style={sortControlGroup}>
                <select value={sortField} onChange={(event) => setSortField(event.target.value as ExpenseReviewSortField)} style={sortSelect}>
                  <option value="default">送り順</option>
                  <option value="receipt_date">日付</option>
                  <option value="amount">金額</option>
                  <option value="applicant">申請者</option>
                  <option value="store_name">店名</option>
                  <option value="corp_id">法人</option>
                </select>
                <button
                  type="button"
                  style={layoutToggleBtn}
                  onClick={() => setSortDirection((value) => (value === "asc" ? "desc" : "asc"))}
                  disabled={sortField === "default"}
                >
                  {sortDirection === "asc" ? "昇順" : "降順"}
                </button>
              </div>
              <button type="button" style={layoutToggleBtn} onClick={() => setCardsReversed((value) => !value)}>
                ⇄ 左右入替
              </button>
            </div>
            <div style={twoCol}>
              <div style={{ ...panel, order: cardsReversed ? 2 : 1 }}>
                <h2 style={panelTitle}>申請情報</h2>
                <div style={formRows}>
                  <div style={fieldRow(FISCAL_COLS)}>
                    <InfoValue label="区分">{current.expense_kind === "company" ? "会社経費" : "個人経費"}</InfoValue>
                    {searchMode && (
                      <Field label="区分">
                        <select value={activeSearch.expense_kind ?? ""} onChange={(e) => setSearchField("expense_kind", e.target.value)} style={input}>
                          <option value="">すべて</option>
                          <option value="会社経費">会社経費</option>
                          <option value="個人経費">個人経費</option>
                          <option value="company">company</option>
                          <option value="personal">personal</option>
                        </select>
                      </Field>
                    )}
                    {searchMode ? (
                      <Field label="申請者">
                        <input
                          type="text"
                          value={activeSearch.applicant_employee_id ?? ""}
                          onChange={(e) => setSearchField("applicant_employee_id", e.target.value)}
                          placeholder="氏名で検索"
                          style={input}
                        />
                      </Field>
                    ) : (
                      <InfoValue label="申請者">{employeeLabel(current, employees)}</InfoValue>
                    )}
                    {(current.description === OCR_CONFIRM_DESCRIPTION || corpChangeBadge) && (
                      <div style={badgeStack}>
                        {current.description === OCR_CONFIRM_DESCRIPTION && <div style={ocrBadgeBox}>OCR要確認</div>}
                        {corpChangeBadge && (
                          <div style={corpChangeBadgeBox}>
                            ⚠ 申請者が法人変更: {corpChangeBadge.defaultName}→{corpChangeBadge.selectedName}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <div style={fieldRow(FISCAL_COLS)}>
                    <Field label="法人">
                      <select
                        value={searchMode ? activeSearch.corp_id ?? "" : form.corp_id}
                        onChange={(e) => (searchMode ? setSearchField("corp_id", e.target.value) : setF("corp_id", e.target.value))}
                        style={requiredFieldStyle(searchMode, form.corp_id)}
                      >
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
                      <input
                        type={searchMode ? "text" : "date"}
                        value={searchMode ? activeSearch.receipt_date ?? "" : form.receipt_date}
                        onChange={(e) => (searchMode ? setSearchField("receipt_date", e.target.value) : setF("receipt_date", e.target.value))}
                        placeholder={searchMode ? "//・7/1...7/31" : undefined}
                        style={requiredFieldStyle(searchMode, form.receipt_date)}
                      />
                    </Field>
                    <Field label="レシート時刻">
                      <input
                        type={searchMode ? "text" : "time"}
                        value={searchMode ? activeSearch.receipt_time ?? "" : form.receipt_time}
                        onChange={(e) => (searchMode ? setSearchField("receipt_time", e.target.value) : setF("receipt_time", e.target.value))}
                        placeholder={searchMode ? "09:00...12:00" : undefined}
                        style={input}
                      />
                    </Field>
                  </div>

                  <div style={fieldRow(FISCAL_COLS)}>
                    <Field label="経費区分">
                      {/* OCRで判定できなかった場合（未選択）は赤背景・白文字で「人が選ぶ」ことを促す */}
                      <select
                        value={searchMode ? activeSearch.category_id ?? "" : form.category_id}
                        onChange={(e) => (searchMode ? setSearchField("category_id", e.target.value) : setF("category_id", e.target.value))}
                        style={requiredFieldStyle(searchMode, form.category_id)}
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
                        value={searchMode ? activeSearch.qualified_class ?? "" : form.qualified_class}
                        onChange={(e) => (searchMode ? setSearchField("qualified_class", e.target.value) : setF("qualified_class", e.target.value))}
                        style={requiredFieldStyle(searchMode, form.qualified_class)}
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
                        const numberDisabled = !searchMode && (form.qualified_class === "無" || form.qualified_class === "非課税");
                        const qualifiedNumberValue = searchMode ? activeSearch.qualified_number ?? "" : form.qualified_number;
                        const tValid = /^T\d{13}$/.test(qualifiedNumberValue.trim());
                        // 有なのに T+13桁 が拾えていなければ ✖ + 薄赤背景で知らせる
                        const showInvalid = !numberDisabled && form.qualified_class === "有" && !tValid;
                        return (
                          <div style={{ position: "relative" }}>
                            <input
                              type="text"
                              value={qualifiedNumberValue}
                              onChange={(e) => (searchMode ? setSearchField("qualified_number", e.target.value) : setF("qualified_number", e.target.value))}
                              onBlur={(e) => {
                                if (!searchMode) setF("qualified_number", normalizeQualifiedNumberInput(e.target.value));
                              }}
                              disabled={numberDisabled}
                              style={{
                                ...input,
                                paddingRight: 32,
                                ...(numberDisabled ? { background: "var(--bg-paper)", color: "var(--text-muted)" } : {}),
                                ...(showInvalid ? { background: "rgba(179,88,80,0.12)", border: "1px solid rgba(179,88,80,0.45)" } : {}),
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
                        <input
                          type="text"
                          value={searchMode ? activeSearch.store_name ?? "" : form.store_name}
                          onChange={(e) => (searchMode ? setSearchField("store_name", e.target.value) : setF("store_name", e.target.value))}
                          placeholder={searchMode ? "部分一致・==完全一致・!除外" : undefined}
                          style={requiredFieldStyle(searchMode, form.store_name)}
                        />
                      </Field>
                    </div>
                    <Field label="金額">
                      {/* 表示はコンマ付き右揃え・編集中は素の数字・保存はコンマ無し（type=text なのでスピナー矢印も出ない） */}
                      <input
                        type="text"
                        inputMode={searchMode ? "text" : "numeric"}
                        value={searchMode ? activeSearch.amount ?? "" : amountFocused ? form.amount : formatAmountDisplay(form.amount)}
                        onFocus={() => {
                          if (!searchMode) setAmountFocused(true);
                        }}
                        onChange={(e) => (searchMode ? setSearchField("amount", e.target.value) : setF("amount", e.target.value))}
                        onBlur={(e) => {
                          if (searchMode) return;
                          setAmountFocused(false);
                          setF("amount", normalizeAmountInput(e.target.value));
                        }}
                        placeholder={searchMode ? ">5000" : undefined}
                        style={{ ...requiredAmountStyle(searchMode, form.amount), textAlign: "right" }}
                      />
                    </Field>
                  </div>

                  <Field label="摘要">
                    <input
                      type="text"
                      value={searchMode ? activeSearch.description ?? "" : form.description}
                      onChange={(e) => (searchMode ? setSearchField("description", e.target.value) : setF("description", e.target.value))}
                      placeholder={searchMode ? "部分一致・*ワイルドカード" : undefined}
                      style={input}
                    />
                  </Field>
                </div>
                <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
                  <button type="button" disabled={busy || searchMode} onClick={() => process("reject")} style={busy || searchMode ? disabledRejectBtn : rejectBtn}>
                    差戻し
                  </button>
                  <button type="button" disabled={busy || searchMode} onClick={() => process("approve")} style={busy || searchMode ? disabledApproveBtn : approveBtn}>
                    {busy ? "処理中…" : "承認 → 完了待ちへ"}
                  </button>
                </div>
              </div>

              <div style={{ ...panel, display: "flex", flexDirection: "column", order: cardsReversed ? 1 : 2 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  {imgUrl && (
                    <div style={receiptToolGroup}>
                      <button type="button" onClick={() => setReceiptInlineScale((value) => Math.max(1, value - 0.2))} style={rotateImgBtn}>
                        縮小
                      </button>
                      <button type="button" onClick={() => setReceiptInlineScale((value) => Math.min(2.4, value + 0.2))} style={rotateImgBtn}>
                        ズーム
                      </button>
                    </div>
                  )}
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
                  <div ref={recBoxRef} style={{ flex: 1, minHeight: 280, overflow: "auto", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={imgUrl}
                      alt="領収書"
                      onLoad={(e) => setNatSize({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })}
                      onClick={() => {
                        setReceiptZoomScale(1.6);
                        setReceiptZoomOpen(true);
                      }}
                      style={{
                        ...receiptImgSize(rotation, recBox, natSize),
                        borderRadius: 10,
                        border: "1px solid #e2ddcf",
                        cursor: "zoom-in",
                        transform: `rotate(${rotation}deg) scale(${receiptInlineScale})`,
                        transformOrigin: "center center",
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
          corps={sortedCorps}
          employees={employees}
          onPendingClick={jumpToPending}
          onProcessedClick={openDetail}
        />
      )}

      {receiptZoomOpen && imgUrl && (
        <div style={zoomBackdrop} role="dialog" aria-modal="true" aria-label="領収書拡大表示">
          <div style={zoomHead}>
            <strong>領収書ズーム</strong>
            <div style={zoomTools}>
              <button type="button" style={zoomBtn} onClick={() => setReceiptZoomScale((value) => Math.max(0.8, value - 0.25))}>
                −
              </button>
              <span style={zoomScaleText}>{Math.round(receiptZoomScale * 100)}%</span>
              <button type="button" style={zoomBtn} onClick={() => setReceiptZoomScale((value) => Math.min(4, value + 0.25))}>
                +
              </button>
              <button type="button" style={zoomBtn} onClick={() => setReceiptZoomScale(1.6)}>
                等倍
              </button>
              <button type="button" style={zoomCloseBtn} onClick={() => setReceiptZoomOpen(false)} aria-label="閉じる">
                ×
              </button>
            </div>
          </div>
          <div
            style={zoomCanvas}
            onWheel={(event) => {
              event.preventDefault();
              const delta = event.deltaY > 0 ? -0.18 : 0.18;
              setReceiptZoomScale((value) => Math.max(0.8, Math.min(4, value + delta)));
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imgUrl}
              alt="領収書拡大"
              style={{
                maxWidth: "none",
                width: `${receiptZoomScale * 100}%`,
                transform: `rotate(${rotation}deg)`,
                transformOrigin: "center center",
              }}
            />
          </div>
        </div>
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

      {listTabHost &&
        createPortal(
          <ExpenseListTab rows={statusRows} cats={cats} corps={sortedCorps} employees={employees} onPendingClick={jumpToPending} onProcessedClick={openDetail} />,
          listTabHost,
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

function ExpenseListTab({
  rows,
  cats,
  corps,
  employees,
  onPendingClick,
  onProcessedClick,
}: {
  rows: StatusRow[];
  cats: Cat[];
  corps: Corp[];
  employees: Record<string, Employee>;
  onPendingClick: (row: Req) => void;
  onProcessedClick: (row: Req) => void;
}) {
  return (
    <section style={{ ...statusPanel, marginTop: 0 }}>
      <div style={statusHead}>
        <h3 style={statusTitle}>経費一覧</h3>
        <span style={statusMeta}>承認待ちと本日処理分</span>
      </div>
      <StatusList rows={rows} cats={cats} corps={corps} employees={employees} onPendingClick={onPendingClick} onProcessedClick={onProcessedClick} compact />
    </section>
  );
}

function StatusList({
  rows,
  cats,
  corps,
  employees,
  onPendingClick,
  onProcessedClick,
  compact = false,
}: {
  rows: StatusRow[];
  cats: Cat[];
  corps: Corp[];
  employees: Record<string, Employee>;
  onPendingClick: (row: Req) => void;
  onProcessedClick: (row: Req) => void;
  compact?: boolean;
}) {
  return (
    <section style={compact ? { margin: 0 } : statusPanel} data-exp-status-react="true">
      {compact ? null : (
      <div style={statusHead}>
        <h3 style={statusTitle}>承認状況一覧</h3>
        <span style={statusMeta}>承認待ち残件 + 本日処理分</span>
      </div>
      )}
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
                <th style={th}>店名</th>
                <th style={{ ...th, textAlign: "right" }}>金額</th>
                <th style={th}>状態</th>
                <th style={th}>法人</th>
                <th style={th}>区分</th>
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
                  <td style={td}>{expenseKindLabel(row.expense_kind) || categoryLabel(row.category_id, cats)}</td>
                  <td style={td}>{row.store_name ?? "-"}</td>
                  <td style={{ ...td, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{yen(row.amount ?? 0)}</td>
                  <td style={td}>
                    <span style={statusPill(row.status)}>{statusLabel(row.status)}</span>
                  </td>
                  <td style={td}>{corpLabel(row.corp_id, corps)}</td>
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
            <Row label="摘要">{displayDescription(row.description) || "—"}</Row>
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

// 「承認待ち 9件 合計 ¥12,868」をコンパクト表示。件数・金額は固定列で右揃え＝
// 桁が増えても位置が動かない（最大「1000件 合計 ¥5,000,000」を基準に列幅を確保）
function CompactCard({ label, count, amount, color }: { label: string; count: number; amount: number; color: string }) {
  return (
    <div style={{ ...compactCard, borderLeft: `3px solid ${color}` }}>
      {/* 完了待ちタブ（経理差戻し行あり）とカード高さを揃えるため、上に同じ高さの余白を確保し主要部は下寄せ */}
      <div style={compactCardSub} />
      <div style={compactCardMain}>
        <span style={{ color: "var(--text-sub)", overflow: "hidden", textOverflow: "ellipsis" }}>{label}</span>
        <strong style={{ fontSize: 16, color, fontVariantNumeric: "tabular-nums", textAlign: "right" }}>{count}件</strong>
        {/* 「合計」は左固定・金額は右固定（桁が増えても両方位置が動かない） */}
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
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ display: "block", fontSize: 12, color: "var(--text-sub)", marginBottom: 4 }}>{label}</label>
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
      <div style={{ fontSize: 12, color: emphasis === "danger" ? "var(--text-warning)" : "var(--text-sub)", marginBottom: 4 }}>{label}</div>
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

// 領収書画像を枠いっぱい(contain)に表示する寸法を計算。回転90/270でも枠を最大利用するよう
// 回転後の縦横を考慮して拡大率を求める（元画像が小さくても拡大して埋める）
function receiptImgSize(
  rotation: number,
  box: { w: number; h: number },
  nat: { w: number; h: number },
): React.CSSProperties {
  if (!box.w || !box.h || !nat.w || !nat.h) return { maxWidth: "100%", maxHeight: "100%" };
  const rotated = rotation % 180 !== 0;
  // 回転後に枠へ収まる拡大率（rotated 時は枠の縦横を入れ替えて判定）
  const scale = rotated
    ? Math.min(box.w / nat.h, box.h / nat.w)
    : Math.min(box.w / nat.w, box.h / nat.h);
  return { width: Math.round(nat.w * scale), height: Math.round(nat.h * scale) };
}

function employeeLabel(row: Req, employees: Record<string, Employee>) {
  if (!row.applicant_employee_id) return "—";
  return employees[row.applicant_employee_id]?.name ?? row.applicant_employee_id;
}

function categoryLabel(categoryId: string | null, cats: Cat[]) {
  if (!categoryId) return "未設定";
  return cats.find((cat) => cat.id === categoryId)?.name ?? categoryId;
}

function expenseKindLabel(value: string | null) {
  if (value === "company") return "会社経費";
  if (value === "personal") return "個人経費";
  return value ?? "";
}

function corpLabel(corpId: string | null, corps: Corp[]) {
  if (!corpId) return "-";
  return corps.find((corp) => corp.id === corpId)?.name_short ?? corpId;
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
  background: "var(--bg-paper-soft)",
  border: "1px solid rgba(179,137,46,0.18)",
  borderRadius: 12,
  padding: 24,
  textAlign: "center",
  color: "var(--text-sub)",
  margin: "12px 0",
};
const reviewShell: React.CSSProperties = { display: "flex", gap: 12, alignItems: "stretch", marginBottom: 18 };
// コンパクト3カード＋横並びレコード送りの1行
const summaryNavBar: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  flexWrap: "wrap",
  marginBottom: 16,
};
const compactCard: React.CSSProperties = {
  // 3カードを同じ幅に固定。完了待ちタブとカード高さを揃えるため flex column 構成。
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
// 完了待ちタブの「経理差戻し」行と同じ高さ。承認待ちでは中身なしの余白として高さを揃える
const compactCardSub: React.CSSProperties = { height: 16, lineHeight: "16px", fontSize: 11 };
// ラベル/件数/金額を固定列にして桁が増えても位置が動かない（最大「1000件 合計 ¥5,000,000」基準）
const compactCardMain: React.CSSProperties = { marginTop: "auto", display: "grid", gridTemplateColumns: "96px 58px 1fr", alignItems: "baseline", gap: 8 };
const navWrap: React.CSSProperties = { marginLeft: "auto", height: 61, display: "flex", flexDirection: "column", justifyContent: "space-between", alignItems: "stretch", gap: 4 };
const navButtonRow: React.CSSProperties = { display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 6, height: 34 };
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
// ◀/▶ を丸で囲んだ方向アイコン（→と↓の矢印重複を避けて視認性を上げる）
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
// alignItems: stretch で申請情報カードと領収書カードの高さを揃える（高い方に合わせる）
const twoCol: React.CSSProperties = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, alignItems: "stretch", marginBottom: 0 };
const panel: React.CSSProperties = { background: "var(--bg-paper-soft)", border: "1px solid rgba(179,137,46,0.18)", borderRadius: 12, padding: "18px 20px" };
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
  color: emphasis === "danger" ? "#b35850" : "var(--text-main)",
  fontWeight: emphasis === "danger" ? 700 : 500,
  border: emphasis === "danger" ? "1px solid rgba(179,88,80,0.35)" : "1px solid rgba(179,137,46,0.16)",
  background: emphasis === "danger" ? "rgba(179,88,80,0.08)" : "var(--bg-card)",
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
  color: "var(--text-warning)",
  fontSize: 12,
  fontWeight: 700,
};
const input: React.CSSProperties = {
  width: "100%",
  padding: "8px 10px",
  borderRadius: 6,
  border: "1px solid rgba(179,137,46,0.3)",
  fontSize: 14,
  background: "var(--bg-card-solid)",
  color: "var(--text-main)",
};
const missingRequiredInput: React.CSSProperties = {
  background: "#b35850",
  border: "1px solid rgba(179,88,80,0.72)",
  color: "#fff",
  fontWeight: 700,
};
function requiredFieldStyle(searchMode: boolean, value: string): React.CSSProperties {
  return searchMode || value.trim() ? input : { ...input, ...missingRequiredInput };
}
function requiredAmountStyle(searchMode: boolean, value: string): React.CSSProperties {
  return searchMode || normalizeAmountInput(value) ? input : { ...input, ...missingRequiredInput };
}
const ocrBadgeBox: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  width: "100%",
  padding: "8px 10px",
  lineHeight: "22px",
  borderRadius: 6,
  background: "rgba(179,88,80,0.14)",
  border: "1px solid rgba(179,88,80,0.34)",
  color: "#b35850",
  fontSize: 12,
  fontWeight: 700,
  whiteSpace: "nowrap",
};
const badgeStack: React.CSSProperties = {
  display: "grid",
  gap: 6,
  alignSelf: "end",
};
const corpChangeBadgeBox: React.CSSProperties = {
  ...ocrBadgeBox,
  background: "rgba(212,165,65,0.16)",
  border: "1px solid rgba(179,137,46,0.36)",
  color: "#8a661f",
  justifyContent: "flex-start",
  overflow: "hidden",
  textOverflow: "ellipsis",
};
const layoutToolRow: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 10,
  marginBottom: 8,
};
const sortControlGroup: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  flexWrap: "wrap",
};
const sortSelect: React.CSSProperties = {
  ...input,
  width: 136,
  padding: "6px 10px",
  fontSize: 12,
};
const layoutToggleBtn: React.CSSProperties = {
  border: "1px solid rgba(179,137,46,0.28)",
  borderRadius: 999,
  background: "var(--bg-card-solid)",
  color: "#b3892e",
  cursor: "pointer",
  fontSize: 12,
  fontWeight: 700,
  padding: "6px 12px",
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
const disabledApproveBtn: React.CSSProperties = { ...approveBtn, opacity: 0.45, cursor: "not-allowed" };
const rejectBtn: React.CSSProperties = {
  flex: 1,
  padding: 13,
  borderRadius: 10,
  border: "1px solid #b35850",
  background: "var(--bg-card-solid)",
  color: "#b35850",
  fontSize: 15,
  fontWeight: 700,
  cursor: "pointer",
};
const disabledRejectBtn: React.CSSProperties = { ...rejectBtn, opacity: 0.45, cursor: "not-allowed" };
const searchBanner: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 12,
  padding: "10px 14px",
  marginBottom: 10,
  borderRadius: 8,
  border: "1px solid rgba(179,137,46,0.28)",
  background: "rgba(212,165,65,0.18)",
  color: "var(--text-main)",
  fontSize: 13,
};
const searchSheetBar: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 6,
  flexWrap: "wrap",
  marginBottom: 12,
};
const searchSheetTab = (active: boolean, omit: boolean): React.CSSProperties => ({
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  minHeight: 30,
  padding: "5px 10px",
  borderRadius: 8,
  border: active ? "1px solid #b3892e" : "1px solid rgba(179,137,46,0.22)",
  background: omit ? (active ? "rgba(179,88,80,0.18)" : "rgba(179,88,80,0.08)") : active ? "rgba(212,165,65,0.18)" : "var(--bg-card-solid)",
  color: omit ? "#b35850" : "var(--text-sub)",
  fontSize: 13,
  fontWeight: active ? 700 : 500,
  cursor: "pointer",
});
const searchSheetClose: React.CSSProperties = { color: "var(--text-muted)", fontWeight: 700, paddingLeft: 4 };
const searchSheetAdd: React.CSSProperties = {
  width: 30,
  height: 30,
  borderRadius: 8,
  border: "1px solid rgba(179,137,46,0.25)",
  background: "var(--bg-card-solid)",
  color: "#b3892e",
  fontWeight: 700,
  cursor: "pointer",
};
const searchModeToggle: React.CSSProperties = {
  display: "inline-flex",
  padding: 3,
  borderRadius: 999,
  border: "1px solid rgba(179,137,46,0.22)",
  background: "var(--bg-card-solid)",
  marginLeft: 6,
};
const searchModeBtn = (active: boolean): React.CSSProperties => ({
  padding: "5px 12px",
  borderRadius: 999,
  border: "none",
  background: active ? "#d4a541" : "transparent",
  color: active ? "#fff" : "var(--text-sub)",
  fontSize: 12,
  fontWeight: 700,
  cursor: "pointer",
});
const foundBar: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 12,
  flexWrap: "wrap",
  padding: "9px 12px",
  marginBottom: 12,
  borderRadius: 8,
  border: "1px solid rgba(179,137,46,0.26)",
  background: "var(--bg-card-solid)",
  color: "var(--text-main)",
  fontSize: 13,
};
const foundSummaryText: React.CSSProperties = { flex: 1, minWidth: 160, color: "var(--text-sub)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" };
const foundClearBtn: React.CSSProperties = {
  border: "1px solid rgba(179,137,46,0.24)",
  background: "var(--bg-card-solid)",
  color: "var(--text-sub)",
  borderRadius: 999,
  padding: "5px 10px",
  cursor: "pointer",
  fontSize: 12,
};
const corpSwitch: React.CSSProperties = {
  display: "flex",
  gap: 4,
  marginBottom: 18,
  padding: 6,
  background: "var(--bg-card)",
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
  color: active ? "#fff" : "var(--text-sub)",
  boxShadow: active ? "0 2px 8px rgba(212,165,65,0.3)" : "none",
  cursor: "pointer",
  fontSize: 13,
});
const statusPanel: React.CSSProperties = {
  background: "var(--bg-paper-soft)",
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
const statusTitle: React.CSSProperties = { fontSize: 16, color: "var(--text-main)", margin: 0, fontWeight: 600 };
const statusMeta: React.CSSProperties = { fontSize: 12, color: "var(--text-muted)" };
const statusTable: React.CSSProperties = { width: "100%", borderCollapse: "collapse", fontSize: 13 };
const th: React.CSSProperties = {
  textAlign: "left",
  color: "var(--text-sub)",
  fontWeight: 500,
  padding: "9px 8px",
  borderBottom: "1px solid rgba(180,165,130,0.25)",
};
const td: React.CSSProperties = { padding: "10px 8px", borderBottom: "1px dashed rgba(180,165,130,0.18)", color: "var(--text-main)" };
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
const zoomBackdrop: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: 1100,
  background: "rgba(24,20,14,0.78)",
  display: "flex",
  flexDirection: "column",
  padding: 18,
};
const zoomHead: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
  color: "#fff",
  marginBottom: 12,
};
const zoomTools: React.CSSProperties = { display: "flex", alignItems: "center", gap: 8 };
const zoomBtn: React.CSSProperties = {
  border: "1px solid rgba(255,255,255,0.28)",
  borderRadius: 8,
  background: "rgba(255,253,245,0.12)",
  color: "#fff",
  cursor: "pointer",
  minWidth: 34,
  padding: "7px 10px",
};
const zoomCloseBtn: React.CSSProperties = {
  ...zoomBtn,
  borderRadius: 999,
  fontSize: 18,
  lineHeight: 1,
};
const zoomScaleText: React.CSSProperties = { minWidth: 52, textAlign: "center", fontVariantNumeric: "tabular-nums" };
const zoomCanvas: React.CSSProperties = {
  flex: 1,
  overflow: "auto",
  borderRadius: 12,
  background: "rgba(255,253,245,0.92)",
  border: "1px solid rgba(255,255,255,0.18)",
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "center",
  padding: 24,
};
const receiptToolGroup: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 6,
  flexWrap: "wrap",
};
const rotateImgBtn: React.CSSProperties = {
  padding: "6px 14px",
  borderRadius: 8,
  border: "1px solid rgba(179,137,46,0.35)",
  background: "var(--bg-card-solid)",
  color: "#b3892e",
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer",
  flexShrink: 0,
  marginLeft: 10,
};
