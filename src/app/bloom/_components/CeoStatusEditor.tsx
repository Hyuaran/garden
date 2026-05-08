"use client";

import { useState } from "react";
import { useShojiStatus, type CeoStatusKey } from "../../../components/shared/ShojiStatusContext";

const OPTIONS: Array<{ key: CeoStatusKey; icon: string; label: string }> = [
  { key: "available", icon: "🟢", label: "対応可能" },
  { key: "busy",      icon: "🟡", label: "取り込み中" },
  { key: "focused",   icon: "🔴", label: "集中業務中" },
  { key: "away",      icon: "⚪", label: "外出中" },
];

export function CeoStatusEditor({ isSuperAdmin }: { isSuperAdmin: boolean }) {
  const { status, refresh } = useShojiStatus();
  const [selected, setSelected] = useState<CeoStatusKey>(status?.status ?? "available");
  const [summary, setSummary] = useState<string>(status?.summary ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  if (!isSuperAdmin) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setMessage(null);
    try {
      const res = await fetch("/api/ceo-status", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: selected, summary: summary || null }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setMessage(`更新失敗: ${body.error ?? res.status}`);
        return;
      }
      setMessage("更新しました");
      await refresh();
    } catch (err) {
      setMessage(`通信エラー: ${(err as Error).message}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} style={{ padding: 16, border: "1px solid #ddd", borderRadius: 8 }}>
      <h3 style={{ marginTop: 0 }}>東海林さんステータス更新</h3>
      <fieldset style={{ border: 0, padding: 0, marginBottom: 12 }}>
        <legend style={{ fontSize: 12, color: "#666", marginBottom: 8 }}>状態</legend>
        {OPTIONS.map((opt) => (
          <label key={opt.key} style={{ display: "block", padding: 4 }}>
            <input
              type="radio"
              name="status"
              value={opt.key}
              checked={selected === opt.key}
              onChange={() => setSelected(opt.key)}
            />
            {" "}{opt.icon} {opt.label}
          </label>
        ))}
      </fieldset>
      <label style={{ display: "block", marginBottom: 12 }}>
        <span style={{ fontSize: 12, color: "#666" }}>メモ（200 字以内）</span>
        <textarea
          value={summary}
          maxLength={200}
          onChange={(e) => setSummary(e.target.value)}
          placeholder="a-main 006 で Root Phase B 確定中"
          style={{ width: "100%", minHeight: 60, padding: 8, marginTop: 4 }}
        />
      </label>
      <button type="submit" disabled={submitting} style={{ padding: "8px 16px" }}>
        {submitting ? "更新中…" : "更新"}
      </button>
      {message && <p style={{ marginTop: 8, fontSize: 14 }}>{message}</p>}
    </form>
  );
}
