"use client";

/**
 * Today's Activity 右タイムライン（v6 dispatch Step 6）
 *
 * 5/5 デモ用: モック 5 entries（売上更新 / 入金 / タスク / 承認 / システム）
 * post-5/5 で bloom_notifications Cron 3 連携（async fetch + Realtime channel）
 *
 * AppHeader の通知ベル click と連動:
 *   - AppHeader bell click 時、window で 'garden:activity:toggle' CustomEvent を dispatch
 *   - 本コンポーネントが受信して visible state トグル
 *   - 自身の × button でも閉じられる（独立 state）
 */

import { useEffect, useState } from "react";

type ActivityItem = {
  time: string;
  icon: string;
  title: string;
  detail: string;
  /** カラーアクセント（icon背景） */
  accent: string;
};

const MOCK_ITEMS: ReadonlyArray<ActivityItem> = [
  {
    time: "09:30",
    icon: "🌳",
    title: "売上レポートが更新されました",
    detail: "今月の売上が前月比 12.5% 増加しました。",
    accent: "#3B9B5C",
  },
  {
    time: "09:15",
    icon: "💧",
    title: "入金がありました",
    detail: "株式会社ナチュラルハート様より ¥2,150,000 の入金",
    accent: "#4FA8C9",
  },
  {
    time: "08:45",
    icon: "🌸",
    title: "新しいタスクが割り当てられました",
    detail: "請求書の送付確認（5件）が割り当てられました。",
    accent: "#E07A9B",
  },
  {
    time: "08:30",
    icon: "✅",
    title: "ワークフロー申請が承認されました",
    detail: "経費精算申請（山田 太郎）が承認されました。",
    accent: "#7FC66D",
  },
  {
    time: "08:00",
    icon: "🌲",
    title: "システムからのお知らせ",
    detail: "メンテナンスは正常に完了しました。すべてのシステムが利用可能です。",
    accent: "#5C4332",
  },
];

export function TodaysActivity() {
  const [open, setOpen] = useState(true);

  // AppHeader 通知ベルからの open/close 連動
  useEffect(() => {
    const handler = () => setOpen((v) => !v);
    window.addEventListener("garden:activity:toggle", handler);
    return () => window.removeEventListener("garden:activity:toggle", handler);
  }, []);

  if (!open) {
    return null;
  }

  return (
    <aside
      data-testid="todays-activity"
      data-state={open ? "open" : "closed"}
      aria-label="Today's Activity"
      style={{
        width: 320,
        minWidth: 320,
        height: "calc(100vh - 64px)",
        position: "sticky",
        top: 64,
        background: "rgba(255, 255, 255, 0.95)",
        backdropFilter: "blur(12px)",
        borderLeft: "1px solid #E8E5DD",
        boxShadow: "-2px 0 8px rgba(0, 0, 0, 0.04)",
        display: "flex",
        flexDirection: "column",
        zIndex: 4,
      }}
    >
      {/* header + close */}
      <div
        style={{
          padding: "16px 18px 12px",
          borderBottom: "1px solid #E8E5DD",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <h2 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "#1F5C3A" }}>
          Today's Activity
        </h2>
        <button
          type="button"
          aria-label="閉じる"
          data-testid="todays-activity-close"
          onClick={() => setOpen(false)}
          style={{
            background: "transparent",
            border: "none",
            cursor: "pointer",
            color: "#7A8B7E",
            fontSize: 16,
            padding: 2,
          }}
        >
          ✕
        </button>
      </div>

      {/* timeline */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "12px 14px 0",
        }}
      >
        {MOCK_ITEMS.map((item, idx) => (
          <article
            key={idx}
            data-testid={`activity-item-${idx}`}
            style={{
              display: "flex",
              gap: 12,
              padding: "12px 0",
              borderBottom: idx < MOCK_ITEMS.length - 1 ? "1px solid #F0EDE5" : "none",
            }}
          >
            <time
              style={{
                fontSize: 11,
                color: "#7A8B7E",
                fontWeight: 600,
                minWidth: 40,
                paddingTop: 4,
              }}
            >
              {item.time}
            </time>
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                <span
                  aria-hidden
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: "50%",
                    background: `${item.accent}22`,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 12,
                  }}
                >
                  {item.icon}
                </span>
                <div style={{ fontSize: 12, fontWeight: 600, color: "#2B2B2B" }}>
                  {item.title}
                </div>
              </div>
              <div style={{ fontSize: 11, color: "#5C6E5F", lineHeight: 1.5, paddingLeft: 28 }}>
                {item.detail}
              </div>
            </div>
          </article>
        ))}
      </div>

      {/* footer button */}
      <div style={{ padding: "12px 14px 16px", borderTop: "1px solid #E8E5DD" }}>
        <a
          href="/bloom/activity"
          data-testid="todays-activity-view-all"
          style={{
            display: "block",
            padding: "8px 12px",
            background: "rgba(168, 216, 122, 0.18)",
            color: "#1F5C3A",
            fontSize: 12,
            fontWeight: 600,
            borderRadius: 8,
            textDecoration: "none",
            textAlign: "center",
          }}
        >
          すべて表示
        </a>
      </div>
    </aside>
  );
}
