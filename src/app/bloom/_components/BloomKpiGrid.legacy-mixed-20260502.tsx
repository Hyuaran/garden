/**
 * BloomKpiGrid — Bloom Top の 4 KPI カード
 *
 * プロト 015_Gardenシリーズ/000_GardenUI_bloom/02_BloomTop/index.html line 283-367 移植
 *   - 1: 今月の日報提出率（リング 87%）
 *   - 2: 進捗順調モジュール数（バー 8/12）
 *   - 3: 今月の達成マイルストーン（折れ線 4 件）
 *   - 4: 本日のステータス（折れ線「集中業務中」）
 *
 * Phase 1: hardcoded mock values（プロト準拠）、Supabase 連携は Phase 2-Step 5 で
 */

export default function BloomKpiGrid() {
  return (
    <section className="kpi-grid">
      {/* 1: 今月の日報提出率 */}
      <div className="kpi-card">
        <div className="kpi-header">
          <span className="kpi-label">今月の日報提出率</span>
        </div>
        <div className="kpi-value-row">
          <div className="kpi-value">
            87<small>%</small>
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
                stroke="#7a9968"
                strokeWidth="6"
                fill="none"
                strokeDasharray="163.4"
                strokeDashoffset="21.2"
                transform="rotate(-90 30 30)"
                strokeLinecap="round"
              />
            </svg>
          </div>
        </div>
        <div className="kpi-trend up">
          <span className="kpi-trend-label">前月比</span>
          <span className="kpi-trend-arrow">↑</span>
          <span>5%</span>
        </div>
      </div>

      {/* 2: 進捗順調モジュール数 */}
      <div className="kpi-card">
        <div className="kpi-header">
          <span className="kpi-label">進捗順調モジュール数</span>
        </div>
        <div className="kpi-value">
          8<small> / 12</small>
        </div>
        <div className="kpi-bars">
          {[90, 85, 80, 75, 70, 65, 60, 55].map((h, i) => (
            <span
              key={`g${i}`}
              style={{
                height: `${h}%`,
                background: "linear-gradient(180deg,#9bb88a 0%,#7a9968 100%)",
              }}
            />
          ))}
          {[30, 25, 20, 15].map((h, i) => (
            <span
              key={`m${i}`}
              style={{
                height: `${h}%`,
                background: "linear-gradient(180deg,#d4c8a6 0%,#b3a98f 100%)",
              }}
            />
          ))}
        </div>
      </div>

      {/* 3: 今月の達成マイルストーン */}
      <div className="kpi-card">
        <div className="kpi-header">
          <span className="kpi-label">今月の達成マイルストーン</span>
        </div>
        <div className="kpi-value">
          4<small>件</small>
        </div>
        <div className="kpi-trend up">
          <span className="kpi-trend-label">前月比</span>
          <span className="kpi-trend-arrow">↑</span>
          <span>2件</span>
        </div>
        <svg className="kpi-chart" viewBox="0 0 200 50" preserveAspectRatio="none">
          <path
            d="M0,40 Q20,38 40,35 T80,30 T120,22 T160,15 T200,8"
            stroke="#d4a541"
            strokeWidth="1.5"
            fill="none"
          />
          <path
            d="M0,40 Q20,38 40,35 T80,30 T120,22 T160,15 T200,8 L200,50 L0,50 Z"
            fill="url(#bloom-grad-gold)"
            opacity="0.3"
          />
          <defs>
            <linearGradient id="bloom-grad-gold" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#d4a541" />
              <stop offset="100%" stopColor="#d4a541" stopOpacity="0" />
            </linearGradient>
          </defs>
        </svg>
      </div>

      {/* 4: 本日のステータス */}
      <div className="kpi-card">
        <div className="kpi-header">
          <span className="kpi-label">本日のステータス</span>
        </div>
        <div
          className="kpi-value"
          style={{
            fontFamily: "'Shippori Mincho', serif",
            fontSize: "1.55rem",
            lineHeight: 1.5,
          }}
        >
          集中業務中
        </div>
        <svg className="kpi-chart" viewBox="0 0 200 50" preserveAspectRatio="none">
          <path
            d="M0,30 Q15,28 25,25 T45,28 T70,20 T95,18 T120,15 T145,20 T170,18 T200,15"
            stroke="#8ab4cc"
            strokeWidth="1.5"
            fill="none"
          />
          <path
            d="M0,30 Q15,28 25,25 T45,28 T70,20 T95,18 T120,15 T145,20 T170,18 T200,15 L200,50 L0,50 Z"
            fill="url(#bloom-grad-blue)"
            opacity="0.25"
          />
          <defs>
            <linearGradient id="bloom-grad-blue" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#8ab4cc" />
              <stop offset="100%" stopColor="#8ab4cc" stopOpacity="0" />
            </linearGradient>
          </defs>
        </svg>
      </div>
    </section>
  );
}
