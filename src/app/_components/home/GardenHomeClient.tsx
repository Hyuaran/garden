"use client";

import Image from "next/image";
import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type MouseEvent,
  type ReactNode,
} from "react";

import {
  GARDEN_SHELL_MODULES,
  type GardenModuleId,
} from "../layout/GardenShell/garden-shell-config";
import { signOutUnified } from "../../_lib/auth-unified";
import { getGreeting } from "../../_lib/greeting";
import { useTheme } from "../../_lib/theme/ThemeProvider";
import styles from "./garden-home.module.css";

const FAVORITES_KEY = "garden.home.favorites";
const EMPTY_FAVORITES = "まだお気に入りはありません。下の一覧でカード右上の★を押すと、ここに並びます。";

type Props = {
  role?: string | null;
  visibleModules?: readonly string[];
  employeeName?: string | null;
};

type HomeModule = {
  id: "system" | GardenModuleId;
  jp: string;
  en: string;
  color: string;
  description: string;
  href: string;
  icon: ReactNode;
};

const MODULE_PRESENTATION: Record<GardenModuleId, Omit<HomeModule, "id" | "en" | "href">> = {
  bloom: {
    jp: "案件KPI", color: "#f472b6", description: "案件の進みぐあいと数字。",
    icon: <><circle cx="12" cy="10" r="2.4"/><path d="M12 7.6c0-2 1-3.6 2.5-3.6S17 5.6 17 7.6c2 0 3.6 1 3.6 2.5S19 12.6 17 12.6c0 2-1 3.6-2.5 3.6S12 14.6 12 12.6c-2 0-3.6-1-3.6-2.5S9.9 7.6 12 7.6z"/><path d="M12 16v5"/></>,
  },
  fruit: {
    jp: "法人実態情報", color: "#fb923c", description: "取引先の法人がどんな会社かを調べます。",
    icon: <><path d="M12 8c-3.5 0-6 2.6-6 6s2.5 7 6 7 6-3.4 6-7-2.5-6-6-6z"/><path d="M12 8V4"/><path d="M12 5c2-.5 3.5-2 3.5-2"/></>,
  },
  seed: {
    jp: "新事業", color: "#facc15", description: "これから始める事業の検討。",
    icon: <><ellipse cx="12" cy="13" rx="5" ry="6.5"/><path d="M12 19c0-4 1.5-7 4-9"/></>,
  },
  forest: {
    jp: "全法人決算", color: "#34d399", description: "7つの法人の決算をまとめて。",
    icon: <path d="M6 20v-3M6 17l-3-3h6zM6 14L4 11h4zM18 20v-3M18 17l-3-3h6zM18 14l-2-3h4zM12 21v-5M12 16l-3.5-4h7z"/>,
  },
  bud: {
    jp: "経理・収支", color: "#c084fc", description: "経費精算・入金・振込・給与・仕訳。",
    icon: <><path d="M12 21v-7"/><path d="M12 14c-3 0-5-2.4-5-5.5S9 3 12 3s5 2.4 5 5.5S15 14 12 14z"/></>,
  },
  leaf: {
    jp: "個別アプリ", color: "#4ade80", description: "関西電力など、案件ごとの専用画面。",
    icon: <><path d="M5 19c0-8 5-13 14-14 1 9-4 15-12 15-1 0-2 0-2-1z"/><path d="M8 18c2-4 5-7 9-9"/></>,
  },
  tree: {
    jp: "架電", color: "#a78bfa", description: "架電の受付から結果の記録まで。",
    icon: <path d="M12 21v-6M12 15l-5-4h10zM12 11L8 7h8zM12 7l-3-3h6z"/>,
  },
  sprout: {
    jp: "採用", color: "#86efac", description: "求人と応募者のやりとり。",
    icon: <><path d="M12 21v-8"/><path d="M12 13c0-3 2.2-5 5-5 0 3-2.2 5-5 5z"/><path d="M12 15c0-2.6-2-4.5-4.5-4.5 0 2.6 2 4.5 4.5 4.5z"/></>,
  },
  soil: {
    jp: "データ基盤", color: "#9aa7b8", description: "Garden全体のデータの土台。",
    icon: <path d="M3 8h18M3 13h18M3 18h18M7 8v10M17 8v10"/>,
  },
  root: {
    jp: "組織マスタ", color: "#5b9dff", description: "従業員名簿と法人の情報。",
    icon: <path d="M12 3v9M12 12c-1.5 2-4 3-5 6M12 12c1.5 2 4 3 5 6M12 12v9"/>,
  },
  rill: {
    jp: "メッセージ", color: "#38bdf8", description: "メールの確認・送信・取り込み。",
    icon: <path d="M3 8c3 0 3 2 6 2s3-2 6-2 3 2 6 2M3 13c3 0 3 2 6 2s3-2 6-2 3 2 6 2M3 18c3 0 3 2 6 2"/>,
  },
  calendar: {
    jp: "予定管理", color: "#60a5fa", description: "会議や来客の予定を共有。",
    icon: <><rect x="3.5" y="5" width="17" height="15" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/></>,
  },
};

