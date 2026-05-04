"use client";

/**
 * BloomSidebar — 試作版 1:1 移植 (dispatch main- No.19 修正版)
 *
 * dispatch main- No.19 (2026-05-03) 修正:
 *   #1: HTML 構造をプロト 1:1 に揃え、<aside class="sidebar sidebar-dual"> でラップ
 *   #3: localStorage キー名を React 版独自に切替 (proto と分離)、default expanded 確保
 *
 * プロト出典:
 *   public/_proto/bloom-top/index.html line 164-250
 *
 * 構造:
 *   <aside class="sidebar sidebar-dual">
 *     <nav class="nav-apps">  -- 12 Garden module orbs (icons-only column、hover で expand)
 *       <a class="nav-app-item" data-app data-status>...</a> × 12
 *     </nav>
 *     <nav class="nav-pages">  -- Bloom サブページ menu
 *       <a class="nav-pages-header active">Bloom</a>
 *       <div class="nav-pages-divider"></div>
 *       <a class="nav-page-item">×4</a>
 *     </nav>
 *   </aside>
 *   <button class="nav-pages-toggle">›</button>  -- aside の外、独立配置
 */

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

// React 版専用 localStorage key (プロトの 'garden_nav_pages_collapsed' とは分離、
// プロトを別タブで開いて collapsed 設定しても /bloom には影響しない)
const STORAGE_KEY = "garden_bloom_nav_pages_collapsed";

type NavApp = {
  app: string;
  name: string;
  iconSrc: string;
  status: "released" | "dev" | "concept" | "todo";
  href: string;
  title: string;
};

const NAV_APPS: NavApp[] = [
  { app: "bloom",    name: "Bloom",    iconSrc: "/images/icons_bloom/orb_bloom.png",    status: "dev",      href: "/bloom",    title: "Bloom — ダッシュボード" },
  { app: "fruit",    name: "Fruit",    iconSrc: "/images/icons_bloom/orb_fruit.png",    status: "concept",  href: "/fruit",    title: "Fruit — 法人格の実体・登記" },
  { app: "seed",     name: "Seed",     iconSrc: "/images/icons_bloom/orb_seed.png",     status: "todo",     href: "/seed",     title: "Seed — 新事業枠" },
  { app: "forest",   name: "Forest",   iconSrc: "/images/icons_bloom/orb_forest.png",   status: "todo",     href: "/forest",   title: "Forest — 全法人決算" },
  { app: "bud",      name: "Bud",      iconSrc: "/images/icons_bloom/orb_bud.png",      status: "dev",      href: "/bud",      title: "Bud — 経理・収支" },
  { app: "leaf",     name: "Leaf",     iconSrc: "/images/icons_bloom/orb_leaf.png",     status: "dev",      href: "/leaf",     title: "Leaf — 商材・トスアップ" },
  { app: "tree",     name: "Tree",     iconSrc: "/images/icons_bloom/orb_tree.png",     status: "released", href: "/tree",     title: "Tree — 架電アプリ" },
  { app: "sprout",   name: "Sprout",   iconSrc: "/images/icons_bloom/orb_sprout.png",   status: "todo",     href: "/sprout",   title: "Sprout — 採用・入社" },
  { app: "soil",     name: "Soil",     iconSrc: "/images/icons_bloom/orb_soil.png",     status: "released", href: "/soil",     title: "Soil — DB・大量データ" },
  { app: "root",     name: "Root",     iconSrc: "/images/icons_bloom/orb_root.png",     status: "released", href: "/root",     title: "Root — 組織・顧客・マスタ" },
  { app: "rill",     name: "Rill",     iconSrc: "/images/icons_bloom/orb_rill.png",     status: "dev",      href: "/rill",     title: "Rill — 業務連絡・メッセージング" },
  { app: "calendar", name: "Calendar", iconSrc: "/images/icons_bloom/orb_calendar.png", status: "todo",     href: "/calendar", title: "Calendar — 営業予定・シフト" },
];

type NavPage = {
  href: string;
  iconSrc: string;
  label: string;
};

const NAV_PAGES: NavPage[] = [
  { href: "/bloom/workboard",       iconSrc: "/images/icons_bloom/bloom_workboard.png",     label: "ワークボード" },
  { href: "/bloom/daily-report",    iconSrc: "/images/icons_bloom/bloom_dailyreport.png",   label: "日報" },
  { href: "/bloom/monthly-digest",  iconSrc: "/images/icons_bloom/bloom_monthlydigest.png", label: "月次まとめ" },
  { href: "/bloom/ceo-status",      iconSrc: "/images/icons_bloom/bloom_ceostatus.png",     label: "経営状況" },
];

export default function BloomSidebar() {
  const pathname = usePathname() || "";

  // default: expanded (collapsed = false)、localStorage で "1" の時のみ collapsed
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      // 明示的に "1" のみ collapsed、それ以外（null / "0" / 何でも）は expanded
      const isCollapsed = stored === "1";
      setCollapsed(isCollapsed);
      document.body.classList.toggle("nav-pages-collapsed", isCollapsed);
    } catch {
      /* ignore */
    }
    return () => {
      document.body.classList.remove("nav-pages-collapsed");
    };
  }, []);

  const toggleCollapsed = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      document.body.classList.toggle("nav-pages-collapsed", next);
      return next;
    });
  }, []);

  return (
    <>
      {/* プロト 1:1: <aside class="sidebar sidebar-dual"> でラップ */}
      <aside className="sidebar sidebar-dual" id="sidebarDual">
        {/* 1 本目: nav-apps (Garden 12 モジュール icons column、hover で展開) */}
        <nav className="nav-apps" id="navApps" aria-label="Garden Series アプリ一覧">
          {NAV_APPS.map((nav) => {
            const isCurrent = nav.app === "bloom";
            return (
              <Link
                key={nav.app}
                href={nav.href}
                className={`nav-app-item${isCurrent ? " is-current" : ""}`}
                data-app={nav.app}
                data-status={nav.status}
                title={nav.title}
              >
                <span className="nav-app-icon">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={nav.iconSrc} alt="" />
                </span>
                <span className="nav-app-name">{nav.name}</span>
              </Link>
            );
          })}
        </nav>

        {/* 2 本目: nav-pages (Bloom サブページ menu) */}
        <nav className="nav-pages" id="navPages" aria-label="Bloom メニュー">
          <Link href="/bloom" className="nav-pages-header active" title="Bloomホーム">
            <span className="nav-pages-app-icon">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/images/icons_bloom/orb_bloom.png" alt="" />
            </span>
            <span className="nav-pages-app-name">Bloom</span>
          </Link>

          <div className="nav-pages-divider" />

          {NAV_PAGES.map((page) => {
            const active =
              pathname === page.href || pathname.startsWith(`${page.href}/`);
            return (
              <Link
                key={page.href}
                href={page.href}
                className={`nav-page-item${active ? " active" : ""}`}
              >
                <span className="nav-page-icon">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={page.iconSrc} alt="" />
                </span>
                <span className="nav-page-label">{page.label}</span>
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* 3 本目: nav-pages-toggle (折り畳みボタン、aside の外、独立配置) */}
      <button
        type="button"
        className="nav-pages-toggle"
        id="navPagesToggle"
        onClick={toggleCollapsed}
        title="メニュー名の表示/非表示"
        aria-label="メニュー名の表示/非表示"
        aria-expanded={!collapsed}
      >
        <span className="nav-pages-toggle-arrow" aria-hidden>
          ›
        </span>
      </button>
    </>
  );
}
