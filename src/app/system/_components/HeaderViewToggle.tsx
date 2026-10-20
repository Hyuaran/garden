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
  return <div ref={setNode} className={styles.slot} />;
}
export default function HeaderViewToggle({ children }: { children: ReactNode }) {
  const target = useContext(Target);
  const content = <div className={styles.toggle} role="group" aria-label="表示形式">{children}</div>;
  return target === undefined ? content : target ? createPortal(content, target) : null;
}
