"use client";

import { colors } from "../_constants/colors";

export function StatusBadge({ active }: { active: boolean }) {
  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 8px",
        borderRadius: 10,
        fontSize: 11,
        fontWeight: 600,
        background: active ? colors.successBg : colors.disabledBg,
        color: active ? colors.success : colors.disabled,
      }}
    >
      {active ? "有効" : "無効"}
    </span>
  );
}
