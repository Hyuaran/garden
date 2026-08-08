"use client";

import { Suspense, useState, type FormEvent } from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";

import { supabase } from "@/app/bloom/_lib/supabase";
import { toTossEmail } from "../_lib/auth";
import styles from "./page.module.css";

function safeReturnTo(value: string | null): string {
  return value && value.startsWith("/p/") && !value.startsWith("//") ? value : "/p/toss";
}

function TossLoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [partnerCode, setPartnerCode] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");

    let email: string;
    try {
      email = toTossEmail(partnerCode);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "パートナーコードを確認してください");
      return;
    }

    setSubmitting(true);
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    if (signInError) {
      setSubmitting(false);
      setError("パートナーコードかパスワードが違います");
      return;
    }

    router.push(safeReturnTo(searchParams.get("returnTo")));
    router.refresh();
  };

  return (
    <main className={styles.page}>
      <section className={styles.card} aria-labelledby="toss-login-title">
        <div className={styles.mark}><Image src="/images/logo/garden_logo.png" alt="Garden" width={58} height={58} /></div>
        <p className={styles.eyebrow}>Garden toss portal</p>
        <h1 id="toss-login-title">関電メンバー トスポータル</h1>

        <form onSubmit={onSubmit} className={styles.form}>
          <label>
            <span>パートナーコード</span>
            <input
              autoComplete="username"
              inputMode="numeric"
              maxLength={7}
              onChange={(event) => setPartnerCode(event.target.value.replace(/[^0-9]/g, ""))}
              placeholder="1234567"
              required
              value={partnerCode}
            />
          </label>
          <label>
            <span>パスワード</span>
            <input
              autoComplete="current-password"
              onChange={(event) => setPassword(event.target.value)}
              placeholder="パスワードを入力"
              required
              type="password"
              value={password}
            />
          </label>
          {error && <p className={styles.error} role="alert">{error}</p>}
          <button disabled={submitting} type="submit">
            {submitting ? "ログイン中…" : "ログイン"}
          </button>
        </form>
        <p className={styles.note}>ログイン状態はこの端末に安全に保存されます。</p>
      </section>
    </main>
  );
}

export default function TossLoginPage() {
  return <Suspense fallback={<main className={styles.page} />}><TossLoginForm /></Suspense>;
}

