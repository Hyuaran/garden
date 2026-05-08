"use client";

/**
 * Forest ログイン/パスワードゲート
 *
 * 社員番号 + パスワード で認証する。Tree の login 画面と UI を揃えつつ、
 * Forest 専用テーマ（グリーン系グラデーション + 🌲 アイコン）で表示。
 *
 * 認証フロー:
 *  1. ユーザー入力: 社員番号(4桁) + パスワード(自由長)
 *  2. signInForest(empId, password) を呼ぶ
 *     → 擬似メール生成 → Supabase Auth → forest_users 権限確認
 *  3. 成功なら refreshAuth() でコンテキスト状態を更新
 *     → login/page.tsx が isUnlocked を検知して dashboard にリダイレクト
 *  4. 失敗なら login_failed ログを記録してエラー表示
 *
 * 設計ドキュメント: docs/auth/login-implementation-guide.md
 */

import { useState, type CSSProperties, type FormEvent } from "react";

import { C } from "../_constants/colors";
import { FOREST_THEME } from "../_constants/theme";
import { signInForest } from "../_lib/auth";
import { writeAuditLog } from "../_lib/audit";
import { useForestState } from "../_state/ForestStateContext";

const inputStyle: CSSProperties = {
  width: "100%",
  padding: "12px 16px",
  border: "1.5px solid #d8f3dc",
  borderRadius: 10,
  fontSize: 14,
  outline: "none",
  boxSizing: "border-box",
  fontFamily: "inherit",
  background: "#fff",
  color: C.textDark,
};

const inputStyleError: CSSProperties = {
  ...inputStyle,
  border: `1.5px solid ${C.red}`,
};

export function ForestGate() {
  const { refreshAuth } = useForestState();
  const [empId, setEmpId] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!empId || !password) return;

    setLoading(true);
    setError("");

    // 1. 認証のみ（Supabase Auth）
    const result = await signInForest(empId, password);

    if (!result.success) {
      await writeAuditLog("login_failed", empId);
      setError(result.error ?? "ログインに失敗しました");
      setLoading(false);
      return;
    }

    // 2. 認証成功後に権限チェック + 状態更新（forest_users 参照）
    //    signIn 直後に JWT がクライアントに完全反映されるまで、
    //    refreshAuth 内で getSession → fetchForestUser の順で実行することで
    //    タイミング問題を回避する。
    const authResult = await refreshAuth();

    if (authResult.success) {
      await writeAuditLog("login");
      // refreshAuth で isUnlocked = true になり、login/page.tsx が dashboard へリダイレクト
    } else {
      await writeAuditLog("login_failed", empId);
      setError(authResult.error ?? "認証に失敗しました");
    }
    setLoading(false);
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: FOREST_THEME.loginBackground,
        fontFamily: "'Noto Sans JP', sans-serif",
        padding: 16,
      }}
    >
      {/* 上部バー */}
      <div
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          height: 4,
          background: FOREST_THEME.headerBar,
        }}
      />

      <div
        style={{
          background: "#fff",
          borderRadius: 20,
          padding: "44px 36px 36px",
          maxWidth: 380,
          width: "100%",
          textAlign: "center",
          boxShadow: "0 12px 48px rgba(0,0,0,0.3)",
        }}
      >
        <h2
          style={{
            fontSize: 22,
            fontWeight: 700,
            color: C.darkGreen,
            marginBottom: 28,
          }}
        >
          Garden
        </h2>

        <form onSubmit={handleSubmit}>
          {/* 社員番号 */}
          <div style={{ marginBottom: 14, textAlign: "left" }}>
            <label
              style={{
                fontSize: 12,
                color: FOREST_THEME.textSecondary,
                display: "block",
                marginBottom: 4,
              }}
            >
              社員番号
            </label>
            <input
              type="text"
              value={empId}
              onChange={(e) => setEmpId(e.target.value.replace(/\D/g, ""))}
              maxLength={4}
              inputMode="numeric"
              placeholder="4桁の社員番号"
              autoComplete="username"
              autoFocus={!empId}
              style={error ? inputStyleError : inputStyle}
            />
          </div>

          {/* パスワード */}
          <div style={{ marginBottom: 20, textAlign: "left" }}>
            <label
              style={{
                fontSize: 12,
                color: FOREST_THEME.textSecondary,
                display: "block",
                marginBottom: 4,
              }}
            >
              パスワード
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="パスワードを入力"
              autoComplete="current-password"
              autoFocus={!!empId}
              style={error ? inputStyleError : inputStyle}
            />
          </div>

          {error && (
            <p style={{ color: C.red, fontSize: 13, marginBottom: 12 }}>
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading || !empId || !password}
            style={{
              width: "100%",
              padding: "12px",
              background:
                loading || !empId || !password
                  ? "#ccc"
                  : `linear-gradient(135deg, ${C.darkGreen}, ${C.midGreen})`,
              color: "#fff",
              border: "none",
              borderRadius: 10,
              fontSize: 15,
              fontWeight: 700,
              cursor:
                loading || !empId || !password ? "not-allowed" : "pointer",
              fontFamily: "inherit",
            }}
          >
            {loading ? "確認中..." : "ログイン"}
          </button>
        </form>

        <p
          style={{
            marginTop: 20,
            fontSize: 10,
            color: FOREST_THEME.textMuted,
            lineHeight: 1.6,
          }}
        >
          ※ 各アプリへのアクセスは許可されたユーザーに限定されます
        </p>
      </div>
    </div>
  );
}
