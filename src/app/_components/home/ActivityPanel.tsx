/**
 * ActivityPanel (v2.8a Step 3 — 静的版)
 *
 * DESIGN_SPEC §4-6
 *
 * 浮島カード形式の Today's Activity panel。
 *   - 5 件の mock entries (時刻 / アイコン / タイトル / 詳細)
 *   - フッターに「すべて表示」リンク + 通知設定ボタン
 *
 * Step 3 では:
 *   - mock entries は index.html からそのまま移植
 *   - 高さ自動調整（top + bottom 両端固定 + JS 実測補正）は Step 4 で
 *     useActivityHeight フック配線予定。本 Step では CSS の暫定値で OK。
 */

type ActivityEntry = {
  time: string;
  /** icon 画像 path or 'check' (チェックマーク表示) */
  icon: string | "check";
  title: string;
  /** 詳細本文。<br/> を含む場合あり → React node で */
  body: React.ReactNode;
};

const ENTRIES: ActivityEntry[] = [
  {
    time: "09:30",
    icon: "/images/icons/tree.png",
    title: "売上レポートが更新されました",
    body: <>今月の売上が前月比 12.5% 増加しました。</>,
  },
  {
    time: "09:15",
    icon: "/images/icons/rill.png",
    title: "入金がありました",
    body: (
      <>
        株式会社ナチュラルハート様より
        <br />
        ¥2,150,000 の入金がありました。
      </>
    ),
  },
  {
    time: "08:45",
    icon: "/images/icons/bloom.png",
    title: "新しいタスクが割り当てられました",
    body: (
      <>
        請求書の送付確認（5件）が
        <br />
        割り当てられました。
      </>
    ),
  },
  {
    time: "08:30",
    icon: "check",
    title: "ワークフロー申請が承認されました",
    body: (
      <>
        経費精算申請（山田 太郎）が
        <br />
        承認されました。
      </>
    ),
  },
  {
    time: "08:00",
    icon: "/images/icons/tree.png",
    title: "システムからのお知らせ",
    body: (
      <>
        メンテナンスは正常に完了しました。
        <br />
        すべてのシステムが利用可能です。
      </>
    ),
  },
];

export default function ActivityPanel() {
  return (
    <aside className="activity-panel">
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
            {entry.icon === "check" ? (
              <span className="activity-icon-check">✓</span>
            ) : (
              <span className="activity-icon">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={entry.icon} alt="" />
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
  );
}
