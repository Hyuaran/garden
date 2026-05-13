"use client";

/**
 * Garden Series 共通ログイン画面（v8、2026-05-11、Task 1）
 *
 * 改訂点 (v8 / Task 1):
 *   - signInBloom → signInUnified へ置換（API 互換、内部で 6 モジュール session unlock）
 *   - useSearchParams() で returnTo クエリ取得、sanitizeReturnTo() 通過後は role redirect より優先
 *   - 全体を <Suspense> boundary でラップ（useSearchParams を Suspense 内で使うため）
 *
 * 既存維持 (v7 Group B):
 *   - 背景: 6 atmospheres カルーセル（home と同じ <BackgroundCarousel atmospheres={ATMOSPHERES_V2} />）
 *   - 入力枠 1: 「社員番号またはID」（パートナーコード対応、暫定 microcopy 付き）
 *   - ログイン枠: 左側 fixed position 重ね、半透明白カード
 *
 * 認証フロー:
 *   - signInUnified(empId, password) → fetchBloomUser → returnTo or getPostLoginRedirect → router.push
 *   - 入力値判定（E-/P-）はコメントのみ、実 DB 連携は post-5/5
 *
 * 仕様: docs/specs/plans/2026-05-11-garden-unified-auth-plan.md §Task 1 §Step 2
 */

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { fetchBloomUser } from "../bloom/_lib/auth";
import { signInUnified, sanitizeReturnTo } from "../_lib/auth-unified";
import { getPostLoginRedirect } from "../_lib/auth-redirect";
import { BackgroundCarousel } from "../../components/shared/garden-view/BackgroundCarousel";
import { ATMOSPHERES_V2 } from "../../components/shared/garden-view/_lib/atmospheres";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [employeeIdOrPartnerCode, setEmployeeIdOrPartnerCode] = useState("");
  const [password, setPassword] = useState("");
  const [keepLogin, setKeepLogin] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // expired 警告 (bud/login 等から forward された場合)
  const isExpired = searchParams.get("reason") === "expired";

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    // v7 Group B: 入力値判定（実 DB 連携は post-5/5）
    //   - "E-" prefix → 社員番号 (root_employees)
    //   - "P-" prefix → パートナーコード (root_partners)
    //   - その他 → 既存 signInUnified（暫定で社員番号として扱う）
    const trimmed = employeeIdOrPartnerCode.trim();
    // const isPartnerCode = trimmed.toUpperCase().startsWith("P-");
    // const isEmployeeId = trimmed.toUpperCase().startsWith("E-");

    const result = await signInUnified(trimmed, password);
    if (!result.success) {
      setSubmitting(false);
      setError(result.error ?? "ログイン失敗");
      return;
    }
    try {
      const bloomUser = result.userId ? await fetchBloomUser(result.userId) : null;
      const role = bloomUser?.garden_role;

      // returnTo 優先 (sanitize 通過時のみ)、それ以外は role redirect
      const returnToRaw = searchParams.get("returnTo");
      const returnTo = sanitizeReturnTo(returnToRaw);
      const target = returnTo ?? getPostLoginRedirect(role);

      router.push(target);
    } catch (err) {
      setSubmitting(false);
      setError(`ロール取得失敗: ${(err as Error).message}`);
    }
  };

  return (
    <main style={{ position: "relative", minHeight: "100vh", overflow: "hidden" }}>
      {/* 6 atmospheres カルーセル（全画面背景） */}
      <div style={{ position: "fixed", inset: 0, zIndex: 0 }}>
        <BackgroundCarousel atmospheres={ATMOSPHERES_V2} />
      </div>

      {/* ログイン枠（左側 fixed 重ね） */}
      <section
        aria-label="ログインフォーム"
        data-testid="login-section"
        style={{
          position: "relative",
          zIndex: 2,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          padding: "40px 56px",
        }}
      >
        <div
          style={{
            width: "100%",
            maxWidth: 420,
            background: "rgba(255, 255, 255, 0.88)",
            backdropFilter: "blur(16px)",
            borderRadius: 16,
            padding: "40px 36px",
            boxShadow: "0 12px 40px rgba(0, 0, 0, 0.15)",
            border: "1px solid rgba(255, 255, 255, 0.6)",
          }}
        >
          {/* logo header */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 28 }}>
            <img
              src="/themes/garden-logo.webp"
              alt="Garden Series"
              width={44}
              height={44}
              style={{ display: "block", objectFit: "contain" }}
            />
            <div>
              <div style={{ fontWeight: 700, fontSize: 17, color: "#1F5C3A", lineHeight: 1.1 }}>
                Garden Series
              </div>
              <div style={{ fontSize: 11, color: "#6B8E75", marginTop: 3 }}>
                業務を、育てる。 / Grow Your Business.
              </div>
            </div>
          </div>

          {/* expired 警告 (bud/login 等から forward された場合) */}
          {isExpired && (
            <div
              role="status"
              style={{
                background: "#FFF7E6",
                border: "1px solid #F5A623",
                color: "#7A5800",
                padding: "10px 12px",
                borderRadius: 6,
                fontSize: 12,
                margin: "0 0 16px",
              }}
            >
              セッションが 2 時間で期限切れになりました。再度ログインしてください。
            </div>
          )}

          <form onSubmit={onSubmit}>
            {/* 社員番号またはID */}
            <label style={{ display: "block", marginBottom: 14 }}>
              <span style={{ fontSize: 12, color: "#5C6E5F", fontWeight: 600 }}>
                社員番号またはID
              </span>
              <input
                type="text"
                value={employeeIdOrPartnerCode}
                onChange={(e) => setEmployeeIdOrPartnerCode(e.target.value)}
                required
                autoComplete="username"
                placeholder="例) E-12345 または P-001"
                data-testid="login-empid"
                name="employeeIdOrPartnerCode"
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
              <span
                style={{
                  display: "block",
                  marginTop: 4,
                  fontSize: 10,
                  color: "#7A8B7E",
                  fontStyle: "italic",
                }}
                aria-label="ID とはパートナーコードのことです"
              >
                ID とはパートナーコードのことです
              </span>
            </label>

            {/* パスワード（目アイコン付き） */}
            <label style={{ display: "block", marginBottom: 14 }}>
              <span style={{ fontSize: 12, color: "#5C6E5F", fontWeight: 600 }}>パスワード</span>
              <div style={{ position: "relative", marginTop: 6 }}>
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  placeholder="●●●●●●●●●●●●"
                  data-testid="login-password"
                  style={{
                    width: "100%",
                    padding: "10px 38px 10px 12px",
                    fontSize: 14,
                    border: "1px solid #DEE5DE",
                    borderRadius: 6,
                    outline: "none",
                    background: "#FAFCFA",
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  data-testid="login-password-toggle"
                  aria-label={showPassword ? "パスワードを隠す" : "パスワードを表示"}
                  style={{
                    position: "absolute",
                    right: 8,
                    top: "50%",
                    transform: "translateY(-50%)",
                    background: "transparent",
                    border: "none",
                    cursor: "pointer",
                    color: "#7A8B7E",
                    fontSize: 14,
                    padding: 4,
                  }}
                >
                  {showPassword ? "🙈" : "👁"}
                </button>
              </div>
            </label>

            {/* ログイン状態保持 */}
            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                fontSize: 12,
                color: "#5C6E5F",
                marginBottom: 18,
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

            {/* ログインボタン */}
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
            <div style={{ textAlign: "center", marginTop: 14 }}>
              <a
                href="/login/forgot"
                style={{
                  fontSize: 12,
                  color: "#3B9B5C",
                  textDecoration: "underline",
                }}
              >
                パスワードをお忘れですか？
              </a>
            </div>
          </form>

          {/* footer microcopy */}
          <p
            style={{
              marginTop: 22,
              fontSize: 10,
              color: "#9AA89D",
              textAlign: "center",
              lineHeight: 1.5,
              fontStyle: "italic",
            }}
          >
            Secure workspace for finance, operations, and customer support.
          </p>
          <p style={{ marginTop: 8, fontSize: 10, color: "#9AA89D", textAlign: "center" }}>
            社内 PC からのみアクセス可能です。
          </p>
        </div>
      </section>
    </main>
  );
}

export default function GardenLoginPage() {
  return (
    <Suspense
      fallback={
        <main style={{ position: "relative", minHeight: "100vh", overflow: "hidden" }}>
          <div style={{ position: "fixed", inset: 0, zIndex: 0, background: "#F5F8F2" }} />
        </main>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
