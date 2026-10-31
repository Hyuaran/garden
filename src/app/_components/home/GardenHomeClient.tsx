"use client";

import HelpButton from "@/app/system/_components/HelpButton/HelpButton";
import SystemTabs from "@/app/system/_components/SystemTabs/SystemTabs";
import Image from "next/image";
import { ModuleIcon, RailIcon } from "../ModuleIcon/ModuleIcon";
import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type MouseEvent,
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
};

const MODULE_PRESENTATION: Record<GardenModuleId, Omit<HomeModule, "id" | "en" | "href">> = {
  bloom: {
    jp: "案件KPI", color: "#f472b6", description: "案件の進みぐあいと数字。",
  },
  fruit: {
    jp: "法人実態情報", color: "#fb923c", description: "取引先の法人がどんな会社かを調べます。",
  },
  seed: {
    jp: "新事業", color: "#facc15", description: "これから始める事業の検討。",
  },
  forest: {
    jp: "全法人決算", color: "#34d399", description: "7つの法人の決算をまとめて。",
  },
  bud: {
    jp: "経理・収支", color: "#c084fc", description: "経費精算・入金・振込・給与・仕訳。",
  },
  leaf: {
    jp: "案件アプリ", color: "#4ade80", description: "関西電力など、案件ごとの専用画面。",
  },
  tree: {
    jp: "架電", color: "#a78bfa", description: "架電の受付から結果の記録まで。",
  },
  sprout: {
    jp: "採用", color: "#86efac", description: "求人と応募者のやりとり。",
  },
  soil: {
    jp: "データベース", color: "#9aa7b8", description: "Garden全体のデータの土台。",
  },
  root: {
    jp: "組織台帳", color: "#5b9dff", description: "従業員名簿と法人の情報。",
  },
  rill: {
    jp: "メッセージ", color: "#38bdf8", description: "メールの確認・送信・取り込み。",
  },
  calendar: {
    jp: "予定管理", color: "#60a5fa", description: "会議や来客の予定を共有。",
  },
};

const SYSTEM_MODULE: HomeModule = {
  id: "system",
  jp: "社内システム",
  en: "System",
  color: "#0ea5a0",
  description: "マイページや勤怠打刻など。",
  href: "/system",
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
      <span className={styles.cardIcon}>{module.id === "system" ? <RailIcon color="#0ea5a0" shade="#054e4b" iconScale={1.85} iconStrokeWidth={1.9}><path d="M4 11h9v6.5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z"/><path d="M13 13.5l5.5-3.8M18.5 9.7l2.2 1.1M6.5 11V9.2A2.2 2.2 0 0 1 8.7 7h1.6M20 13.8v2.2M17.6 15.2V17"/></RailIcon> : <ModuleIcon id={module.id} />}</span>
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
      <div className="garden-help-heading"><h1 id="home-greeting">{displayName}さん、{greeting}</h1><HelpButton /></div><SystemTabs />
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
      <Link href="/system/notices">お知らせ</Link>
      <Link href="/help">サポート</Link>
      <Link href="/company">会社情報</Link>
      <span>ヒュアラングループ</span>
    </footer>
  </main>;
}
