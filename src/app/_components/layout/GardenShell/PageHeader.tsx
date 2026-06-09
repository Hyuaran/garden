"use client";

import { useMemo, useRef, useState, useSyncExternalStore } from "react";

/**
 * PageHeader — 中央エリア上部 (⑤ 見出し + ⑦ お気に入り + ⑧ 限定公開バッジ)
 */

interface PageHeaderProps {
  /** 大見出し (例: "銀行口座管理") */
  title: string;
  /** 見出し横の和 サブタイトル (例: "お金の通り道を、見渡す") */
  titleJp?: string;
  /** 見出し下のサブテキスト (例: "法人 × 口座 マトリクス + 残高推移 + 口座マスタ") */
  subtitle?: string;
  /** 限定公開バッジ表示 */
  accessBadge?: { icon?: string; label: string };
  /** お気に入り押下中の状態 */
  isFavorite?: boolean;
  moduleMark?: "sakura" | "forest";
  favoriteIcon?: string;
}

const FAV_KEY = "garden_favorites";
const MSG_ADDED = "お気に入りに追加しました";
const MSG_REMOVED = "お気に入りを解除しました";

interface FavoriteItem {
  title: string;
  url: string;
  icon: string;
  addedAt: number;
}

function getCurrentUrl(): string {
  if (typeof window === "undefined") return "";
  return window.location.pathname + window.location.search + window.location.hash;
}

function loadFavorites(): FavoriteItem[] {
  return parseFavorites(readFavoritesRaw());
}

function parseFavorites(raw: string): FavoriteItem[] {
  try {
    return raw ? JSON.parse(raw) as FavoriteItem[] : [];
  } catch {
    return [];
  }
}

function readFavoritesRaw(): string {
  if (typeof window === "undefined") return "[]";
  try {
    return window.localStorage.getItem(FAV_KEY) ?? "[]";
  } catch {
    return "[]";
  }
}

function saveFavorites(list: FavoriteItem[]) {
  try {
    window.localStorage.setItem(FAV_KEY, JSON.stringify(list));
    window.dispatchEvent(new Event("garden-favorites-change"));
  } catch {
    /* ignore */
  }
}

function subscribeFavorites(onStoreChange: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener("storage", onStoreChange);
  window.addEventListener("garden-favorites-change", onStoreChange);
  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener("garden-favorites-change", onStoreChange);
  };
}

export default function PageHeader({
  title,
  titleJp,
  subtitle,
  accessBadge,
  isFavorite = false,
  moduleMark = "sakura",
  favoriteIcon = "/themes/garden-shell/images/icons_bloom/orb_bud.png",
}: PageHeaderProps) {
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const favoriteSnapshot = useSyncExternalStore(subscribeFavorites, readFavoritesRaw, () => "[]");
  const favorites = useMemo(() => parseFavorites(favoriteSnapshot), [favoriteSnapshot]);
  const url = getCurrentUrl();
  const favorite = isFavorite || (url ? favorites.some(item => item.url === url) : false);
  const [toast, setToast] = useState("");
  const [toastVisible, setToastVisible] = useState(false);

  const showToast = (message: string) => {
    setToast(message);
    setToastVisible(true);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastVisible(false), 1800);
  };

  const toggleFavorite = () => {
    const url = getCurrentUrl();
    if (!url) return;
    const list = loadFavorites();
    const idx = list.findIndex(item => item.url === url);

    if (idx >= 0) {
      list.splice(idx, 1);
      saveFavorites(list);
      showToast(MSG_REMOVED);
      return;
    }

    list.push({
      title,
      url,
      icon: favoriteIcon,
      addedAt: Date.now(),
    });
    saveFavorites(list);
    showToast(MSG_ADDED);
  };

  return (
    <div className="page-header">
      <button
        className="page-favorite-btn"
        type="button"
        title={favorite ? "お気に入りから外す" : "このページをお気に入りに追加"}
        aria-pressed={favorite}
        onClick={toggleFavorite}
      >
        <img
          src="/themes/garden-shell/images/header_icons/D-01a_favorite_outline.png"
          alt=""
          className="page-favorite-icon-off"
        />
        <img
          src="/themes/garden-shell/images/header_icons/D-01_favorite_simple.png"
          alt=""
          className="page-favorite-icon-on"
        />
        <span className={`page-favorite-toast${toastVisible ? " is-visible" : ""}`} aria-live="polite">{toast}</span>
      </button>
      <div className="page-title-block">
        <div className="page-title-row">
          <h1 className="page-title">
            {title}
            {titleJp && (
              <>
                {" "}<span style={{ color: "var(--text-muted)", fontSize: "1.6rem" }}>—</span>{" "}
                <span className="page-title-jp">{titleJp}</span>
              </>
            )}
            <span className="page-title-flower">
              {moduleMark === "forest" ? (
                <svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                  <path d="M16 27V13" stroke="#2d6a4f" strokeWidth="2.2" strokeLinecap="round" />
                  <path
                    d="M15.5 14.5C9.8 15.2 6.1 11.8 5 5.8c6.1.6 10.1 3.9 10.5 8.7Z"
                    fill="#74c69d"
                    opacity="0.92"
                  />
                  <path
                    d="M17 13.8c5.1-1.7 9.2.3 11 5.8-5.7 1.4-9.7-.5-11-5.8Z"
                    fill="#40916c"
                    opacity="0.88"
                  />
                  <path
                    d="M16 22c-2.6-3.4-2.1-7.5 1.5-11.6 3.2 4.4 2.8 8.3-1.5 11.6Z"
                    fill="#95d5b2"
                    opacity="0.78"
                  />
                  <circle cx="16" cy="24.5" r="2.2" fill="#b8860b" opacity="0.78" />
                </svg>
              ) : (
                <svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                  <g fill="#e8b4b8" opacity="0.85">
                    <ellipse cx="16" cy="9" rx="3.5" ry="6.5" transform="rotate(0 16 16)" />
                    <ellipse cx="16" cy="9" rx="3.5" ry="6.5" transform="rotate(72 16 16)" />
                    <ellipse cx="16" cy="9" rx="3.5" ry="6.5" transform="rotate(144 16 16)" />
                    <ellipse cx="16" cy="9" rx="3.5" ry="6.5" transform="rotate(216 16 16)" />
                    <ellipse cx="16" cy="9" rx="3.5" ry="6.5" transform="rotate(288 16 16)" />
                  </g>
                  <circle cx="16" cy="16" r="2.8" fill="#d4a541" opacity="0.9" />
                </svg>
              )}
            </span>
          </h1>
        </div>
        {subtitle && <p className="page-subtitle">{subtitle}</p>}
      </div>
      {accessBadge && (
        <span className="access-badge">
          {accessBadge.icon && <span className="access-badge-icon">{accessBadge.icon}</span>}
          <span>{accessBadge.label}</span>
        </span>
      )}
    </div>
  );
}
