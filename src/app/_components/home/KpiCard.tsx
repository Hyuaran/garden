/**
 * KpiCard (v2.8a Step 3 — 静的版)
 *
 * DESIGN_SPEC §4-4
 *
 * 4 種の KPI カード variant を 1 component に集約。
 *   A: 売上カード（折れ線チャート）
 *   B: 入金カード（棒グラフ）
 *   C: 達成率カード（リング）
 *   D: 警告カード（プログレスバー）
 *
 * mock 値は v2.8a プロトタイプ index.html からそのまま移植。
 * Step 4 以降で props 化 + 実データ接続予定（本 Step は静的レンダリング）。
 */

export type KpiCardVariant = "sales" | "deposit" | "callRate" | "tasks";

type Props = {
  variant: KpiCardVariant;
};

export default function KpiCard({ variant }: Props) {
  switch (variant) {
    case "sales":
      return <KpiCardSales />;
    case "deposit":
      return <KpiCardDeposit />;
    case "callRate":
      return <KpiCardCallRate />;
    case "tasks":
      return <KpiCardTasks />;
  }
}

/* ============================================================
   A: 売上カード（折れ線チャート）
   ============================================================ */
function KpiCardSales() {
  return (
    <div className="kpi-card">
      <div className="kpi-header">
        <span className="kpi-label">売上（今月）</span>
      </div>
      <div className="kpi-value">¥12,680,000</div>
      <div className="kpi-trend up">
        <span className="kpi-trend-label">前月比</span>
        <span className="kpi-trend-arrow">↑</span>
        <span>12.5%</span>
      </div>
      <svg className="kpi-chart" viewBox="0 0 200 50" preserveAspectRatio="none">
        <path
          d="M0,40 Q20,35 40,30 T80,25 T120,20 T160,15 T200,10"
          stroke="#7a9968"
          strokeWidth="1.5"
          fill="none"
        />
        <path
          d="M0,40 Q20,35 40,30 T80,25 T120,20 T160,15 T200,10 L200,50 L0,50 Z"
          fill="url(#grad-green)"
          opacity="0.3"
        />
        <defs>
          <linearGradient id="grad-green" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#7a9968" />
            <stop offset="100%" stopColor="#7a9968" stopOpacity="0" />
          </linearGradient>
        </defs>
      </svg>
    </div>
  );
}

/* ============================================================
   B: 入金カード（棒グラフ）
   ============================================================ */
function KpiCardDeposit() {
  const heights = [30, 50, 40, 65, 55, 75, 60, 80, 70, 90, 75, 85];
  return (
    <div className="kpi-card">
      <div className="kpi-header">
        <span className="kpi-label">入金予定（今月）</span>
      </div>
      <div className="kpi-value">¥8,450,000</div>
      <div className="kpi-trend up">
        <span className="kpi-trend-label">前月比</span>
        <span className="kpi-trend-arrow">↑</span>
        <span>8.3%</span>
      </div>
      <div className="kpi-bars">
        {heights.map((h, idx) => (
          <span key={idx} style={{ height: `${h}%` }} />
        ))}
      </div>
    </div>
  );
}

/* ============================================================
   C: 達成率カード（リング）
   ============================================================ */
function KpiCardCallRate() {
  return (
    <div className="kpi-card">
      <div className="kpi-header">
        <span className="kpi-label">架電状況（今日）</span>
      </div>
      <div className="kpi-value-row">
        <div className="kpi-value">
          68<small>%</small>
        </div>
        <div className="ring-progress">
          <svg viewBox="0 0 60 60">
            <circle
              cx="30"
              cy="30"
              r="26"
              stroke="#f0ead8"
              strokeWidth="6"
              fill="none"
            />
            <circle
              cx="30"
              cy="30"
              r="26"
              stroke="#d4a541"
              strokeWidth="6"
              fill="none"
              strokeDasharray="163.4"
              strokeDashoffset="52.3"
              transform="rotate(-90 30 30)"
              strokeLinecap="round"
            />
          </svg>
        </div>
      </div>
      <div className="kpi-sub">完了 34 / 50 件</div>
    </div>
  );
}

/* ============================================================
   D: 警告カード（プログレスバー）
   ============================================================ */
function KpiCardTasks() {
  return (
    <div className="kpi-card">
      <div className="kpi-header">
        <span className="kpi-label">未処理タスク</span>
      </div>
      <div className="kpi-value">
        24<small>件</small>
      </div>
      <div className="kpi-warning">期限超過 5 件</div>
      <div className="kpi-progress">
        <div className="kpi-progress-fill" style={{ width: "82%" }} />
        <span className="kpi-progress-text">82%</span>
      </div>
    </div>
  );
}
