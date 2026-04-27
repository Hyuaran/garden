"use client";

/**
 * Garden Series 共通ヘッダー（v6 dispatch Step 3 で拡張）
 *
 * 構成（左→右）:
 *   - クリスタル大樹ロゴ + Garden Series + Grow Your Business
 *   - 中央: 検索ボックス（max-w 480、Ctrl+F or Ctrl+K で focus）
 *   - 右: 日付（曜日付）+ 天気（モック）+ システム状態 + 通知ベル + ユーザー情報（ドロップダウン）
 *
 * 動的化（root_employees 連携）は post-5/5 で後追い。初版は static + props 経由。
 * 通知ベル click は data-state 切替のみ（drawer 実装は v6 Step 6 Today's Activity）。
 */

import { useEffect, useRef, useState } from "react";

const WEEKDAY_JP = ["日", "月", "火", "水", "木", "金", "土"];

function formatDateJP(date: Date): string {
  const y = date.getFullYear();
  const m = date.getMonth() + 1;
  const d = date.getDate();
  const w = WEEKDAY_JP[date.getDay()];
  return `${y}年${m}月${d}日（${w}）`;
}

type GardenRole =
  | "toss" | "closer" | "cs" | "staff" | "outsource" | "manager" | "admin" | "super_admin";

const ROLE_LABEL: Record<GardenRole, string> = {
  super_admin: "全権管理者",
  admin: "管理者",
  manager: "マネージャー",
  staff: "正社員",
  cs: "CS",
  closer: "クローザー",
  toss: "トス",
  outsource: "外注",
};

type Props = {
  /** 動的化された場合の表示名（未指定時は東海林 美琴） */
  userName?: string;
  /** 法人名（未指定時は株式会社ヒュアラン） */
  organization?: string;
  /** 雇用形態（未指定時は正社員） */
  employmentType?: string;
  /** ロール（未指定時は super_admin） */
  role?: GardenRole;
  /** 通知件数（モック） */
  notificationCount?: number;
};

