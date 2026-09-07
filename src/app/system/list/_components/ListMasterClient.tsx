"use client";

import { useEffect, useMemo, useState } from "react";

import {
  DEFAULT_EXPORT_LIMIT,
  EMPTY_OPTION_VALUE,
  SOIL_LIST_EXPORT_COLUMNS,
  SOIL_LIST_FILTER_DEFINITIONS,
  SOIL_LIST_SORT_OPTIONS,
  type SoilListColumnKey,
  type SoilListConditionPayload,
  type SoilListFilter,
  type SoilListOptionFieldKey,
  type SoilListOptionsPayload,
  type SoilListSortKey,
} from "../_lib/list-fields";

import styles from "./list-master.module.css";

type SearchRow = {
  phoneNumber: string;
  name: string;
  addressCity: string;
  listName: string;
  lastCalledOn: string;
  callCount: number | null;
  purchaseStatus: string;
};

type SavedCondition = {
  id: string;
  name: string;
  condition: SoilListConditionPayload;
  created_by: string | null;
  updated_at: string;
};

type ExportHistory = {
  id: string;
  row_count: number;
  replaced_chars: number;
  file_name: string;
  created_by: string | null;
  created_at: string;
};

type FilterState = {
  prefecture: string;
  auCallAvailability: string;
  purchaseStatus: string;
  appointmentBlocked: string;
  listName: string;
  listLoadedOnFrom: string;
  listLoadedOnTo: string;
  recheckedOnFrom: string;
  recheckedOnTo: string;
  lastCalledOnFrom: string;
  lastCalledOnTo: string;
  callCountFrom: string;
  callCountTo: string;
  purchaseHistory: string;
};

const initialFilters: FilterState = {
  prefecture: "",
  auCallAvailability: "○",
  purchaseStatus: "",
  appointmentBlocked: EMPTY_OPTION_VALUE,
  listName: "",
  listLoadedOnFrom: "",
  listLoadedOnTo: "",
  recheckedOnFrom: "",
  recheckedOnTo: "",
  lastCalledOnFrom: "",
  lastCalledOnTo: "",
  callCountFrom: "",
  callCountTo: "",
  purchaseHistory: "",
};

function filtersToCondition(filters: FilterState): SoilListConditionPayload {
  const result: SoilListFilter[] = [];
  const pushSelect = (field: SoilListOptionFieldKey, value: string) => {
    if (value === EMPTY_OPTION_VALUE) result.push({ field, op: "empty" });
    else if (value) result.push({ field, op: "eq", value });
  };
  pushSelect("prefecture", filters.prefecture);
  pushSelect("auCallAvailability", filters.auCallAvailability);
  pushSelect("purchaseStatus", filters.purchaseStatus);
  pushSelect("appointmentBlocked", filters.appointmentBlocked);
  if (filters.listName) result.push({ field: "listName", op: "contains", value: filters.listName });
  if (filters.listLoadedOnFrom) result.push({ field: "listLoadedOn", op: "gte", value: filters.listLoadedOnFrom });
  if (filters.listLoadedOnTo) result.push({ field: "listLoadedOn", op: "lte", value: filters.listLoadedOnTo });
  if (filters.recheckedOnFrom) result.push({ field: "recheckedOn", op: "gte", value: filters.recheckedOnFrom });
  if (filters.recheckedOnTo) result.push({ field: "recheckedOn", op: "lte", value: filters.recheckedOnTo });
  if (filters.lastCalledOnFrom) result.push({ field: "lastCalledOn", op: "gte", value: filters.lastCalledOnFrom });
  if (filters.lastCalledOnTo) result.push({ field: "lastCalledOn", op: "lte", value: filters.lastCalledOnTo });
  if (filters.callCountFrom) result.push({ field: "callCount", op: "gte", value: Number(filters.callCountFrom) });
  if (filters.callCountTo) result.push({ field: "callCount", op: "lte", value: Number(filters.callCountTo) });
  if (filters.purchaseHistory === "あり") result.push({ field: "purchaseHistoryExists", op: "eq", value: true });
  if (filters.purchaseHistory === "なし") result.push({ field: "purchaseHistoryExists", op: "eq", value: false });
  return { filters: result };
}

