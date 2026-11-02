import styles from "./BudTableLoading.module.css";

/** Reserve visible table geometry before client data is available. */
export default function BudTableLoading({ headers, rows = 7, rowHeight = 48, tableClassName }: { headers: readonly string[]; rows?: number; rowHeight?: number; tableClassName?: string }) {
  return <div className={styles.frame} role="status" aria-label="読み込み中" aria-busy="true">
    <table className={[styles.table, tableClassName].filter(Boolean).join(" ")}><thead><tr>{headers.map((heading, i) => <th key={i}>{heading}</th>)}</tr></thead>
      <tbody>{Array.from({ length: rows }, (_, row) => <tr key={row} style={{ height: rowHeight }}>{headers.map((_, col) => <td key={col}>{row === 0 && col === 0 ? "読み込み中…" : <span className={styles.bar} />}</td>)}</tr>)}</tbody>
    </table>
  </div>;
}
