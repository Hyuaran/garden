"use client";

import { GARDEN_ROLE_LABELS } from "../_constants/types";
import { colors } from "../_constants/colors";
import { useRootState } from "../_state/RootStateContext";

export function UserHeader() {
  const { rootUser, gardenRole, signOut } = useRootState();
  if (!rootUser || !gardenRole) return null;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 16,
        padding: "12px 24px",
        background: colors.bgPanel,
        borderBottom: `1px solid ${colors.border}`,
        position: "sticky",
        top: 0,
        zIndex: 10,
      }}
    >
      <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 12 }}>
        <span style={{ fontSize: 14, color: colors.text }}>
          👤 {rootUser.name}
        </span>
        <span
          style={{
            fontSize: 11,
            color: colors.textMuted,
            background: colors.bg,
            padding: "2px 8px",
            borderRadius: 4,
          }}
        >
          {GARDEN_ROLE_LABELS[gardenRole]}
        </span>
        <button
          type="button"
          onClick={() => signOut("manual")}
          style={{
            padding: "6px 12px",
            background: colors.bgPanel,
            border: `1px solid ${colors.border}`,
            borderRadius: 6,
            cursor: "pointer",
            fontSize: 12,
            color: colors.textMuted,
          }}
        >
          ログアウト
        </button>
      </div>
    </div>
  );
}
