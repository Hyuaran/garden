"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { useBloomState } from "../_state/BloomStateContext";
import type { MonthlyDigest, MonthlyDigestStatus } from "../_types/monthly-digest";
import { createDigest, fetchDigests, toMonthKey } from "./_lib/digest-queries";

const STATUS_LABEL: Record<MonthlyDigestStatus, { label: string; bg: string; color: string }> = {
  draft: { label: "編集中", bg: "#fef3c7", color: "#92400e" },
  published: { label: "公開", bg: "#d8f3dc", color: "#1b4332" },
  archived: { label: "過去分", bg: "#f1f8f4", color: "#6b8e75" },
};

function currentMonthKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default function MonthlyDigestListPage() {
  const { canRead } = useBloomState();
  const isAdmin = canRead("admin");

  const [digests, setDigests] = useState<MonthlyDigest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [draftMonth, setDraftMonth] = useState(currentMonthKey());

  const load = useCallback(async () => {
    setError(null);
    try {
      const list = await fetchDigests();
      setDigests(list);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "取得に失敗しました";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleCreate = async () => {
    if (!draftMonth) return;
    setCreating(true);
    try {
      const created = await createDigest({
        digest_month: draftMonth,
        title: `${draftMonth} Garden 進捗`,
        pages: [
          { kind: "cover", title: "今月のダイジェスト", body: "" },
          { kind: "achievements", title: "今月の主要達成", body: "" },
          { kind: "progress_graph", title: "全体進捗グラフ", body: "" },
          { kind: "next_month_goals", title: "来月の目標", body: "" },
          { kind: "work_summary", title: "稼働サマリ", body: "" },
        ],
      });
      if (created) {
        await load();
      } else {
        setError("作成に失敗しました（権限または既存月の重複の可能性）");
      }
    } finally {
      setCreating(false);
    }
  };

  return (
    <div style={{ maxWidth: 960, margin: "0 auto" }}>
      <header style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: "#1b4332", margin: 0 }}>
          📅 月次ダイジェスト
        </h2>
        <p style={{ fontSize: 13, color: "#6b8e75", margin: "4px 0 0" }}>
          毎月15-20日の責任者会議用レポート
        </p>
      </header>

      {isAdmin && (
        <section
          style={{
            background: "#fff",
            borderRadius: 12,
            padding: 16,
            border: "1px solid #d8f3dc",
            marginBottom: 20,
            display: "flex",
            gap: 12,
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <span style={{ fontSize: 13, fontWeight: 600, color: "#1b4332" }}>
            新規作成:
          </span>
          <input
            type="month"
            value={draftMonth}
            onChange={(e) => setDraftMonth(e.target.value)}
            disabled={creating}
            style={{
              padding: "6px 10px",
              border: "1px solid #d8f3dc",
              borderRadius: 8,
              fontSize: 13,
              color: "#1b4332",
              fontFamily: "inherit",
            }}
          />
          <button
            type="button"
            onClick={handleCreate}
            disabled={creating || !draftMonth}
            style={{
              padding: "8px 16px",
              fontSize: 13,
              fontWeight: 600,
              borderRadius: 8,
              border: "none",
              background: creating ? "#d8f3dc" : "#40916c",
              color: creating ? "#6b8e75" : "#fff",
              cursor: creating ? "default" : "pointer",
              fontFamily: "inherit",
            }}
          >
            {creating ? "作成中..." : "ダイジェスト作成"}
          </button>
        </section>
      )}

      {error && (
        <div
          style={{
            padding: "10px 14px",
            marginBottom: 16,
            borderRadius: 8,
            background: "#fef2f2",
            color: "#7f1d1d",
            fontSize: 12,
          }}
        >
          {error}
        </div>
      )}

      {loading ? (
        <p style={{ fontSize: 13, color: "#6b8e75" }}>読み込み中...</p>
      ) : digests.length === 0 ? (
        <p style={{ fontSize: 13, color: "#95d5b2" }}>
          まだダイジェストがありません。
        </p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {digests.map((d) => {
            const style = STATUS_LABEL[d.status];
            const key = toMonthKey(d.digest_month);
            return (
              <li key={d.id} style={{ marginBottom: 12 }}>
                <Link
                  href={`/bloom/monthly-digest/${key}`}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 16,
                    padding: "14px 18px",
                    background: "#fff",
                    borderRadius: 12,
                    border: "1px solid #d8f3dc",
                    boxShadow: "0 2px 6px rgba(64, 145, 108, 0.05)",
                    textDecoration: "none",
                    color: "#1b4332",
                  }}
                >
                  <div style={{ fontSize: 22, fontWeight: 800, minWidth: 90 }}>
                    {key}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 700 }}>{d.title}</div>
                    <div style={{ fontSize: 11, color: "#6b8e75", marginTop: 2 }}>
                      {d.pages.length} ページ
                      {d.published_at && ` · 公開 ${d.published_at.slice(0, 10)}`}
                    </div>
                  </div>
                  <span
                    style={{
                      fontSize: 11,
                      padding: "3px 10px",
                      borderRadius: 10,
                      background: style.bg,
                      color: style.color,
                      fontWeight: 600,
                    }}
                  >
                    {style.label}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