function conditionToFilters(condition: SoilListConditionPayload): FilterState {
  const next = { ...initialFilters, listLoadedOnFrom: "" };
  for (const filter of condition.filters ?? []) {
    if (filter.field === "prefecture" && filter.op === "eq") next.prefecture = String(filter.value);
    if (filter.field === "prefecture" && filter.op === "empty") next.prefecture = EMPTY_OPTION_VALUE;
    if (filter.field === "auCallAvailability" && filter.op === "eq") next.auCallAvailability = String(filter.value);
    if (filter.field === "auCallAvailability" && filter.op === "empty") next.auCallAvailability = EMPTY_OPTION_VALUE;
    if (filter.field === "purchaseStatus" && filter.op === "eq") next.purchaseStatus = String(filter.value);
    if (filter.field === "purchaseStatus" && filter.op === "empty") next.purchaseStatus = EMPTY_OPTION_VALUE;
    if (filter.field === "appointmentBlocked" && filter.op === "eq") next.appointmentBlocked = String(filter.value);
    if (filter.field === "appointmentBlocked" && filter.op === "empty") next.appointmentBlocked = EMPTY_OPTION_VALUE;
    if (filter.field === "listName" && filter.op === "contains") next.listName = String(filter.value);
    if (filter.field === "listLoadedOn" && filter.op === "gte") next.listLoadedOnFrom = String(filter.value);
    if (filter.field === "listLoadedOn" && filter.op === "lte") next.listLoadedOnTo = String(filter.value);
    if (filter.field === "recheckedOn" && filter.op === "gte") next.recheckedOnFrom = String(filter.value);
    if (filter.field === "recheckedOn" && filter.op === "lte") next.recheckedOnTo = String(filter.value);
    if (filter.field === "lastCalledOn" && filter.op === "gte") next.lastCalledOnFrom = String(filter.value);
    if (filter.field === "lastCalledOn" && filter.op === "lte") next.lastCalledOnTo = String(filter.value);
    if (filter.field === "callCount" && filter.op === "gte") next.callCountFrom = String(filter.value);
    if (filter.field === "callCount" && filter.op === "lte") next.callCountTo = String(filter.value);
    if (filter.field === "purchaseHistoryExists" && filter.op === "eq") {
      next.purchaseHistory = filter.value === true ? "あり" : "なし";
    }
  }
  return next;
}

