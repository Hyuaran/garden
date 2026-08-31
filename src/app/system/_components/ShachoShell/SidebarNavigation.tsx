"use client";

import { useEffect, useId, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import styles from "./shacho-shell.module.css";

export const UPCOMING_STORAGE_KEY = "garden.system.upcoming.open";

function readStoredOpen() {
  try { return window.localStorage.getItem(UPCOMING_STORAGE_KEY) === "true"; }
  catch { return false; }
}

function subscribeToStorage(onChange: () => void) {
  window.addEventListener("storage", onChange);
  return () => window.removeEventListener("storage", onChange);
}

export default function SidebarNavigation({ children, upcoming, upcomingCount }: {
  children: ReactNode;
  upcoming: ReactNode;
  upcomingCount: number;
}) {
  // SSRと初回hydrationは閉じる。ブラウザの保存値はReactの外部ストアとして復元する。
  const savedOpen = useSyncExternalStore(subscribeToStorage, readStoredOpen, () => false);
  const [selection, setSelection] = useState<boolean | null>(null);
  const open = selection ?? savedOpen;
  const [edges, setEdges] = useState({ top: false, bottom: false });
  const navRef = useRef<HTMLElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const upcomingId = useId();

  useEffect(() => {
    const nav = navRef.current;
    const content = contentRef.current;
    if (!nav || !content) return;
    const update = () => {
      const overflow = nav.scrollHeight - nav.clientHeight > 1;
      const next = {
        top: overflow && nav.scrollTop > 1,
        bottom: overflow && nav.scrollHeight - nav.clientHeight - nav.scrollTop > 1,
      };
      setEdges(previous => previous.top === next.top && previous.bottom === next.bottom ? previous : next);
    };
    update();
    nav.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    // 表示領域だけでなく内容も監視し、開閉・権限・文字の折返しに追従する。
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(update);
    observer?.observe(nav);
    observer?.observe(content);
    return () => {
      nav.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
      observer?.disconnect();
    };
  }, [open]);

  function toggleUpcoming() {
    const next = !open;
    setSelection(next);
    // 初回描画のfalseで保存値を上書きしない。利用者が開閉したときだけ保存する。
    try { window.localStorage.setItem(UPCOMING_STORAGE_KEY, String(next)); }
    catch { /* 保存できなくても、その画面での開閉は継続できる。 */ }
  }

  return <div className={styles.navFrame}>
    <nav ref={navRef} className={styles.nav} aria-label="Systemメニュー" tabIndex={0}>
      <div ref={contentRef} className={styles.navContent}>
        <div className={styles.navLabel}>メニュー</div>
        {children}
        {upcomingCount > 0 && <>
          <button className={styles.upcomingToggle} type="button" aria-expanded={open} aria-controls={upcomingId} onClick={toggleUpcoming}>
            <span>これから</span>
            {!open && <span className={styles.upcomingCount}>{upcomingCount}</span>}
            <svg className={open ? styles.chevronOpen : undefined} viewBox="0 0 24 24" aria-hidden="true"><path d="m5 9 7 7 7-7" /></svg>
          </button>
          <div id={upcomingId} hidden={!open}>{open && upcoming}</div>
        </>}
      </div>
    </nav>
    {edges.top && <div className={`${styles.scrollFade} ${styles.scrollFadeTop}`} data-scroll-fade="top" aria-hidden="true" />}
    {edges.bottom && <div className={`${styles.scrollFade} ${styles.scrollFadeBottom}`} data-scroll-fade="bottom" aria-hidden="true" />}
  </div>;
}
