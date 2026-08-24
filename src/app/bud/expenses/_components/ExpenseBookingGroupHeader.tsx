"use client";

import { useEffect, useRef } from "react";

type Props = {
  applicantName: string;
  count: number;
  totalAmount: number;
  selectedCount: number;
  selectedAmount: number;
  invalidCount: number;
  collapsed: boolean;
  checked: boolean;
  partial: boolean;
  disabled: boolean;
  onToggleCollapsed: () => void;
  onToggleSelection: (checked: boolean) => void;
};

export function ExpenseBookingGroupHeader({
  applicantName,
  count,
  totalAmount,
  selectedCount,
  selectedAmount,
  invalidCount,
  collapsed,
  checked,
  partial,
  disabled,
  onToggleCollapsed,
  onToggleSelection,
}: Props) {
  const checkboxRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (checkboxRef.current) checkboxRef.current.indeterminate = partial;
  }, [partial]);

  return (
    <tr>
      <td colSpan={12} style={groupTd}>
        <div style={groupHead}>
          <button
            type="button"
            style={collapseBtn}
            aria-expanded={!collapsed}
            aria-label={`${applicantName}の明細を${collapsed ? "開く" : "折りたたむ"}`}
            onClick={onToggleCollapsed}
          >
            {collapsed ? "▶" : "▼"}
          </button>
          <input
            ref={checkboxRef}
            type="checkbox"
            aria-label={`${applicantName}をまとめて選ぶ`}
            checked={checked}
            disabled={disabled}
            onChange={(event) => onToggleSelection(event.target.checked)}
          />
          <strong style={groupName}>{applicantName}</strong>
          <span style={groupStats}>
            <span style={selectedMeta}>選択 {selectedCount}件 {yen(selectedAmount)}</span>
            <span aria-hidden="true">／</span>
            <span style={groupMeta}>全{count}件 {yen(totalAmount)}</span>
            {invalidCount > 0 && <span style={warningBadge}>要確認 {invalidCount}件</span>}
          </span>
        </div>
      </td>
    </tr>
  );
}

function yen(value: number) {
  return "¥" + value.toLocaleString("ja-JP");
}

const groupTd: React.CSSProperties = { padding: "10px 8px", background: "var(--bg-card-solid)", borderTop: "1px solid var(--border-card)", borderBottom: "1px solid var(--border-card)", color: "var(--text-main)" };
const groupHead: React.CSSProperties = { display: "flex", alignItems: "center", flexWrap: "wrap", gap: "8px 12px", minHeight: 26, whiteSpace: "normal" };
const collapseBtn: React.CSSProperties = { width: 24, color: "var(--text-main)", fontSize: 12, lineHeight: 1 };
const groupName: React.CSSProperties = { color: "var(--text-main)", fontSize: 14, fontWeight: 600, overflowWrap: "anywhere" };
const groupStats: React.CSSProperties = { display: "flex", alignItems: "center", flexWrap: "wrap", gap: "4px 8px", minWidth: 0 };
const selectedMeta: React.CSSProperties = { color: "var(--text-main)", fontSize: 13, fontWeight: 700, fontVariantNumeric: "tabular-nums" };
const groupMeta: React.CSSProperties = { color: "var(--accent-gold-d)", fontSize: 13, fontWeight: 600, fontVariantNumeric: "tabular-nums" };
const warningBadge: React.CSSProperties = { padding: "2px 8px", borderRadius: 999, color: "var(--text-main)", background: "rgba(212,165,65,0.18)", fontSize: 12, fontWeight: 600 };
