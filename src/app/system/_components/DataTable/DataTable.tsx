"use client";
import StickyTable from "@/app/system/_components/StickyTable/useStickyTable";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import styles from "./DataTable.module.css";

type Value = string | number;
export type DataColumn<T> = {
  id: string; label: string; value: (row: T) => Value; type: "text" | "number" | "date";
  filterValue?: (row: T) => string; render?: (row: T) => ReactNode; right?: boolean; wrap?: boolean;
};
type Sort = { id: string; direction: "asc" | "desc" };
const normalize = (value: string) => value.normalize("NFKC").toLocaleLowerCase("ja-JP");
const filterKey = <T,>(column: DataColumn<T>, row: T) => column.filterValue?.(row) ?? String(column.value(row));
export default function DataTable<T>({ rows, columns, rowKey, searchText, summary, toolbar, defaultSort, pageSize = 100 }: {
  rows: T[]; columns: DataColumn<T>[]; rowKey: (row: T) => string;
  searchText: (row: T) => string; summary?: (rows: T[]) => ReactNode; toolbar?: ReactNode;
  defaultSort: Sort; pageSize?: number;
}) {
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<Record<string, string[]>>({});
  const [sort, setSort] = useState(defaultSort);
  const [page, setPage] = useState(1);
  const [menu, setMenu] = useState<string | null>(null);
  const [draft, setDraft] = useState<string[]>([]);
  const [menuSearch, setMenuSearch] = useState("");
  const [position, setPosition] = useState({ left: 8, top: 8 });
  const menuRef = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement | null>(null);
  const close = (restore = false) => { setMenu(null); if (restore) trigger.current?.focus(); };
  useEffect(() => {
    if (!menu) return;
    menuRef.current?.querySelector<HTMLInputElement>("input[type=search]")?.focus();
    const outside = (event: PointerEvent) => { if (!menuRef.current?.contains(event.target as Node) && !trigger.current?.contains(event.target as Node)) setMenu(null); };
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") { setMenu(null); trigger.current?.focus(); } };
    const dismiss = (event: Event) => { if (!(event.target instanceof Node) || !menuRef.current?.contains(event.target)) setMenu(null); };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    window.addEventListener("resize", dismiss);
    window.addEventListener("scroll", dismiss, true);
    return () => { document.removeEventListener("pointerdown", outside); document.removeEventListener("keydown", escape); window.removeEventListener("resize", dismiss); window.removeEventListener("scroll", dismiss, true); };
  }, [menu]);
  const filtered = useMemo(() => rows.filter(row => (!search || normalize(searchText(row)).includes(normalize(search))) && columns.every(column => !filters[column.id] || filters[column.id].includes(filterKey(column, row)))), [rows, columns, filters, search, searchText]);
  const sorted = useMemo(() => {
    const column = columns.find(column => column.id === sort.id);
    if (!column) return filtered;
    return [...filtered].sort((a, b) => {
      const av = column.value(a), bv = column.value(b);
      const difference = column.type === "number" ? Number(av) - Number(bv) : column.type === "date" ? Date.parse(String(av)) - Date.parse(String(bv)) : String(av).localeCompare(String(bv), "ja", { numeric: true });
      return difference * (sort.direction === "asc" ? 1 : -1);
    });
  }, [filtered, columns, sort]);
  const pages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const currentPage = Math.min(page, pages);
  const column = columns.find(column => column.id === menu);
  const options = column ? Array.from(rows.reduce((values, row) => { const key = filterKey(column, row); values.set(key, (values.get(key) ?? 0) + 1); return values; }, new Map<string, number>())).sort(([a], [b]) => a.localeCompare(b, "ja", { numeric: true })) : [];
  const visibleOptions = options.filter(([key]) => normalize(key).includes(normalize(menuSearch)));
  const apply = (values?: string[]) => {
    if (!column) return;
    setFilters(previous => { const next = { ...previous }; if (!values || options.every(([key]) => values.includes(key))) delete next[column.id]; else next[column.id] = values; return next; });
    setPage(1); close(true);
  };
  return <div className={styles.root}>
    <div className={styles.topRow}>{summary && <div className={styles.summary}>{summary(filtered)}</div>}
    <div className={[styles.toolbar, styles.controls].join(" ")}>{toolbar}<div className={`${styles.search} ${styles.searchBox}`}><small>検索</small><div className={styles.searchRow}><label className={styles.searchLabel}><span className={styles.searchField}><svg className={styles.searchIcon} viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4.5 4.5" /></svg><input className={styles.searchInput} type="search" aria-label="検索" placeholder="内容・金額" value={search} onChange={event => { setSearch(event.target.value); setPage(1); }} /></span></label><button type="button" className={styles.clear} disabled={!search && !Object.keys(filters).length} aria-label="絞り込みをすべて解除" title="絞り込みをすべて解除" onClick={() => { setSearch(""); setFilters({}); setPage(1); close(); }}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 4h18l-7 8.5V19l-4 2v-8.5Z" /><path d="m16 15 5 5M21 15l-5 5" /></svg></button></div></div></div></div>
    <div className={styles.tableWrap}><StickyTable><thead><tr>{columns.map(column => <th key={column.id} aria-sort={sort.id === column.id ? sort.direction === "asc" ? "ascending" : "descending" : "none"}><button type="button" aria-label={`${column.label}の並べ替え・絞り込み`} aria-haspopup="dialog" aria-expanded={menu === column.id} onClick={event => {
      if (menu === column.id) { close(); return; }
      trigger.current = event.currentTarget;
      const rect = event.currentTarget.getBoundingClientRect();
      setPosition({ left: Math.max(8, Math.min(rect.left, window.innerWidth - 328)), top: Math.max(8, Math.min(rect.bottom + 4, window.innerHeight - 440)) });
      setDraft(filters[column.id] ?? Array.from(new Set(rows.map(row => filterKey(column, row))))); setMenuSearch(""); setMenu(column.id);
    }}>{column.label}<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor"><path d="m4 6 4 4 4-4" /></svg>{filters[column.id] && <svg aria-label="絞り込み中" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor"><path d="M2 3h12L9 9v4l-2 1V9Z" /></svg>}</button><button type="button" className={[styles.sortButton, sort.id === column.id ? styles.sortActive : ""].join(" ")} aria-label={sort.id === column.id ? `${column.label}を${sort.direction === "asc" ? "降順" : "昇順"}に並べ替える（今は${sort.direction === "asc" ? "昇順" : "降順"}）` : `${column.label}で並べ替える`} title={sort.id === column.id ? (sort.direction === "asc" ? "昇順（押すと降順）" : "降順（押すと昇順）") : "並べ替え"} onClick={() => { setSort(sort.id === column.id ? { id: column.id, direction: sort.direction === "asc" ? "desc" : "asc" } : { id: column.id, direction: column.type === "text" ? "asc" : "desc" }); setPage(1); close(); }}><svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" aria-hidden="true"><path d={sort.id !== column.id ? "M5 2v12M2.5 4.5 5 2l2.5 2.5M11 14V2m-2.5 9.5L11 14l2.5-2.5" : sort.direction === "asc" ? "M8 14V2m-4 4 4-4 4 4" : "M8 2v12m-4-4 4 4 4-4"} /></svg></button></th>)}</tr></thead><tbody>{sorted.slice((currentPage - 1) * pageSize, currentPage * pageSize).map(row => <tr key={rowKey(row)}>{columns.map(column => <td key={column.id} className={[column.right ? styles.money : "", column.wrap ? styles.wrap : ""].join(" ")}>{column.render ? column.render(row) : column.value(row)}</td>)}</tr>)}</tbody></StickyTable>{!sorted.length && <p>該当する明細はありません。</p>}</div>
    <div className={styles.toolbar}><button type="button" disabled={currentPage <= 1} onClick={() => setPage(currentPage - 1)}>前へ</button><span>{currentPage} / {pages}</span><button type="button" disabled={currentPage >= pages} onClick={() => setPage(currentPage + 1)}>次へ</button></div>
    {column && <div ref={menuRef} role="dialog" aria-label={`${column.label}の並べ替え・絞り込み`} className={styles.menu} style={{ ...position, maxHeight: `calc(100dvh - ${position.top + 8}px)` }}>
      <div className={styles.sortRow}>{(["asc", "desc"] as const).map(direction => <button type="button" key={direction} aria-pressed={sort.id === column.id && sort.direction === direction} onClick={() => { setSort({ id: column.id, direction }); setPage(1); close(true); }}>{direction === "asc" ? "昇順" : "降順"}</button>)}</div>
      <input type="search" aria-label="値を検索" placeholder="値を検索" value={menuSearch} onChange={event => setMenuSearch(event.target.value)} />
      <label><input type="checkbox" checked={visibleOptions.length > 0 && visibleOptions.every(([key]) => draft.includes(key))} onChange={event => { const keys = visibleOptions.map(([key]) => key); setDraft(event.target.checked ? Array.from(new Set([...draft, ...keys])) : draft.filter(key => !keys.includes(key))); }} />すべて選択</label>
      <div className={styles.options}>{visibleOptions.map(([key, count]) => <label key={key}><input type="checkbox" checked={draft.includes(key)} onChange={event => setDraft(event.target.checked ? [...draft, key] : draft.filter(value => value !== key))} /><span>{key || "（空白）"} ({count})</span></label>)}</div>
      <div className={styles.actions}><button type="button" onClick={() => apply()}>解除</button><button type="button" className={styles.primary} onClick={() => apply(draft)}>OK</button></div>
    </div>}
  </div>;
}
