"use client";

import Image from "next/image";
import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import { type CSSProperties, type ReactNode, useEffect, useId, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { MODULE_META, ModuleIcon, RailIcon } from "@/app/_components/ModuleIcon/ModuleIcon";
import { GARDEN_SHELL_MODULES } from "@/app/_components/layout/GardenShell/garden-shell-config";
import { readFavorites, readFavoritesRaw, subscribeFavorites, writeFavorites, type FavoriteItem } from "@/app/_components/layout/GardenShell/GardenShell";
import { createBrowserClient } from "@/app/_lib/supabase/browser";
import { useTheme } from "@/app/_lib/theme/ThemeProvider";
import { getVisibleModules } from "@/app/_lib/module-visibility";
import { ShortcutsModal } from "@/app/_components/shortcuts/ShortcutsModal";
import styles from "./RillShachoShell.module.css";

type Props = {
  children: ReactNode;
  user: { name: string; company: string; role: string; roleLabel: string };
};

const RILL_ICON = "/themes/garden-shell/images/icons_bloom/orb_rill.png";

function NavigationPendingHint() {
  const { pending } = useLinkStatus();
  if (!pending) return null;
  return <span className={styles.navigationProgress} data-testid="rill-navigation-pending" aria-hidden="true" />;
}

function SearchIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5" /><path d="m15.5 15.5 5 5" /></svg>;
}

function MailIcon() {
  return <svg className={styles.menuIcon} viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="5" width="17" height="14" rx="2" /><path d="m4 7 8 6 8-6" /></svg>;
}

function ChatIcon() {
  return <svg className={styles.menuIcon} viewBox="0 0 24 24" aria-hidden="true"><path d="M4 4h16v12H7l-3 3z" /></svg>;
}

function CalendarIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="5" width="16" height="15" rx="2" /><path d="M4 10h16M8 3v4M16 3v4" /></svg>;
}

type WeatherKind = "sunny" | "partly" | "cloudy" | "rain" | "snow" | "thunder";
type WeatherState = { temp: string; label: string; kind: WeatherKind };

const CLOUD = "M7 17.5h9.5a4 4 0 0 0 .5-8 6 6 0 0 0-11.6 1.7A3.2 3.2 0 0 0 7 17.5Z";

// 天気は線画で描く（Garden 全体の帯と同じ区分・同じ判定。画像や絵文字は使わない）
function WeatherIcon({ kind }: { kind: WeatherKind }) {
  const parts: Record<WeatherKind, ReactNode> = {
    sunny: <><circle cx="12" cy="12" r="4" /><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6 7 7M17 17l1.4 1.4M18.4 5.6 17 7M7 17l-1.4 1.4" /></>,
    partly: <><path d="M8.5 5.2A4 4 0 0 1 14.6 8" /><path d="M5.2 8.8 4 8.2M8.5 2.8v1.4M3.8 4.6l1 1" /><path d={CLOUD} /></>,
    cloudy: <path d={CLOUD} />,
    rain: <><path d="M7 14.5h9.5a4 4 0 0 0 .5-8 6 6 0 0 0-11.6 1.7A3.2 3.2 0 0 0 7 14.5Z" /><path d="M9 17.5 8 20M13 17.5 12 20M17 17.5 16 20" /></>,
    snow: <><path d="M7 14.5h9.5a4 4 0 0 0 .5-8 6 6 0 0 0-11.6 1.7A3.2 3.2 0 0 0 7 14.5Z" /><path d="M9 18h.01M12 20h.01M15 18h.01" /></>,
    thunder: <><path d="M7 14.5h9.5a4 4 0 0 0 .5-8 6 6 0 0 0-11.6 1.7A3.2 3.2 0 0 0 7 14.5Z" /><path d="m12.5 15-2 3.5h3l-2 3" /></>,
  };
  return <svg viewBox="0 0 24 24" aria-hidden="true">{parts[kind]}</svg>;
}

function weatherFromCode(code: number): { label: string; kind: WeatherKind } {
  if ([0, 1].includes(code)) return { label: "晴れ", kind: "sunny" };
  if (code === 2) return { label: "薄曇り", kind: "partly" };
  if ([3, 45, 48].includes(code)) return { label: "曇り", kind: "cloudy" };
  if ([71, 73, 75, 77, 85, 86].includes(code)) return { label: "雪", kind: "snow" };
  if ([95, 96, 99].includes(code)) return { label: "雷雨", kind: "thunder" };
  return { label: "雨", kind: "rain" };
}

function GearIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3" /><path d="M12 2.8v2.4M12 18.8v2.4M2.8 12h2.4M18.8 12h2.4M5.5 5.5l1.7 1.7M16.8 16.8l1.7 1.7M18.5 5.5l-1.7 1.7M7.2 16.8l-1.7 1.7" /></svg>;
}

function KeyboardIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="2.5" y="6" width="19" height="12" rx="2" /><path d="M6 10h.01M9 10h.01M12 10h.01M15 10h.01M18 10h.01M7 14h10" /></svg>;
}

function StatusIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 4 4L19 6" /></svg>;
}

function SunIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4.2" /><path d="M12 2.6v2.6M12 18.8v2.6M2.6 12h2.6M18.8 12h2.6M5.2 5.2l1.9 1.9M16.9 16.9l1.9 1.9M18.8 5.2l-1.9 1.9M7.1 16.9l-1.9 1.9" /></svg>;
}

function MoonIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 14.4A8.4 8.4 0 0 1 9.6 4 8.4 8.4 0 1 0 20 14.4z" /></svg>;
}

function BellIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" /><path d="M10 21h4" /></svg>;
}

function HelpIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M9.7 9a2.5 2.5 0 1 1 4.1 1.9c-1.2.8-1.8 1.4-1.8 2.6M12 17h.01" /></svg>;
}

function StarIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 2.7 5.5 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z" /></svg>;
}

function UserIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 3.6-6.5 8-6.5s8 2.5 8 6.5" /></svg>;
}

function LogoutIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 17l5-5-5-5M20 12H9M12 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h6" /></svg>;
}

function formatDateJP(date: Date): string {
  const weekdays = ["日", "月", "火", "水", "木", "金", "土"];
  return `${date.getMonth() + 1}/${date.getDate()}(${weekdays[date.getDay()]})`;
}

