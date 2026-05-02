/**
 * BloomNavGrid — Bloom Top の 4 ナビカード（横 2 × 縦 2）
 *
 * プロト 015_Gardenシリーズ/000_GardenUI_bloom/02_BloomTop/index.html line 369-411 移植
 *   - Workboard → /bloom/workboard
 *   - 日報 → /bloom/daily-report  (Phase 1 では未実装、Phase 3 で新規実装)
 *   - 月次まとめ → /bloom/monthly-digest
 *   - 経営状況 → /bloom/ceo-status (Phase 1 では未実装、Phase 3 で新規実装)
 *
 * Phase 1: 既存実装あり画面 (Workboard / MonthlyDigest) は href 直結、
 *   未実装画面 (DailyReport / CEOStatus) は同じく href 直結（404 OK、Phase 3 で実装）
 */

import Link from "next/link";

type BloomNav = {
  href: string;
  iconSrc: string;
  title: string;
  subtitle: string;
};

const NAVS: BloomNav[] = [
  {
    href: "/bloom/workboard",
    iconSrc: "/images/icons_bloom/bloom_workboard.png",
    title: "ワークボード",
    subtitle: "本日の作業状況を可視化",
  },
  {
    href: "/bloom/daily-report",
    iconSrc: "/images/icons_bloom/bloom_dailyreport.png",
    title: "日報",
    subtitle: "今日の積み重ねを綴る",
  },
  {
    href: "/bloom/monthly-digest",
    iconSrc: "/images/icons_bloom/bloom_monthlydigest.png",
    title: "月次まとめ",
    subtitle: "月の歩みを振り返る",
  },
  {
    href: "/bloom/ceo-status",
    iconSrc: "/images/icons_bloom/bloom_ceostatus.png",
    title: "経営状況",
    subtitle: "経営の全景を、一望に",
  },
];

export default function BloomNavGrid() {
  return (
    <section className="bloom-nav-grid">
      {NAVS.map((nav) => (
        <Link key={nav.href} href={nav.href} className="bloom-nav-card">
          <div className="bloom-nav-img">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={nav.iconSrc} alt={nav.title} />
          </div>
          <div className="bloom-nav-text">
            <h3 className="bloom-nav-title">{nav.title}</h3>
            <p className="bloom-nav-sub">{nav.subtitle}</p>
          </div>
          <span className="bloom-nav-arrow">›</span>
        </Link>
      ))}
    </section>
  );
}
