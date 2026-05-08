"use client";

/**
 * BloomTopbar — 試作版 1:1 移植版 Topbar (dispatch main- No.16)
 *
 * プロト 015_Gardenシリーズ/000_GardenUI_bloom/02_BloomTop/index.html line 51-162 移植。
 *
 * 構造（左から右）:
 *   - topbar-brand: ロゴ画像 + (Garden Series ホームへリンク)
 *   - search-box: 検索 input + Ctrl+F shortcut
 *   - topbar-info:
 *     - info-item: 日付 (calendar icon + 動的日付)
 *     - info-item: 天気 (icon + 温度 + label)
 *     - info-item: システム正常 (dot + text)
 *     - theme-toggle button (sun/moon)
 *     - sound-toggle button (既存 v2.8a 流用、playPon)
 *     - bell button + バッジ「3」
 *     - Help button
 *     - Favorite button + dropdown
 *     - user-area + dropdown (avatar + name + role + chevron)
 *
 * 既存ロジック流用:
 *   - playPon (sound toggle)
 *   - localStorage persistence
 *
 * 試作版 1:1 取り込み:
 *   - bell badge "3" (hardcoded)
 *   - Help button (UI のみ)
 *   - Favorite dropdown (UI、永続化は localStorage)
 *   - User dropdown (マイページ / ユーザー設定 / ログアウト)
 */

import { useCallback, useEffect, useRef, useState } from "react";

type Props = {
  dateLabel: string;
  weatherIconSrc: string;
  weatherTemp: string;
  weatherLabel: string;
  themeIconSrc: string;
  onThemeToggle: () => void;
  soundMuted: boolean;
  onSoundToggle: () => void;
  onBellClick?: () => void;
  /** ログアウト処理（ProP として注入、既存 BloomState の lockAndLogout 等を bind） */
  onLogout?: () => void;
};

