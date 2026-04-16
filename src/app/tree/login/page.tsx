"use client";

/**
 * Garden-Tree ログイン画面 (/tree/login)
 *
 * プロトタイプの <LoginScreen /> を移植。
 *
 *  - TreeShell 側で /tree/login は「bare screen」扱いになり、
 *    サイドバー・KPIヘッダーは描画されない。
 *  - 現段階では打刻・認証はなく、ボタン押下で /tree/dashboard へ遷移するだけ。
 *  - Supabase Auth 連携（社員番号 + 4桁PIN or Supabase magic link 等）は後続タスク。
 */

import { useRouter } from "next/navigation";
import { useState, type CSSProperties, type FocusEvent } from "react";

import { ActionButton } from "../_components/ActionButton";
import { GlassPanel } from "../_components/GlassPanel";
import { WireframeLabel } from "../_components/WireframeLabel";
import { C } from "../_constants/colors";
import { TREE_PATHS } from "../_constants/screens";

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
  const [empId, setEmpId] = useState("");
  const [password, setPassword] = useState("");

  const handleLogin = () => {
    // TODO: Supabase Auth 連携（現状はデモ：入力値に関係なくダッシュボードへ）
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
          <div
            style={{
              fontSize: 56,
              lineHeight: 1,
              marginBottom: 12,
            }}
          >
            🌳
          </div>
          <h1
            style={{
              fontSize: 24,
              fontWeight: 800,
              color: C.darkGreen,
              margin: "0 0 4px",
            }}
          >
            Garden
          </h1>
          <p
            style={{
              fontSize: 12,
              color: C.textMuted,
              margin: "0 0 32px",
            }}
          >
            打刻・ログイン
          </p>

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
              />
            </div>
            <div style={{ marginBottom: 28, textAlign: "left" }}>
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
                placeholder="4桁パスワード"
                maxLength={4}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onFocus={handleFocus}
                onBlur={handleBlur}
                style={inputStyle}
                inputMode="numeric"
                autoComplete="current-password"
              />
            </div>
            <div style={{ display: "flex", justifyContent: "center" }}>
              <ActionButton
                label="打刻・ログイン"
                large
                type="submit"
                color={`linear-gradient(135deg, ${C.darkGreen}, ${C.midGreen})`}
                onClick={handleLogin}
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
