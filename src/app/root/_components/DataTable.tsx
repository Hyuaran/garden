"use client";

import StickyTable from "@/app/system/_components/StickyTable/useStickyTable";
import { ReactNode, useEffect, useRef } from "react";
import styles from "./root-shell.module.css";
import { colors } from "../_constants/colors";

export interface Column<T> {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
  width?: number | string;
  align?: "left" | "right" | "center";
  wrap?: boolean;
}

export function DataTable<T>({
  columns,
  rows,
  emptyMessage = "データがありません",
  onRowClick,
  activeIndex,
  stickyFirstColumn = false,
}: {
  stickyFirstColumn?: boolean;
  columns: Column<T>[];
  rows: T[];
  emptyMessage?: string;
  onRowClick?: (row: T) => void;
  /** Ctrl+↑/↓ ナビで選択中の行。-1 で非ハイライト。 */
  activeIndex?: number;
}) {
  const activeRowRef = useRef<HTMLTableRowElement | null>(null);

  useEffect(() => {
    if (activeIndex !== undefined && activeIndex >= 0 && activeRowRef.current) {
      activeRowRef.current.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }, [activeIndex]);

  const totalWidth = columns.reduce((total, col) => total + (typeof col.width === "number" ? col.width : 100), 0);

  return (
    <div style={{ background: colors.bgPanel, border: `1px solid ${colors.border}`, borderRadius: 16, overflow: "auto", maxWidth: "100%", minWidth: 0, boxShadow: colors.shadowSmall }}>
      <StickyTable className={stickyFirstColumn ? undefined : styles.compactTable} style={{ width: "100%", minWidth: stickyFirstColumn ? "max-content" : undefined, tableLayout: stickyFirstColumn ? "auto" : "fixed", borderCollapse: "collapse", fontSize: 13 }}>
        <thead>
          <tr style={{ background: colors.bg, borderBottom: `1px solid ${colors.border}` }}>
            {columns.map((col, columnIndex) => (
              <th
                key={col.key}
                style={{ textAlign: "center", padding: "10px 6px", fontSize: 12, fontWeight: 700, color: colors.heading, width: stickyFirstColumn ? col.width : `${((typeof col.width === "number" ? col.width : 100) / totalWidth) * 100}%`, whiteSpace: "normal", ...(stickyFirstColumn && columnIndex === 0 ? { position: "sticky", left: 0, zIndex: 2, background: colors.bg } as const : {}) }}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} style={{ textAlign: "center", padding: "40px 0", color: colors.textMuted }}>
                {emptyMessage}
              </td>
            </tr>
          ) : (
            rows.map((row, i) => {
              const isActive = activeIndex !== undefined && activeIndex === i;
              return (
                <tr
                  key={i}
                  ref={isActive ? activeRowRef : undefined}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  style={{
                    borderBottom: `1px solid ${colors.border}`,
                    cursor: onRowClick ? "pointer" : "default",
                    background: isActive ? colors.infoBg : "transparent",
                    transition: "background 0.1s",
                  }}
                  onMouseEnter={(e) => { if (onRowClick && !isActive) (e.currentTarget as HTMLTableRowElement).style.background = colors.bg; }}
                  onMouseLeave={(e) => { if (onRowClick && !isActive) (e.currentTarget as HTMLTableRowElement).style.background = "transparent"; }}
                >
                  {columns.map((col, columnIndex) => (
                    <td key={col.key} style={{ padding: "10px 6px", textAlign: col.align ?? "left", color: colors.text, verticalAlign: "middle", whiteSpace: !stickyFirstColumn || col.wrap ? "normal" : "nowrap", overflowWrap: "anywhere", minWidth: stickyFirstColumn && col.wrap ? col.width : undefined, ...(stickyFirstColumn && columnIndex === 0 ? { position: "sticky", left: 0, zIndex: 1, background: isActive ? colors.infoBg : colors.bgPanel } as const : {}) }}>
                      {col.render(row)}
                    </td>
                  ))}
                </tr>
              );
            })
          )}
        </tbody>
      </StickyTable>
    </div>
  );
}
