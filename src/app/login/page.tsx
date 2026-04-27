"use client";

/**
 * Garden Series 共通ログイン画面（候補 8 Step 6 / 7、2026-04-27 改訂）
 *
 * レイアウト（東海林さん 4/27 最終確定、シンプル化版）:
 *   - 左 40%: フォーム（社員番号 + パスワード + 状態保持 + ログイン + パスワード忘れ + ロゴ）
 *   - 右 60%: home 画面と同じ atmosphere（Var 1 Morning Calm = /themes/atmospheres/02-morning-calm.webp）
 *
 * 不要要素（v2 image にあったが除外）:
 *   - 大見出し「東海林さんを、やさしく迎える業務 OS。」
 *   - 特徴ハイライト 3 つ / SSO / サブテキスト
 *
 * 認証成功時 権限別 redirect は src/app/_lib/auth-redirect.ts 参照。
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signInBloom, fetchBloomUser } from "../bloom/_lib/auth";
import { getPostLoginRedirect } from "../_lib/auth-redirect";

export default function GardenLoginPage() {
  const router = useRouter();
  const [empId, setEmpId] = useState("");
  const [password, setPassword] = useState("");
  const [keepLogin, setKeepLogin] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const result = await signInBloom(empId, password);
    if (!result.success) {
      setSubmitting(false);
      setError(result.error ?? "ログイン失敗");
      return;
    }
    // 認証成功 → 権限取得 → 権限別 redirect
    try {
      const bloomUser = result.userId ? await fetchBloomUser(result.userId) : null;
      const target = getPostLoginRedirect(bloomUser?.garden_role);
      router.push(target);
    } catch (err) {
      setSubmitting(false);
      setError(`ロール取得失敗: ${(err as Error).message}`);
    }
  };

  return (
    <main
      style={{
        display: "flex",
        minHeight: "100vh",
        background: "#FAF8F3",
      }}
    >
      {/* 左 40%: フォーム */}
      <section
        aria-label="ログインフォーム"
        style={{
          width: "40%",
          minWidth: 360,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "40px 56px",
          background: "rgba(255, 255, 255, 0.97)",
        }}
      >
        {/* ロゴ最小限 */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 32 }}>
          <img
            src="/themes/garden-logo.webp"
            alt="Garden Series"
            width={40}
            height={40}
            style={{ display: "block", objectFit: "contain" }}
          />
          <div>
            <div style={{ fontWeight: 700, fontSize: 16, color: "#1F5C3A", lineHeight: 1.1 }}>
              Garden Series
            </div>
            <div style={{ fontSize: 11, color: "#6B8E75", marginTop: 2 }}>
              業務を、育てる
            </div>
          </div>
        </div>

        <form onSubmit={onSubmit}>
          {/* 社員番号 */}
          <label style={{ display: "block", marginBottom: 16 }}>
            <span style={{ fontSize: 12, color: "#5C6E5F", fontWeight: 600 }}>社員番号</span>
            <input
              type="text"
              value={empId}
              onChange={(e) => setEmpId(e.target.value)}
              required
              autoComplete="username"
              data-testid="login-empid"
              style={{
                width: "100%",
                padding: "10px 12px",
                marginTop: 6,
                fontSize: 14,
                border: "1px solid #DEE5DE",
                borderRadius: 6,
                outline: "none",
                background: "#FAFCFA",
              }}
            />
          </label>

          {/* パスワード */}
          <label style={{ display: "block", marginBottom: 16 }}>
            <span style={{ fontSize: 12, color: "#5C6E5F", fontWeight: 600 }}>パスワード</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              data-testid="login-password"
              style={{
                width: "100%",
                padding: "10px 12px",
                marginTop: 6,
                fontSize: 14,
                border: "1px solid #DEE5DE",
                borderRadius: 6,
                outline: "none",
                background: "#FAFCFA",
              }}
            />
          </label>

          {/* ログイン状態保持 */}
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontSize: 12,
              color: "#5C6E5F",
              marginBottom: 20,
              cursor: "pointer",
            }}
          >
            <input
              type="checkbox"
              checked={keepLogin}
              onChange={(e) => setKeepLogin(e.target.checked)}
              data-testid="login-keep"
            />
            ログイン状態を保持する
          </label>

          {error && (
            <p
              role="alert"
              style={{
                color: "#C1121F",
                background: "#FDE2E3",
                padding: "8px 10px",
                borderRadius: 4,
                fontSize: 13,
                margin: "0 0 12px",
                border: "1px solid #C1121F",
              }}
            >
              ⚠️ {error}
            </p>
          )}

          {/* ログインボタン（緑グラデ + 葉アイコン） */}
          <button
            type="submit"
            disabled={submitting}
            data-testid="login-submit"
            style={{
              width: "100%",
              padding: "12px 16px",
              background: submitting
                ? "#A0A0A0"
                : "linear-gradient(135deg, #3B9B5C 0%, #1F5C3A 100%)",
              color: "#fff",
              fontSize: 14,
              fontWeight: 700,
              border: "none",
              borderRadius: 8,
              cursor: submitting ? "not-allowed" : "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              boxShadow: "0 2px 8px rgba(31, 92, 58, 0.25)",
            }}
          >
            <span aria-hidden>🍃</span>
            <span>{submitting ? "ログイン中…" : "ログイン"}</span>
          </button>

          {/* パスワード忘れ */}
          <div style={{ textAlign: "center", marginTop: 16 }}>
            <a
              href="/login/forgot"
              style={{
                fontSize: 12,
                color: "#3B9B5C",
                textDecoration: "underline",
              }}
            >
              パスワードを忘れた場合
            </a>
          </div>

          <p style={{ marginTop: 24, fontSize: 11, color: "#9AA89D", textAlign: "center" }}>
            社内 PC からのみアクセス可能です。
          </p>
        </form>
      </section>

      {/* 右 60%: atmosphere（home と同じ Var 1 Morning Calm） */}
      <section
        aria-hidden
        data-testid="login-atmosphere"
        style={{
          flex: 1,
          backgroundImage: "url(/themes/atmospheres/02-morning-calm.webp)",
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      />
    </main>
  );
}
