"use client";

/**
 * BloomSidebar — Bloom 専用 dual サイドバー
 *
 * プロト 015_Gardenシリーズ/000_GardenUI_bloom/02_BloomTop/index.html line 164-250 移植。
 *
 * 構造（dual sidebar）:
 *   1. nav-apps (左 56px、Garden 12 モジュール icons-only column)
 *      - hover で 200px に展開、各モジュール名 label 表示
 *      - data-status (released / dev / concept / todo) で opacity 微調整
 *   2. nav-pages (中央 180px、Bloom サブページ menu)
 *      - "Bloom" header + workboard / daily-report / monthly-digest / ceo-status
 *      - body.nav-pages-collapsed クラスで折り畳み (width 0 + opacity 0)
 *   3. nav-pages-toggle (境界の矢印ボタン、14px、hover で 22px)
 *      - クリックで body のクラス切替、localStorage 永続化
 *
 * dispatch main- No.15 v2 (2026-05-02 16:11) 対応。
 * 旧 v2.8a Garden Sidebar はこのコンポーネントで置換。
 */

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "garden_nav_pages_collapsed";

type NavApp = {
  app: string;
  name: string;
  iconSrc: string;
  status: "released" | "dev" | "concept" | "todo";
  href: string;
};

const NAV_APPS: NavApp[] = [
  { app: "bloom", name: "Bloom", iconSrc: "/images/icons_bloom/orb_bloom.png", status: "dev", href: "/bloom" },
  { app: "fruit", name: "Fruit", iconSrc: "/images/icons_bloom/orb_fruit.png", status: "concept", href: "/fruit" },
  { app: "seed", name: "Seed", iconSrc: "/images/icons_bloom/orb_seed.png", status: "todo", href: "/seed" },
  { app: "forest", name: "Forest", iconSrc: "/images/icons_bloom/orb_forest.png", status: "todo", href: "/forest" },
  { app: "bud", name: "Bud", iconSrc: "/images/icons_bloom/orb_bud.png", status: "dev", href: "/bud" },
  { app: "leaf", name: "Leaf", iconSrc: "/images/icons_bloom/orb_leaf.png", status: "dev", href: "/leaf" },
  { app: "tree", name: "Tree", iconSrc: "/images/icons_bloom/orb_tree.png", status: "released", href: "/tree" },
  { app: "sprout", name: "Sprout", iconSrc: "/images/icons_bloom/orb_sprout.png", status: "todo", href: "/sprout" },
  { app: "soil", name: "Soil", iconSrc: "/images/icons_bloom/orb_soil.png", status: "released", href: "/soil" },
  { app: "root", name: "Root", iconSrc: "/images/icons_bloom/orb_root.png", status: "released", href: "/root" },
  { app: "rill", name: "Rill", iconSrc: "/images/icons_bloom/orb_rill.png", status: "dev", href: "/rill" },
  { app: "calendar", name: "Calendar", iconSrc: "/images/icons_bloom/orb_calendar.png", status: "todo", href: "/calendar" },
];

type NavPage = {
  href: string;
  iconSrc: string;
  label: string;
};

const NAV_PAGES: NavPage[] = [
  { href: "/bloom/workboard", iconSrc: "/images/icons_bloom/bloom_workboard.png", label: "ワークボード" },
  { href: "/bloom/daily-report", iconSrc: "/images/icons_bloom/bloom_dailyreport.png", label: "日報" },
  { href: "/bloom/monthly-digest", iconSrc: "/images/icons_bloom/bloom_monthlydigest.png", label: "月次まとめ" },
  { href: "/bloom/ceo-status", iconSrc: "/images/icons_bloom/bloom_ceostatus.png", label: "経営状況" },
];

export default function BloomSidebar() {
  const pathname = usePathname() || "";
  const [collapsed, setCollapsed] = useState(false);

  // mount 時 localStorage から復元
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
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
      {/* 1 本目: nav-apps (Garden 全モジュール icons column、hover で展開) */}
      <nav className="nav-apps" aria-label="Garden Series アプリ一覧">
        {NAV_APPS.map((nav) => {
          const isCurrent = nav.app === "bloom";
          return (
            <Link
              key={nav.app}
              href={nav.href}
              className={`nav-app-item${isCurrent ? " is-current" : ""}`}
              data-app={nav.app}
              data-status={nav.status}
              title={`${nav.name}`}
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
      <nav className="nav-pages" aria-label="Bloom メニュー">
        <Link href="/bloom" className="nav-pages-header" title="Bloom ホーム">
          <span className="nav-pages-app-icon">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/images/icons_bloom/orb_bloom.png" alt="" />
          </span>
          <span className="nav-pages-app-name">Bloom</span>
        </Link>

        <div className="nav-pages-divider" />

        {NAV_PAGES.map((page) => {
          const active = pathname === page.href || pathname.startsWith(`${page.href}/`);
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

      {/* 3 本目: nav-pages-toggle (折り畳みボタン) */}
      <button
        type="button"
        className="nav-pages-toggle"
        onClick={toggleCollapsed}
        title="メニューの表示/非表示"
        aria-label="メニューの表示/非表示"
        aria-expanded={!collapsed}
      >
        <span className="nav-pages-toggle-arrow" aria-hidden>
          ›
        </span>
      </button>
    </>
  );
}
