"use client";

/**
 * BloomNavGrid — Bloom Top の 4 ナビカード（横 2 × 縦 2）
 *
 * プロト 015_Gardenシリーズ/000_GardenUI_bloom/02_BloomTop/index.html line 369-411 移植
 *
 * 実装状態 (2026-05-02):
 *   - Workboard → /bloom/workboard           ✅ 既存実装あり、Link 遷移
 *   - 日報     → /bloom/daily-report        ❌ 未実装、Coming Soon Toast
 *   - 月次まとめ → /bloom/monthly-digest      ✅ 既存実装あり、Link 遷移
 *   - 経営状況  → /bloom/ceo-status         ❌ 未実装、Coming Soon Toast
 *
 * NG 2 対応 (main- No.14): 未実装画面で 404 を防止、Coming Soon Toast 表示。
 */

import Link from "next/link";
import { useCallback, useState } from "react";

type BloomNav = {
  href: string;
  iconSrc: string;
  title: string;
  subtitle: string;
  /** true: クリックで遷移ではなく Coming Soon Toast 表示 */
  comingSoon: boolean;
};

const NAVS: BloomNav[] = [
  {
    href: "/bloom/workboard",
    iconSrc: "/images/icons_bloom/bloom_workboard.png",
    title: "ワークボード",
    subtitle: "本日の作業状況を可視化",
    comingSoon: false,
  },
  {
    href: "/bloom/daily-report",
    iconSrc: "/images/icons_bloom/bloom_dailyreport.png",
    title: "日報",
    subtitle: "今日の積み重ねを綴る",
    comingSoon: true,
  },
  {
    href: "/bloom/monthly-digest",
    iconSrc: "/images/icons_bloom/bloom_monthlydigest.png",
    title: "月次まとめ",
    subtitle: "月の歩みを振り返る",
    comingSoon: false,
  },
  {
    /* dispatch main- No.32 #B: 経営状況プロト (06_CEOStatus) を public/_proto/ceostatus/ に
       コピー済、Coming Soon 解除して直接遷移。本 PoC 段階では target="_blank" で別タブ表示 */
    href: "/_proto/ceostatus/index.html",
    iconSrc: "/images/icons_bloom/bloom_ceostatus.png",
    title: "経営状況",
    subtitle: "経営の全景を、一望に",
    comingSoon: false,
  },
];

export default function BloomNavGrid() {
  const [toastText, setToastText] = useState<string | null>(null);

  const showToast = useCallback((title: string) => {
    setToastText(`${title} は準備中です`);
    window.setTimeout(() => setToastText(null), 2500);
  }, []);

  return (
    <>
      <section className="bloom-nav-grid">
        {NAVS.map((nav) => {
          const cardInner = (
            <>
              <div className="bloom-nav-img">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={nav.iconSrc} alt={nav.title} />
              </div>
              <div className="bloom-nav-text">
                <h3 className="bloom-nav-title">{nav.title}</h3>
                <p className="bloom-nav-sub">{nav.subtitle}</p>
              </div>
              <span className="bloom-nav-arrow">›</span>
            </>
          );

          if (nav.comingSoon) {
            return (
              <button
                key={nav.href}
                type="button"
                className="bloom-nav-card bloom-nav-card-coming-soon"
                data-status="todo"
                onClick={() => showToast(nav.title)}
              >
                {cardInner}
              </button>
            );
          }

          // dispatch main- No.36 #3: /_proto/ 配下は静的ファイル、Next.js Link は内部
          // routing として処理して 404 を返すため、通常 <a> でフル遷移
          if (nav.href.startsWith("/_proto/")) {
            return (
              <a key={nav.href} href={nav.href} className="bloom-nav-card">
                {cardInner}
              </a>
            );
          }

          return (
            <Link key={nav.href} href={nav.href} className="bloom-nav-card">
              {cardInner}
            </Link>
          );
        })}
      </section>

      {/* Coming Soon Toast (画面下部固定、2.5s 表示) */}
      <div
        className={`gs-coming-soon-toast${toastText ? " show" : ""}`}
        role="status"
        aria-live="polite"
      >
        {toastText}
      </div>
    </>
  );
}
