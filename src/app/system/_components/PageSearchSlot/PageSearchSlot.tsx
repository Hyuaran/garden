"use client";
import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from "react";
import styles from "./PageSearchSlot.module.css";
const Context = createContext<{ target: HTMLDivElement | null; register: (id: symbol) => () => void; owner: symbol | undefined; setTarget: (node: HTMLDivElement | null) => void } | null>(null);
export function PageSearchProvider({ children }: { children: ReactNode }) {
  const [target, setTarget] = useState<HTMLDivElement | null>(null);
  const [owners, setOwners] = useState<symbol[]>([]);
  const register = useMemo(() => (id: symbol) => {
    setOwners(previous => [...previous, id]);
    return () => setOwners(previous => previous.filter(owner => owner !== id));
  }, []);
  const value = useMemo(() => ({ target, setTarget, register, owner: owners[0] }), [target, register, owners]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function PageSearchSlot() {
  const context = useContext(Context);
  const target = context?.target;
  useEffect(() => {
    if (!target) return;
    const main = target.closest("main") ?? target.closest("header")?.parentElement?.querySelector("main");
    if (!main) return;
    const headings = Array.from(main.querySelectorAll<HTMLElement>("[data-page-search-heading]"));
    const clear = () => {
      main.style.removeProperty("--page-search-width");
      main.style.removeProperty("--page-search-bottom");
      headings.forEach(heading => heading.style.removeProperty("--page-search-heading-top"));
    };
    const measure = () => {
      if (!target.childElementCount || !window.matchMedia("(min-width: 801px)").matches) { clear(); return; }
      const rect = target.getBoundingClientRect();
      const mainRect = main.getBoundingClientRect();
      // Garden zoom scales viewport rectangles; the custom properties use CSS pixels.
      const scale = main.offsetWidth && mainRect.width ? mainRect.width / main.offsetWidth : 1;
      headings.forEach(heading => heading.style.setProperty("--page-search-heading-top", `${(heading.getBoundingClientRect().top - mainRect.top) / scale}px`));
      main.style.setProperty("--page-search-width", `${rect.width / scale + 16}px`);
      main.style.setProperty("--page-search-bottom", `${Math.max(0, (rect.bottom - mainRect.top) / scale)}px`);
    };
    const observer = new MutationObserver(measure);
    observer.observe(target, { childList: true });
    const resize = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure);
    resize?.observe(target);
    resize?.observe(main);
    if (target.parentElement) resize?.observe(target.parentElement);
    window.addEventListener("resize", measure);
    measure();
    return () => { observer.disconnect(); resize?.disconnect(); window.removeEventListener("resize", measure); clear(); };
  }, [target]);
  return <div ref={context?.setTarget} className={styles.slot} data-page-search-slot="" />;
}
export function PageSearchActions({ children }: { children: ReactNode }) {
  return <div className={styles.actions}><div>{children}</div><PageSearchSlot /></div>;
}
export function usePageSearchTarget(ref: RefObject<HTMLDivElement | null>, enabled: boolean) {
  const context = useContext(Context);
  const id = useRef(Symbol("page-search"));
  const [desktop, setDesktop] = useState(false);
  const register = context?.register;
  useEffect(() => {
    if (!register || typeof window.matchMedia !== "function") return;
    const query = window.matchMedia("(min-width: 801px)");
    const update = () => setDesktop(query.matches);
    update(); query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, [register]);
  useEffect(() => {
    if (!enabled || !desktop || ref.current?.closest('dialog, [role="dialog"], [role="alertdialog"]')) return;
    return register?.(id.current);
  }, [register, desktop, enabled, ref]);
  return desktop && enabled && context?.owner === id.current ? context.target : null;
}
/** Resolve the table's input even when it is rendered in the header. */
export function findTableSearch(container: HTMLElement | null) {
  const table = container?.querySelector<HTMLElement>("[data-table-search-id]");
  return table ? document.getElementById(table.dataset.tableSearchId!) as HTMLInputElement | null : container?.querySelector<HTMLInputElement>('input[type="search"]');
}
