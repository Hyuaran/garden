"use client";

import { Suspense, useEffect, useState, type FormEvent } from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";

import { getPostLoginRedirect } from "../_lib/auth-redirect";
import { sanitizeReturnTo, signInUnified } from "../_lib/auth-unified";
import { getGreeting } from "../_lib/greeting";
import { fetchBloomUser } from "../bloom/_lib/auth";
import styles from "./page.module.css";

function BrandIcons() {
  return (
    <div className={styles.chips} data-testid="login-brand-icons" aria-hidden="true">
      <i><svg viewBox="0 0 24 24" style={{ stroke: "#f472b6", filter: "drop-shadow(0 0 3px #f472b6)" }}><circle cx="12" cy="10" r="2.4"/><path d="M12 7.6c0-2 1-3.6 2.5-3.6S17 5.6 17 7.6c2 0 3.6 1 3.6 2.5S19 12.6 17 12.6c0 2-1 3.6-2.5 3.6S12 14.6 12 12.6c-2 0-3.6-1-3.6-2.5S9.9 7.6 12 7.6z"/><path d="M12 16v5"/></svg></i>
      <i><svg viewBox="0 0 24 24" style={{ stroke: "#fb923c", filter: "drop-shadow(0 0 3px #fb923c)" }}><path d="M12 8c-3.5 0-6 2.6-6 6s2.5 7 6 7 6-3.4 6-7-2.5-6-6-6z"/><path d="M12 8V4"/><path d="M12 5c2-.5 3.5-2 3.5-2"/></svg></i>
      <i><svg viewBox="0 0 24 24" style={{ stroke: "#facc15", filter: "drop-shadow(0 0 3px #facc15)" }}><ellipse cx="12" cy="13" rx="5" ry="6.5"/><path d="M12 19c0-4 1.5-7 4-9"/></svg></i>
      <i><svg viewBox="0 0 24 24" style={{ stroke: "#34d399", filter: "drop-shadow(0 0 3px #34d399)" }}><path d="M6 20v-3"/><path d="M6 17l-3-3h6z"/><path d="M6 14L4 11h4z"/><path d="M18 20v-3"/><path d="M18 17l-3-3h6z"/><path d="M12 21v-5"/><path d="M12 16l-3.5-4h7z"/></svg></i>
      <i><svg viewBox="0 0 24 24" style={{ stroke: "#c084fc", filter: "drop-shadow(0 0 3px #c084fc)" }}><path d="M12 21v-7"/><path d="M12 14c-3 0-5-2.4-5-5.5S9 3 12 3s5 2.4 5 5.5S15 14 12 14z"/></svg></i>
      <i><svg viewBox="0 0 24 24" style={{ stroke: "#4ade80", filter: "drop-shadow(0 0 3px #4ade80)" }}><path d="M5 19c0-8 5-13 14-14 1 9-4 15-12 15-1 0-2 0-2-1z"/><path d="M8 18c2-4 5-7 9-9"/></svg></i>
      <i><svg viewBox="0 0 24 24" style={{ stroke: "#a78bfa", filter: "drop-shadow(0 0 3px #a78bfa)" }}><path d="M12 21v-6"/><path d="M12 15l-5-4h10z"/><path d="M12 11L8 7h8z"/><path d="M12 7l-3-3h6z"/></svg></i>
      <i><svg viewBox="0 0 24 24" style={{ stroke: "#86efac", filter: "drop-shadow(0 0 3px #86efac)" }}><path d="M12 21v-8"/><path d="M12 13c0-3 2.2-5 5-5 0 3-2.2 5-5 5z"/><path d="M12 15c0-2.6-2-4.5-4.5-4.5 0 2.6 2 4.5 4.5 4.5z"/></svg></i>
      <i><svg viewBox="0 0 24 24" style={{ stroke: "#5b9dff", filter: "drop-shadow(0 0 3px #5b9dff)" }}><path d="M12 3v9"/><path d="M12 12c-1.5 2-4 3-5 6"/><path d="M12 12c1.5 2 4 3 5 6"/><path d="M12 12v9"/></svg></i>
      <i><svg viewBox="0 0 24 24" style={{ stroke: "#38bdf8", filter: "drop-shadow(0 0 3px #38bdf8)" }}><path d="M3 8c3 0 3 2 6 2s3-2 6-2 3 2 6 2"/><path d="M3 13c3 0 3 2 6 2s3-2 6-2 3 2 6 2"/><path d="M3 18c3 0 3 2 6 2"/></svg></i>
      <i><svg viewBox="0 0 24 24" style={{ stroke: "#60a5fa", filter: "drop-shadow(0 0 3px #60a5fa)" }}><rect x="3.5" y="5" width="17" height="15" rx="2.5"/><path d="M3.5 10h17"/><path d="M8 3v4M16 3v4"/></svg></i>
      <i><svg viewBox="0 0 24 24" style={{ stroke: "#0ea5a0", filter: "drop-shadow(0 0 3px #0ea5a0)" }}><path d="M4 11h9v6.5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z"/><path d="M13 13.5l5.5-3.8"/><path d="M18.5 9.7l2.2 1.1"/><path d="M6.5 11V9.2A2.2 2.2 0 0 1 8.7 7h1.6"/><path d="M20 14.4v1.4M17.6 15.6v1.2"/></svg></i>
    </div>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [employeeIdOrPartnerCode, setEmployeeIdOrPartnerCode] = useState("");
  const [password, setPassword] = useState("");
  const [keepLogin, setKeepLogin] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [greeting, setGreeting] = useState("おはようございます");

  useEffect(() => {
    const timer = window.setTimeout(() => setGreeting(getGreeting(new Date())), 0);
    return () => window.clearTimeout(timer);
  }, []);

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
      <section className={styles.brandPanel} data-testid="login-brand-panel">
        <div className={styles.logo}>
          <Image
            alt=""
            className={styles.logoMark}
            height={256}
            src="/themes/garden-shell/images/login/mark-tree-emblem.png"
            unoptimized
            width={256}
          />
          <span>Garden</span>
        </div>
        <h1>{greeting}</h1>
        <p>
          今日の業務をここから始めましょう。<br />
          経理・営業・カスタマーサポートの仕事を、<br />
          ひとつの場所にまとめています。
        </p>
        <BrandIcons />
      </section>
      <section
        aria-label="ログインフォーム"
        className={styles.formPanel}
        data-testid="login-section"
      >
        <form className={styles.form} onSubmit={onSubmit}>
          <h2>ログイン</h2>
            {isExpired && (
              <p className={styles.statusMessage} role="status">
                セッションが期限切れになりました。もう一度ログインしてください。
              </p>
            )}
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
            {submitting ? "ログイン中..." : "ログイン"}
          </button>
        </form>
      </section>
    </main>
  );
}

export default function GardenLoginPage() {
  return (
    <Suspense
      fallback={
        <main className={styles.stage} />
      }
    >
      <LoginForm />
    </Suspense>
  );
}
