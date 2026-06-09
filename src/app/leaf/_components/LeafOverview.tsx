"use client";

import Link from "next/link";

import PageHeader from "@/app/_components/layout/GardenShell/PageHeader";

import LeafShell from "./LeafShell";
import styles from "./LeafPages.module.css";

type DivisionCard = {
  title: string;
  description: string;
  status: "ready" | "soon";
  href?: string;
  glyph: string;
};

const DIVISIONS: DivisionCard[] = [
  {
    title: "コールセンター",
    description: "受電・架電の業務設計と日次オペレーションを扱う入口です。",
    status: "soon",
    glyph: "☘",
  },
  {
    title: "関電（関西電力業務委託）",
    description: "OCR取り込み済みの入力UI・事務UIプロトタイプを閲覧できます。",
    status: "ready",
    href: "/leaf/kanden",
    glyph: "🌿",
  },
  {
    title: "ブレーカー",
    description: "電気設備まわりの案件管理と点検フローを扱う予定です。",
    status: "soon",
    glyph: "🍃",
  },
  {
    title: "不動産アライアンス",
    description: "提携先・物件・送客状況を束ねる事業部として準備中です。",
    status: "soon",
    glyph: "🌱",
  },
  {
    title: "トスアップ",
    description: "一次接点から次工程への受け渡しを管理する予定です。",
    status: "soon",
    glyph: "☘",
  },
  {
    title: "軽貨物事業",
    description: "配送・車両・稼働状況を扱う事業部として準備中です。",
    status: "soon",
    glyph: "🍃",
  },
];

function DivisionCardView({ card }: { card: DivisionCard }) {
  const inner = (
    <>
      <span className={styles.iconWrap} aria-hidden="true">
        {card.status === "ready" ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src="/themes/garden-shell/images/icons_bloom/orb_leaf.png" alt="" />
        ) : (
          <span className={styles.iconGlyph}>{card.glyph}</span>
        )}
      </span>
      <span className={styles.cardText}>
        <h3>{card.title}</h3>
        <p>{card.description}</p>
      </span>
      <span
        className={`${styles.status} ${
          card.status === "ready" ? styles.statusReady : styles.statusSoon
        }`}
      >
        {card.status === "ready" ? "利用可" : "準備中"}
      </span>
      {card.status === "ready" && <span className={styles.arrow} aria-hidden="true">›</span>}
    </>
  );

  if (card.href) {
    return (
      <Link className={styles.navCard} href={card.href}>
        {inner}
      </Link>
    );
  }

  return (
    <button className={`${styles.navCard} ${styles.navCardDisabled}`} type="button" disabled>
      {inner}
    </button>
  );
}

export default function LeafOverview() {
  return (
    <LeafShell active="overview">
      <div className={styles.pageStack}>
        <PageHeader
          title="Leaf"
          subtitle="事業部ごとの業務アプリを束ねる入口です。現在は関電プロトタイプの閲覧を先行して公開しています。"
          accessBadge={{ icon: "🌿", label: "Leaf" }}
          moduleMark="leaf"
          favoriteIcon="/themes/garden-shell/images/icons_bloom/orb_leaf.png"
        />

        <section className={styles.overviewLead}>
          <div>
            <h2>事業部カード</h2>
            <p>
              関電のみ利用可能です。他の事業部は会議後の本格設計に合わせて追加します。
            </p>
          </div>
          <span className={styles.leadBadge}>関電プロト閲覧 ready</span>
        </section>

        <section className={styles.navGrid} aria-label="Leaf 事業部一覧">
          {DIVISIONS.map((card) => (
            <DivisionCardView key={card.title} card={card} />
          ))}
        </section>
      </div>
    </LeafShell>
  );
}
