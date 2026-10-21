"use client";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import styles from "./header-view-toggle.module.css";
const Target = createContext<HTMLElement | null | undefined>(undefined);
const Register = createContext<(node: HTMLDivElement | null) => void>(() => {});
export function HeaderViewProvider({ children }: { children: ReactNode }) {
  const [target, setTarget] = useState<HTMLDivElement | null>(null);
  return <Target.Provider value={target}><Register.Provider value={setTarget}>{children}</Register.Provider></Target.Provider>;
}
export function HeaderViewSlot({ mobile = false }: { mobile?: boolean }) {
  const register = useContext(Register);
  const [node, setNode] = useState<HTMLDivElement | null>(null);
  const [occupied, setOccupied] = useState(false);
  useEffect(() => {
    const target = node;
    if (!target) return;
    const update = () => setOccupied(target.childElementCount > 0);
    const observer = new MutationObserver(update);
    observer.observe(target, { childList: true });
    update();
    return () => observer.disconnect();
  }, [node]);
  useEffect(() => {
    if (!window.matchMedia) {
      if (!mobile) register(node);
      return;
    }
    const query = window.matchMedia("(max-width: 760px)");
    const update = () => { if (query.matches === mobile) register(node); };
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, [node, mobile, register]);
  return <div className={styles.slot}>
    {!occupied && <span className={styles.fallback} tabIndex={0}>
      <button type="button" disabled aria-label="この画面は表示の切り替えがありません">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h2M9 6h11M4 12h2M9 12h11M4 18h2M9 18h11" /></svg>
      </button>
      <span className={styles.tooltip} role="tooltip">この画面は表示の切り替えがありません</span>
    </span>}
    <div ref={setNode} />
  </div>;
}
export default function HeaderViewToggle({ children }: { children: ReactNode }) {
  const target = useContext(Target);
  const content = <div className={styles.toggle} role="group" aria-label="表示形式">{children}</div>;
  return target === undefined ? content : target ? createPortal(content, target) : null;
}