export function AppHeader({
  userName = "東海林 美琴",
  organization = "株式会社ヒュアラン",
  employmentType = "正社員",
  role = "super_admin",
  notificationCount = 5,
}: Props) {
  const searchRef = useRef<HTMLInputElement>(null);
  const [searchValue, setSearchValue] = useState("");
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const [activityOpen, setActivityOpen] = useState(false);
  const [today, setToday] = useState<string>("");

  // hydration mismatch を避けるため client side で日付を初期化
  useEffect(() => {
    setToday(formatDateJP(new Date()));
  }, []);

  // Ctrl+F / Ctrl+K / Cmd+F / Cmd+K で search にフォーカス
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      const isContentEditable =
        target?.isContentEditable || target?.getAttribute("contenteditable") === "true";
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || isContentEditable) return;

      if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === "f" || e.key.toLowerCase() === "k")) {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // ユーザードロップダウン: 外側 click で閉じる
  useEffect(() => {
    if (!userDropdownOpen) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target?.closest('[data-testid="app-user-info"]')) setUserDropdownOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [userDropdownOpen]);

  return (
    <header
      data-testid="app-header"
      data-activity-open={activityOpen}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 16,
        padding: "12px 24px",
        background: "rgba(255, 255, 255, 0.92)",
        borderBottom: "1px solid #E8E5DD",
        boxShadow: "0 2px 6px rgba(0,0,0,0.04)",
        backdropFilter: "blur(8px)",
        position: "sticky",
        top: 0,
        zIndex: 5,
      }}
    >
      {/* 左: 検索バー（Sidebar が左にあるので AppHeader の左端は検索でスタート） */}
      <div style={{ flex: 1, maxWidth: 560, marginLeft: 8 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "7px 12px",
            background: "rgba(240, 244, 240, 0.7)",
            borderRadius: 8,
            border: "1px solid #DEE5DE",
          }}
        >
          <span aria-hidden style={{ color: "#7A8B7E" }}>🔍</span>
          <input
            ref={searchRef}
            type="text"
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            placeholder="検索（取引先・請求書・タスク・ヘルプなど）"
            data-testid="app-search-input"
            style={{
              flex: 1,
              border: "none",
              background: "transparent",
              fontSize: 13,
              color: "#2B2B2B",
              outline: "none",
            }}
          />
          <span
            style={{
              fontSize: 11,
              color: "#7A8B7E",
              padding: "2px 6px",
              background: "rgba(255,255,255,0.85)",
              borderRadius: 4,
              border: "1px solid #DEE5DE",
            }}
            aria-label="Ctrl + F または Ctrl + K で検索"
          >
            Ctrl+F
          </span>
        </div>
      </div>

      <div style={{ flex: 1 }} />

      {/* 右: 日付 + 天気 + システム状態 + 通知 + ユーザー情報 */}
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        {/* 日付 */}
        <span
          data-testid="app-date"
          style={{ fontSize: 12, color: "#5C6E5F", whiteSpace: "nowrap" }}
        >
          {today || "\u00A0"}
        </span>

        {/* 天気（モック） */}
        <span
          data-testid="app-weather"
          aria-label="天気: 晴れ 21度"
          style={{ fontSize: 12, color: "#5C6E5F", whiteSpace: "nowrap" }}
        >
          ☀️ 21℃
        </span>

        {/* システム状態（緑●） */}
        <span
          data-testid="app-system-status"
          aria-label="システム正常稼働中"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            fontSize: 12,
            color: "#5C6E5F",
          }}
        >
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: "#3B9B5C",
              display: "inline-block",
            }}
            aria-hidden
          />
          すべてのシステム正常
        </span>

        {/* 通知ベル */}
        <button
          type="button"
          data-testid="app-notification-bell"
          aria-label={`通知 ${notificationCount} 件`}
          aria-pressed={activityOpen}
          onClick={() => setActivityOpen((v) => !v)}
          style={{
            position: "relative",
            background: "transparent",
            border: "none",
            cursor: "pointer",
            padding: 4,
            color: "#3B9B5C",
            fontSize: 18,
          }}
        >
          🔔
          {notificationCount > 0 && (
            <span
              aria-hidden
              style={{
                position: "absolute",
                top: 0,
                right: 0,
                background: "#C1121F",
                color: "#fff",
                fontSize: 9,
                fontWeight: 700,
                borderRadius: 8,
                padding: "1px 5px",
                minWidth: 16,
                lineHeight: 1.2,
                textAlign: "center",
              }}
            >
              {notificationCount}
            </span>
          )}
        </button>

        {/* ユーザー情報 + ドロップダウン */}
        <div style={{ position: "relative" }} data-testid="app-user-info">
          <button
            type="button"
            data-testid="app-user-dropdown-trigger"
            onClick={() => setUserDropdownOpen((v) => !v)}
            aria-haspopup="menu"
            aria-expanded={userDropdownOpen}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              background: "transparent",
              border: "none",
              cursor: "pointer",
              padding: 4,
            }}
          >
            <div
              aria-hidden
              style={{
                width: 36,
                height: 36,
                borderRadius: "50%",
                background: "linear-gradient(135deg, #A8D87A, #3B9B5C)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#fff",
                fontWeight: 700,
                fontSize: 13,
              }}
            >
              {userName.charAt(0)}
            </div>
            <div style={{ lineHeight: 1.2, textAlign: "left" }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#2B2B2B" }}>{userName}</div>
              <div style={{ fontSize: 10, color: "#6B8E75" }}>
                {organization} / {ROLE_LABEL[role]}
              </div>
            </div>
            <span aria-hidden style={{ color: "#7A8B7E", fontSize: 10 }}>▼</span>
          </button>

          {userDropdownOpen && (
            <div
              role="menu"
              data-testid="app-user-dropdown-menu"
              style={{
                position: "absolute",
                right: 0,
                top: "calc(100% + 6px)",
                minWidth: 200,
                background: "#fff",
                border: "1px solid #DEE5DE",
                borderRadius: 8,
                boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
                padding: 6,
                zIndex: 20,
              }}
            >
              <a
                href="/root/me"
                role="menuitem"
                style={{ display: "block", padding: "8px 12px", fontSize: 13, color: "#2B2B2B", textDecoration: "none", borderRadius: 4 }}
              >
                マイページ
              </a>
              <a
                href="/help"
                role="menuitem"
                style={{ display: "block", padding: "8px 12px", fontSize: 13, color: "#2B2B2B", textDecoration: "none", borderRadius: 4 }}
              >
                ヘルプ
              </a>
              <hr style={{ border: 0, borderTop: "1px solid #E8E5DD", margin: "4px 0" }} />
              <a
                href="/api/logout"
                role="menuitem"
                style={{ display: "block", padding: "8px 12px", fontSize: 13, color: "#C1121F", textDecoration: "none", borderRadius: 4 }}
              >
                ログアウト
              </a>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
