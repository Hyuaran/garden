"use client";

/**
 * Bloom ログインゲート
 *
 * §10.3 判5 (2026-05-02): 当面 Bloom 独自ログイン画面を作らず `/forest/login` へリダイレクトしていた。
 *
 * dispatch main- No. 83 / No. 84 (2026-05-07): Garden 統一認証ゲート稼働により redirect 先を
 *   `/forest/login` → **統一ログイン `/login`** へ変更。新ログイン画面は claude.ai 起草版ベースの
 *   Garden Series 共通画面 (src/app/login/page.tsx v8 unified)。Forest セッションも同じ画面を共有。
 *
 * 旧版: BloomGate.legacy-forest-redirect-20260507.tsx (削除禁止ルール準拠)
 *
 * 動作:
 *   - loading 中      : スピナー
 *   - 未認証 or 未ロック : /login?returnTo=... へリダイレクト
 *   - 認証 + ロック解除 : children をそのまま描画
 */

import { useEffect, type ReactNode } from "react";

import { BLOOM_PATHS } from "../_constants/routes";
import { useBloomState } from "../_state/BloomStateContext";

export function BloomGate({ children }: { children: ReactNode }) {
  const { loading, isAuthenticated, hasPermission, isUnlocked } = useBloomState();

  // dev 環境では認証バイパス（視覚確認用）
  // 本番ビルドでは process.env.NODE_ENV !== 'development' のため自動無効
  // 根本解決（Bloom 認証の Forest 統合再設計）は post-5/5 タスク。
  // dispatch v2.8a-bloom main-9 (2026-05-02) の対応、memory project_bloom_auth_independence.md 参照。
  const isDevBypass = process.env.NODE_ENV === "development";

  const allowed =
    isDevBypass || (isAuthenticated && hasPermission && isUnlocked);

  useEffect(() => {
    if (loading || allowed) return;
    const current =
      typeof window !== "undefined"
        ? window.location.pathname + window.location.search
        : BLOOM_PATHS.HOME;
    const returnTo = encodeURIComponent(current);
    window.location.replace(`${BLOOM_PATHS.UNIFIED_LOGIN}?returnTo=${returnTo}`);
  }, [loading, allowed]);

  if (allowed) {
    return <>{children}</>;
  }

  return (
    <div
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
