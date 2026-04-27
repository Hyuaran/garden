/**
 * Topbar (v2.8a Step 3 — 静的版)
 *
 * DESIGN_SPEC §4-1
 *
 * ロゴ（左）+ 検索ボックス（中央）+ 右側情報エリア
 *   - 日付 / 天気 / システム正常 / 音 toggle / theme toggle / ベル / ユーザー
 *
 * Step 3 では:
 *   - 日付・天気は静的表示（仮値）
 *   - 音/theme/ベルは button のみ。onClick は Step 4-5 で配線
 *   - id 属性は v2.8a プロトタイプの DOM 操作と互換のため残置
 */
export default function Topbar() {
  return (
    <header className="topbar">
      {/* ===== ロゴ + ブランド名 ===== */}
      <div className="topbar-brand">
        <div className="topbar-brand-logo">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/images/logo/garden_logo.png" alt="Garden Series" />
        </div>
        <div className="topbar-brand-text">
          <span className="topbar-brand-name">Garden Series</span>
          <span className="topbar-brand-tagline">
            業務を、育てる。
            <span className="topbar-brand-tagline-en">/ Grow Your Business.</span>
          </span>
        </div>
      </div>

      {/* ===== 検索ボックス ===== */}
      <div className="search-box">
        <span className="search-icon">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/images/header_icons/header_search.png" alt="" />
        </span>
        <input
          type="text"
          placeholder="検索（取引先、請求書、タスク、ヘルプなど）"
        />
        <span className="search-shortcut">Ctrl+F</span>
      </div>

      {/* ===== 右側情報エリア ===== */}
      <div className="topbar-info">
        {/* 日付 */}
        <div className="info-item">
          <span className="info-icon">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/images/header_icons/header_calendar.png" alt="" />
          </span>
          <span className="info-text">2026年4月27日（月）</span>
        </div>

        {/* 天気（Step 4 で時刻ベース動的化） */}
        <div className="info-item">
          <span className="info-icon">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/images/header_icons/weather_02_partly_cloudy.png"
              alt=""
              id="weatherIcon"
            />
          </span>
          <div className="info-text">
            <strong id="weatherTemp">25℃</strong>
            <small id="weatherLabel">晴れ時々曇り</small>
          </div>
        </div>

        {/* システム正常 */}
        <div className="info-item">
          <span className="status-dot" />
          <span className="info-text">すべてのシステム正常</span>
        </div>

        {/* 音 toggle (Step 4 で音再生配線) */}
        <button
          type="button"
          className="sound-toggle muted"
          id="soundToggle"
          title="音 ON/OFF"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/images/header_icons/header_sound.png" alt="" />
        </button>

        {/* theme toggle (Step 4 で dark mode 切替配線) */}
        <button
          type="button"
          className="theme-toggle"
          id="themeToggle"
          title="ライト/ダーク切替"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/images/theme_icons/theme_sun.png"
            alt=""
            id="themeToggleIcon"
          />
        </button>

        {/* ベル (Step 5 で通知 panel 配線) */}
        <button type="button" className="bell-btn" title="通知">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/images/header_icons/header_bell.png" alt="" />
        </button>

        {/* ユーザーエリア */}
        <div className="user-area">
          <div className="user-avatar">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/images/avatar/avatar_shoji.png" alt="東海林 美琴" />
          </div>
          <div className="user-info">
            <strong>東海林 美琴</strong>
            <small>正社員 / 全権管理者</small>
          </div>
          <span className="user-arrow">⌄</span>
        </div>
      </div>
    </header>
  );
}
