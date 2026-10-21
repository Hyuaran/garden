"use client";

import { useEffect, useRef, type RefObject, type ComponentProps } from "react";
import styles from "./StickyTable.module.css";

/** Fixed overlays live on body: only the root zoom applies to their coordinates. */
export function useStickyTable(ref: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const wrap = ref.current;
    const table = wrap?.querySelector("table");
    if (!wrap || !table || table.closest('[role="dialog"],dialog')) return;
    const previous = wrap.style.cssText;
    wrap.classList.add(styles.wrap);
    wrap.style.maxHeight = "none";
    wrap.style.height = "auto";
    wrap.style.overflowX = "auto";
    wrap.style.overflowY = "hidden";
    const head = document.createElement("div"), bar = document.createElement("div"), track = document.createElement("div");
    head.className = styles.head;
    head.setAttribute("aria-label", "表の見出し");
    bar.className = styles.bar;
    bar.setAttribute("aria-label", "表を横にスクロール");
    bar.tabIndex = 0;
    bar.append(track);
    document.body.append(head, bar);
    let frame = 0;
    let dirty = true;
    let activeGroup: HTMLTableRowElement | null = null;
    const rebuild = () => {
      const original = table.tHead;
      head.replaceChildren();
      if (!original) return;
      const copy = table.cloneNode(false) as HTMLTableElement;
      const cloned = original.cloneNode(true) as HTMLTableSectionElement;
      copy.append(cloned);
      let groupCopy: HTMLTableRowElement | null = null;
      if (activeGroup) {
        groupCopy = activeGroup.cloneNode(true) as HTMLTableRowElement;
        copy.createTBody().append(groupCopy);
      }
      head.append(copy);
      const source = [table, original, ...original.querySelectorAll("*")];
      const targets = [copy, cloned, ...cloned.querySelectorAll("*")];
      if (activeGroup && groupCopy) {
        source.push(activeGroup, ...activeGroup.querySelectorAll("*"));
        targets.push(groupCopy, ...groupCopy.querySelectorAll("*"));
      }
      source.forEach((node, i) => {
        const dest = targets[i] as HTMLElement;
        const css = getComputedStyle(node);
        for (const key of Array.from(css)) dest.style.setProperty(key, css.getPropertyValue(key));
        dest.removeAttribute("id");
        if (node instanceof HTMLTableCellElement) {
          const zoom = table.getBoundingClientRect().width / table.offsetWidth || 1;
          const width = node.getBoundingClientRect().width / zoom;
          Object.assign(dest.style, { width: `${width}px`, minWidth: `${width}px`, maxWidth: `${width}px`, boxSizing: "border-box" });
        }
        if (node instanceof HTMLInputElement && dest instanceof HTMLInputElement) { dest.checked = node.checked; dest.indeterminate = node.indeterminate; }
        if (activeGroup?.contains(node)) { dest.style.top = "auto"; if (css.position === "sticky") dest.style.position = "static"; }
        if (node instanceof HTMLElement && node.matches("button,input,a,select")) {
          dest.addEventListener("click", event => { event.preventDefault(); node.click(); });
          dest.addEventListener("pointerdown", event => { node.dispatchEvent(new PointerEvent("pointerdown", event)); });
          dest.addEventListener("keydown", event => { if (!node.dispatchEvent(new KeyboardEvent("keydown", event))) event.preventDefault(); });
        }
      });
      Object.assign(copy.style, { width: `${table.offsetWidth}px`, minWidth: `${table.offsetWidth}px`, maxWidth: "none", height: "auto", minHeight: "0", maxHeight: "none", tableLayout: "fixed", margin: "0" });
      // Match any zoom applied below the document root as well.
      const rootZoom = Number.parseFloat(getComputedStyle(document.documentElement).zoom) || 1;
      copy.style.zoom = String((table.getBoundingClientRect().width / table.offsetWidth || rootZoom) / rootZoom);
    };
    const fit = () => {
      frame = 0;
      const r = wrap.getBoundingClientRect(), t = table.getBoundingClientRect(), h = table.tHead?.getBoundingClientRect();
      let top = 0, bottom = window.innerHeight, left = Math.max(0, r.left), right = Math.min(window.innerWidth, r.right);
      for (let parent = wrap.parentElement; parent && parent !== document.body; parent = parent.parentElement) {
        const css = getComputedStyle(parent), rect = parent.getBoundingClientRect();
        if (/(auto|scroll|hidden|clip)/.test(css.overflowY)) { top = Math.max(top, rect.top); bottom = Math.min(bottom, rect.bottom); }
        if (/(auto|scroll|hidden|clip)/.test(css.overflowX)) { left = Math.max(left, rect.left); right = Math.min(right, rect.right); }
      }
      let group: HTMLTableRowElement | null = null;
      // The row retains its natural position even when its cells are sticky.
      const layoutTop=(node:HTMLElement)=>{let y=0;for(let el:HTMLElement|null=node;el;el=el.offsetParent as HTMLElement|null)y+=el.offsetTop;return y;};
      const scale=table.offsetWidth ? t.width/table.offsetWidth : 1;
      for (const row of Array.from(table.tBodies).flatMap(body=>Array.from(body.rows))) {
        const rowTop = row.offsetHeight ? t.top + (layoutTop(row)-layoutTop(table))*scale : row.getBoundingClientRect().top;
        if (rowTop > top + (h?.height ?? 0)) break;
        if (row.hasAttribute("data-sticky-group")) group = row;
      }
      if (group !== activeGroup) { activeGroup = group; dirty = true; }
      const zoom = Number.parseFloat(getComputedStyle(document.documentElement).zoom) || 1;
      const width = Math.max(0, right - left);
      head.hidden = !h || h.top >= top || t.bottom <= top + h.height || width === 0 || top >= bottom;
      if (head.hidden) { head.replaceChildren(); dirty = true; }
      else if (dirty) { rebuild(); dirty = false; }
      bar.hidden = !(wrap.scrollWidth > wrap.clientWidth && r.top < bottom && r.bottom > bottom && width > 0);
      Object.assign(head.style, { left: `${left / zoom}px`, top: `${top / zoom}px`, width: `${width / zoom}px` });
      Object.assign(bar.style, { left: `${left / zoom}px`, top: `${(bottom - 12) / zoom}px`, width: `${width / zoom}px` });
      track.style.width = `${wrap.scrollWidth * (t.width / table.offsetWidth || zoom) / zoom}px`;
      head.scrollLeft = wrap.scrollLeft * (t.width / table.offsetWidth || zoom) / zoom + (left - r.left) / zoom;
      bar.scrollLeft = wrap.scrollLeft * (t.width / table.offsetWidth || zoom) / zoom;
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(fit); };
    const refresh = () => { dirty = true; schedule(); };
    const sync = () => {
      const scale = (table.getBoundingClientRect().width / table.offsetWidth || 1) / (Number.parseFloat(getComputedStyle(document.documentElement).zoom) || 1);
      if (Math.abs(wrap.scrollLeft - bar.scrollLeft / scale) > 1) wrap.scrollLeft = bar.scrollLeft / scale;
    };
    bar.addEventListener("scroll", sync);
    const resize = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(refresh);
    resize?.observe(wrap); resize?.observe(table);
    const mutation = new MutationObserver(refresh);
    mutation.observe(table, { subtree: true, childList: true, attributes: true, characterData: true });
    table.addEventListener("change", refresh);
    const theme = new MutationObserver(refresh);
    theme.observe(document.documentElement, { attributes: true, attributeFilter: ["class", "style", "data-theme"] });
    window.addEventListener("scroll", schedule, true);
    window.addEventListener("resize", refresh);
    window.addEventListener("garden-font-size-change", refresh);
    fit();
    return () => {
      cancelAnimationFrame(frame); resize?.disconnect(); mutation.disconnect(); theme.disconnect(); table.removeEventListener("change", refresh);
      window.removeEventListener("scroll", schedule, true); window.removeEventListener("resize", refresh); window.removeEventListener("garden-font-size-change", refresh);
      head.remove(); bar.remove(); wrap.classList.remove(styles.wrap); wrap.style.cssText = previous;
    };
  }, [ref]);
}

/** Keeps existing table markup/styles; its immediate parent is the horizontal viewport. */
export default function StickyTable(props: ComponentProps<"table">) {
  const viewport = useRef<HTMLElement | null>(null);
  useStickyTable(viewport);
  return <table {...props} ref={node => { viewport.current = node?.parentElement ?? null; }} />;
}
