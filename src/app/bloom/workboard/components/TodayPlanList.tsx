"use client";

import { useState } from "react";

import type { PlannedItem } from "../../_types/daily-log";

type Props = {
  items: PlannedItem[];
  onChange: (next: PlannedItem[]) => Promise<void> | void;
  disabled?: boolean;
};

export function TodayPlanList({ items, onChange, disabled = false }: Props) {
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);

  const commit = async (next: PlannedItem[]) => {
    setSaving(true);
    try {
      await onChange(next);
    } finally {
      setSaving(false);
    }
  };

  const toggle = (index: number) => {
    const next = items.map((it, i) =>
      i === index ? { ...it, done_bool: !it.done_bool } : it,
    );
    void commit(next);
  };

  const add = () => {
    const title = draft.trim();
    if (!title) return;
    void commit([...items, { title, done_bool: false }]);
    setDraft("");
  };

  const remove = (index: number) => {
    void commit(items.filter((_, i) => i !== index));
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
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, color: "#1b4332", margin: 0 }}>
          本日の予定
        </h3>
        <span style={{ fontSize: 11, color: "#6b8e75" }}>
          {items.filter((i) => i.done_bool).length} / {items.length}
        </span>
      </div>

      <ul style={{ listStyle: "none", padding: 0, margin: "12px 0 0" }}>
        {items.length === 0 && (
          <li style={{ fontSize: 12, color: "#95d5b2", padding: "8px 0" }}>
            予定はありません
          </li>
        )}
        {items.map((item, i) => (
          <li
            key={i}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "6px 0",
              borderBottom: i < items.length - 1 ? "1px solid #f1f8f4" : undefined,
            }}
          >
            <input
              type="checkbox"
              checked={!!item.done_bool}
              onChange={() => toggle(i)}
              disabled={disabled || saving}
              style={{ accentColor: "#40916c" }}
            />
            <span
              style={{
                flex: 1,
                fontSize: 13,
                color: item.done_bool ? "#95d5b2" : "#1b4332",
                textDecoration: item.done_bool ? "line-through" : "none",
              }}
            >
              {item.title}
              {item.estimate_min != null && (
                <span style={{ fontSize: 11, color: "#6b8e75", marginLeft: 6 }}>
                  ({item.estimate_min}分)
                </span>
              )}
            </span>
            <button
              type="button"
              onClick={() => remove(i)}
              disabled={disabled || saving}
              aria-label="削除"
              style={{
                border: "none",
                background: "transparent",
                color: "#95d5b2",
                cursor: disabled || saving ? "default" : "pointer",
                fontSize: 14,
              }}
            >
              ×
            </button>
          </li>
        ))}
      </ul>

      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") add();
          }}
          placeholder="追加する予定を入力"
          disabled={disabled || saving}
          style={{
            flex: 1,
            padding: "8px 12px",
            fontSize: 13,
            border: "1px solid #d8f3dc",
            borderRadius: 8,
            outline: "none",
            color: "#1b4332",
            background: "#fff",
          }}
        />
        <button
          type="button"
          onClick={add}
          disabled={!draft.trim() || disabled || saving}
          style={{
            padding: "8px 16px",
            fontSize: 12,
            fontWeight: 600,
            borderRadius: 8,
            border: "none",
            background: !draft.trim() || disabled || saving ? "#d8f3dc" : "#40916c",
            color: !draft.trim() || disabled || saving ? "#6b8e75" : "#fff",
            cursor: !draft.trim() || disabled || saving ? "default" : "pointer",
            fontFamily: "inherit",
          }}
        >
          追加
        </button>
      </div>
    </section>
  );
}
