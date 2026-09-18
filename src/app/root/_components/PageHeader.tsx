"use client";

import { ReactNode } from "react";
import { colors } from "../_constants/colors";

export function PageHeader({ title, description, actions, titleAddon }: { title: string; description?: string; actions?: ReactNode; titleAddon?: ReactNode }) {
  return (
    <div style={{ marginBottom: 20, display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 16, flexWrap: "wrap" }}>
      <div style={{ minWidth: 0 }}>
        <h1 style={{ fontSize: 26, fontWeight: 700, margin: 0, color: colors.heading, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          {title}
          {titleAddon}
        </h1>
        {description && <p style={{ fontSize: 13, color: colors.textMuted, margin: "6px 0 0 0" }}>{description}</p>}
      </div>
      {actions && <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>{actions}</div>}
    </div>
  );
}
