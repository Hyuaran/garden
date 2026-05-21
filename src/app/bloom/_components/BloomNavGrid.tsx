"use client";

/**
 * BloomNavGrid — Bloom Top の 4 ナビカード（横 2 × 縦 2）
 *
 * プロト 015_Gardenシリーズ/000_GardenUI_bloom/02_BloomTop/index.html line 369-411 移植
 *
 * 実装状態 (2026-05-21 更新):
 *   - Workboard → /bloom/workboard           ✅ 実装済、Link 遷移
 *   - 日報     → /bloom/daily-report        ✅ Codex-015 実装済、Link 遷移
 *   - 月次まとめ → /bloom/monthly-digest      ✅ 実装済、Link 遷移
 *   - 経営状況  → /bloom/ceo-status         ✅ PR #214 実装済、Link 遷移 (admin 3 名のみ閲覧可能)
 *
 * NG 2 対応 (main- No.14): 未実装画面では Coming Soon Toast を表示する仕組みは保持。
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
    comingSoon: false,
  },
  {
    href: "/bloom/monthly-digest",
    iconSrc: "/images/icons_bloom/bloom_monthlydigest.png",
    title: "月次まとめ",
    subtitle: "月の歩みを振り返る",
    comingSoon: false,
  },
  {
    /* PR #214 で /bloom/ceo-status を React 実装、Link 遷移に切替。
       admin 3 名 (super_admin) のみ閲覧可能、それ以外は「権限がありません」表示 */
    href: "/bloom/ceo-status",
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