function formatDateTime(value: string): string {
  if (!value) return "";
  return new Intl.DateTimeFormat("ja-JP", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

async function readJson<T>(response: Response): Promise<T> {
  const data = (await response.json()) as T & { error?: string };
  if (!response.ok) throw new Error(data.error ?? "処理できませんでした");
  return data;
}

export function ListMasterClient() {
  const [filters, setFilters] = useState<FilterState>(initialFilters);
  const [count, setCount] = useState<number | null>(null);
  const [approximate, setApproximate] = useState(false);
  const [elapsedMs, setElapsedMs] = useState<number | null>(null);
  const [rows, setRows] = useState<SearchRow[]>([]);
  const [savedConditions, setSavedConditions] = useState<SavedCondition[]>([]);
  const [exports, setExports] = useState<ExportHistory[]>([]);
  const [options, setOptions] = useState<Partial<SoilListOptionsPayload>>({});
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [conditionName, setConditionName] = useState("AU光○ アポ禁なし");
  const [selectedColumns, setSelectedColumns] = useState<SoilListColumnKey[]>(
    SOIL_LIST_EXPORT_COLUMNS.filter((column) => column.defaultChecked).map((column) => column.key),
  );
  const [limit, setLimit] = useState(DEFAULT_EXPORT_LIMIT);
  const [sortKey, setSortKey] = useState<SoilListSortKey>("listLoadedOnAsc");
  const condition = useMemo(() => filtersToCondition(filters), [filters]);

  async function loadSaved() {
    const [conditionsRes, exportsRes] = await Promise.all([
      fetch("/api/soil/list/conditions"),
      fetch("/api/soil/list/exports"),
    ]);
    const conditionsData = await readJson<{ ok: boolean; conditions: SavedCondition[] }>(conditionsRes);
    const exportsData = await readJson<{ ok: boolean; exports: ExportHistory[] }>(exportsRes);
    setSavedConditions(conditionsData.conditions);
    setExports(exportsData.exports);
  }

  async function loadOptions() {
    const response = await fetch("/api/soil/list/options");
    const data = await readJson<{ ok: boolean; options: SoilListOptionsPayload }>(response);
    setOptions(data.options);
  }

  useEffect(() => {
    Promise.all([loadSaved(), loadOptions()]).catch((error: unknown) =>
      setMessage(error instanceof Error ? error.message : "取得できませんでした"),
    );
  }, []);

  async function handleCountAndSearch() {
    setBusy(true);
    setMessage("");
    try {
      const countResponse = await fetch("/api/soil/list/count", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ condition }),
      });
      const countData = await readJson<{ count: number; approximate: boolean; elapsedMs: number }>(countResponse);
      setCount(countData.count);
      setApproximate(countData.approximate);
      setElapsedMs(countData.elapsedMs);

      const searchResponse = await fetch("/api/soil/list/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ condition }),
      });
      const searchData = await readJson<{ rows: SearchRow[] }>(searchResponse);
      setRows(searchData.rows);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "取得できませんでした");
    } finally {
      setBusy(false);
    }
  }

  async function handleSaveCondition() {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/soil/list/conditions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: conditionName, condition }),
      });
      await readJson(response);
      await loadSaved();
      setMessage("条件を保存しました");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "保存できませんでした");
    } finally {
      setBusy(false);
    }
  }

  async function handleDeleteCondition(id: string) {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch(`/api/soil/list/conditions?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      await readJson(response);
      await loadSaved();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "削除できませんでした");
    } finally {
      setBusy(false);
    }
  }

  async function downloadMer(body: Record<string, unknown>) {
    const response = await fetch("/api/soil/list/export", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      const data = (await response.json()) as { error?: string };
      throw new Error(data.error ?? "書き出しできませんでした");
    }
    const blob = await response.blob();
    const disposition = response.headers.get("Content-Disposition") ?? "";
    const utf8Match = /filename\*=UTF-8''([^;]+)/.exec(disposition);
    const asciiMatch = /filename="([^"]+)"/.exec(disposition);
    const fileName = utf8Match ? decodeURIComponent(utf8Match[1]) : (asciiMatch?.[1] ?? "soil-list.mer");
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = fileName;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async function handleExport() {
    setBusy(true);
    setMessage("");
    try {
      await downloadMer({ condition, columns: selectedColumns, limit, sortKey });
      await loadSaved();
      setMessage("書き出しました");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "書き出しできませんでした");
    } finally {
      setBusy(false);
    }
  }

  async function handleRedownload(id: string) {
    setBusy(true);
    setMessage("");
    try {
      await downloadMer({ exportId: id });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "再ダウンロードできませんでした");
    } finally {
      setBusy(false);
    }
  }

  function setFilter<K extends keyof FilterState>(key: K, value: FilterState[K]) {
    setFilters((current) => ({ ...current, [key]: value }));
  }

  function renderOptions(field: SoilListOptionFieldKey) {
    const dynamicOptions = options[field] ?? [];
    return (
      <>
        <option value="">指定なし</option>
        {dynamicOptions.map((option) => (
          <option key={`${field}-${option.empty ? EMPTY_OPTION_VALUE : option.value}`} value={option.empty ? EMPTY_OPTION_VALUE : option.value}>
            {option.label}（{option.count.toLocaleString("ja-JP")}）
          </option>
        ))}
      </>
    );
  }

  return (
    <div className={styles.pageShell}>
      <div className={styles.header}>
        <p className={styles.eyebrow}>System / リストマスタ</p>
        <h1>リストマスタ</h1>
        <p className={styles.lead}>営業リストを条件で絞って件数を見て、.mer に書き出します。</p>
      </div>

      <section className={styles.panel} aria-labelledby="filter-heading">
        <div className={styles.panelTitle}>
          <h2 id="filter-heading">絞り込み</h2>
          <span>{SOIL_LIST_FILTER_DEFINITIONS.length} 項目</span>
        </div>
        <div className={styles.filterGrid}>
          <label>
            都道府県
            <select value={filters.prefecture} onChange={(event) => setFilter("prefecture", event.target.value)}>
              {renderOptions("prefecture")}
            </select>
          </label>
          <label>
            AU光架電可否
            <select
              value={filters.auCallAvailability}
              onChange={(event) => setFilter("auCallAvailability", event.target.value)}
            >
              {renderOptions("auCallAvailability")}
            </select>
          </label>
          <label>
            購入状態
            <select value={filters.purchaseStatus} onChange={(event) => setFilter("purchaseStatus", event.target.value)}>
              {renderOptions("purchaseStatus")}
            </select>
          </label>
          <label>
            アポ禁
            <select
              value={filters.appointmentBlocked}
              onChange={(event) => setFilter("appointmentBlocked", event.target.value)}
            >
              {renderOptions("appointmentBlocked")}
            </select>
          </label>
          <label className={styles.wide}>
            リスト名
            <input value={filters.listName} onChange={(event) => setFilter("listName", event.target.value)} placeholder="含む" />
          </label>
          <label>
            リスト投入日
            <span className={styles.range}>
              <input type="date" value={filters.listLoadedOnFrom} onChange={(event) => setFilter("listLoadedOnFrom", event.target.value)} />
              <input type="date" value={filters.listLoadedOnTo} onChange={(event) => setFilter("listLoadedOnTo", event.target.value)} />
            </span>
          </label>
          <label>
            再判定日
            <span className={styles.range}>
              <input type="date" value={filters.recheckedOnFrom} onChange={(event) => setFilter("recheckedOnFrom", event.target.value)} />
              <input type="date" value={filters.recheckedOnTo} onChange={(event) => setFilter("recheckedOnTo", event.target.value)} />
            </span>
          </label>
          <label>
            最終コール日
            <span className={styles.range}>
              <input type="date" value={filters.lastCalledOnFrom} onChange={(event) => setFilter("lastCalledOnFrom", event.target.value)} />
              <input type="date" value={filters.lastCalledOnTo} onChange={(event) => setFilter("lastCalledOnTo", event.target.value)} />
            </span>
          </label>
          <label>
            コール回数
            <span className={styles.range}>
              <input type="number" min="0" value={filters.callCountFrom} onChange={(event) => setFilter("callCountFrom", event.target.value)} />
              <input type="number" min="0" value={filters.callCountTo} onChange={(event) => setFilter("callCountTo", event.target.value)} />
            </span>
          </label>
          <label>
            購入履歴
            <select value={filters.purchaseHistory} onChange={(event) => setFilter("purchaseHistory", event.target.value)}>
              {SOIL_LIST_FILTER_DEFINITIONS[9].options?.map((option) => (
                <option key={option} value={option}>
                  {option || "指定なし"}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className={styles.actions}>
          <button type="button" onClick={handleCountAndSearch} disabled={busy}>
            件数を見る
          </button>
          <input value={conditionName} onChange={(event) => setConditionName(event.target.value)} aria-label="保存する条件名" />
          <button type="button" onClick={handleSaveCondition} disabled={busy}>
            条件を保存
          </button>
        </div>
        {count !== null && (
          <p className={styles.result}>
            該当 {approximate ? "約 " : ""}
            {count.toLocaleString("ja-JP")} 件
            {elapsedMs !== null ? `（${(elapsedMs / 1000).toFixed(1)} 秒）` : ""}
          </p>
        )}
        {message && <p className={styles.message}>{message}</p>}
      </section>

      <section className={styles.panel} aria-labelledby="saved-heading">
        <h2 id="saved-heading">保存した条件</h2>
        <div className={styles.listStack}>
          {savedConditions.length === 0 && <p className={styles.empty}>保存した条件はありません</p>}
          {savedConditions.map((item) => (
            <div className={styles.savedRow} key={item.id}>
              <span>{item.name}</span>
              <small>
                {formatDateTime(item.updated_at)} {item.created_by ?? ""}
              </small>
              <button type="button" onClick={() => setFilters(conditionToFilters(item.condition))}>
                この条件で絞る
              </button>
              <button type="button" className={styles.secondaryButton} onClick={() => handleDeleteCondition(item.id)}>
                削除
              </button>
            </div>
          ))}
        </div>
      </section>

      <section className={styles.panel} aria-labelledby="table-heading">
        <h2 id="table-heading">一覧（先頭 100 件・個人情報は一部伏せる）</h2>
        <div className={styles.tableWrap}>
          <table>
            <thead>
              <tr>
                <th>電話番号</th>
                <th>氏名</th>
                <th>住所（市区町村まで）</th>
                <th>リスト名</th>
                <th>最終コール日</th>
                <th>コール回数</th>
                <th>購入状態</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={`${row.phoneNumber}-${index}`}>
                  <td>{row.phoneNumber}</td>
                  <td>{row.name}</td>
                  <td>{row.addressCity}</td>
                  <td>{row.listName}</td>
                  <td>{row.lastCalledOn}</td>
                  <td>{row.callCount ?? ""}</td>
                  <td>{row.purchaseStatus}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className={styles.panel} aria-labelledby="export-heading">
        <h2 id="export-heading">書き出し</h2>
        <div className={styles.columns}>
          {SOIL_LIST_EXPORT_COLUMNS.map((column) => (
            <label key={column.key}>
              <input
                type="checkbox"
                checked={selectedColumns.includes(column.key)}
                onChange={(event) =>
                  setSelectedColumns((current) =>
                    event.target.checked ? [...current, column.key] : current.filter((key) => key !== column.key),
                  )
                }
              />
              {column.label}
            </label>
          ))}
        </div>
        <div className={styles.actions}>
          <label>
            上限
            <input type="number" min="1" max="50000" value={limit} onChange={(event) => setLimit(Number(event.target.value))} />
          </label>
          <label>
            並び
            <select value={sortKey} onChange={(event) => setSortKey(event.target.value as SoilListSortKey)}>
              {SOIL_LIST_SORT_OPTIONS.map((option) => (
                <option key={option.key} value={option.key}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <button type="button" onClick={handleExport} disabled={busy}>
            .mer を書き出す
          </button>
        </div>
        <div className={styles.listStack}>
          {exports.map((item) => (
            <div className={styles.savedRow} key={item.id}>
              <span>
                {formatDateTime(item.created_at)} {item.created_by ?? ""} {item.row_count.toLocaleString("ja-JP")} 件
              </span>
              <small>置き換え {item.replaced_chars.toLocaleString("ja-JP")} 文字</small>
              <button type="button" onClick={() => handleRedownload(item.id)}>
                再ダウンロード
              </button>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
