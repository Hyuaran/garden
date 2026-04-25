"use client";

/**
 * Bloom ログインゲート
 *
 * 動作:
 *   - /bloom/login : children をそのまま描画（ゲート自体を bypass、ログインフォームを表示）
 *   - loading 中    : スピナー
 *   - 未認証 or 未ロック : `/bloom/login?returnTo=<current>` へリダイレクト
 *   - 認証 + ロック解除 : children をそのまま描画
 *
 * 設計判断履歴:
 *   §10.3 判5 当初は /forest/login へのリダイレクト方針だったが、2026-04-26 の
 *   動作確認で「/bloom 開きたいのに Forest しか開けない」問題（returnTo 無視 + 独立画面欠如）
 *   が判明。a-main 緊急対応として **Bloom 独立ログイン画面** に方針変更。
 */

import { usePathname } from "next/navigation";
import { useEffect, type ReactNode } from "react";

import { BLOOM_PATHS } from "../_constants/routes";
import { useBloomState } from "../_state/BloomStateContext";

export function BloomGate({ children }: { children: ReactNode }) {
  const pathname = usePathname() || "";
  const { loading, isAuthenticated, hasPermission, isUnlocked } = useBloomState();

  const allowed = isAuthenticated && hasPermission && isUnlocked;
  const onLoginPage = pathname === BLOOM_PATHS.LOGIN;

  useEffect(() => {
    if (loading || allowed || onLoginPage) return;
    // 未認証 → /bloom/login にリダイレクト（returnTo 付き）
    const current =
      typeof window !== "undefined"
        ? window.location.pathname + window.location.search
        : BLOOM_PATHS.HOME;
    const returnTo = encodeURIComponent(current);
    window.location.replace(`${BLOOM_PATHS.LOGIN}?returnTo=${returnTo}`);
  }, [loading, allowed, onLoginPage]);

  // ログインページは認証不要で children を描画（/bloom/login 用）
  if (onLoginPage) {
    return <>{children}</>;
  }

  if (allowed) {
    return <>{children}</>;
  }

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)",
        fontFamily: "'Noto Sans JP', sans-serif",
      }}
    >
      <div
        style={{
          background: "#fff",
          borderRadius: 16,
          padding: "32px 28px",
          boxShadow: "0 8px 32px rgba(0,0,0,0.12)",
          textAlign: "center",
          color: "#1b4332",
        }}
      >
        <div style={{ fontSize: 36, marginBottom: 8 }}>🌸</div>
        <p style={{ fontSize: 13, color: "#6b8e75", margin: 0 }}>
          {loading ? "読み込み中..." : "ログインページに移動しています..."}
        </p>
      </div>
    </div>
  );
}
