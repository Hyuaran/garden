"use client";

import { useEffect, useRef } from "react";

type Props = {
  applicantName: string;
  count: number;
  totalAmount: number;
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
          <span style={groupMeta}>{count}件</span>
          <span style={groupMeta}>合計 {yen(totalAmount)}</span>
          {partial && <span style={partialBadge}>一部選択</span>}
        </div>
      </td>
    </tr>
  );
}

function yen(value: number) {
  return "¥" + value.toLocaleString("ja-JP");
}

const groupTd: React.CSSProperties = { padding: "10px 8px", background: "var(--bg-card-solid)", borderTop: "1px solid var(--border-card)", borderBottom: "1px solid var(--border-card)", color: "var(--text-main)" };
const groupHead: React.CSSProperties = { display: "flex", alignItems: "center", gap: 12, minHeight: 26 };
const collapseBtn: React.CSSProperties = { width: 24, color: "var(--text-main)", fontSize: 12, lineHeight: 1 };
const groupName: React.CSSProperties = { color: "var(--text-main)", fontSize: 14, fontWeight: 600 };
const groupMeta: React.CSSProperties = { color: "var(--accent-gold-d)", fontSize: 13, fontWeight: 600, fontVariantNumeric: "tabular-nums" };
const partialBadge: React.CSSProperties = { marginLeft: "auto", padding: "2px 8px", borderRadius: 999, color: "var(--text-main)", background: "rgba(212,165,65,0.18)", fontSize: 12 };
