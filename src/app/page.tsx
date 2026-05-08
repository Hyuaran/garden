"use client";

/**
 * Garden Series ホーム画面 — v2.8a Step 5 (5/5 後道さんデモ用 全面組み上げ)
 *
 * 経緯:
 *   V7-D-fix2 では 1 枚画像 + 透明 hit area で 12 module 配置していたが、
 *   後道さんの UX 採用ゲート（実物必須・遊び心・世界観）に応えるため、
 *   v2.8a プロトタイプを React 化する dispatch v2.8a で組み直し。
 *   旧 page.tsx は page_20260427T172100Z.tsx として保存。
 *
 * 構成:
 *   <BackgroundLayer />                (5 light + 1 dark bg、cross-fade、固定全画面)
 *   <Topbar />                         (上 80px、固定、theme/sound/weather/bell 動的)
 *   <Sidebar />                        (左 210px、固定)
 *   <main className="garden-v28a-main">
 *     <Greeting />                     (時刻ベース 1m 更新)
 *     <KpiGrid />                      (4 cards)
 *     <OrbGrid />                      (12 module、hover/click で音、href で遷移)
 *   </main>
 *   <ActivityPanel />                  (右側 floating、useActivityHeight で高さ追従)
 *
 * 動的機能:
 *   - useTheme() で light/dark 切替（Topbar.themeToggle）
 *   - useState で sound mute/unmute（Topbar.soundToggle）+ playPon (orb hover/click)
 *   - useBackgroundCarousel で bg index 管理 (BackgroundLayer.bgClickZone)
 *   - 1 hour interval で天気更新（getWeatherByHour）
 *   - 1 minute interval で挨拶更新（時刻ベース）
 *   - useActivityHeight で activity panel 高さ追従
 *
 * 既存 routes 維持（V7-D-fix2 互換）:
 *   - /bloom/workboard, /tree, /forest, /root, /bud, /leaf
 *   - /seed, /soil, /sprout, /fruit, /rill, /calendar (Coming Soon ページ)
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import BackgroundLayer from "./_components/layout/BackgroundLayer";
import Topbar from "./_components/layout/Topbar";
import Sidebar from "./_components/layout/Sidebar";
import Greeting from "./_components/home/Greeting";
import KpiGrid from "./_components/home/KpiGrid";
import OrbGrid from "./_components/home/OrbGrid";
import ActivityPanel from "./_components/home/ActivityPanel";

import { useTheme } from "./_lib/theme/ThemeProvider";
import {
  ATMOSPHERES_V28_LIGHT,
  ATMOSPHERE_V28_NIGHT,
} from "./_lib/background/atmospheres";
import { useBackgroundCarousel } from "./_hooks/useBackgroundCarousel";
import { useActivityHeight } from "./_hooks/useActivityHeight";
import {
  getWeatherByHour,
  getWeatherIconPath,
  WEATHER_LABELS,
} from "./_lib/weather/getWeather";
import {
  getSoundEnabled,
  setSoundEnabled,
  playPon,
  unlockAudio,
} from "./_lib/sound/playSound";

// ============================================================================
// 時刻ベース挨拶
// ============================================================================
function getGreetingByHour(hour: number): string {
  if (hour >= 5 && hour < 10) return "おはようございます";
  if (hour >= 10 && hour < 17) return "こんにちは";
  return "お疲れさまです";
}

// 日付ラベル（YYYY年M月D日（曜））
const WEEKDAY_JP = ["日", "月", "火", "水", "木", "金", "土"];
function formatDateLabel(d: Date): string {
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日（${WEEKDAY_JP[d.getDay()]}）`;
}

// ============================================================================
// メインページ
// ============================================================================
export default function GardenHomePage() {
  // === Theme (light/dark) ===
  const { theme, toggleTheme } = useTheme();

  // === Sound (ON/OFF) ===
  // localStorage 永続化、初回 mount 時に同期
  const [soundEnabled, setSoundEnabledState] = useState<boolean>(false);

  useEffect(() => {
    setSoundEnabledState(getSoundEnabled());
  }, []);

  const handleSoundToggle = useCallback(() => {
    unlockAudio();
    const next = !soundEnabled;
    setSoundEnabled(next);
    setSoundEnabledState(next);
    if (next) {
      // 切替直後、ON になった時は 1 度ポンと鳴らす
      playPon(0.1);
    }
  }, [soundEnabled]);

  // === Background carousel (5 light bg) ===
  const carousel = useBackgroundCarousel({
    count: ATMOSPHERES_V28_LIGHT.length,
    initialIndex: 0,
    mode: "manual",
  });

  // === Click hint (1.5s 後 4s 表示) ===
  const [showHint, setShowHint] = useState<boolean>(false);
  useEffect(() => {
    let t2: number | undefined;
    const t1 = window.setTimeout(() => {
      setShowHint(true);
      t2 = window.setTimeout(() => setShowHint(false), 4000);
    }, 1500);
    return () => {
      window.clearTimeout(t1);
      if (t2 !== undefined) window.clearTimeout(t2);
    };
  }, []);

  // === BG layer cross-fade state ===
  // theme: dark なら ATMOSPHERE_V28_NIGHT、light なら carousel.index
  // 2 layer 交互に active を切り替え
  const [activeLayer, setActiveLayer] = useState<1 | 2>(1);
  const [layer1Src, setLayer1Src] = useState<string>(
    ATMOSPHERES_V28_LIGHT[0]?.path ?? "/images/backgrounds/bg_01_morning.png",
  );
  const [layer2Src, setLayer2Src] = useState<string | undefined>(undefined);

  const targetBgUrl = useMemo<string>(() => {
    if (theme === "dark") return ATMOSPHERE_V28_NIGHT.path;
    return ATMOSPHERES_V28_LIGHT[carousel.index]?.path ?? ATMOSPHERES_V28_LIGHT[0].path;
  }, [theme, carousel.index]);

  // 初回 mount 後、targetBgUrl の変化に追従して inactive layer に新 url を設定 + active layer を交替
  useEffect(() => {
    // 既に active layer に同じ url が表示されているなら何もしない
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

  // === BG click zone ===
  // light モード時のみ次の bg、dark 時は無視
  const handleBgClick = useCallback(() => {
    unlockAudio();
    if (theme === "dark") return;
    carousel.next();
  }, [theme, carousel]);

  // === Theme button click (音再生 + toggle) ===
  const handleThemeToggle = useCallback(() => {
    unlockAudio();
    toggleTheme();
    if (soundEnabled) playPon(0.08);
  }, [toggleTheme, soundEnabled]);

  // === Bell (placeholder) ===
  const handleBellClick = useCallback(() => {
    unlockAudio();
    if (soundEnabled) playPon(0.08);
  }, [soundEnabled]);

  // === 1m interval: 時刻 (greeting + date) 更新 ===
  const [now, setNow] = useState<Date>(() => new Date());
  useEffect(() => {
    const t = window.setInterval(() => {
      setNow(new Date());
    }, 60_000);
    return () => window.clearInterval(t);
  }, []);

  // === 1h interval: 天気更新 (now の hour 変化に連動) ===
  const [weatherHour, setWeatherHour] = useState<number>(() => new Date().getHours());
  useEffect(() => {
    const t = window.setInterval(() => {
      setWeatherHour(new Date().getHours());
    }, 60 * 60 * 1000);
    return () => window.clearInterval(t);
  }, []);

  const weatherKind = useMemo(
    () => getWeatherByHour(weatherHour),
    [weatherHour],
  );
  const weatherIconSrc = useMemo(
    () => getWeatherIconPath(weatherKind),
    [weatherKind],
  );
  const weatherLabel = WEATHER_LABELS[weatherKind];

  // === Activity Panel 高さ追従 ===
  const activityRef = useRef<HTMLElement>(null);
  useActivityHeight(activityRef, 80, 32);

  // === Orb hover/click (音再生) ===
  const handleOrbHover = useCallback(() => {
    if (soundEnabled) playPon(0.08);
  }, [soundEnabled]);

  const handleOrbClick = useCallback(() => {
    unlockAudio();
    if (soundEnabled) playPon(0.13);
    // 遷移は Link の href が処理するので preventDefault しない
  }, [soundEnabled]);

  // === User-gesture 後 1 度だけ AudioContext を unlock ===
  useEffect(() => {
    function onFirstClick() {
      unlockAudio();
      window.removeEventListener("click", onFirstClick);
    }
    window.addEventListener("click", onFirstClick, { once: true });
    return () => window.removeEventListener("click", onFirstClick);
  }, []);

  // === 派生ラベル ===
  const greetingText = useMemo(() => getGreetingByHour(now.getHours()), [now]);
  const dateLabel = useMemo(() => formatDateLabel(now), [now]);
  const themeIconSrc =
    theme === "dark"
      ? "/images/theme_icons/theme_moon.png"
      : "/images/theme_icons/theme_sun.png";

  return (
    <>
      {/* 背景レイヤー (固定全画面、cross-fade) */}
      <BackgroundLayer
        layer1Src={layer1Src}
        layer2Src={layer2Src}
        activeLayer={activeLayer}
        onClickZone={handleBgClick}
        showHint={showHint}
      />

      {/* Topbar (上 80px、固定) */}
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

      {/* Sidebar (左 210px、固定) */}
      <Sidebar />

      {/* Main area */}
      <main className="garden-v28a-main">
        <Greeting greeting={greetingText} userName="東海林さん" />
        <KpiGrid />
        <OrbGrid onOrbHover={handleOrbHover} onOrbClick={handleOrbClick} />
      </main>

      {/* Activity Panel (右側 floating、JS で高さ補正) */}
      <ActivityPanel ref={activityRef} />
    </>
  );
}
