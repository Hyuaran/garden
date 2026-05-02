"use client";

/**
 * Garden Bloom トップ画面 — v2.8a-bloom Step 1 (画面 1 先行実装)
 *
 * dispatch v2.8a-bloom main-7 (2026-05-02 10:04) の Step 1 対応。
 *
 * プロト出典:
 *   015_Gardenシリーズ/000_GardenUI_bloom/02_BloomTop/index.html (v1.4)
 *   "ホーム画面 v2.8a の建付けを完全踏襲" (README 明記)
 *
 * 構成（v2.8a 構成流用）:
 *   <div className="bloom-page">  -- bloom-page CSS scoping anchor
 *     <BackgroundLayer />          -- bg_bloom_garden_light/dark cross-fade
 *     <Topbar />                   -- v2.8a 既存 (Bloom 用ではないが流用、Phase 2 で拡張案)
 *     <Sidebar />                  -- v2.8a 既存（Phase 2 で dual-style に置換予定）
 *     <main className="garden-v28a-main">
 *       <BloomPageHeader />        -- page-header + page-title + 桜花 SVG + subtitle
 *       <BloomKpiGrid />           -- 4 KPI カード（日報率/進捗順調/マイルストーン/ステータス）
 *       <BloomNavGrid />           -- 4 ナビカード（Workboard/DailyReport/MonthlyDigest/CEOStatus）
 *     </main>
 *     <ActivityPanel />            -- v2.8a 既存（Phase 2 で activity-toggle 折り畳み追加予定）
 *   </div>
 *
 * Phase 1 範囲（本 commit）:
 *   - 視覚確認可能なレベルの基本 layout
 *   - Bloom 専用 light/dark bg
 *   - hardcoded mock 値（プロト準拠）
 *
 * Phase 2 範囲（後続 commit）:
 *   - dual sidebar (nav-apps + nav-pages)
 *   - page-favorite-btn 詳細
 *   - activity-toggle (panel 折り畳み)
 *   - sakura-bg / peony-bg overlay
 *   - お気に入り永続化 / その他細部
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import BackgroundLayer from "../_components/layout/BackgroundLayer";
import Topbar from "../_components/layout/Topbar";
import Sidebar from "../_components/layout/Sidebar";
import ActivityPanel from "../_components/home/ActivityPanel";

import BloomPageHeader from "./_components/BloomPageHeader";
import BloomKpiGrid from "./_components/BloomKpiGrid";
import BloomNavGrid from "./_components/BloomNavGrid";

import { useTheme } from "../_lib/theme/ThemeProvider";
import {
  ATMOSPHERE_BLOOM_LIGHT,
  ATMOSPHERE_BLOOM_DARK,
} from "../_lib/background/atmospheres";
import { useActivityHeight } from "../_hooks/useActivityHeight";
import {
  getWeatherByHour,
  getWeatherIconPath,
  WEATHER_LABELS,
} from "../_lib/weather/getWeather";
import {
  getSoundEnabled,
  setSoundEnabled,
  playPon,
  unlockAudio,
} from "../_lib/sound/playSound";

// 日付ラベル
const WEEKDAY_JP = ["日", "月", "火", "水", "木", "金", "土"];
function formatDateLabel(d: Date): string {
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日（${WEEKDAY_JP[d.getDay()]}）`;
}

export default function BloomTopPage() {
  const { theme, toggleTheme } = useTheme();

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

  // === bloom-page body class scoping ===
  // CSS .bloom-page .* 系のスコープが効くよう <html> に attribute 付与
  // (body class だと SSR/CSR で hydration mismatch しやすいため html data 属性で代用)
  useEffect(() => {
    document.documentElement.dataset.page = "bloom";
    return () => {
      delete document.documentElement.dataset.page;
    };
  }, []);

  // === BG layer cross-fade (Bloom 用は light/dark の 2 種のみ、carousel なし) ===
  const targetBgUrl = useMemo<string>(() => {
    return theme === "dark"
      ? ATMOSPHERE_BLOOM_DARK.path
      : ATMOSPHERE_BLOOM_LIGHT.path;
  }, [theme]);

  const [activeLayer, setActiveLayer] = useState<1 | 2>(1);
  const [layer1Src, setLayer1Src] = useState<string>(
    ATMOSPHERE_BLOOM_LIGHT.path,
  );
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

  // === BG click zone — Bloom Top では light/dark のみ、click 切替なし ===
  // NG 3 (main- No.14): bg-click-zone を CSS で完全 hide、onClick 不要のため undefined
  // → bg-click-zone div の cursor: pointer / role="button" も付与されなくなる

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

  // === 1m: 時刻 / 1h: 天気 ===
  const [now, setNow] = useState<Date>(() => new Date());
  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(t);
  }, []);

  const [weatherHour, setWeatherHour] = useState<number>(() =>
    new Date().getHours(),
  );
  useEffect(() => {
    const t = window.setInterval(() => {
      setWeatherHour(new Date().getHours());
    }, 60 * 60 * 1000);
    return () => window.clearInterval(t);
  }, []);

  const weatherKind = useMemo(() => getWeatherByHour(weatherHour), [weatherHour]);
  const weatherIconSrc = useMemo(
    () => getWeatherIconPath(weatherKind),
    [weatherKind],
  );
  const weatherLabel = WEATHER_LABELS[weatherKind];

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

  const dateLabel = useMemo(() => formatDateLabel(now), [now]);
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
        /* onClickZone を undefined にすることで bg-click-zone は inert に（NG 3 対応）
           CSS でも .bloom-page .bg-click-zone を display:none に */
      />

      <Topbar
        dateLabel={dateLabel}
        weatherIconSrc={weatherIconSrc}
        weatherLabel={weatherLabel}
        soundMuted={!soundEnabled}
        onSoundToggle={handleSoundToggle}
        themeIconSrc={themeIconSrc}
        onThemeToggle={handleThemeToggle}
        onBellClick={handleBellClick}
      />

      <Sidebar />

      <main className="garden-v28a-main">
        <BloomPageHeader />
        <BloomKpiGrid />
        <BloomNavGrid />
      </main>

      <ActivityPanel ref={activityRef} />
    </div>
  );
}
