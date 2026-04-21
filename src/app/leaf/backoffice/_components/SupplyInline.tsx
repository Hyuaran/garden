"use client";

import { getSupplyInfoFromPoint } from "../../_lib/calendar";
import { colors } from "../../_constants/colors";

interface Props {
  supplyPoint22: string | null;
  supplyStartDate: string | null;
}

export function SupplyInline({ supplyPoint22, supplyStartDate }: Props) {
  // 供給地点番号からコードを解析して直近日程を表示
  const upcoming = getSupplyInfoFromPoint(supplyPoint22);

  if (!supplyPoint22 && !supplyStartDate) {
    return <span style={{ color: colors.textMuted, fontSize: 12 }}>—</span>;
  }

  if (!upcoming || upcoming.length === 0) {
    // 日程コード不明でも供給開始日が入っていれば表示
    if (supplyStartDate) {
      return (
        <span style={{ fontSize: 12 }}>
          <span style={{ color: colors.accent, fontWeight: 600 }}>{supplyStartDate}</span>
        </span>
      );
    }
    return <span style={{ color: colors.textMuted, fontSize: 12 }}>—</span>;
  }

  return (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
      {upcoming.map((u) => (
        <span
          key={u.date}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            padding: "2px 8px",
            borderRadius: 12,
            background: u.primary ? colors.accentLight : colors.bgCard,
            border: `1px solid ${u.primary ? colors.accent : colors.border}`,
            fontSize: 11,
            color: u.primary ? colors.accent : colors.textMuted,
            fontWeight: u.primary ? 600 : 400,
            whiteSpace: "nowrap",
          }}
        >
          <span style={{ opacity: 0.7 }}>{u.monthLabel}</span>
          <span>{u.date.slice(5).replace("-", "/")}</span>
          {/* コード表示 */}
          <span
            style={{
              fontSize: 10,
              opacity: 0.6,
              background: "rgba(0,0,0,0.07)",
              borderRadius: 4,
              padding: "0 3px",
            }}
          >
            {u.code}
          </span>
        </span>
      ))}
    </div>
  );
}
