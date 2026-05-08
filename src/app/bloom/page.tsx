"use client";

/**
 * Garden Bloom トップ画面 — 試作版 1:1 移植版 (dispatch main- No.16)
 *
 * dispatch main- No.16 (2026-05-02) の方針転換:
 *   旧: 既存 v2.8a Garden 構成 + Bloom 固有 OrbGrid/KpiGrid/PageHeader/Sidebar の混合
 *   新: プロト 015_Gardenシリーズ/000_GardenUI_bloom/02_BloomTop/index.html (v1.4) を 1:1 移植
 *
 * 旧版は src/app/bloom/page.legacy-mixed-20260502.tsx に保持（削除禁止）。
 *
 * 構成:
 *   <div className="bloom-page">
 *     <BackgroundLayer />          -- bg_bloom_garden_light/dark (Bloom 専用 2 種)
 *     <BloomTopbar />              -- Topbar (logo + search + 日付/天気/正常/theme/sound/bell+badge/Help/Favorite/User)
 *     <BloomSidebar />             -- dual sidebar (nav-apps + nav-pages + nav-pages-toggle)
 *     <main className="garden-v28a-main">
 *       <BloomPageHeader />        -- page-header (page-favorite-btn + 桜花タイトル + subtitle)
 *       <BloomKpiGrid />           -- 4 KPI cards
 *       <BloomNavGrid />           -- 4 nav cards (Workboard live + 3 Coming Soon Toast 既存維持)
 *     </main>
 *     <BloomActivityPanel />       -- Bloom 専用 5 entries + activity-toggle button
 *   </div>
 *
 * 既存ロジック流用 (試作版にない or 既存の方が優れる):
 *   - playPon (sound toggle、D7 既存維持)
 *   - Coming Soon Toast (BloomNavGrid、D21/D23 main-No.14 で実装済)
 *   - BloomGate dev バイパス (main-No.9 commit 988efa5)
 *   - getWeatherByHour (時刻ベース天気自動更新、既存)
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import BackgroundLayer from "../_components/layout/BackgroundLayer";

import BloomTopbar from "./_components/BloomTopbar";
import BloomSidebar from "./_components/BloomSidebar";
import BloomPageHeader from "./_components/BloomPageHeader";
import BloomKpiGrid from "./_components/BloomKpiGrid";
import BloomNavGrid from "./_components/BloomNavGrid";
import BloomActivityPanel from "./_components/BloomActivityPanel";

import { useTheme } from "../_lib/theme/ThemeProvider";
import {
  ATMOSPHERE_BLOOM_LIGHT,
  ATMOSPHERE_BLOOM_DARK,
} from "../_lib/background/atmospheres";
import { useActivityHeight } from "../_hooks/useActivityHeight";
// dispatch main- No.19 #4: 天気は固定 mock (22℃ 晴れ) のため getWeather 系 import 不要化
// Phase 3 で Open-Meteo API 連動時に再 import 予定
import {
  getSoundEnabled,
  setSoundEnabled,
  playPon,
  unlockAudio,
} from "../_lib/sound/playSound";

const WEEKDAY_JP = ["日", "月", "火", "水", "木", "金", "土"];
function formatDateLabel(d: Date): string {
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日（${WEEKDAY_JP[d.getDay()]}）`;
}

export default function BloomTopPage() {
  const { theme, toggleTheme } = useTheme();

  // === Mounted フラグ (SSR/CSR hydration mismatch 回避) ===
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  // === Sound ===
  const [soundEnabled, setSoundEnabledState] = useState<boolean>(false);
  useEffect(() => {
    setSoundEnabledState(getSoundEnabled());
  }, []);
  const handleSoundToggle = useCallback(() => {
    unlockAudio();
    const next = !soundEnabled;
    setSoundEnabled(next);
    setSoundEnabledState(next);
    if (next) playPon(0.1);
  }, [soundEnabled]);

  // === BG layer cross-fade (Bloom 専用 light/dark 2 種) ===
  const targetBgUrl = useMemo<string>(() => {
    return theme === "dark" ? ATMOSPHERE_BLOOM_DARK.path : ATMOSPHERE_BLOOM_LIGHT.path;
  }, [theme]);

  const [activeLayer, setActiveLayer] = useState<1 | 2>(1);
  const [layer1Src, setLayer1Src] = useState<string>(ATMOSPHERE_BLOOM_LIGHT.path);
  const [layer2Src, setLayer2Src] = useState<string | undefined>(undefined);

  useEffect(() => {
    const current = activeLayer === 1 ? layer1Src : layer2Src;
    if (current === targetBgUrl) return;
    if (activeLayer === 1) {
      setLayer2Src(targetBgUrl);
      setActiveLayer(2);
    } else {
      setLayer1Src(targetBgUrl);
      setActiveLayer(1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetBgUrl]);

  // === Theme toggle ===
  const handleThemeToggle = useCallback(() => {
    unlockAudio();
    toggleTheme();
    if (soundEnabled) playPon(0.08);
  }, [toggleTheme, soundEnabled]);

  // === Bell ===
  const handleBellClick = useCallback(() => {
    unlockAudio();
    if (soundEnabled) playPon(0.08);
  }, [soundEnabled]);

  // === Logout (D12 — Phase 2 で BloomState の lockAndLogout 等にバインド予定) ===
  const handleLogout = useCallback(() => {
    // 暫定: dev バイパス中なので alert で挙動確認、prod では BloomState.lockAndLogout バインド
    window.alert("ログアウト機能は現在準備中です（dev バイパス中）。");
  }, []);

  // === 1m: 時刻 (SSR では null、mount 後に動的) ===
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const t = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(t);
  }, []);

  // dispatch main- No.19 #4: 天気は プロト準拠で「晴れ」「22℃」固定 mock
  // (旧 getWeatherByHour ロジックは深夜帯に「雪」「雷」等を返し プロト不一致だったため固定化)
  // Phase 3 で Open-Meteo API 連動予定
  const weatherIconSrc = "/images/header_icons/weather_01_sunny.png";
  const weatherLabel = "晴れ";
  const weatherTemp = "22℃";

  // === Activity Panel 高さ追従 ===
  const activityRef = useRef<HTMLElement>(null);
  useActivityHeight(activityRef, 80, 32);

  // === User-gesture audio unlock ===
  useEffect(() => {
    function onFirstClick() {
      unlockAudio();
      window.removeEventListener("click", onFirstClick);
    }
    window.addEventListener("click", onFirstClick, { once: true });
    return () => window.removeEventListener("click", onFirstClick);
  }, []);

  // SSR では空、client mount 後に日付表示（hydration mismatch 回避）
  const dateLabel = useMemo(() => (now === null ? "" : formatDateLabel(now)), [now]);
  void mounted; // 参照確保（将来の追加 SSR-safe 表示用）
  const themeIconSrc =
    theme === "dark"
      ? "/images/theme_icons/theme_moon.png"
      : "/images/theme_icons/theme_sun.png";

  return (
    <div className="bloom-page">
      <BackgroundLayer
        layer1Src={layer1Src}
        layer2Src={layer2Src}
        activeLayer={activeLayer}
        showHint={false}
        /* onClickZone undefined で bg-click-zone は inert (D32/D33 hide も CSS で適用) */
      />

      <BloomTopbar
        dateLabel={dateLabel}
        weatherIconSrc={weatherIconSrc}
        weatherTemp={weatherTemp}
        weatherLabel={weatherLabel}
        themeIconSrc={themeIconSrc}
        onThemeToggle={handleThemeToggle}
        soundMuted={!soundEnabled}
        onSoundToggle={handleSoundToggle}
        onBellClick={handleBellClick}
        onLogout={handleLogout}
      />

      <BloomSidebar />

      <main className="garden-v28a-main">
        <BloomPageHeader />
        <BloomKpiGrid />
        <BloomNavGrid />
      </main>

      <BloomActivityPanel ref={activityRef} />
    </div>
  );
}
