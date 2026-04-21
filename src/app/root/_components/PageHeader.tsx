"use client";

import { ReactNode } from "react";
import { colors } from "../_constants/colors";

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <div style={{ marginBottom: 24, display: "flex", justifyContent: "space-between", alignItems: "flex-end", borderBottom: `1px solid ${colors.border}`, paddingBottom: 16 }}>
      <div>
        <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0, color: colors.text }}>{title}</h1>
        {description && <p style={{ fontSize: 13, color: colors.textMuted, margin: "6px 0 0 0" }}>{description}</p>}
      </div>
      {actions && <div style={{ display: "flex", gap: 8 }}>{actions}</div>}
    </div>
  );
}
