"use client";

/**
 * GardenShell 窶・Bloom 蜴溷・讒矩 (position: fixed) + CSS 螟画焚迚ｩ逅・｣蜍・
 *
 * 險ｭ險・
 *   - header: position: fixed top:0 竊・body 蜈ｨ菴薙・荳翫↓蟶ｸ鬧・
 *   - sidebar (orb + nav + toggle): position: fixed left:0 竊・蟾ｦ遶ｯ蟶ｸ鬧・
 *   - activity-panel: position: fixed right:0 竊・蜿ｳ遶ｯ蟶ｸ鬧・
 *   - main: margin-left: var(--gs-left-w); margin-right: var(--gs-right-w)
 *           竊・CSS 螟画焚縺ｧ sidebar / activity 縺ｮ蟷・→蜷梧悄
 *   - body 縺ｯ騾壼ｸｸ document scroll 竊・scrollbar 逕ｻ髱｢譛蜿ｳ遶ｯ
 *   - 謚倥ｊ逡ｳ縺ｿ譎・ --gs-nav-w / --gs-activity-w 繧・0 縺ｫ 竊・蜈ｨ隕∫ｴ蜷御ｸ繝輔Ξ繝ｼ繝蜀崎ｨ育ｮ・= 迢ｬ遶九ぜ繝ｬ辟｡縺・
 */

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";

import { useTheme } from "@/app/_lib/theme/ThemeProvider";
import {
  DEFAULT_GARDEN_ACTIVITY_ITEMS,
  GARDEN_SHELL_MODULES,
  getGardenShellModule,
  type GardenModuleId,
  type GardenShellActivityItem,
  type GardenShellPageMenuItem,
} from "./garden-shell-config";

const T = "/themes/garden-shell";
const EASE = "cubic-bezier(0.4, 0, 0.2, 1)";
const DUR = "0.45s";

const ORB_W = 56;
const NAV_W = 180;
const ACT_W = 320;
const HEADER_H = 80;
const FAV_KEY = "garden_favorites";

interface FavoriteItem {
  title: string;
  url: string;
  icon?: string;
  addedAt?: number;
}

function formatDateJP(date: Date): string {
  const weekdays = ["\u65e5", "\u6708", "\u706b", "\u6c34", "\u6728", "\u91d1", "\u571f"];
  return `${date.getFullYear()}\u5e74${date.getMonth() + 1}\u6708${date.getDate()}\u65e5(${weekdays[date.getDay()]})`;
}

function readFavorites(): FavoriteItem[] {
  const raw = readFavoritesRaw();
  try {
    return raw ? JSON.parse(raw) as FavoriteItem[] : [];
  } catch {
    return [];
  }
}

function readFavoritesRaw(): string {
  if (typeof window === "undefined") return "[]";
  try {
    return window.localStorage.getItem(FAV_KEY) ?? "[]";
  } catch {
    return "[]";
  }
}

function writeFavorites(list: FavoriteItem[]) {
  try {
    window.localStorage.setItem(FAV_KEY, JSON.stringify(list));
    window.dispatchEvent(new Event("garden-favorites-change"));
  } catch {
    /* ignore */
  }
}

function subscribeFavorites(onStoreChange: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener("storage", onStoreChange);
  window.addEventListener("garden-favorites-change", onStoreChange);
  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener("garden-favorites-change", onStoreChange);
  };
}

function weatherLabel(code: number): { label: string; icon: string } {
  if ([0, 1].includes(code)) return { label: "\u6674\u308c", icon: "weather_01_sunny.png" };
  if ([2].includes(code)) return { label: "\u8584\u66c7\u308a", icon: "weather_02_partly_cloudy.png" };
  if ([3, 45, 48].includes(code)) return { label: "\u66c7\u308a", icon: "weather_03_cloudy.png" };
  if ([71, 73, 75, 77, 85, 86].includes(code)) return { label: "\u96ea", icon: "weather_05_snow.png" };
  if ([95, 96, 99].includes(code)) return { label: "\u96f7\u96e8", icon: "weather_06_thunder.png" };
  return { label: "\u96e8", icon: "weather_04_rain.png" };
}

interface GardenShellProps {
  activeModule?: GardenModuleId;
  pageMenu?: GardenShellPageMenuItem[];
  activityItems?: GardenShellActivityItem[];
  moduleName?: string;
  moduleIcon?: string;
  bgLight?: string;
  bgDark?: string;
  userName?: string;
  userEmail?: string | null;
  userRoleLabel?: string;
  onLogout?: () => void | Promise<void>;
  children: React.ReactNode;
}

