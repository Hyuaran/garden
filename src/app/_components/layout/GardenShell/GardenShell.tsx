"use client";

/**
 * GardenShell — Bloom 原典構造 (position: fixed) + CSS 変数物理連動
 *
 * 設計:
 *   - header: position: fixed top:0 → body 全体の上に常駐
 *   - sidebar (orb + nav + toggle): position: fixed left:0 → 左端常駐
 *   - activity-panel: position: fixed right:0 → 右端常駐
 *   - main: margin-left: var(--gs-left-w); margin-right: var(--gs-right-w)
 *           ← CSS 変数で sidebar / activity の幅と同期
 *   - body は通常 document scroll → scrollbar 画面最右端
 *   - 折り畳み時: --gs-nav-w / --gs-activity-w を 0 に → 全要素同一フレーム再計算 = 独立ズレ無し
 */

import { useEffect, useState } from "react";
import Link from "next/link";

import { useTheme } from "@/app/_lib/theme/ThemeProvider";

const T = "/themes/garden-shell";
const EASE = "cubic-bezier(0.4, 0, 0.2, 1)";
const DUR = "0.45s";

const ORB_W = 60;
const NAV_W = 180;
const ACT_W = 320;
const HEADER_H = 80;

interface GardenShellProps {
  activeModule?: string;
  pageMenu?: { label: string; href: string; icon?: string; active?: boolean }[];
  moduleName?: string;
  moduleIcon?: string;
  bgLight?: string;
  bgDark?: string;
  children: React.ReactNode;
}

const MODULES = [
  { id: "bloom",    name: "Bloom",    icon: `${T}/images/icons_bloom/orb_bloom.png` },
  { id: "fruit",    name: "Fruit",    icon: `${T}/images/icons_bloom/orb_fruit.png` },
  { id: "seed",     name: "Seed",     icon: `${T}/images/icons_bloom/orb_seed.png` },
  { id: "forest",   name: "Forest",   icon: `${T}/images/icons_bloom/orb_forest.png` },
  { id: "bud",      name: "Bud",      icon: `${T}/images/icons_bloom/orb_bud.png` },
  { id: "leaf",     name: "Leaf",     icon: `${T}/images/icons_bloom/orb_leaf.png` },
  { id: "tree",     name: "Tree",     icon: `${T}/images/icons_bloom/orb_tree.png` },
  { id: "sprout",   name: "Sprout",   icon: `${T}/images/icons_bloom/orb_sprout.png` },
  { id: "soil",     name: "Soil",     icon: `${T}/images/icons_bloom/orb_soil.png` },
  { id: "root",     name: "Root",     icon: `${T}/images/icons_bloom/orb_root.png` },
  { id: "rill",     name: "Rill",     icon: `${T}/images/icons_bloom/orb_rill.png` },
  { id: "calendar", name: "Calendar", icon: `${T}/images/icons_bloom/orb_calendar.png` },
];

