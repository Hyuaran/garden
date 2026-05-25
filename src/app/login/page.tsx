"use client";

import { Suspense, useState, type FormEvent } from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";

import { getPostLoginRedirect } from "../_lib/auth-redirect";
import { sanitizeReturnTo, signInUnified } from "../_lib/auth-unified";
import { fetchBloomUser } from "../bloom/_lib/auth";
import styles from "./page.module.css";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [employeeIdOrPartnerCode, setEmployeeIdOrPartnerCode] = useState("");
  const [password, setPassword] = useState("");
  const [keepLogin, setKeepLogin] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const isExpired = searchParams.get("reason") === "expired";

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    const trimmed = employeeIdOrPartnerCode.trim();
    const result = await signInUnified(trimmed, password);
    if (!result.success) {
      setSubmitting(false);
      setError(result.error ?? "ログインに失敗しました");
      return;
    }

    try {
      const bloomUser = result.userId ? await fetchBloomUser(result.userId) : null;
      const role = bloomUser?.garden_role;
      const returnTo = sanitizeReturnTo(searchParams.get("returnTo"));
      router.push(returnTo ?? getPostLoginRedirect(role));
    } catch (err) {
      setSubmitting(false);
      setError(`ロール取得に失敗しました: ${(err as Error).message}`);
    }
  };

  return (
    <main className={styles.stage}>
      <div className={styles.sky} aria-hidden="true" />
      <div className={styles.vignette} aria-hidden="true" />

      <section
        aria-label="ログインフォーム"
        className={styles.loginSection}
        data-testid="login-section"
      >
        <div className={styles.cardShell}>
          <div className={styles.card}>
            <div className={styles.cardLogo}>
              <Image
                src="/themes/garden-shell/images/login/mark-tree-emblem.png"
                alt="Garden Series"
                width={128}
                height={128}
                unoptimized
              />
            </div>
            <p className={styles.seriesName}>Garden Series</p>
            <h1 aria-label="Welcome to the Garden" className={styles.title}>
              <span>Welcome</span>
              <span>to the</span>
              <span>Garden</span>
            </h1>
            <p className={styles.subtitle}>夜明け前の庭から、今日の業務へ。</p>

            {isExpired && (
              <p className={styles.statusMessage} role="status">
                セッションが期限切れになりました。もう一度ログインしてください。
              </p>
            )}

            <form className={styles.form} onSubmit={onSubmit}>
              <label className={styles.field}>
                <span>社員番号またはID</span>
                <input
                  autoComplete="username"
                  data-testid="login-empid"
                  name="employeeIdOrPartnerCode"
                  onChange={(event) => setEmployeeIdOrPartnerCode(event.target.value)}
                  placeholder="例: 12345 / E-12345 / P-001"
                  required
                  type="text"
                  value={employeeIdOrPartnerCode}
                />
              </label>

              <label className={styles.field}>
                <span>パスワード</span>
                <div className={styles.passwordWrap}>
                  <input
                    autoComplete="current-password"
                    data-testid="login-password"
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="パスワードを入力"
                    required
                    type={showPassword ? "text" : "password"}
                    value={password}
                  />
                  <button
                    aria-label={showPassword ? "パスワードを隠す" : "パスワードを表示"}
                    className={styles.passwordToggle}
                    data-testid="login-password-toggle"
                    onClick={() => setShowPassword((value) => !value)}
                    type="button"
                  >
                    {showPassword ? "隠す" : "表示"}
                  </button>
                </div>
              </label>

              <div className={styles.formMeta}>
                <label className={styles.keepLogin}>
                  <input
                    checked={keepLogin}
                    data-testid="login-keep"
                    onChange={(event) => setKeepLogin(event.target.checked)}
                    type="checkbox"
                  />
                  <span>ログイン状態を保持する</span>
                </label>
                <a href="/login/forgot">パスワードをお忘れですか？</a>
              </div>

              {error && (
                <p className={styles.errorMessage} role="alert">
                  {error}
                </p>
              )}

              <button
                className={styles.submitButton}
                data-testid="login-submit"
                disabled={submitting}
                type="submit"
              >
                {submitting ? "ログイン中..." : "Enter the Garden"}
              </button>
            </form>

            <p className={styles.footerNote}>
              Secure workspace for finance, operations, and customer support.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}

export default function GardenLoginPage() {
  return (
    <Suspense
      fallback={
        <main className={styles.stage}>
          <div className={styles.sky} aria-hidden="true" />
        </main>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