const SYSTEM_MODULE: HomeModule = {
  id: "system",
  jp: "社内システム",
  en: "System",
  color: "#0ea5a0",
  description: "マイページや勤怠打刻など。",
  href: "/system",
  icon: <><path d="M4 11h9v6.5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z"/><path d="M13 13.5l5.5-3.8M18.5 9.7l2.2 1.1M6.5 11V9.2A2.2 2.2 0 0 1 8.7 7h1.6M20 14.4v1.4M17.6 15.6v1.2"/></>,
};

const ALL_MODULES: HomeModule[] = [
  SYSTEM_MODULE,
  ...GARDEN_SHELL_MODULES.map((module) => ({
    id: module.id,
    en: module.name,
    href: `/${module.id}`,
    ...MODULE_PRESENTATION[module.id],
  })),
];

function readFavorites(): string[] {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(FAVORITES_KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string") : [];
  } catch {
    return [];
  }
}

function storeFavorites(favorites: string[]) {
  try {
    window.localStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites));
  } catch {
    // localStorageが利用できない環境でも、現在の画面ではお気に入りを使えるようにする。
  }
}

function StarIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.6l2.6 5.3 5.8.8-4.2 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8L3.6 9.7l5.8-.8z"/></svg>;
}

function ModuleCard({ module, favorite, compact, onToggleFavorite }: {
  module: HomeModule;
  favorite: boolean;
  compact?: boolean;
  onToggleFavorite: (event: MouseEvent<HTMLButtonElement>, id: string) => void;
}) {
  return <article
    className={`${styles.card} ${compact ? styles.favoriteCard : ""}`}
    data-module-id={module.id}
    style={{ "--c": module.color } as CSSProperties}
  >
    <Link className={styles.cardLink} href={module.href}>
      <span className={styles.cardIcon}><svg viewBox="0 0 24 24" aria-hidden="true">{module.icon}</svg></span>
      <span className={styles.cardBody}>
        <span className={styles.cardName}><strong>{module.jp}</strong><em>{module.en}</em></span>
        {!compact && <span className={styles.cardDesc}>{module.description}</span>}
      </span>
    </Link>
    <button
      type="button"
      className={styles.favBtn}
      aria-pressed={favorite}
      aria-label={`${module.jp}をお気に入り${favorite ? "から外す" : "に追加"}`}
      onClick={(event) => onToggleFavorite(event, module.id)}
    >
      <StarIcon />
    </button>
  </article>;
}

