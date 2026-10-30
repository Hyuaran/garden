"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Modal from "@/app/system/_components/Modal/Modal";
import { CLARITY_MASK } from "@/app/_lib/clarity-mask";
import { matchRange, validSearch, type SearchGroup } from "@/lib/search/match";
import styles from "./GlobalSearch.module.css";

export function GlobalSearchButton({ className }: { className?: string }) {
  return <button type="button" className={className} title="Garden 全体を検索（Ctrl+K）" aria-label="Garden 全体を検索（Ctrl+K）" onClick={() => window.dispatchEvent(new Event("garden-search-open"))}><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m15.5 15.5 5 5"/></svg></button>;
}
function Highlight({ value, query, phone }: { value: string; query: string; phone?: boolean }) {
  const range = matchRange(value, query, phone);
  return range ? <>{value.slice(0, range[0])}<strong>{value.slice(...range)}</strong>{value.slice(range[1])}</> : <>{value}</>;
}
export default function GlobalSearch() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const show = () => setOpen(true);
    const key = (event: KeyboardEvent) => { if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") { event.preventDefault(); show(); } };
    window.addEventListener("garden-search-open", show); window.addEventListener("keydown", key);
    return () => { window.removeEventListener("garden-search-open", show); window.removeEventListener("keydown", key); };
  }, []);
  return open ? <SearchDialog onClose={() => setOpen(false)}/> : null;
}
export function SearchDialog({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [groups, setGroups] = useState<SearchGroup[]>([]);
  const [expanded, setExpanded] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [active, setActive] = useState(0);
  const selected = useRef<HTMLAnchorElement>(null);
  const expansion = expanded.join(",");
  useEffect(() => {
    setGroups([]); setActive(0); setError("");
    if (!validSearch(query)) { setLoading(false); return; }
    const controller = new AbortController();
    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const params = new URLSearchParams({ q: query, expanded: expansion });
        const response = await fetch(`/api/search?${params}`, { signal: controller.signal, cache: "no-store", referrerPolicy: "no-referrer" });
        if (!response.ok) throw new Error();
        const body = await response.json();
        if (!controller.signal.aborted) { setGroups(body.groups); setLoading(false); }
      } catch { if (!controller.signal.aborted) { setError("検索できませんでした。もう一度お試しください。"); setLoading(false); } }
    }, 250);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [query, expansion]);
  useEffect(() => { selected.current?.scrollIntoView?.({ block: "nearest" }); }, [active]);
  const hits = groups.flatMap(group => group.hits);
  const navigate = (href: string) => { window.dispatchEvent(new CustomEvent("garden-search-navigate", { detail: href })); onClose(); router.push(href); };
  let index = 0;
  return <Modal title="Garden 全体を検索" size="lg" className={styles.modal} onClose={onClose} actions={<small>↑↓ で選ぶ　Enter で開く　Esc で閉じる</small>}><div {...CLARITY_MASK} onKeyDown={event => {
    if (event.nativeEvent.isComposing) return;
    if (["ArrowDown", "ArrowUp"].includes(event.key) && hits.length) { event.preventDefault(); setActive(value => (value + (event.key === "ArrowDown" ? 1 : hits.length - 1)) % hits.length); }
    if (event.key === "Enter" && event.target instanceof HTMLInputElement && hits[active]) { event.preventDefault(); navigate(hits[active].href); }
  }}>
    <input className={styles.input} type="search" maxLength={200} aria-label="Garden 全体を検索（氏名・金額・番号・メモなど）" placeholder="Garden 全体を検索（氏名・金額・番号・メモなど）" value={query} onChange={event => { setQuery(event.target.value); setExpanded([]); }} aria-controls="garden-search-results" aria-activedescendant={hits[active] ? `garden-search-hit-${active}` : undefined}/>
    <div id="garden-search-results" className={styles.results} aria-busy={loading}>
      {loading ? <p role="status"><span className={styles.spinner} aria-hidden="true"/>検索中…</p> : error ? <p role="alert">{error}</p> : validSearch(query) && !hits.length ? <p role="status">見つかりませんでした</p> : !query ? <p>氏名・金額・番号・メモなどを入力してください。</p> : !validSearch(query) ? <p>数字だけ・英字だけの場合は 2 文字から検索できます。</p> : null}
      {groups.map(group => <section key={group.key}><h3>{group.label}</h3>{group.hits.map(hit => { const current = index++; return <a id={`garden-search-hit-${current}`} key={hit.id} ref={active === current ? selected : undefined} className={styles.hit} data-active={active === current} href={hit.href} onFocus={() => setActive(current)} onClick={event => { if (!event.ctrlKey && !event.metaKey && !event.shiftKey) { event.preventDefault(); navigate(hit.href); } }}><span><span className={styles.title}>{hit.title}</span><small>{hit.label}：<Highlight value={hit.value} query={query} phone={hit.phone}/></small></span><small>{hit.module}</small></a>; })}{group.more && !expanded.includes(group.key) && <button type="button" onClick={() => setExpanded(values => [...values, group.key])}>さらに表示</button>}</section>)}
    </div>
  </div></Modal>;
}
