"use client";

/**
 * Garden-Forest TaxPill: 納税カレンダーのセル内 pill。
 *
 * spec: docs/specs/2026-04-24-forest-t-f4-02-tax-calendar.md §5 Step 3
 *
 * 色分け:
 *   - paid (status=paid OR 過去月): #a3b18a (paleGreen 系)
 *   - kakutei: #e07a7a (赤系)
 *   - yotei / extra: #c9a84c (黄系)
 *
 * Forest のインラインスタイル規約に合わせ、Tailwind は用いない。
 */

import { fmtYen } from "../_lib/format";
import type { NouzeiKind } from "../_lib/types";

type Props = {
  kind: NouzeiKind;
  /** '確定' / '予定' / '予定（消費税）' 等 */
  label: string;
  amount: number | null;
  isPaid: boolean;
  onClick?: () => void;
};

function bgColor(kind: NouzeiKind, isPaid: boolean): string {
  if (isPaid) return "#a3b18a";
  if (kind === "kakutei") return "#e07a7a";
  // yotei / extra
  return "#c9a84c";
}

export function TaxPill({ kind, label, amount, isPaid, onClick }: Props) {
  const isClickable = typeof onClick === "function";
  const ariaLabel = `${label}${isPaid ? "（納付済）" : ""}${
    amount != null ? ` ${fmtYen(amount)}` : ""
  }`.trim();

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!isClickable}
      aria-label={ariaLabel}
      style={{
        display: "inline-flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: bgColor(kind, isPaid),
        color: "#fff",
        fontSize: 10,
        fontWeight: 600,
        padding: "4px 10px",
        borderRadius: 10,
        border: "none",
        whiteSpace: "nowrap",
        minWidth: 52,
        minHeight: 38,
        cursor: isClickable ? "pointer" : "default",
        opacity: isClickable ? 1 : 0.95,
        transition: "opacity 0.15s",
        fontFamily: "inherit",
      }}
    >
      <span>{label}</span>
      {amount != null && (
        <span
          style={{
            fontSize: 9,
            fontWeight: 400,
            marginTop: 1,
          }}
        >
          {fmtYen(amount)}
        </span>
      )}
    </button>
  );
}
