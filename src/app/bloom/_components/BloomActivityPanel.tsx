"use client";

/**
 * BloomActivityPanel — 試作版 1:1 移植版 Activity Panel (dispatch main- No.16)
 *
 * プロト 015_Gardenシリーズ/000_GardenUI_bloom/02_BloomTop/index.html line 412-475 移植。
 *
 * Bloom 専用 5 entries (5/5 後道さんデモ向け):
 *   11:30  ステータスを更新しました - 集中業務中に設定しました
 *   10:45  本日の予定を完了しました - 10:00 Bloom ワークボード確認
 *   10:05  プロジェクトが更新されました - 4月施策計画①、進捗 85%
 *   09:20  予定が追加されました - 16:00 月次ダイジェスト編集
 *   08:50  リアクション - 5/5 後道代表 Garden デモ にあらわれます
 *
 * activity-toggle (panel 外配置、左側にトグルボタン):
 *   - localStorage `garden_activity_collapsed` で永続化
 *   - body.activity-collapsed クラスで CSS 折り畳み
 */

import { forwardRef, useCallback, useEffect, useState } from "react";

type ActivityEntry = {
  time: string;
  iconType: "image" | "check";
  iconSrc?: string;
  title: string;
  body: React.ReactNode;
};

const ENTRIES: ActivityEntry[] = [
  {
    time: "11:30",
    iconType: "image",
    iconSrc: "/images/icons_bloom/bloom_workboard.png",
    title: "ステータスを更新しました",
    body: <>集中業務中に設定しました。</>,
  },
  {
    time: "10:45",
    iconType: "check",
    title: "本日の予定を完了しました",
    body: <>「10:00 Bloom ワークボード確認」を完了しました。</>,
  },
  {
    time: "10:05",
    iconType: "image",
    iconSrc: "/images/icons_bloom/bloom_ceostatus.png",
    title: "プロジェクトが更新されました",
    body: <>「4月施策計画①」の進捗が85%になりました。</>,
  },
  {
    time: "09:20",
    iconType: "image",
    iconSrc: "/images/icons_bloom/bloom_dailyreport.png",
    title: "予定が追加されました",
    body: <>「16:00 月次ダイジェスト編集」を追加しました。</>,
  },
  {
    time: "08:50",
    iconType: "image",
    iconSrc: "/images/icons_bloom/bloom_monthlydigest.png",
    title: "リアクション",
    body: <>「5/5 後道代表 Garden デモ」にあらわれます。</>,
  },
];

const STORAGE_KEY = "garden_activity_collapsed";

const BloomActivityPanel = forwardRef<HTMLElement>(function BloomActivityPanel(
  _props,
  ref,
) {
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      const isCollapsed = stored === "1";
      setCollapsed(isCollapsed);
      document.body.classList.toggle("activity-collapsed", isCollapsed);
    } catch {
      /* ignore */
    }
    return () => {
      document.body.classList.remove("activity-collapsed");
    };
  }, []);

  const toggleCollapsed = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      document.body.classList.toggle("activity-collapsed", next);
      return next;
    });
  }, []);

  return (
    <>
      {/* Activity Panel トグルボタン (panel 外配置、親 transform/opacity 影響回避) */}
      <button
        type="button"
        className="activity-toggle"
        title="Activity Panel 収納/展開"
        aria-expanded={!collapsed}
        onClick={toggleCollapsed}
      >
        <span className="activity-toggle-arrow" aria-hidden>
          ‹
        </span>
      </button>

      <aside className="activity-panel" ref={ref}>
        <div className="activity-header">
          <div className="activity-title">
            <h3>Today&apos;s Activity</h3>
          </div>
          <a href="#" className="activity-all">
            すべて表示
          </a>
        </div>

        <ul className="activity-list">
          {ENTRIES.map((entry, idx) => (
            <li key={idx} className="activity-item">
              <span className="activity-time">{entry.time}</span>
              {entry.iconType === "check" ? (
                <span className="activity-icon-check">✓</span>
              ) : (
                <span className="activity-icon">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={entry.iconSrc} alt="" />
                </span>
              )}
              <div className="activity-body">
                <strong>{entry.title}</strong>
                <p>{entry.body}</p>
              </div>
            </li>
          ))}
        </ul>

        <button type="button" className="notify-btn">
          <span>⚙</span> 通知設定をカスタマイズ
          <span className="arrow">›</span>
        </button>
      </aside>
    </>
  );
});

export default BloomActivityPanel;
