"use client";

/**
 * Bloom ログインゲート
 *
 * §10.3 判5: 当面は Bloom 独自ログイン画面を作らず、`/forest/login` へリダイレクトする。
 *   Forest 認証成功後に同じ Supabase Auth セッションで Bloom に戻る想定。
 *
 * 将来 Bloom 固有ブランディングが必要になったら、本ファイルを Forest の ForestGate
 * 相当（社員番号 + パスワードフォーム）に差し替える。signInBloom() は実装済。
 *
 * 動作:
 *   - loading 中      : スピナー
 *   - 未認証 or 未ロック : /forest/login?returnTo=... へリダイレクト
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
    window.location.replace(`${BLOOM_PATHS.FOREST_LOGIN}?returnTo=${returnTo}`);
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