export default function RillShachoShell({ children, user }: Props) {
  const pathname = usePathname();
  const { theme, toggleTheme } = useTheme();
  const searchInputRef = useRef<HTMLInputElement>(null);
  const favoriteSnapshot = useSyncExternalStore(subscribeFavorites, readFavoritesRaw, () => "[]");
  const favorites = useMemo(() => {
    try {
      return JSON.parse(favoriteSnapshot) as FavoriteItem[];
    } catch {
      return [];
    }
  }, [favoriteSnapshot]);
  const [favoriteOpen, setFavoriteOpen] = useState(false);
  const [activityOpen, setActivityOpen] = useState(false);
  const [userOpen, setUserOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [dateText, setDateText] = useState(() => formatDateJP(new Date()));
  const [weather, setWeather] = useState<WeatherState>({ temp: "--℃", label: "位置未設定", kind: "partly" });
  const drawerId = useId();
  const openButtonRef = useRef<HTMLButtonElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const visibleModules = new Set(getVisibleModules(user.role).map((module) => module.toLowerCase()));
  const themeLabel = theme === "dark" ? "ライトにする" : "ダークにする";

  useEffect(() => {
    const timer = window.setInterval(() => setDateText(formatDateJP(new Date())), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  // 天気：Garden 全体の帯と同じく、現在地が取れたときだけ open-meteo から取る
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
          setWeather({ temp: `${Math.round(current.temperature_2m)}℃`, ...weatherFromCode(current.weather_code) });
        } catch {
          setWeather((w) => ({ ...w, label: "天気取得待ち" }));
        }
      },
      () => setWeather((w) => ({ ...w, label: "位置未設定" })),
      { maximumAge: 30 * 60 * 1000, timeout: 8000 },
    );
  }, []);

  useEffect(() => {
    const handleSearchShortcut = (event: KeyboardEvent) => {
      if (!event.ctrlKey || event.altKey || event.metaKey || !event.shiftKey) return;
      if (event.key.toLowerCase() !== "g") return;
      event.preventDefault();
      searchInputRef.current?.focus();
      searchInputRef.current?.select();
    };
    window.addEventListener("keydown", handleSearchShortcut, true);
    return () => window.removeEventListener("keydown", handleSearchShortcut, true);
  }, []);

  useEffect(() => {
    if (!drawerOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setDrawerOpen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
      openButtonRef.current?.focus();
    };
  }, [drawerOpen]);

  async function logout() {
    await createBrowserClient().auth.signOut();
    window.location.assign("/login");
  }

  function addCurrentFavorite() {
    if (typeof window === "undefined") return;
    const url = `${window.location.pathname}${window.location.search}`;
    const list = readFavorites();
    const index = list.findIndex((item) => item.url === url);
    const item: FavoriteItem = { title: document.title || "Rill Mail", url, icon: RILL_ICON, addedAt: Date.now() };
    if (index >= 0) list[index] = { ...list[index], ...item };
    else list.unshift(item);
    writeFavorites(list.slice(0, 20));
  }

  function removeFavorite(url: string) {
    writeFavorites(readFavorites().filter((item) => item.url !== url));
  }

  const renderModuleRail = () => (
    <>
      <Link href="/system" className={styles.app} style={{ "--c": "#0ea5a0" } as CSSProperties} aria-label="System：社内システム">
        <RailIcon color="#0ea5a0" shade="#054e4b" iconScale={1.85} iconStrokeWidth={1.9}>
          <path d="M4 11h9v6.5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z" /><path d="M13 13.5l5.5-3.8M18.5 9.7l2.2 1.1M6.5 11V9.2A2.2 2.2 0 0 1 8.7 7h1.6M20 13.8v2.2M17.6 15.2V17" />
        </RailIcon>
        <span className={styles.railTip}><b>System</b><span>社内システム</span></span>
      </Link>
      <div className={styles.separator} />
      {GARDEN_SHELL_MODULES.filter((module) => visibleModules.has(module.id)).map((module) => <Link key={module.id} href={`/${module.id}`} className={`${styles.app} ${module.id === "rill" ? styles.current : ""}`} style={{ "--c": MODULE_META[module.id].color } as CSSProperties} aria-current={module.id === "rill" ? "page" : undefined} aria-label={`${module.name}：${MODULE_META[module.id].role}`}>
        <ModuleIcon id={module.id} />
        <span className={styles.railTip}><b>{module.name}</b><span>{MODULE_META[module.id].role}</span></span>
      </Link>)}
    </>
  );
  const renderRillMenu = () => (
    <nav className={styles.nav} aria-label="Rill メニュー" onClick={(event) => {
      if ((event.target as HTMLElement).closest("a")) setDrawerOpen(false);
    }}>
      <div className={styles.navLabel}>メニュー</div>
      <Link href="/rill/mail" className={pathname === "/rill/mail" || pathname.startsWith("/rill/mail/") ? styles.active : undefined} aria-current={pathname === "/rill/mail" || pathname.startsWith("/rill/mail/") ? "page" : undefined}><MailIcon />Mail<NavigationPendingHint /></Link>
      <Link href="#rill-chat"><ChatIcon />Chat（year-end）</Link>
    </nav>
  );

  return <div className={styles.shell}>
    <header className={styles.mobileTopbar}>
      <button ref={openButtonRef} className={styles.menuButton} type="button" aria-label="メニューを開く" aria-expanded={drawerOpen} aria-controls={drawerId} onClick={() => setDrawerOpen(true)}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16" /></svg></button>
      <Link href="/" className={styles.mobileBrand} aria-label="Garden ホームへ（上部）"><Image className={styles.mobileBrandMark} src="/themes/garden-shell/images/login/mark-tree-emblem.png" width={256} height={256} alt="" unoptimized /><span>Garden ／ Rill</span></Link>
      <div className={styles.mobileActions}>
        <button className={styles.iconButton} type="button" aria-label={themeLabel} onClick={toggleTheme}>{theme === "dark" ? <SunIcon /> : <MoonIcon />}</button>
        <button className={styles.iconButton} type="button" aria-label="通知" onClick={() => setActivityOpen(true)}><BellIcon /></button>
        <button className={styles.iconButton} type="button" aria-label="ユーザーメニュー" onClick={() => setUserOpen((value) => !value)}><UserIcon /></button>
      </div>
    </header>
    <aside className={styles.rail} aria-label="Gardenシリーズ">
      <div className={styles.railInner}>
        {renderModuleRail()}
      </div>
    </aside>
    <aside className={styles.side}>
      <div className={styles.sideInner}>
        <div className={styles.brand}>
          <Link href="/" className={styles.brandName} aria-label="Garden ホームへ"><Image className={styles.brandMark} src="/themes/garden-shell/images/login/mark-tree-emblem.png" width={256} height={256} alt="" unoptimized /><span>Garden</span></Link>
          <div className={styles.moduleName}>Rill ／ メッセージ</div>
        </div>
        {renderRillMenu()}
        <div className={styles.who}><div className={styles.avatar}>{user.name.charAt(0)}</div><div><div className={styles.userName}>{user.name}</div><div className={styles.userRole}><span>{user.company}</span><span>{user.roleLabel}</span></div></div></div>
      </div>
    </aside>
    {drawerOpen && <div className={`${styles.drawerLayer} ${styles.drawerOpen}`}>
      <aside id={drawerId} className={styles.drawer} role="dialog" aria-modal="true" aria-label="Rill メニュー">
        <div className={styles.drawerHead}>
          <Link href="/" className={styles.brandName} aria-label="Garden ホームへ"><Image className={styles.brandMark} src="/themes/garden-shell/images/login/mark-tree-emblem.png" width={256} height={256} alt="" unoptimized /><span>Garden</span></Link>
          <button ref={closeButtonRef} className={styles.drawerClose} type="button" aria-label="閉じる" onClick={() => setDrawerOpen(false)}>×</button>
        </div>
        <div className={styles.moduleName}>Rill ／ メッセージ</div>
        <div className={styles.drawerRail} aria-label="Gardenシリーズ">{renderModuleRail()}</div>
        {renderRillMenu()}
        <div className={styles.who}><div className={styles.avatar}>{user.name.charAt(0)}</div><div><div className={styles.userName}>{user.name}</div><div className={styles.userRole}><span>{user.company}</span><span>{user.roleLabel}</span></div></div></div>
      </aside>
      <button className={styles.drawerBackdrop} type="button" aria-label="メニューを閉じる" onClick={() => setDrawerOpen(false)} />
    </div>}
    <div className={styles.work}>
      <header className={styles.topbar}>
        <div className={styles.searchBox}>
          <SearchIcon />
          <input ref={searchInputRef} type="search" placeholder="検索（取引先、請求書、タスク、ヘルプなど）" aria-label="検索" />
          <span>Ctrl+Shift+G</span>
        </div>
        <div className={styles.topbarInfo}>
          <span className={styles.infoItem}><CalendarIcon />{dateText}</span>
          <span className={styles.infoItem}><WeatherIcon kind={weather.kind} /><b>{weather.temp}</b><small>{weather.label}</small></span>
          <span className={styles.infoItem}><StatusIcon />すべてのシステム正常</span>
        </div>
        <div className={styles.headerActions}>
          <button className={styles.iconButton} type="button" aria-label={themeLabel} onClick={toggleTheme}>{theme === "dark" ? <SunIcon /> : <MoonIcon />}<span className={styles.actionTip}>{themeLabel}</span></button>
          <button className={styles.iconButton} type="button" aria-label="通知" onClick={() => setActivityOpen(true)}><BellIcon /></button>
          <button className={styles.iconButton} type="button" aria-label="ヘルプ" onClick={() => setShortcutsOpen(true)}><HelpIcon /></button>
          <div className={`${styles.favoriteWrap} ${favoriteOpen ? styles.open : ""}`}>
            <button className={styles.iconButton} type="button" aria-label="お気に入り" aria-expanded={favoriteOpen} onClick={() => setFavoriteOpen((value) => !value)}><StarIcon /></button>
            <div className={styles.favoriteMenu} role="menu" aria-hidden={!favoriteOpen}>
              <div className={styles.favoriteHead}><span>お気に入り</span><b>{favorites.length}</b></div>
              <div className={styles.favoriteList}>
                {favorites.map((item) => <div className={styles.favoriteItem} key={item.url} role="menuitem" onClick={() => { window.location.href = item.url; }}>
                  <span>{item.title}</span><button type="button" aria-label="削除" onClick={(event) => { event.stopPropagation(); removeFavorite(item.url); }}>×</button>
                </div>)}
                {!favorites.length && <div className={styles.favoriteEmpty}>お気に入りはまだありません</div>}
              </div>
              <button className={styles.favoriteAdd} type="button" onClick={addCurrentFavorite}>現在のページを追加</button>
            </div>
          </div>
          <div className={`${styles.userWrap} ${userOpen ? styles.open : ""}`}>
            <button className={styles.userButton} type="button" aria-label="ユーザーメニュー" aria-expanded={userOpen} onClick={() => setUserOpen((value) => !value)}><span>{user.name.charAt(0)}</span><UserIcon /></button>
            <div className={styles.userMenu} role="menu" aria-hidden={!userOpen}>
              <Link href="/mypage"><UserIcon />マイページ</Link>
              <Link href="/settings"><GearIcon />ユーザー設定</Link>
              <button type="button" onClick={() => { setUserOpen(false); setShortcutsOpen(true); }}><KeyboardIcon />ショートカット一覧</button>
              <button type="button" onClick={() => void logout()}><LogoutIcon />ログアウト</button>
            </div>
          </div>
        </div>
      </header>
      <main className={styles.main}>{children}</main>
    </div>
    <div className={`${styles.activityPanel} ${activityOpen ? styles.activityOpen : ""}`} aria-hidden={!activityOpen}>
      <div className={styles.activityHeader}><h3>Today&apos;s Activity</h3><button type="button" onClick={() => setActivityOpen(false)} aria-label="閉じる">×</button></div>
      <div className={styles.activityActions}><button type="button">すべて既読</button><button type="button">すべて未読</button><Link href="/settings/notifications">通知設定</Link></div>
      <p className={styles.activityEmpty}>新しいお知らせはありません</p>
    </div>
    <ShortcutsModal open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
  </div>;
}
