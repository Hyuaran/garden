"use client";

import { Suspense, useEffect, useState, type FormEvent } from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";

import { ModuleIcon } from "@/app/_components/ModuleIcon/ModuleIcon";
import { GARDEN_SHELL_MODULES } from "@/app/_components/layout/GardenShell/garden-shell-config";
import { getPostLoginRedirect } from "../_lib/auth-redirect";
import { sanitizeReturnTo, signInUnified } from "../_lib/auth-unified";
import { getGreeting } from "../_lib/greeting";
import { fetchBloomUser } from "../bloom/_lib/auth";
import styles from "./page.module.css";

const ONBOARDING_REDIRECT_EXCLUDED_ROLES = new Set(["closer", "toss", "outsource"]);

async function fetchNeedsOnboardingAfterLogin() {
  try {
    const response = await fetch("/api/system/onboarding/status", {
      cache: "no-store",
      headers: { accept: "application/json" },
    });
    if (!response.ok) return false;
    const payload = await response.json();
    return payload?.needsOnboarding === true;
  } catch {
    return false;
  }
}

function BrandIcons() {
  return (
    <div className={styles.chips} data-testid="login-brand-icons" aria-hidden="true">
      {GARDEN_SHELL_MODULES.map((module) => (
        <i data-module-id={module.id} key={module.id}>
          <ModuleIcon id={module.id} />
        </i>
      ))}
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
      if (returnTo) {
        router.push(returnTo);
        return;
      }
      const needsOnboarding = !ONBOARDING_REDIRECT_EXCLUDED_ROLES.has(String(role ?? ""))
        && await fetchNeedsOnboardingAfterLogin();
      router.push(needsOnboarding ? "/system/onboarding" : getPostLoginRedirect(role));
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
