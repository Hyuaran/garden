"use client";

import type { ReactNode } from "react";

type Props = {
  icon: string;
  title: string;
  children?: ReactNode;
  /** 投影モードかどうか（true だとフルスクリーン + 大フォント） */
  projection?: boolean;
  accent?: string;
};

export function DigestPageFrame({
  icon,
  title,
  children,
  projection = false,
  accent = "#40916c",
}: Props) {
  const padding = projection ? "48px 64px" : "28px 32px";
  const minHeight = projection ? "calc(100vh - 96px)" : 280;
  const titleSize = projection ? 42 : 20;
  const bodySize = projection ? 22 : 14;

  return (
    <section
      style={{
        background: "#fff",
        borderRadius: projection ? 0 : 16,
        padding,
        minHeight,
        boxShadow: projection ? "none" : "0 4px 16px rgba(64, 145, 108, 0.08)",
        border: projection ? "none" : `1px solid ${accent}33`,
        display: "flex",
        flexDirection: "column",
        gap: projection ? 36 : 18,
      }}
    >
      <header style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <span style={{ fontSize: projection ? 56 : 32 }}>{icon}</span>
        <h3
          style={{
            fontSize: titleSize,
            fontWeight: 800,
            color: "#1b4332",
            margin: 0,
            lineHeight: 1.2,
          }}
        >
          {title}
        </h3>
      </header>
      <div style={{ fontSize: bodySize, color: "#1b4332", lineHeight: 1.8 }}>
        {children}
      </div>
    </section>
  );
}
