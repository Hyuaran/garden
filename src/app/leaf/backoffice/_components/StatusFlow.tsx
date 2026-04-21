"use client";

import { KandenStatus, STATUS_FLOW } from "../../_lib/types";
import { colors } from "../../_constants/colors";

interface Props {
  currentStatus: KandenStatus;
  compact?: boolean;
}

/** 8段階ステータスフロー表示（横ステッパー） */
export function StatusFlow({ currentStatus, compact = false }: Props) {
  const currentNum = STATUS_FLOW.find((s) => s.key === currentStatus)?.num ?? 1;

  if (compact) {
    // コンパクト表示: 現在のステップだけ強調、他は小さいドット
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 2,
          overflowX: "auto",
        }}
      >
        {STATUS_FLOW.map((s, i) => {
          const done = s.num < currentNum;
          const active = s.num === currentNum;
          return (
            <div key={s.key} style={{ display: "flex", alignItems: "center" }}>
              <div
                style={{
                  width: active ? 8 : 6,
                  height: active ? 8 : 6,
                  borderRadius: "50%",
                  background: done
                    ? colors.accent
                    : active
                    ? colors.accent
                    : colors.border,
                  opacity: active ? 1 : done ? 0.7 : 0.4,
                  flexShrink: 0,
                }}
                title={s.label}
              />
              {i < STATUS_FLOW.length - 1 && (
                <div
                  style={{
                    width: 8,
                    height: 1,
                    background: done ? colors.accent : colors.border,
                    opacity: done ? 0.7 : 0.3,
                  }}
                />
              )}
            </div>
          );
        })}
      </div>
    );
  }

  // フル表示: テキスト付き横ステッパー
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        overflowX: "auto",
        padding: "4px 0",
      }}
    >
      {STATUS_FLOW.map((s, i) => {
        const done = s.num < currentNum;
        const active = s.num === currentNum;

        return (
          <div key={s.key} style={{ display: "flex", alignItems: "center", flexShrink: 0 }}>
            {/* ノード */}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: "50%",
                  background: done || active ? colors.accent : colors.border,
                  color: done || active ? "#fff" : colors.textMuted,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 11,
                  fontWeight: 700,
                  border: active ? `2px solid ${colors.accentHover}` : "none",
                  boxShadow: active ? `0 0 0 3px ${colors.accentLight}` : "none",
                  flexShrink: 0,
                }}
              >
                {done ? "✓" : s.num}
              </div>
              <div
                style={{
                  fontSize: 10,
                  color: active ? colors.accent : done ? colors.textMuted : colors.border,
                  fontWeight: active ? 700 : 400,
                  whiteSpace: "nowrap",
                }}
              >
                {s.short}
              </div>
            </div>

            {/* コネクター */}
            {i < STATUS_FLOW.length - 1 && (
              <div
                style={{
                  width: 24,
                  height: 2,
                  background: done ? colors.accent : colors.border,
                  margin: "0 2px",
                  marginBottom: 18, // テキスト分を補正
                  opacity: done ? 0.7 : 0.4,
                  flexShrink: 0,
                }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
