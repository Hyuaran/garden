"use client";

/**
 * Garden Series 共通ヘッダー（home page 用）
 *
 * 構成（design-references/home-design-reference-v1 準拠、Garden 世界観 + デザインセンス向上目的）:
 *   - 左: クリスタル大樹ロゴ + 「Garden Series」タイトル + サブ「Grow Your Business」
 *   - 中央: 検索ボックス（placeholder + Ctrl+F ヒント）
 *   - 右: 日付 + 通知 + ユーザー名・権限
 *
 * Phase 2-2 候補 8 Step 1+5+7: ロゴ / 挨拶（外側）/ 検索ショートカット / ユーザー情報を統合。
 * 動的化（root_employees からの dynamic 取得）は post-5/5 で後追い、初版は静的テキスト。
 */

import { useEffect, useRef, useState } from "react";

const TODAY = new Date().toLocaleDateString("ja-JP", {
  year: "numeric",
  month: "long",
  day: "numeric",
});

type Props = {
  /** 動的化された場合の表示名（未指定時は東海林 美琴） */
  userName?: string;
  /** 雇用形態（未指定時は正社員） */
  employmentType?: string;
  /** ロール表示ラベル（未指定時は全権管理者） */
  roleLabel?: string;
};

export function AppHeader({
  userName = "東海林 美琴",
  employmentType = "正社員",
  roleLabel = "全権管理者",
}: Props) {
  const searchRef = useRef<HTMLInputElement>(null);
  const [searchValue, setSearchValue] = useState("");

  // Ctrl+F: search にフォーカス（既存ブラウザ機能を上書き）
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      const isContentEditable =
        target?.isContentEditable || target?.getAttribute("contenteditable") === "true";
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || isContentEditable) return;

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "f") {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  return (
    <header
      data-testid="app-header"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 24,
        padding: "12px 20px",
        background: "rgba(255, 255, 255, 0.92)",
        borderBottom: "1px solid #E8E5DD",
        boxShadow: "0 2px 6px rgba(0,0,0,0.04)",
        backdropFilter: "blur(8px)",
      }}
    >
      {/* 左: ロゴ + タイトル */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 220 }}>
        <img
          src="/themes/garden-logo.webp"
          alt="Garden Series"
          width={44}
          height={44}
          style={{ display: "block", objectFit: "contain" }}
        />
        <div>
          <div style={{ fontWeight: 700, fontSize: 16, color: "#1F5C3A", lineHeight: 1.1 }}>
            Garden Series
          </div>
          <div style={{ fontSize: 11, color: "#6B8E75", marginTop: 2 }}>
            Grow Your Business
          </div>
        </div>
      </div>

      {/* 中央: 検索 */}
      <div style={{ flex: 1, display: "flex", justifyContent: "center" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "6px 12px",
            background: "rgba(240, 244, 240, 0.7)",
            borderRadius: 8,
            border: "1px solid #DEE5DE",
            maxWidth: 480,
            width: "100%",
          }}
        >
          <span aria-hidden style={{ color: "#7A8B7E" }}>🔍</span>
          <input
            ref={searchRef}
            type="text"
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            placeholder="検索（取引先、顧客、タスク、ヘルプなど）"
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
            aria-label="Ctrl + F で検索"
          >
            Ctrl+F
          </span>
        </div>
      </div>

      {/* 右: 日付 + 通知 + ユーザー情報 */}
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <span style={{ fontSize: 12, color: "#6B8E75" }}>{TODAY}</span>
        <span style={{ fontSize: 12, color: "#6B8E75" }} aria-label="システムは正常稼働中">
          ☀️ 全システム正常
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
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
          <div style={{ lineHeight: 1.15 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "#2B2B2B" }}>{userName}</div>
            <div style={{ fontSize: 10, color: "#6B8E75" }}>
              {employmentType} / {roleLabel}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