export default function GardenShell({
  activeModule = "bud",
  pageMenu = [],
  activityItems = DEFAULT_GARDEN_ACTIVITY_ITEMS,
  moduleName,
  moduleIcon,
  bgLight,
  bgDark,
  userName = "東海林 美琴",
  userEmail = "shoji@hyualan.co.jp",
  userRoleLabel = "正社員 / 全権管理者",
  onLogout,
  children,
}: GardenShellProps) {
  const { theme, toggleTheme } = useTheme();
  const activeModuleConfig = getGardenShellModule(activeModule);
  const resolvedModuleName = moduleName ?? activeModuleConfig.name;
  const resolvedModuleIcon = moduleIcon ?? activeModuleConfig.icon;
  const resolvedBgLight = bgLight ?? activeModuleConfig.bgLight;
  const resolvedBgDark = bgDark ?? activeModuleConfig.bgDark;
  const bgUrl = `${T}/backgrounds/${theme === "dark" ? resolvedBgDark : resolvedBgLight}`;
  const logoUrl = `${T}/images/logo/logo-garden-series-header-20260515-transparent.png`;
  const themeIconUrl = `${T}/images/theme_icons/theme_${theme === "dark" ? "moon" : "sun"}.png`;
  const searchInputRef = useRef<HTMLInputElement>(null);

  const [navCollapsed, setNavCollapsed] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return document.documentElement.dataset.preNavCollapsed === "1";
  });
  const [activityCollapsed, setActivityCollapsed] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return document.documentElement.dataset.preActivityCollapsed === "1";
  });
  const favoriteSnapshot = useSyncExternalStore(subscribeFavorites, readFavoritesRaw, () => "[]");
  const headerFavorites = useMemo(() => {
    try {
      return JSON.parse(favoriteSnapshot) as FavoriteItem[];
    } catch {
      return [];
    }
  }, [favoriteSnapshot]);
  const [favoriteOpen, setFavoriteOpen] = useState(false);
  const [userOpen, setUserOpen] = useState(false);
  const [readActivityIds, setReadActivityIds] = useState<Set<string>>(() => new Set());
  const [dateText, setDateText] = useState(() => formatDateJP(new Date()));
  const [weather, setWeather] = useState({
    temp: "--\u2103",
    label: "\u4f4d\u7f6e\u672a\u8a2d\u5b9a",
    icon: "weather_02_partly_cloudy.png",
  });

  // body classlist + localStorage 蜷梧悄
  useEffect(() => {
    document.body.classList.toggle("nav-pages-collapsed", navCollapsed);
    try { localStorage.setItem("garden_nav_pages_collapsed", navCollapsed ? "1" : "0"); } catch { /* ignore */ }
  }, [navCollapsed]);
  useEffect(() => {
    document.body.classList.remove("activity-collapsed");
    try { localStorage.setItem("garden_activity_collapsed", activityCollapsed ? "1" : "0"); } catch { /* ignore */ }
  }, [activityCollapsed]);

  useEffect(() => {
    const timer = window.setInterval(() => setDateText(formatDateJP(new Date())), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const { latitude, longitude } = pos.coords;
          const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,weather_code&timezone=auto`);
          const data = await res.json() as { current?: { temperature_2m?: number; weather_code?: number } };
          const current = data.current;
          if (!current || current.temperature_2m == null || current.weather_code == null) return;
          const mapped = weatherLabel(current.weather_code);
          setWeather({
            temp: `${Math.round(current.temperature_2m)}\u2103`,
            label: mapped.label,
            icon: mapped.icon,
          });
        } catch {
          setWeather((w) => ({ ...w, label: "\u5929\u6c17\u53d6\u5f97\u5f85\u3061" }));
        }
      },
      () => setWeather((w) => ({ ...w, label: "\u4f4d\u7f6e\u672a\u8a2d\u5b9a" })),
      { maximumAge: 30 * 60 * 1000, timeout: 8000 },
    );
  }, []);

  useEffect(() => {
    const handleSearchShortcut = (event: KeyboardEvent) => {
      if (!event.ctrlKey || event.altKey || event.metaKey || event.shiftKey) return;
      if (event.key.toLowerCase() !== "g") return;
      event.preventDefault();
      searchInputRef.current?.focus();
      searchInputRef.current?.select();
    };

    window.addEventListener("keydown", handleSearchShortcut, true);
    return () => window.removeEventListener("keydown", handleSearchShortcut, true);
  }, []);

  const closeHeaderMenus = () => {
    setFavoriteOpen(false);
    setUserOpen(false);
  };

  const handleLogout = async () => {
    closeHeaderMenus();
    await onLogout?.();
  };

  const addCurrentFavorite = () => {
    const url = window.location.pathname + window.location.search + window.location.hash;
    const list = readFavorites();
    if (!list.some(item => item.url === url)) {
      list.push({
        title: document.querySelector(".page-title")?.textContent?.trim() || resolvedModuleName,
        url,
        icon: resolvedModuleIcon,
        addedAt: Date.now(),
      });
      writeFavorites(list);
    }
  };

  const removeFavorite = (url: string) => {
    const next = readFavorites().filter(item => item.url !== url);
    writeFavorites(next);
  };

  const getActivityId = (item: GardenShellActivityItem) => `${item.time}-${item.title}`;
  const unreadActivityCount = activityItems.filter(item => !readActivityIds.has(getActivityId(item))).length;
  const toggleActivityRead = (id: string) => {
    setReadActivityIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const markAllActivityRead = () => {
    setReadActivityIds(new Set(activityItems.map(getActivityId)));
  };
  const markAllActivityUnread = () => {
    setReadActivityIds(new Set());
  };
  const allActivityRead = activityItems.length > 0 && unreadActivityCount === 0;

  // CSS 螟画焚縺ｧ sidebar / activity 縺ｮ蟷・ｒ蛻ｶ蠕｡ (main 縺ｯ蜷後§螟画焚繧・margin 縺ｧ蜿ら・)
  const navW = navCollapsed ? 0 : NAV_W;
  const actW = activityCollapsed ? 14 : ACT_W + 14;
  const leftW = ORB_W + navW;
  const rightW = actW;

  useEffect(() => {
    const sid = "garden-shell-stylesheet";
    if (!document.getElementById(sid)) {
      const link = document.createElement("link");
      link.id = sid;
      link.rel = "stylesheet";
      link.href = `${T}/style.css`;
      document.head.appendChild(link);
    }
    const fid = "garden-shell-fonts";
    if (!document.getElementById(fid)) {
      const link = document.createElement("link");
      link.id = fid;
      link.rel = "stylesheet";
      link.href = "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;0,600;1,400;1,500&family=EB+Garamond:ital,wght@0,400;0,500;0,600;1,400;1,500&family=Noto+Serif+JP:wght@300;400;500;600&family=Shippori+Mincho:wght@400;500;600&display=swap";
      document.head.appendChild(link);
    }
    document.body.classList.add("bloom-page");
    // Bloom 蜴溷・讒矩縺ｮ override (豈・mount 縺ｧ蜀咲函謌舌？MR 蜿肴丐菫晁ｨｼ)
    const oid = "garden-shell-fixed-override";
    const existing = document.getElementById(oid);
    if (existing) existing.remove();
    {
      const st = document.createElement("style");
      st.id = oid;
      st.textContent = `
        /* GardenShell (Bloom 蜴溷・讒矩) 窶・body 騾壼ｸｸ scroll = 逕ｻ髱｢譛蜿ｳ遶ｯ scrollbar */
        html { height: auto !important; min-height: 100% !important; overflow-x: hidden !important; overflow-y: auto !important; }
        body { height: auto !important; min-height: 100vh !important; overflow-x: hidden !important; overflow-y: visible !important; }
        /* Chrome 讓呎ｺ悶せ繧ｯ繝ｭ繝ｼ繝ｫ繝舌・繧剃ｽｿ縺・◆繧√”tml/body 縺ｫ縺ｯ濶ｲ繧・ｹ・ｒ謖・ｮ壹＠縺ｪ縺・*/
        /* CSS 螟画焚迚ｩ逅・｣蜍・ sidebar/activity 縺ｮ蟷・→ main 縺ｮ margin 縺悟酔縺・var 繧貞盾辣ｧ */
        :root {
          --gs-header-h: ${HEADER_H}px;
          --gs-orb-w: ${ORB_W}px;
        }
        /* 繝倥ャ繝繝ｼ: 逕ｻ髱｢荳企Κ蝗ｺ螳・*/
        .gs-header {
          position: fixed; top: 0; left: 0; right: 0;
          height: var(--gs-header-h);
          z-index: 100;
          background: rgba(253, 251, 243, 0.92);
          backdrop-filter: blur(10px) saturate(120%);
          border-bottom: 1px solid rgba(154, 138, 105, 0.18);
        }
        [data-theme="dark"] .gs-header {
          background: rgba(24, 32, 25, 0.94);
          border-bottom-color: rgba(180, 170, 140, 0.18);
        }
        .gs-header .topbar-brand {
          width: ${ORB_W + NAV_W}px;
          height: 100%;
          padding: 8px 0;
          margin-left: -28px;
        }
        .gs-header .topbar-brand-img {
          height: 76px;
          width: auto;
          object-fit: contain;
        }
        /* sidebar (orb + nav): 逕ｻ髱｢蟾ｦ蝗ｺ螳・*/
        .gs-sidebar {
          position: fixed; left: 0; top: var(--gs-header-h);
          height: calc(100vh - var(--gs-header-h));
          display: flex;
          z-index: 90;
          transition: width ${DUR} ${EASE};
        }
        .gs-orb-col {
          width: var(--gs-orb-w); flex: none; height: 100%;
          background: rgba(253, 251, 243, 0.85);
          backdrop-filter: blur(8px);
          border-right: 1px solid rgba(154, 138, 105, 0.18);
          overflow-y: auto;
          display: flex;
          flex-direction: column;
          align-items: stretch;
          gap: 2px;
          padding: 18px 0 14px;
        }
        [data-theme="dark"] .gs-orb-col {
          background: rgba(24, 32, 25, 0.86);
          border-right-color: rgba(180, 170, 140, 0.16);
        }
        .gs-nav-col {
          flex: none; height: 100%; overflow: hidden;
          background: rgba(253, 251, 243, 0.85);
          backdrop-filter: blur(8px);
          border-right: 1px solid rgba(154, 138, 105, 0.18);
          padding: 30px 0 14px;
          transition: width ${DUR} ${EASE};
        }
        [data-theme="dark"] .gs-nav-col {
          background: rgba(24, 32, 25, 0.86);
          border-right-color: rgba(180, 170, 140, 0.16);
        }
        /* activity-panel: 逕ｻ髱｢蜿ｳ蝗ｺ螳・*/
        .gs-activity-dock {
          position: fixed; right: 0; top: var(--gs-header-h);
          width: ${ACT_W + 14}px;
          height: calc(100vh - var(--gs-header-h));
          z-index: 95;
          transition: transform ${DUR} ${EASE};
          pointer-events: none;
        }
        .gs-activity-dock > * {
          pointer-events: auto;
        }
        .gs-activity-fixed {
          position: absolute; left: 14px; right: auto; top: 0;
          width: ${ACT_W}px;
          height: 100%;
          overflow: hidden;
          background: rgba(253, 251, 243, 0.85);
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
          border-left: 1px solid rgba(154, 138, 105, 0.18);
          z-index: 1;
          transition: background 0.6s ease, border-color 0.6s ease;
        }
        [data-theme="dark"] .gs-activity-fixed {
          background: rgba(24, 32, 25, 0.90);
          border-left-color: rgba(180, 170, 140, 0.16);
        }
        /* main: margin 縺ｧ sidebar/activity 縺ｮ蟷・↓蜷医ｏ縺帙ｋ */
        .gs-main-fixed {
          margin-top: var(--gs-header-h);
          margin-left: var(--gs-left-w);
          margin-right: var(--gs-right-w);
          box-sizing: border-box;
          max-width: calc(100vw - var(--gs-left-w) - var(--gs-right-w));
          width: calc(100vw - var(--gs-left-w) - var(--gs-right-w));
          min-height: calc(100vh - var(--gs-header-h));
          overflow-x: hidden;
          padding: 30px 32px 0 48px;
          transition: margin-left ${DUR} ${EASE}, margin-right ${DUR} ${EASE};
          position: relative;
          z-index: 1;
        }
        .gs-main-fixed,
        .gs-main-fixed * {
          box-sizing: border-box;
        }
        .gs-main-fixed > * {
          max-width: 100%;
          min-width: 0;
        }
        /* 12 繝｢繧ｸ繝･繝ｼ繝ｫ orb 蛻・*/
        .gs-orb-col .nav-app-item {
          display: flex;
          align-items: center;
          justify-content: flex-start;
          gap: 10px;
          min-height: 48px;
          width: calc(100% - 8px);
          margin: 0 4px;
          padding: 4px 4px 4px 52px;
          box-sizing: border-box;
          border-radius: 12px;
          position: relative;
          color: var(--text-main);
          text-decoration: none;
          font-size: 0;
          transition: background 0.2s;
        }
        .gs-orb-col .nav-app-item:hover { background: rgba(212, 165, 65, 0.10); }
        .gs-orb-col .nav-app-item.active { background: transparent; }
        .gs-orb-col .nav-app-name { display: none; }
        .gs-orb-col .nav-app-icon {
          width: 40px;
          height: 40px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-radius: 50%;
          position: absolute;
          left: 4px;
          top: 50%;
          transform: translateY(-50%);
        }
        .gs-orb-col .nav-app-icon img {
          width: 40px;
          height: 40px;
          object-fit: contain;
          filter: drop-shadow(0 1px 2px rgba(120, 95, 60, 0.25));
        }
        .gs-orb-col .nav-app-item.active .nav-app-icon {
          background: rgba(212, 165, 65, 0.16);
        }
        .gs-orb-col .nav-app-item.active .nav-app-icon::before {
          content: "";
          position: absolute;
          inset: 0;
          border-radius: 50%;
          border: 2px solid rgba(212, 165, 65, 0.65);
          box-shadow: 0 0 8px rgba(212, 165, 65, 0.30);
          pointer-events: none;
        }
        [data-theme="dark"] .gs-orb-col .nav-app-item.active .nav-app-icon {
          background: rgba(228, 181, 81, 0.20);
        }
        /* nav-pages 蜀・(繝｢繧ｸ繝･繝ｼ繝ｫ繝｡繝九Η繝ｼ) */
        .gs-nav-col .nav-pages-header {
          display: flex; align-items: center; gap: 8px; padding: 0 14px 10px;
          margin: 0 4px 4px;
          color: var(--text-main); text-decoration: none; font-weight: 500;
          font-size: 1.05rem;
          letter-spacing: 0.05em;
        }
        .gs-nav-col .nav-pages-header img { width: 24px; height: 24px; }
        .gs-nav-col .nav-pages-divider {
          height: 1px;
          background: linear-gradient(90deg, transparent 0%, rgba(154, 138, 105, 0.25) 15%, rgba(154, 138, 105, 0.25) 85%, transparent 100%);
          margin: 4px 12px 8px;
          flex-shrink: 0;
        }
        [data-theme="dark"] .gs-nav-col .nav-pages-divider {
          background: linear-gradient(90deg, transparent 0%, rgba(180, 170, 140, 0.25) 15%, rgba(180, 170, 140, 0.25) 85%, transparent 100%);
        }
        .gs-nav-col .nav-page-item {
          display: flex; align-items: center; gap: 10px; padding: 9px 12px;
          margin: 1px 8px;
          border-radius: 10px;
          color: var(--text-main); text-decoration: none; font-size: 0.80rem;
          transition: background 0.2s, color 0.2s, padding-left 0.2s;
        }
        .gs-nav-col .nav-page-item:hover { background: rgba(232, 180, 184, 0.14); color: var(--text-main); padding-left: 16px; }
        .gs-nav-col .nav-page-item.active { background: rgba(212, 165, 65, 0.16); color: var(--text-main); font-weight: 500; }
        [data-theme="dark"] .gs-nav-col .nav-page-item:hover { background: rgba(212, 165, 65, 0.10); }
        [data-theme="dark"] .gs-nav-col .nav-page-item.active { background: rgba(212, 165, 65, 0.22); }
        .gs-nav-col .nav-page-icon {
          width: 26px;
          height: 26px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        .gs-nav-col .nav-page-item img { width: 24px; height: 24px; }
        /* toggle 繝懊ち繝ｳ (sidebar / activity 縺ｮ蠅・阜縺ｫ邨ｶ蟇ｾ驟咲ｽｮ縲∫判髱｢荳狗ｫｯ縺ｾ縺ｧ雋ｫ騾・ */
        .gs-toggle-fixed {
          position: fixed; top: var(--gs-header-h);
          height: calc(100vh - var(--gs-header-h));
          width: 14px;
          background: transparent; border: none; cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          z-index: 95;
          transition: background 0.25s ease, left ${DUR} ${EASE}, right ${DUR} ${EASE};
          color: var(--text-muted);
        }
        .gs-toggle-fixed:hover { background: rgba(212, 165, 65, 0.14); color: var(--text-main); }
        .nav-pages-toggle {
          z-index: 96;
        }
        .nav-pages-toggle-arrow {
          position: relative;
          z-index: 1;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 100%;
          font-family: 'EB Garamond', 'Cormorant Garamond', serif;
          font-size: 1rem;
          line-height: 1;
          color: var(--text-main);
          opacity: 0.62;
          transition: opacity 0.3s ease;
        }
        .nav-pages-toggle:hover .nav-pages-toggle-arrow {
          opacity: 1;
        }
        .activity-toggle {
          position: absolute;
          left: 0;
          right: auto;
          top: 0;
          bottom: auto;
          height: 100%;
          z-index: 100;
          transition: width 0.25s ease, background 0.3s ease;
        }
        .activity-toggle::before {
          content: "";
          position: absolute;
          inset: 0;
          background: linear-gradient(135deg, rgba(255, 245, 225, 0.9) 0%, rgba(245, 220, 195, 0.9) 100%);
          border-left: 1px solid rgba(184, 144, 100, 0.3);
          box-shadow: -2px 0 8px rgba(154, 138, 105, 0.12);
          pointer-events: none;
          transition: background 0.3s ease, box-shadow 0.3s ease;
        }
        [data-theme="dark"] .activity-toggle::before {
          background: linear-gradient(135deg, rgba(70, 78, 62, 0.95) 0%, rgba(55, 62, 48, 0.95) 100%);
          border-color: rgba(180, 170, 140, 0.35);
        }
        .activity-toggle:hover {
          width: 22px;
        }
        .activity-toggle:hover::before {
          background: linear-gradient(135deg, rgba(255, 250, 235, 1) 0%, rgba(250, 225, 200, 1) 100%);
          box-shadow: -3px 3px 12px rgba(212, 165, 65, 0.35);
        }
        [data-theme="dark"] .activity-toggle:hover::before {
          background: linear-gradient(135deg, rgba(85, 92, 75, 1) 0%, rgba(70, 78, 62, 1) 100%);
        }
        .activity-toggle-arrow {
          position: relative;
          z-index: 1;
          font-family: 'EB Garamond', 'Cormorant Garamond', serif;
          font-size: 1rem;
          line-height: 1;
          opacity: 0.5;
          transform: rotate(180deg);
          transition: opacity 0.3s ease, transform ${DUR} ${EASE};
        }
        .activity-toggle:hover .activity-toggle-arrow {
          opacity: 1;
        }
        .garden-shell-center-card,
        .garden-shell .ceo-card,
        .garden-shell .kpi-integrated-card,
        .garden-shell .company-card,
        .garden-shell .action-card {
          background: var(--bg-card);
          border: 1px solid var(--border-card);
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
          box-shadow: var(--shadow-soft);
        }
        .gs-main-fixed .page-header {
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto;
          column-gap: 18px;
          align-items: start;
          margin-bottom: 20px;
          padding-right: 56px;
        }
        .gs-main-fixed .page-title-block {
          min-width: 0;
        }
        .gs-main-fixed .page-title {
          font-size: clamp(1.72rem, 2.7vw, 2.2rem);
          color: var(--text-main);
          flex-wrap: wrap;
          line-height: 1.18;
          overflow-wrap: normal;
          word-break: keep-all;
        }
        .gs-main-fixed .page-title-jp {
          font-size: clamp(1.22rem, 2.1vw, 1.65rem);
          color: var(--text-main);
          overflow-wrap: normal;
          word-break: keep-all;
        }
        .gs-main-fixed .page-subtitle {
          margin-top: 4px;
          color: var(--text-sub);
          font-size: 0.88rem;
        }
        .gs-main-fixed .access-badge {
          align-items: center;
          align-self: start;
          background: rgba(255, 253, 245, 0.66);
          border: 1px solid rgba(212, 151, 22, 0.72);
          border-radius: 999px;
          color: var(--text-accent);
          display: inline-flex;
          flex-shrink: 0;
          gap: 8px;
          justify-content: center;
          line-height: 1;
          max-width: min(100%, 280px);
          min-height: 34px;
          padding: 8px 16px;
          white-space: nowrap;
        }
        .gs-main-fixed .access-badge-icon {
          display: inline-flex;
          line-height: 1;
        }
        @media (max-width: 1180px) {
          .gs-main-fixed .page-header {
            grid-template-columns: minmax(0, 1fr);
            row-gap: 10px;
          }
          .gs-main-fixed .access-badge {
            justify-self: start;
          }
        }
        .gs-main-fixed .tab-nav {
          gap: 28px;
          margin-top: 0;
          margin-bottom: 18px;
          padding: 0 4px;
        }
        .gs-main-fixed .tab-item {
          padding: 10px 4px 12px;
          font-size: 1rem;
          color: var(--text-sub);
        }
        .gs-main-fixed .tab-item-jp {
          font-size: 0.95rem;
          margin-right: 6px;
        }
        .gs-main-fixed .tab-item.active {
          color: var(--text-accent);
        }
        .activity-settings-link {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 26px;
          height: 26px;
          border: 1px solid rgba(154, 138, 105, 0.22);
          border-radius: 50%;
          background: rgba(255, 253, 245, 0.55);
          color: var(--text-sub);
          text-decoration: none;
          font-size: 0.82rem;
          transition: background 0.2s ease, color 0.2s ease, border-color 0.2s ease;
        }
        .activity-settings-link:hover {
          background: rgba(212, 165, 65, 0.12);
          border-color: rgba(212, 165, 65, 0.45);
          color: var(--text-main);
        }
        .activity-item.is-read {
          opacity: 0.48;
        }
        .activity-item {
          cursor: pointer;
          transition: opacity 0.2s ease, background 0.2s ease;
        }
        .activity-item:hover {
          background: rgba(212, 165, 65, 0.06);
        }
        @media (max-width: 1350px) {
          .gs-header .search-box {
            width: min(28vw, 320px);
            gap: 8px;
            padding-left: 12px;
            padding-right: 10px;
          }
          .gs-header .topbar-info {
            gap: 8px;
          }
          .gs-header .topbar-info .info-item:nth-of-type(3) {
            display: none;
          }
          .gs-header .header-tool-btn {
            width: 36px;
            height: 36px;
            padding: 5px;
          }
          .gs-header .header-tool-btn img {
            width: 24px;
            height: 24px;
          }
          .gs-header .user-area {
            padding-right: 8px;
            gap: 7px;
          }
        }
        @media (max-width: 760px) {
          .gs-header {
            min-width: 0;
          }
          .gs-header .topbar-brand {
            width: 118px;
            margin-left: -16px;
          }
          .gs-header .topbar-brand-img {
            height: 58px;
          }
          .gs-header .search-box,
          .gs-header .topbar-info .info-item,
          .gs-header .help-btn,
          .gs-header .favorite-btn,
          .gs-header .user-info,
          .gs-header .user-arrow {
            display: none;
          }
          .gs-header .topbar-info {
            gap: 6px;
            margin-left: auto;
          }
          .gs-header .header-tool-btn {
            width: 34px;
            height: 34px;
          }
          .gs-header .user-area {
            padding: 4px;
            border-radius: 999px;
          }
          .gs-header .user-avatar {
            width: 32px;
            height: 32px;
          }
          .gs-sidebar {
            width: var(--gs-orb-w) !important;
          }
          .gs-nav-col,
          .nav-pages-toggle,
          .gs-activity-dock {
            display: none !important;
          }
          .gs-main-fixed {
            margin-left: var(--gs-orb-w) !important;
            margin-right: 0 !important;
            width: calc(100vw - var(--gs-orb-w)) !important;
            max-width: calc(100vw - var(--gs-orb-w)) !important;
            padding: 22px 14px 0 16px;
          }
          .gs-main-fixed .page-header {
            padding-right: 44px;
            margin-bottom: 14px;
          }
          .gs-main-fixed .page-title {
            font-size: 1.45rem;
            gap: 6px;
          }
          .gs-main-fixed .page-title-jp {
            font-size: 1.08rem;
          }
          .gs-main-fixed .page-subtitle {
            font-size: 0.78rem;
          }
          .gs-main-fixed .kpi-grid,
          .gs-main-fixed .bloom-nav-grid {
            grid-template-columns: 1fr;
            gap: 12px;
          }
          .gs-main-fixed .kpi-card,
          .gs-main-fixed .bloom-nav-card {
            min-width: 0;
          }
        }
      `;
      document.head.appendChild(st);
    }
    return () => {
      document.body.classList.remove("bloom-page");
    };
  }, []);

  return (
    <>
      {/* 閭梧勹 (逕ｻ髱｢蜈ｨ菴薙↓蝗ｺ螳・ */}
      <div
        className="bg-layer"
        style={{
          position: "fixed", top: 0, left: 0, width: "100vw", height: "100vh",
          backgroundImage: `url('${bgUrl}')`, backgroundSize: "cover", backgroundPosition: "center",
          opacity: 1, zIndex: 0,
          transition: `background-image ${DUR} ${EASE}`,
        }}
      />
      <div className="bg-layer-overlay" aria-hidden="true" />

      {/* CSS 螟画焚繧・root 縺ｫ inject (CSS 縺ｨ React state 縺ｮ蜷梧悄) */}
      <style>{`:root { --gs-left-w: ${leftW}px !important; --gs-right-w: ${rightW}px !important; --gs-nav-w: ${navW}px !important; --gs-activity-w: ${actW}px !important; }`}</style>

      {/* 竭 繝倥ャ繝繝ｼ (fixed top) */}
      <header className="gs-header topbar garden-shell" data-garden-module={activeModule}>
        <Link href="/" className="topbar-brand" title="Garden Series home" style={{ textDecoration: "none" }}>
          <img src={logoUrl} alt="Garden Series" className="topbar-brand-img" />
        </Link>
        <div className="search-box">
          <span className="search-icon"><img src={`${T}/images/header_icons/header_search.png`} alt="" /></span>
          <input ref={searchInputRef} type="text" placeholder="検索 (取引先、請求書、タスク、ヘルプなど)" />
          <span className="search-shortcut">Ctrl+G</span>
        </div>
        <div className="topbar-info">
          <div className="info-item">
            <span className="info-icon"><img src={`${T}/images/header_icons/header_calendar.png`} alt="" /></span>
            <span className="info-text">{dateText}</span>
          </div>
          <div className="info-item">
            <span className="info-icon"><img src={`${T}/images/header_icons/${weather.icon}`} alt="" /></span>
            <div className="info-text"><strong>{weather.temp}</strong><small>{weather.label}</small></div>
          </div>
          <div className="info-item">
            <span className="status-dot"></span>
            <span className="info-text">すべてのシステム正常</span>
          </div>
          <button className="header-tool-btn theme-toggle" title="ライト/ダーク切替" onClick={toggleTheme}>
            <img src={themeIconUrl} alt="" />
          </button>
          <button
            className="header-tool-btn header-notify-btn"
            title="通知"
            onClick={() => setActivityCollapsed(false)}
          >
            <img src={`${T}/images/header_icons/header_bell.png`} alt="" />
            {unreadActivityCount > 0 && <span className="header-tool-badge">{unreadActivityCount}</span>}
          </button>
          <button className="header-tool-btn help-btn" title="ヘルプ">
            <img src={`${T}/images/header_icons/D-02_help_simple.png`} alt="" />
          </button>
          <div className={`header-favorite-wrap${favoriteOpen ? " is-open" : ""}`}>
            <button
              className="header-tool-btn favorite-btn"
              title="お気に入り"
              onClick={() => {
                setFavoriteOpen(v => !v);
                setUserOpen(false);
              }}
              aria-expanded={favoriteOpen}
            >
              <img src={`${T}/images/header_icons/D-01_favorite_simple.png`} alt="" />
            </button>
            <div className={`favorite-dropdown${headerFavorites.length ? " has-items" : ""}`} role="menu" aria-hidden={!favoriteOpen}>
              <div className="favorite-dropdown-header">
                <span className="favorite-dropdown-title">お気に入り</span>
                <span className="favorite-dropdown-count">{headerFavorites.length}</span>
              </div>
              <div className="favorite-dropdown-divider"></div>
              <div className="favorite-dropdown-list">
                {headerFavorites.map(item => (
                  <div className="favorite-dropdown-item" key={item.url} onClick={() => { window.location.href = item.url; }}>
                    <span className="favorite-dropdown-item-icon"><img src={item.icon || `${T}/images/icons_bloom/orb_bud.png`} alt="" /></span>
                    <span className="favorite-dropdown-item-label">{item.title}</span>
                    <button
                      className="favorite-dropdown-item-remove"
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeFavorite(item.url);
                      }}
                      aria-label="お気に入りから削除"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
              <div className="favorite-dropdown-empty">お気に入りはまだありません</div>
              <div className="favorite-dropdown-divider"></div>
              <button className="favorite-dropdown-add" type="button" onClick={addCurrentFavorite}>
                <span className="favorite-dropdown-add-icon">＋</span>
                <span className="favorite-dropdown-add-label">現在のページを追加</span>
              </button>
            </div>
          </div>
          <div
            className={`user-area${userOpen ? " is-open" : ""}`}
            tabIndex={0}
            onClick={() => {
              setUserOpen(v => !v);
              setFavoriteOpen(false);
            }}
            onBlur={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setUserOpen(false);
            }}
          >
            <div className="user-avatar"><img src={`${T}/images/avatar/avatar_shoji.png`} alt={userName} /></div>
            <div className="user-info"><strong>{userName}</strong><small>{userRoleLabel}</small></div>
            <span className="user-arrow">⌄</span>
            <div className="user-dropdown" role="menu" aria-hidden={!userOpen} onClick={(e) => e.stopPropagation()}>
              <div className="user-dropdown-header">
                <div className="user-dropdown-avatar"><img src={`${T}/images/avatar/avatar_shoji.png`} alt="" /></div>
                <div className="user-dropdown-info">
                  <strong>{userName}</strong>
                  {userEmail && <small>{userEmail}</small>}
                  <span className="user-dropdown-role">{userRoleLabel}</span>
                </div>
              </div>
              <div className="user-dropdown-divider"></div>
              <Link href="/mypage" className="user-dropdown-item" role="menuitem" onClick={closeHeaderMenus}>
                <span className="user-dropdown-icon"><img src={`${T}/images/header_icons/D-03_mypage_simple.png`} alt="" /></span>
                <span className="user-dropdown-label">マイページ</span>
              </Link>
              <Link href="/settings" className="user-dropdown-item" role="menuitem" onClick={closeHeaderMenus}>
                <span className="user-dropdown-icon"><img src={`${T}/images/header_icons/D-04_settings_simple.png`} alt="" /></span>
                <span className="user-dropdown-label">ユーザー設定</span>
              </Link>
              <div className="user-dropdown-divider"></div>
              <button className="user-dropdown-item user-dropdown-item-logout" type="button" onClick={handleLogout}>
                <span className="user-dropdown-icon"><img src={`${T}/images/header_icons/D-05_logout_simple.png`} alt="" /></span>
                <span className="user-dropdown-label">ログアウト</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* 竭｡竭｢ sidebar (orb + nav縲’ixed left) */}
      <aside className="gs-sidebar" style={{ width: leftW }}>
        <div className="gs-orb-col">
          {GARDEN_SHELL_MODULES.map((m) => (
            <Link key={m.id} href={`/${m.id}`} className={`nav-app-item${activeModule === m.id ? " active" : ""}`} data-app={m.id} title={m.name}>
              <span className="nav-app-icon"><img src={m.icon} alt="" /></span>
              <span className="nav-app-name">{m.name}</span>
            </Link>
          ))}
        </div>
        <div className="gs-nav-col" style={{ width: navW }}>
          <Link href={`/${activeModule}`} className="nav-pages-header" title={`${resolvedModuleName} ホームへ`}>
            <span className="nav-pages-app-icon"><img src={resolvedModuleIcon} alt="" /></span>
            <span className="nav-pages-app-name">{resolvedModuleName}</span>
          </Link>
          <div className="nav-pages-divider" aria-hidden="true" />
          {pageMenu.map((p) => (
            <Link key={p.href} href={p.href} className={`nav-page-item${p.active ? " active" : ""}`}>
              {p.icon && <span className="nav-page-icon"><img src={p.icon} alt="" /></span>}
              <span className="nav-page-label">{p.label}</span>
            </Link>
          ))}
        </div>
      </aside>

      {/* nav toggle (sidebar 蜿ｳ蠅・阜縲∫判髱｢荳狗ｫｯ縺ｾ縺ｧ) */}
      <button
        className="gs-toggle-fixed nav-pages-toggle"
        type="button"
        title="メニュー名の表示/非表示"
        aria-expanded={!navCollapsed}
        onClick={() => setNavCollapsed(c => !c)}
        style={{ left: leftW }}
      >
        <span className="nav-pages-toggle-arrow">{navCollapsed ? "‹" : "›"}</span>
      </button>

      {/* 竭､竭･竭ｨ main (margin 縺ｧ sidebar/activity 縺ｫ霑ｽ蠕・ */}
      <main className="gs-main-fixed main garden-shell" data-garden-module={activeModule}>{children}</main>

      <div
        className="gs-activity-dock"
        style={{ transform: activityCollapsed ? `translateX(${ACT_W}px)` : "translateX(0)" }}
      >

      {/* activity toggle (activity 蟾ｦ蠅・阜縲∫判髱｢荳狗ｫｯ縺ｾ縺ｧ) */}
      <button
        className="gs-toggle-fixed activity-toggle"
        type="button"
        title="Activity Panel 開閉"
        aria-expanded={!activityCollapsed}
        onClick={() => setActivityCollapsed(c => !c)}
      >
        <span
          className="activity-toggle-arrow"
          style={{ transform: "none" }}
        >
          {activityCollapsed ? "‹" : "›"}
        </span>
      </button>

      {/* 竭｣ Activity Panel (fixed right) */}
      <aside
        className="gs-activity-fixed"
      >
        <div style={{ width: ACT_W, padding: "24px 22px 16px" }}>
          <div className="activity-header">
            <div className="activity-title"><h3>Today&apos;s Activity</h3></div>
            <Link href="/settings/notifications" className="activity-settings-link" title="通知設定">
              ⚙
            </Link>
            <button
              type="button"
              className="activity-all"
              onClick={allActivityRead ? markAllActivityUnread : markAllActivityRead}
            >
              {allActivityRead ? "すべて未読" : "すべて既読"}
            </button>
          </div>
          <ul className="activity-list">
            {activityItems.map((item) => {
              const id = getActivityId(item);
              const isRead = readActivityIds.has(id);
              return (
                <li
                  className={`activity-item${isRead ? " is-read" : ""}`}
                  key={id}
                  onClick={() => toggleActivityRead(id)}
                  title={isRead ? "クリックで未読に戻す" : "クリックで既読にする"}
                >
                  <span className="activity-time">{item.time}</span>
                  {item.icon && <span className="activity-icon"><img src={item.icon} alt="" /></span>}
                  <div className="activity-body">
                    <strong>{item.title}</strong>
                    <p>{item.body}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </aside>
      </div>
    </>
  );
}

