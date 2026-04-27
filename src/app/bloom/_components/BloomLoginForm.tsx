"use client";

/**
 * Bloom ログインフォーム（社員番号 + パスワード）
 *
 * /bloom/login で表示される。Forest の ForestGate を参考に Bloom テーマで実装：
 *   - 🌸 アイコン + 「Garden Bloom」+ 「進捗ダッシュボード」サブタイトル
 *   - グリーン系グラデーション（Forest と整合）
 *
 * 認証フロー:
 *  1. 社員番号(4桁) + パスワード を入力
 *  2. signInBloom(empId, password) で擬似メール → Supabase Auth
 *  3. 成功なら refreshAuth() で BloomStateContext を更新
 *  4. /bloom/login/page.tsx が isUnlocked を検知して returnTo or /bloom にリダイレクト
 *
 * Forest との違い:
 *   - 権限は root_employees.garden_role を直接参照（§8.2、bloom_users 不要）
 *   - 「経営データ」ではなく「Garden 進捗」の文脈に文言調整
 */

import { useState, type CSSProperties, type FormEvent } from "react";

import { signInBloom } from "../_lib/auth";
import { useBloomState } from "../_state/BloomStateContext";

const PRIMARY = "#1b4332";
const ACCENT = "#40916c";
const SOFT_BORDER = "1.5px solid #d8f3dc";
const ERROR_COLOR = "#dc2626";

const inputStyle: CSSProperties = {
  width: "100%",
  padding: "12px 16px",
  border: SOFT_BORDER,
  borderRadius: 10,
  fontSize: 14,
  outline: "none",
  boxSizing: "border-box",
  fontFamily: "inherit",
  background: "#fff",
  color: PRIMARY,
};

const inputStyleError: CSSProperties = {
  ...inputStyle,
  border: `1.5px solid ${ERROR_COLOR}`,
};

export function BloomLoginForm() {
  const { refreshAuth } = useBloomState();
  const [empId, setEmpId] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!empId || !password) return;

    setLoading(true);
    setError("");

    // 1. 認証のみ（Supabase Auth、擬似メール経由）
    const result = await signInBloom(empId, password);

    if (!result.success) {
      setError(result.error ?? "ログインに失敗しました");
      setLoading(false);
      return;
    }

    // 2. 認証成功後に root_employees から garden_role を取得 + 状態更新
    const authResult = await refreshAuth();
    if (!authResult.success) {
      setError(authResult.error ?? "Bloom 権限の確認に失敗しました");
    }
    // 成功時は /bloom/login/page.tsx が isUnlocked を検知して returnTo へリダイレクト
    setLoading(false);
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(160deg, #1b4332 0%, #40916c 50%, #95d5b2 100%)",
        fontFamily: "'Noto Sans JP', sans-serif",
        padding: 16,
      }}
    >
      {/* 上部バー（Bloom テーマ） */}
      <div
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          height: 4,
          background: `linear-gradient(90deg, ${ACCENT} 0%, #95d5b2 100%)`,
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
        <div style={{ fontSize: 40, marginBottom: 8 }}>🌸</div>
        <h2
          style={{
            fontSize: 22,
            fontWeight: 700,
            color: PRIMARY,
            marginBottom: 4,
          }}
        >
          Garden Bloom
        </h2>
        <p
          style={{
            fontSize: 12,
            color: "#6b8e75",
            marginBottom: 28,
            lineHeight: 1.7,
          }}
        >
          進捗ダッシュボード
          <br />
          社員番号とパスワードを入力してください
        </p>

        <form onSubmit={handleSubmit}>
          {/* 社員番号 */}
          <div style={{ marginBottom: 14, textAlign: "left" }}>
            <label
              style={{
                fontSize: 12,
                color: "#40916c",
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
              aria-label="社員番号"
              style={error ? inputStyleError : inputStyle}
            />
          </div>

          {/* パスワード */}
          <div style={{ marginBottom: 20, textAlign: "left" }}>
            <label
              style={{
                fontSize: 12,
                color: "#40916c",
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
              aria-label="パスワード"
              style={error ? inputStyleError : inputStyle}
            />
          </div>

          {error && (
            <p
              role="alert"
              style={{ color: ERROR_COLOR, fontSize: 13, marginBottom: 12 }}
            >
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
                  : `linear-gradient(135deg, ${PRIMARY}, ${ACCENT})`,
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
            color: "#95d5b2",
            lineHeight: 1.6,
          }}
        >
          ※ Garden Bloom は社員全員が利用できる進捗共有ダッシュボードです
        </p>
      </div>
    </div>
  );
}
