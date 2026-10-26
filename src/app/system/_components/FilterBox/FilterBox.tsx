import type { ReactNode } from "react";
import styles from "./FilterBox.module.css";

export default function FilterBox({ label, children, search = false }: { label: string; children: ReactNode; search?: boolean }) {
  return <label className={styles.box} data-garden-filter-box>
    <small>{label}</small>
    <span className={styles.value}>
      {search && <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 5 5" /></svg>}
      {children}
    </span>
  </label>;
}
