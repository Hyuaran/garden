"use client";

/**
 * Bloom ログインゲート
 *
 * §10.3 判5: 当面は Bloom 独自ログイン画面を作らず、`/forest/login` へリダイレクトする。
 * Forest 認証成功後に同じ Supabase Auth セッションで Bloom に戻ってくる想定。
 *
 * 将来 Bloom 固有ブランディングが必要になったら、本ファイルを Forest の ForestGate
 * 相当（社員番号 + パスワードフォーム）に差し替える。
 * Bloom 用の signInBloom() / BloomStateContext は既に実装済（_lib/auth.ts）。
 */

import { useEffect } from "react";

export function BloomGate() {
  useEffect(() => {
    const current =
      typeof window !== "undefined"
        ? window.location.pathname + window.location.search
        : "/bloom";
    const returnTo = encodeURIComponent(current);
    window.location.replace(`/forest/login?returnTo=${returnTo}`);
  }, []);

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
        <p style={{ fontSize: 13, color: "#6b8e75" }}>
          ログインページに移動しています...
        </p>
      </div>
    </div>
  );
}