export default function GardenHomeClient({ visibleModules, employeeName }: Props = {}) {
  const { theme, toggleTheme } = useTheme();
  const [greeting, setGreeting] = useState("おはようございます");
  const [favorites, setFavorites] = useState<string[]>([]);
  const displayName = employeeName?.trim() || "ユーザー";

  useEffect(() => {
    const timer = window.setTimeout(() => setGreeting(getGreeting(new Date())), 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    // 初回描画を空で揃え、hydration後に端末ごとの保存値を復元する。
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFavorites(readFavorites());
  }, []);

  const visible = useMemo(() => {
    if (!visibleModules) return ALL_MODULES;
    const visibleSet = new Set(visibleModules);
    return ALL_MODULES.filter((module) => module.id === "system" || visibleSet.has(module.en));
  }, [visibleModules]);
  const favoriteSet = useMemo(() => new Set(favorites), [favorites]);
  const favoriteModules = visible.filter((module) => favoriteSet.has(module.id));

  const toggleFavorite = useCallback((event: MouseEvent<HTMLButtonElement>, id: string) => {
    event.preventDefault();
    event.stopPropagation();
    setFavorites((current) => {
      const next = current.includes(id) ? current.filter((item) => item !== id) : [...current, id];
      storeFavorites(next);
      return next;
    });
  }, []);

  const logout = useCallback(async () => {
    await signOutUnified();
    window.location.href = "/login";
  }, []);

  const themeLabel = theme === "dark" ? "ライトにする" : "ダークにする";

  return <main className={styles.pageShell} data-home-mode="series-cards">
    <header className={styles.top}>
      <Link href="/" className={styles.brand} aria-label="Garden ホーム">
        <Image className={styles.brandMark} src="/themes/garden-shell/images/login/mark-tree-emblem.png" width={256} height={256} alt="" unoptimized />
        <span className={styles.brandText}><strong>Garden</strong><span>業務を、育てる。／ GROW YOUR BUSINESS</span></span>
      </Link>
      <div className={styles.actions}>
        <span className={styles.accountName}>{displayName}さん</span>
        <button className={styles.iconButton} type="button" aria-label={themeLabel} onClick={toggleTheme}>
          {theme === "dark"
            ? <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4.2"/><path d="M12 2.6v2.6M12 18.8v2.6M2.6 12h2.6M18.8 12h2.6M5.2 5.2l1.9 1.9M16.9 16.9l1.9 1.9M18.8 5.2l-1.9 1.9M7.1 16.9l-1.9 1.9"/></svg>
            : <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 14.4A8.4 8.4 0 0 1 9.6 4 8.4 8.4 0 1 0 20 14.4z"/></svg>}
        </button>
        <button className={styles.iconButton} type="button" aria-label="ログアウト" onClick={() => void logout()}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 4h3.5A1.5 1.5 0 0 1 20 5.5v13a1.5 1.5 0 0 1-1.5 1.5H15M10 8l-4 4 4 4M6 12h10"/></svg>
        </button>
      </div>
    </header>

    <section className={styles.greeting} aria-labelledby="home-greeting">
      <h1 id="home-greeting">{displayName}さん、{greeting}</h1>
      <p>今日の業務をここから始めましょう。よく使うものは★を押すとお気に入りに並びます。</p>
    </section>

    <section aria-labelledby="favorites-label">
      <h2 className={styles.sectionLabel} id="favorites-label"><span>お気に入り</span></h2>
      {favoriteModules.length === 0
        ? <div className={styles.emptyFav}>{EMPTY_FAVORITES}</div>
        : <div className={styles.grid} data-testid="favorite-grid">
            {favoriteModules.map((module) => <ModuleCard key={module.id} module={module} favorite compact onToggleFavorite={toggleFavorite} />)}
          </div>}
    </section>

    <section className={styles.modulesSection} aria-labelledby="modules-label">
      <h2 className={styles.sectionLabel} id="modules-label"><span>モジュール</span></h2>
      <div className={styles.grid} data-testid="module-grid">
        {visible.map((module) => <ModuleCard key={module.id} module={module} favorite={favoriteSet.has(module.id)} onToggleFavorite={toggleFavorite} />)}
      </div>
    </section>

    <footer className={styles.foot}>
      <Link href="/p/toss/board">トスアップ一覧</Link>
      <Link href="/notices">お知らせ</Link>
      <Link href="/help">サポート</Link>
      <Link href="/company">会社情報</Link>
      <span>ヒュアラングループ</span>
    </footer>
  </main>;
}
