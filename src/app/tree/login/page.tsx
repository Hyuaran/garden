"use client";

/**
 * Garden-Tree ログイン画面 (/tree/login)
 *
 * 2026-04-21 改訂：Supabase Auth 接続
 *
 * フロー:
 *   1. 社員番号 + パスワード入力
 *   2. signInTree() で擬似メールに変換 → Supabase Auth signInWithPassword
 *   3. 成功: refreshAuth() で root_employees.garden_role を取得
 *   4. garden_role が取得できたら /tree/dashboard へ遷移
 *
 *   TreeShell 側で /tree/login は「bare screen」扱いになり、
 *   サイドバー・KPIヘッダーは描画されない。
 */

import { useRouter } from "next/navigation";
import {
  useEffect,
  useState,
  type CSSProperties,
  type FocusEvent,
} from "react";

import { ActionButton } from "../_components/ActionButton";
import { GlassPanel } from "../_components/GlassPanel";
import { WireframeLabel } from "../_components/WireframeLabel";
import { C } from "../_constants/colors";
import { LOGO_PATH } from "../_constants/logo";
import { TREE_PATHS } from "../_constants/screens";
import { signInTree } from "../_lib/auth";
import { useTreeState } from "../_state/TreeStateContext";

const inputStyle: CSSProperties = {
  width: "100%",
  padding: "14px 16px",
  border: "2px solid #dcedc8",
  borderRadius: 12,
  fontSize: 16,
  outline: "none",
  boxSizing: "border-box",
  fontFamily: "'Noto Sans JP', sans-serif",
  background: C.white,
};

export default function TreeLoginPage() {
  const router = useRouter();
  const { isAuthenticated, refreshAuth } = useTreeState();
  const [empId, setEmpId] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // 既にログイン済みなら直接ダッシュボードへ
  useEffect(() => {
    if (isAuthenticated) {
      router.replace(TREE_PATHS.DASHBOARD);
    }
  }, [isAuthenticated, router]);

  const handleLogin = async () => {
    if (loading) return;
    if (!empId || !password) {
      setError("社員番号とパスワードを入力してください");
      return;
    }

    setLoading(true);
    setError("");

    // 1. Supabase Auth でサインイン
    const signInResult = await signInTree(empId, password);
    if (!signInResult.success) {
      setError(signInResult.error ?? "ログインに失敗しました");
      setLoading(false);
      return;
    }

    // 2. 認証成功後に root_employees.garden_role を取得
    const authResult = await refreshAuth();
    if (!authResult.success) {
      setError(authResult.error ?? "権限情報の取得に失敗しました");
      setLoading(false);
      return;
    }

    // 3. ダッシュボードへ遷移
    router.push(TREE_PATHS.DASHBOARD);
  };

  const handleFocus = (e: FocusEvent<HTMLInputElement>) => {
    e.currentTarget.style.borderColor = C.midGreen;
  };
  const handleBlur = (e: FocusEvent<HTMLInputElement>) => {
    e.currentTarget.style.borderColor = "#dcedc8";
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: `linear-gradient(160deg, ${C.bgWarm1} 0%, ${C.bgWarm2} 50%, ${C.bgWarm3} 100%)`,
        fontFamily: "'Noto Sans JP', sans-serif",
      }}
    >
      {/* Forest と揃えた上部のデコレーションバー */}
      <div
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          height: 4,
          background: `linear-gradient(90deg, ${C.darkGreen}, ${C.midGreen}, ${C.accentGreen}, ${C.midGreen}, ${C.darkGreen})`,
        }}
      />

      <div style={{ position: "relative" }}>
        <WireframeLabel>画面1: ログイン</WireframeLabel>
        <GlassPanel style={{ width: 380, padding: 40, textAlign: "center" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={LOGO_PATH}
            alt="Garden"
            style={{
              width: 80,
              height: 80,
              objectFit: "contain",
              display: "block",
              margin: "0 auto 12px",
              borderRadius: 16,
            }}
          />
          <h1
            style={{
              fontSize: 24,
              fontWeight: 800,
              color: C.darkGreen,
              margin: "0 0 32px",
            }}
          >
            Garden
          </h1>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleLogin();
            }}
          >
            <div style={{ marginBottom: 16, textAlign: "left" }}>
              <label
                style={{
                  fontSize: 12,
                  color: C.textSub,
                  display: "block",
                  marginBottom: 4,
                }}
              >
                社員番号
              </label>
              <input
                type="text"
                placeholder="4桁の社員番号"
                maxLength={4}
                value={empId}
                onChange={(e) => setEmpId(e.target.value)}
                onFocus={handleFocus}
                onBlur={handleBlur}
                style={inputStyle}
                inputMode="numeric"
                autoComplete="username"
                disabled={loading}
              />
            </div>
            <div style={{ marginBottom: 20, textAlign: "left" }}>
              <label
                style={{
                  fontSize: 12,
                  color: C.textSub,
                  display: "block",
                  marginBottom: 4,
                }}
              >
                パスワード
              </label>
              <input
                type="password"
                placeholder="4桁パスワード（誕生日MMDD）"
                maxLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onFocus={handleFocus}
                onBlur={handleBlur}
                style={inputStyle}
                inputMode="numeric"
                autoComplete="current-password"
                disabled={loading}
              />
            </div>

            {error && (
              <div
                style={{
                  color: C.red,
                  fontSize: 12,
                  marginBottom: 16,
                  fontWeight: 600,
                  textAlign: "center",
                }}
              >
                {error}
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "center" }}>
              <ActionButton
                label={loading ? "認証中..." : "打刻・ログイン"}
                large
                type="submit"
                color={`linear-gradient(135deg, ${C.darkGreen}, ${C.midGreen})`}
                onClick={handleLogin}
                disabled={loading}
              />
            </div>
          </form>

          <p
            style={{
              marginTop: 20,
              fontSize: 11,
              color: "#b0b0b0",
              lineHeight: 1.7,
              textAlign: "center",
            }}
          >
            ※ログインをすると勤怠管理システムへ自動連携し
            <br />
            出勤打刻が完了します
          </p>
        </GlassPanel>
      </div>
    </div>
  );
}
