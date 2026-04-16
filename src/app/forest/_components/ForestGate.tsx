"use client";

/**
 * Forest パスワードゲート
 *
 * Garden Auth 済み + forest_users 登録済みのユーザーに対して、
 * Forest 専用のパスワード再入力を求める。
 * Supabase Auth の signInWithPassword で再検証。
 */

import { useState, type FormEvent } from "react";

import { C } from "../_constants/colors";
import { FOREST_THEME } from "../_constants/theme";
import { signInForest } from "../_lib/auth";
import { writeAuditLog } from "../_lib/audit";
import { useForestState } from "../_state/ForestStateContext";

export function ForestGate() {
  const { userEmail, unlock } = useForestState();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!userEmail || !password) return;

    setLoading(true);
    setError("");

    const result = await signInForest(userEmail, password);

    if (result.success) {
      writeAuditLog("login");
      unlock();
    } else {
      writeAuditLog("login_failed");
      setError("パスワードが正しくありません");
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
          width: "90%",
          textAlign: "center",
          boxShadow: "0 12px 48px rgba(0,0,0,0.3)",
        }}
      >
        <div style={{ fontSize: 36, marginBottom: 8 }}>🌲</div>
        <h2
          style={{
            fontSize: 22,
            fontWeight: 700,
            color: C.darkGreen,
            marginBottom: 4,
          }}
        >
          Garden Forest
        </h2>
        <p
          style={{
            fontSize: 12,
            color: FOREST_THEME.textMuted,
            marginBottom: 24,
            lineHeight: 1.7,
          }}
        >
          経営データへのアクセスには
          <br />
          パスワードの再入力が必要です
        </p>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 8, textAlign: "left" }}>
            <label
              style={{ fontSize: 12, color: FOREST_THEME.textSecondary, display: "block", marginBottom: 4 }}
            >
              ログインユーザー
            </label>
            <div
              style={{
                padding: "10px 16px",
                background: "#f5f5f5",
                borderRadius: 8,
                fontSize: 14,
                color: FOREST_THEME.textSecondary,
              }}
            >
              {userEmail}
            </div>
          </div>

          <div style={{ marginBottom: 20, textAlign: "left" }}>
            <label
              style={{ fontSize: 12, color: FOREST_THEME.textSecondary, display: "block", marginBottom: 4 }}
            >
              パスワード
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="パスワードを入力"
              autoFocus
              style={{
                width: "100%",
                padding: "12px 16px",
                border: `1.5px solid ${error ? C.red : "#d8f3dc"}`,
                borderRadius: 8,
                fontSize: 14,
                outline: "none",
                boxSizing: "border-box",
                fontFamily: "inherit",
              }}
            />
          </div>

          {error && (
            <p style={{ color: C.red, fontSize: 13, marginBottom: 12 }}>
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading || !password}
            style={{
              width: "100%",
              padding: "12px",
              background: loading
                ? "#ccc"
                : `linear-gradient(135deg, ${C.darkGreen}, ${C.midGreen})`,
              color: "#fff",
              border: "none",
              borderRadius: 10,
              fontSize: 15,
              fontWeight: 700,
              cursor: loading ? "not-allowed" : "pointer",
              fontFamily: "inherit",
            }}
          >
            {loading ? "確認中..." : "アクセス"}
          </button>
        </form>
      </div>
    </div>
  );
}