export default function BloomTopbar({
  dateLabel,
  weatherIconSrc,
  weatherTemp,
  weatherLabel,
  themeIconSrc,
  onThemeToggle,
  soundMuted,
  onSoundToggle,
  onBellClick,
  onLogout,
}: Props) {
  const [favOpen, setFavOpen] = useState(false);
  const [userOpen, setUserOpen] = useState(false);
  const favRef = useRef<HTMLDivElement>(null);
  const userRef = useRef<HTMLDivElement>(null);

  // 外側 click で dropdown 閉じる
  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (favOpen && favRef.current && !favRef.current.contains(e.target as Node)) {
        setFavOpen(false);
      }
      if (userOpen && userRef.current && !userRef.current.contains(e.target as Node)) {
        setUserOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [favOpen, userOpen]);

  const toggleFav = useCallback(() => {
    setFavOpen((p) => !p);
    setUserOpen(false);
  }, []);
  const toggleUser = useCallback(() => {
    setUserOpen((p) => !p);
    setFavOpen(false);
  }, []);

  return (
    <header className="topbar">
      {/* ===== ロゴ + ブランド名 ===== */}
      <a
        href="/_proto/garden-home-spin/index.html"
        className="topbar-brand"
        title="Garden Series ホームへ"
        style={{ textDecoration: "none" }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/images/logo/garden_logo.png"
          alt="Garden Series"
          className="topbar-brand-img"
        />
      </a>

      {/* ===== 検索ボックス ===== */}
      <div className="search-box">
        <span className="search-icon">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/images/header_icons/header_search.png" alt="" />
        </span>
        <input
          type="text"
          placeholder="検索（取引先、請求書、タスク、ヘルプなど）"
        />
        <span className="search-shortcut">Ctrl+F</span>
      </div>

      {/* ===== 右側情報エリア ===== */}
      <div className="topbar-info">
        {/* 日付 */}
        <div className="info-item">
          <span className="info-icon">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/images/header_icons/header_calendar.png" alt="" />
          </span>
          <span className="info-text">{dateLabel}</span>
        </div>

        {/* 天気 (icon + 温度 + label) */}
        <div className="info-item">
          <span className="info-icon">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={weatherIconSrc} alt="" />
          </span>
          <div className="info-text">
            <strong>{weatherTemp}</strong>
            <small>{weatherLabel}</small>
          </div>
        </div>

        {/* システム正常 */}
        <div className="info-item">
          <span className="status-dot" />
          <span className="info-text">すべてのシステム正常</span>
        </div>

        {/* theme toggle (header-tool-btn) */}
        <button
          type="button"
          className="header-tool-btn theme-toggle"
          title="ライト/ダーク切替"
          onClick={onThemeToggle}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={themeIconSrc} alt="" />
        </button>

        {/* sound toggle (既存 v2.8a 流用、試作版にはないが残置 — D7) */}
        <button
          type="button"
          className={`header-tool-btn sound-toggle${soundMuted ? " muted" : ""}`}
          title="音 ON/OFF"
          onClick={onSoundToggle}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/images/header_icons/header_sound.png" alt="" />
        </button>

        {/* bell + バッジ「3」 */}
        <button
          type="button"
          className="header-tool-btn header-notify-btn"
          title="通知"
          onClick={onBellClick}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/images/header_icons/header_bell.png" alt="" />
          <span className="header-tool-badge">3</span>
        </button>

        {/* Help */}
        <button
          type="button"
          className="header-tool-btn help-btn"
          title="ヘルプ・使い方ガイド"
          onClick={() => window.alert("ヘルプ機能は準備中です")}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/images/header_icons/D-02_help_simple.png" alt="" />
        </button>

        {/* Favorite + dropdown */}
        <div className="header-favorite-wrap" ref={favRef}>
          <button
            type="button"
            className="header-tool-btn favorite-btn"
            title="お気に入り"
            aria-haspopup="true"
            aria-expanded={favOpen}
            onClick={toggleFav}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/images/header_icons/D-01_favorite_simple.png" alt="" />
          </button>

          <div
            className={`favorite-dropdown${favOpen ? " is-open" : ""}`}
            role="menu"
            aria-hidden={!favOpen}
          >
            <div className="favorite-dropdown-header">
              <span className="favorite-dropdown-title">お気に入り</span>
              <span className="favorite-dropdown-count">0</span>
            </div>
            <div className="favorite-dropdown-divider" />
            <div className="favorite-dropdown-list" />
            <div className="favorite-dropdown-empty">お気に入りはまだありません</div>
            <div className="favorite-dropdown-divider" />
            <button type="button" className="favorite-dropdown-add">
              <span className="favorite-dropdown-add-icon">＋</span>
              <span className="favorite-dropdown-add-label">現在のページを追加</span>
            </button>
          </div>
        </div>

        {/* User area + dropdown */}
        <div
          className="user-area"
          ref={userRef}
          tabIndex={0}
          onClick={toggleUser}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") toggleUser();
          }}
          role="button"
          aria-haspopup="true"
          aria-expanded={userOpen}
        >
          <div className="user-avatar">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/images/avatar/avatar_shoji.png" alt="東海林 美琴" />
          </div>
          <div className="user-info">
            <strong>東海林 美琴</strong>
            <small>正社員 / 全権管理者</small>
          </div>
          <span className="user-arrow">⌄</span>

          <div
            className={`user-dropdown${userOpen ? " is-open" : ""}`}
            role="menu"
            aria-hidden={!userOpen}
          >
            <div className="user-dropdown-header">
              <div className="user-dropdown-avatar">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/images/avatar/avatar_shoji.png" alt="" />
              </div>
              <div className="user-dropdown-info">
                <strong>東海林 美琴</strong>
                <small>shoji@hyualan.co.jp</small>
                <span className="user-dropdown-role">正社員 / 全権管理者</span>
              </div>
            </div>
            <div className="user-dropdown-divider" />
            <a href="#" className="user-dropdown-item" role="menuitem">
              <span className="user-dropdown-icon">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/images/header_icons/D-03_mypage_simple.png" alt="" />
              </span>
              <span className="user-dropdown-label">マイページ</span>
            </a>
            <a href="#" className="user-dropdown-item" role="menuitem">
              <span className="user-dropdown-icon">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/images/header_icons/D-04_settings_simple.png" alt="" />
              </span>
              <span className="user-dropdown-label">ユーザー設定</span>
            </a>
            <div className="user-dropdown-divider" />
            <a
              href="/_proto/login/index.html"
              className="user-dropdown-item user-dropdown-item-logout"
              role="menuitem"
              onClick={(e) => {
                e.stopPropagation();
                setUserOpen(false);
                onLogout?.();
              }}
            >
              <span className="user-dropdown-icon">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/images/header_icons/D-05_logout_simple.png" alt="" />
              </span>
              <span className="user-dropdown-label">ログアウト</span>
            </a>
          </div>
        </div>
      </div>
    </header>
  );
}
