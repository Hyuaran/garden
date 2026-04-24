"use client";

import { useState } from "react";

import {
  WORKER_STATUS_LABELS,
  type WorkerStatusKind,
} from "../../_types/worker-status";

type Props = {
  status: WorkerStatusKind;
  statusNote: string | null;
  until: string | null;
  updatedAt: string | null;
  onUpdate: (next: WorkerStatusKind) => Promise<void> | void;
  disabled?: boolean;
};

const STATUS_ORDER: WorkerStatusKind[] = ["available", "busy_light", "focus", "away"];

export function WorkerStatusCard({
  status,
  statusNote,
  until,
  updatedAt,
  onUpdate,
  disabled = false,
}: Props) {
  const [saving, setSaving] = useState<WorkerStatusKind | null>(null);
  const current = WORKER_STATUS_LABELS[status];

  const handle = async (next: WorkerStatusKind) => {
    if (next === status || saving) return;
    setSaving(next);
    try {
      await onUpdate(next);
    } finally {
      setSaving(null);
    }
  };

  return (
    <section
      style={{
        background: "#fff",
        borderRadius: 12,
        padding: 20,
        border: "1px solid #d8f3dc",
        boxShadow: "0 2px 8px rgba(64, 145, 108, 0.06)",
      }}
    >
      <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
        <div style={{ fontSize: 42 }}>{current.icon}</div>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700, color: "#1b4332" }}>
            {current.label}
          </div>
          <div style={{ fontSize: 12, color: "#6b8e75" }}>{current.sub}</div>
        </div>
      </div>

      {(statusNote || until) && (
        <div style={{ marginTop: 10, fontSize: 12, color: "#40916c" }}>
          {statusNote && <div>メモ: {statusNote}</div>}
          {until && <div>〜 {formatUntil(until)} まで</div>}
        </div>
      )}

      <div style={{ marginTop: 16, display: "flex", gap: 8, flexWrap: "wrap" }}>
        {STATUS_ORDER.map((kind) => {
          const label = WORKER_STATUS_LABELS[kind];
          const active = kind === status;
          const busy = saving === kind;
          return (
            <button
              key={kind}
              type="button"
              onClick={() => handle(kind)}
              disabled={disabled || active || busy}
              style={{
                padding: "6px 12px",
                fontSize: 12,
                fontWeight: 600,
                borderRadius: 8,
                border: active ? "1px solid #40916c" : "1px solid #d8f3dc",
                background: active ? "#40916c" : "#fff",
                color: active ? "#fff" : "#1b4332",
                cursor: active || disabled || busy ? "default" : "pointer",
                opacity: disabled ? 0.5 : 1,
                fontFamily: "inherit",
              }}
            >
              {label.icon} {label.label}
              {busy && " ..."}
            </button>
          );
        })}
      </div>

      {updatedAt && (
        <div style={{ marginTop: 12, fontSize: 10, color: "#95d5b2" }}>
          更新: {formatUpdatedAt(updatedAt)}
        </div>
      )}
    </section>
  );
}

function formatUntil(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function formatUpdatedAt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${mm}/${dd} ${hh}:${mi}`;
}