export default function GardenShell({
  activeModule = "bud",
  pageMenu = [],
  moduleName = "Bud",
  moduleIcon = `${T}/images/icons_bloom/orb_bud.png`,
  bgLight = "bg-bud-common-20260505.png",
  bgDark = "bg-bud-dark.png",
  children,
}: GardenShellProps) {
  const { theme, toggleTheme } = useTheme();
  const bgUrl = `${T}/backgrounds/${theme === "dark" ? bgDark : bgLight}`;
  const logoUrl = `${T}/images/logo/garden_logo${theme === "dark" ? "_dark" : ""}.png`;
  const themeIconUrl = `${T}/images/theme_icons/theme_${theme === "dark" ? "moon" : "sun"}.png`;

  const [navCollapsed, setNavCollapsed] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return document.documentElement.dataset.preNavCollapsed === "1";
  });
  const [activityCollapsed, setActivityCollapsed] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return document.documentElement.dataset.preActivityCollapsed === "1";
  });

  // body classlist + localStorage 同期
  useEffect(() => {
    document.body.classList.toggle("nav-pages-collapsed", navCollapsed);
    try { localStorage.setItem("garden_nav_pages_collapsed", navCollapsed ? "1" : "0"); } catch { /* ignore */ }
  }, [navCollapsed]);
  useEffect(() => {
    document.body.classList.toggle("activity-collapsed", activityCollapsed);
    try { localStorage.setItem("garden_activity_collapsed", activityCollapsed ? "1" : "0"); } catch { /* ignore */ }
  }, [activityCollapsed]);

  // CSS 変数で sidebar / activity の幅を制御 (main は同じ変数を margin で参照)
  const navW = navCollapsed ? 0 : NAV_W;
  const actW = activityCollapsed ? 0 : ACT_W;
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
    // Bloom 原典構造の override (毎 mount で再生成、HMR 反映保証)
    const oid = "garden-shell-fixed-override";
    const existing = document.getElementById(oid);
    if (existing) existing.remove();
    {
      const st = document.createElement("style");
      st.id = oid;
      st.textContent = `
        /* GardenShell (Bloom 原典構造) — body 通常 scroll = 画面最右端 scrollbar */
        html { height: auto !important; min-height: 100% !important; overflow-x: hidden !important; overflow-y: auto !important; }
        body { height: auto !important; min-height: 100vh !important; overflow-x: hidden !important; overflow-y: visible !important; }
        /* scrollbar: Garden 濃色で明確視認 */
        html::-webkit-scrollbar, body::-webkit-scrollbar { width: 14px; }
        html::-webkit-scrollbar-track, body::-webkit-scrollbar-track { background: rgba(154, 138, 105, 0.10); }
        html::-webkit-scrollbar-thumb, body::-webkit-scrollbar-thumb { background: #8a7f6a; border-radius: 7px; }
        html::-webkit-scrollbar-thumb:hover, body::-webkit-scrollbar-thumb:hover { background: #4a4233; }
        /* CSS 変数物理連動: sidebar/activity の幅と main の margin が同じ var を参照 */
        :root {
          --gs-header-h: ${HEADER_H}px;
          --gs-orb-w: ${ORB_W}px;
        }
        /* ヘッダー: 画面上部固定 */
        .gs-header {
          position: fixed; top: 0; left: 0; right: 0;
          height: var(--gs-header-h);
          z-index: 100;
          background: rgba(253, 251, 243, 0.92);
          backdrop-filter: blur(10px) saturate(120%);
          border-bottom: 1px solid rgba(154, 138, 105, 0.18);
        }
        /* sidebar (orb + nav): 画面左固定 */
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
        }
        .gs-nav-col {
          flex: none; height: 100%; overflow: hidden;
          background: rgba(253, 251, 243, 0.85);
          backdrop-filter: blur(8px);
          border-right: 1px solid rgba(154, 138, 105, 0.18);
          transition: width ${DUR} ${EASE};
        }
        /* activity-panel: 画面右固定 */
        .gs-activity-fixed {
          position: fixed; right: 0; top: var(--gs-header-h);
          height: calc(100vh - var(--gs-header-h));
          overflow: hidden;
          background: rgba(253, 251, 243, 0.85);
          backdrop-filter: blur(8px);
          border-left: 1px solid rgba(154, 138, 105, 0.18);
          z-index: 90;
          transition: width ${DUR} ${EASE};
        }
        /* main: margin で sidebar/activity の幅に合わせる */
        .gs-main-fixed {
          margin-top: var(--gs-header-h);
          margin-left: var(--gs-left-w);
          margin-right: var(--gs-right-w);
          min-height: calc(100vh - var(--gs-header-h));
          padding: 0 28px;
          transition: margin-left ${DUR} ${EASE}, margin-right ${DUR} ${EASE};
          position: relative;
          z-index: 1;
        }
        /* 12 モジュール orb 列 */
        .gs-orb-col .nav-app-item {
          display: flex; flex-direction: column; align-items: center; padding: 8px 0; gap: 2px;
          color: var(--text-sub); text-decoration: none; font-size: 9px;
          transition: background 0.2s;
        }
        .gs-orb-col .nav-app-item:hover { background: rgba(212, 165, 65, 0.10); }
        .gs-orb-col .nav-app-item.active { background: rgba(212, 165, 65, 0.18); }
        .gs-orb-col .nav-app-icon img { width: 36px; height: 36px; object-fit: contain; }
        /* nav-pages 内 (モジュールメニュー) */
        .gs-nav-col .nav-pages-header {
          display: flex; align-items: center; gap: 10px; padding: 16px 14px;
          border-bottom: 1px solid rgba(154, 138, 105, 0.14);
          color: var(--text-main); text-decoration: none; font-weight: 500;
        }
        .gs-nav-col .nav-pages-header img { width: 28px; height: 28px; }
        .gs-nav-col .nav-page-item {
          display: flex; align-items: center; gap: 10px; padding: 10px 14px;
          color: var(--text-sub); text-decoration: none; font-size: 13px;
          transition: background 0.2s, color 0.2s;
        }
        .gs-nav-col .nav-page-item:hover { background: rgba(212, 165, 65, 0.08); color: var(--text-main); }
        .gs-nav-col .nav-page-item.active { background: rgba(212, 165, 65, 0.18); color: var(--text-main); font-weight: 500; }
        .gs-nav-col .nav-page-item img { width: 18px; height: 18px; }
        /* toggle ボタン (sidebar / activity の境界に絶対配置、画面下端まで貫通) */
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
      `;
      document.head.appendChild(st);
    }
    return () => {
      document.body.classList.remove("bloom-page");
    };
  }, []);

  return (
    <>
      {/* 背景 (画面全体に固定) */}
      <div
        className="bg-layer"
        style={{
          position: "fixed", top: 0, left: 0, width: "100vw", height: "100vh",
          backgroundImage: `url('${bgUrl}')`, backgroundSize: "cover", backgroundPosition: "center",
          opacity: 1, zIndex: 0,
          transition: `background-image ${DUR} ${EASE}`,
        }}
      />

      {/* CSS 変数を root に inject (CSS と React state の同期) */}
      <style>{`:root { --gs-left-w: ${leftW}px !important; --gs-right-w: ${rightW}px !important; --gs-nav-w: ${navW}px !important; --gs-activity-w: ${actW}px !important; }`}</style>

      {/* ① ヘッダー (fixed top) */}
      <header className="gs-header topbar">
        <a href="/" className="topbar-brand" title="Garden Series ホームへ戻る" style={{ textDecoration: "none" }}>
          <img src={logoUrl} alt="Garden Series" className="topbar-brand-img" />
        </a>
        <div className="search-box">
          <span className="search-icon"><img src={`${T}/images/header_icons/header_search.png`} alt="" /></span>
          <input type="text" placeholder="検索 (取引先、請求書、タスク、ヘルプなど)" />
          <span className="search-shortcut">Ctrl+F</span>
        </div>
        <div className="topbar-info">
          <div className="info-item">
            <span className="info-icon"><img src={`${T}/images/header_icons/header_calendar.png`} alt="" /></span>
            <span className="info-text">2026年5月14日(木)</span>
          </div>
          <div className="info-item">
            <span className="info-icon"><img src={`${T}/images/header_icons/weather_01_sunny.png`} alt="" /></span>
            <div className="info-text"><strong>22℃</strong><small>晴れ</small></div>
          </div>
          <div className="info-item">
            <span className="status-dot"></span>
            <span className="info-text">すべてのシステム正常</span>
          </div>
          <button className="header-tool-btn theme-toggle" title="ライト/ダーク切替" onClick={toggleTheme}>
            <img src={themeIconUrl} alt="" />
          </button>
          <button className="header-tool-btn header-notify-btn" title="通知">
            <img src={`${T}/images/header_icons/header_bell.png`} alt="" />
            <span className="header-tool-badge">3</span>
          </button>
          <button className="header-tool-btn help-btn" title="ヘルプ">
            <img src={`${T}/images/header_icons/D-02_help_simple.png`} alt="" />
          </button>
          <button className="header-tool-btn favorite-btn" title="お気に入り">
            <img src={`${T}/images/header_icons/D-01_favorite_simple.png`} alt="" />
          </button>
          <div className="user-area" tabIndex={0}>
            <div className="user-avatar"><img src={`${T}/images/avatar/avatar_shoji.png`} alt="東海林 美琴" /></div>
            <div className="user-info"><strong>東海林 美琴</strong><small>正社員 / 全権管理者</small></div>
            <span className="user-arrow">⌄</span>
          </div>
        </div>
      </header>

      {/* ②③ sidebar (orb + nav、fixed left) */}
      <aside className="gs-sidebar" style={{ width: leftW }}>
        <div className="gs-orb-col">
          {MODULES.map((m) => (
            <a key={m.id} href={`/${m.id}`} className={`nav-app-item${activeModule === m.id ? " active" : ""}`} data-app={m.id} title={m.name}>
              <span className="nav-app-icon"><img src={m.icon} alt="" /></span>
              <span className="nav-app-name">{m.name}</span>
            </a>
          ))}
        </div>
        <div className="gs-nav-col" style={{ width: navW }}>
          <Link href={`/${activeModule}`} className="nav-pages-header" title={`${moduleName} ホームへ`}>
            <span className="nav-pages-app-icon"><img src={moduleIcon} alt="" /></span>
            <span className="nav-pages-app-name">{moduleName}</span>
          </Link>
          {pageMenu.map((p) => (
            <Link key={p.href} href={p.href} className={`nav-page-item${p.active ? " active" : ""}`}>
              {p.icon && <span className="nav-page-icon"><img src={p.icon} alt="" /></span>}
              <span className="nav-page-label">{p.label}</span>
            </Link>
          ))}
        </div>
      </aside>

      {/* nav toggle (sidebar 右境界、画面下端まで) */}
      <button
        className="gs-toggle-fixed nav-pages-toggle"
        type="button"
        title="メニュー名の表示/非表示"
        aria-expanded={!navCollapsed}
        onClick={() => setNavCollapsed(c => !c)}
        style={{ left: leftW }}
      >
        <span>{navCollapsed ? "›" : "‹"}</span>
      </button>

      {/* ⑤⑥⑨ main (margin で sidebar/activity に追従) */}
      <main className="gs-main-fixed main">{children}</main>

      {/* activity toggle (activity 左境界、画面下端まで) */}
      <button
        className="gs-toggle-fixed activity-toggle"
        type="button"
        title="Activity Panel 収納/展開"
        aria-expanded={!activityCollapsed}
        onClick={() => setActivityCollapsed(c => !c)}
        style={{ right: actW }}
      >
        <span>{activityCollapsed ? "‹" : "›"}</span>
      </button>

      {/* ④ Activity Panel (fixed right) */}
      <aside className="gs-activity-fixed activity-panel" style={{ width: actW }}>
        <div style={{ width: ACT_W, padding: 16 }}>
          <div className="activity-header">
            <div className="activity-title"><h3>Today's Activity</h3></div>
            <a href="#" className="activity-all">すべて表示</a>
          </div>
          <ul className="activity-list">
            <li className="activity-item">
              <span className="activity-time">--:--</span>
              <span className="activity-icon"><img src={`${T}/images/icons_bloom/bloom_workboard.png`} alt="" /></span>
              <div className="activity-body">
                <strong>(プレースホルダー)</strong>
                <p>Activity Panel は将来の RealTime データ用</p>
              </div>
            </li>
          </ul>
          <button className="notify-btn"><span>⚙</span> 通知設定をカスタマイズ <span className="arrow">›</span></button>
        </div>
      </aside>
    </>
  );
}
