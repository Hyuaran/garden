"use client";

import Link from "next/link";
import { useShojiStatus, type CeoStatusKey } from "./ShojiStatusContext";
import { formatRelativeTime, isStale } from "./_lib/formatRelativeTime";

const STATUS_META: Record<CeoStatusKey, { icon: string; label: string }> = {
  available: { icon: "🟢", label: "対応可能" },
  busy:      { icon: "🟡", label: "取り込み中" },
  focused:   { icon: "🔴", label: "集中業務中" },
  away:      { icon: "⚪", label: "外出中" },
};

const SUMMARY_TRUNCATE = 30;

function truncate(s: string, max: number): string {
  return s.length <= max ? s : s.slice(0, max) + "…";
}

export function ShojiStatusWidget({ mode }: { mode: "compact" | "full" }) {
  const { status } = useShojiStatus();

  if (!status) {
    return (
      <div
        data-testid="ceo-status-skeleton"
        style={{ height: mode === "compact" ? 56 : 120, opacity: 0.5 }}
      >
        東海林ステータス 読込中…
      </div>
    );
  }

  const meta = STATUS_META[status.status];
  const stale = isStale(status.updated_at);
  const relTime = formatRelativeTime(status.updated_at);
  const summaryDisplay = status.summary ?? "メモなし";

  if (mode === "compact") {
    return (
      <Link
        href="/bloom/workboard/ceo-status"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "8px 12px",
          fontSize: 14,
          color: stale ? "#888" : "inherit",
          textDecoration: "none",
          border: "1px solid #ddd",
          borderRadius: 4,
          minHeight: 40,
        }}
        title={`東海林さん: ${meta.label} | ${summaryDisplay}`}
      >
        <span aria-hidden>{meta.icon}</span>
        <span>東海林：{meta.label}</span>
        <span style={{ opacity: 0.6 }}>｜</span>
        <span>{truncate(summaryDisplay, SUMMARY_TRUNCATE)}</span>
        <span style={{ opacity: 0.6, marginLeft: "auto" }}>{relTime}</span>
      </Link>
    );
  }

  // full
  return (
    <div
      style={{
        padding: 16,
        border: "1px solid #ddd",
        borderRadius: 8,
        color: stale ? "#888" : "inherit",
      }}
    >
      <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>
        <span aria-hidden>{meta.icon}</span> 東海林さん：{meta.label}
      </div>
      <hr style={{ border: 0, borderTop: "1px solid #eee", margin: "8px 0" }} />
      <div style={{ fontSize: 14, marginBottom: 12 }}>{summaryDisplay}</div>
      <div style={{ fontSize: 12, color: "#888" }}>
        最終更新: {status.updated_at ?? "—"} ({relTime})
      </div>
      <div style={{ fontSize: 12, color: "#888" }}>
        更新者: {status.updated_by_name ?? "—"}
      </div>
    </div>
  );
}
