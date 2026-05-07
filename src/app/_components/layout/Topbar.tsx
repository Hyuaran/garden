/**
 * Topbar (v2.8a Step 5 — 動的版)
 *
 * DESIGN_SPEC §4-1
 *
 * ロゴ（左）+ 検索ボックス（中央）+ 右側情報エリア
 *   - 日付 / 天気 / システム正常 / 音 toggle / theme toggle / ベル / ユーザー
 *
 * Step 5: 動的 prop 配線済み
 *   - weatherIconSrc / weatherLabel : 1h interval で更新（page.tsx で）
 *   - soundMuted: bool, onSoundToggle: 音 ON/OFF
 *   - themeIconSrc, onThemeToggle: light/dark 切替
 *   - onBellClick: 通知 (Step 5 では未使用、ベル押下 callback)
 *   - dateLabel: 日付表示文字列
 */
type TopbarProps = {
  /** 日付ラベル（例: "2026年4月27日（月）"） */
  dateLabel?: string;
  /** 天気アイコン image path */
  weatherIconSrc?: string;
  /** 天気ラベル（例: "晴れ"） */
  weatherLabel?: string;
  /** 音 OFF（muted）状態 */
  soundMuted?: boolean;
  onSoundToggle?: () => void;
  /** theme toggle アイコン (sun/moon) image path */
  themeIconSrc?: string;
  onThemeToggle?: () => void;
  /** 通知ベル click（Step 5 では panel toggle 想定） */
  onBellClick?: () => void;
};

export default function Topbar({
  dateLabel = "2026年4月27日（月）",
  weatherIconSrc = "/images/header_icons/weather_02_partly_cloudy.png",
  weatherLabel = "晴れ時々曇り",
  soundMuted = true,
  onSoundToggle,
  themeIconSrc = "/images/theme_icons/theme_sun.png",
  onThemeToggle,
  onBellClick,
}: TopbarProps) {
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
          <span className="info-text">{dateLabel}</span>
        </div>

        {/* 天気（動的） */}
        <div className="info-item">
          <span className="info-icon">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={weatherIconSrc} alt="" id="weatherIcon" />
          </span>
          <div className="info-text">
            <strong id="weatherTemp">25℃</strong>
            <small id="weatherLabel">{weatherLabel}</small>
          </div>
        </div>

        {/* システム正常 */}
        <div className="info-item">
          <span className="status-dot" />
          <span className="info-text">すべてのシステム正常</span>
        </div>

        {/* 音 toggle (動的) */}
        <button
          type="button"
          className={`sound-toggle${soundMuted ? " muted" : ""}`}
          id="soundToggle"
          title="音 ON/OFF"
          onClick={onSoundToggle}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/images/header_icons/header_sound.png" alt="" />
        </button>

        {/* theme toggle (動的) */}
        <button
          type="button"
          className="theme-toggle"
          id="themeToggle"
          title="ライト/ダーク切替"
          onClick={onThemeToggle}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={themeIconSrc} alt="" id="themeToggleIcon" />
        </button>

        {/* ベル (動的 click) */}
        <button
          type="button"
          className="bell-btn"
          title="通知"
          onClick={onBellClick}
        >
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
