"use client";

import type { CSSProperties } from "react";
import { useOfflineQueue, type NetworkStatus } from "../_hooks/useOfflineQueue";

const STATUS_CONFIG: Record<
  NetworkStatus,
  { label: string; color: string; bg: string }
> = {
  online: { label: "🟢 オンライン", color: "#fff", bg: "#234d20" },
  queued: { label: "🟡 キュー保留中", color: "#fff", bg: "#b8860b" },
  offline: { label: "🔴 オフライン", color: "#fff", bg: "#a00000" },
};

const BASE_STYLE: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  padding: "4px 10px",
  borderRadius: 12,
  fontSize: 12,
  fontWeight: 600,
  fontFamily: "'Noto Sans JP', sans-serif",
  userSelect: "none",
};

export function NetworkStatusBadge() {
  const { status, queueSize } = useOfflineQueue();
  const cfg = STATUS_CONFIG[status];
  return (
    <span
      style={{ ...BASE_STYLE, color: cfg.color, background: cfg.bg }}
      role="status"
      aria-label={`ネットワーク状態: ${cfg.label}${status === "queued" ? ` (${queueSize}件)` : ""}`}
    >
      {cfg.label}
      {status === "queued" ? ` (${queueSize})` : ""}
    </span>
  );
}
