"use client";

import { ReactNode, useEffect, useRef } from "react";
import { colors } from "../_constants/colors";

export interface Column<T> {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
  width?: number | string;
  align?: "left" | "right" | "center";
}

export function DataTable<T>({
  columns,
  rows,
  emptyMessage = "データがありません",
  onRowClick,
  activeIndex,
}: {
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

  return (
    <div style={{ background: colors.bgPanel, border: `1px solid ${colors.border}`, borderRadius: 6, overflow: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <thead>
          <tr style={{ background: colors.bg, borderBottom: `1px solid ${colors.border}` }}>
            {columns.map((col) => (
              <th
                key={col.key}
                style={{ textAlign: col.align ?? "left", padding: "10px 12px", fontSize: 12, fontWeight: 600, color: colors.textMuted, width: col.width, whiteSpace: "nowrap" }}
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
                  {columns.map((col) => (
                    <td key={col.key} style={{ padding: "10px 12px", textAlign: col.align ?? "left", color: colors.text, verticalAlign: "middle" }}>
                      {col.render(row)}
                    </td>
                  ))}
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
