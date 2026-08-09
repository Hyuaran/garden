"use client";

import { Suspense, useState, type FormEvent } from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";

import { supabase } from "@/app/bloom/_lib/supabase";
import { signInUnified } from "@/app/_lib/auth-unified";
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

    const trimmed = partnerCode.trim();
    setSubmitting(true);
    try {
      // 7桁はパートナーコード、1〜6桁は社員番号という運用上の前提で認証経路を分ける。
      const failed = /^\d{7}$/.test(trimmed)
        ? Boolean((await supabase.auth.signInWithPassword({ email: toTossEmail(trimmed), password })).error)
        : !(await signInUnified(trimmed, password)).success;
      if (failed) {
        setSubmitting(false);
        setError("コードまたはパスワードが違います");
        return;
      }
    } catch {
      setSubmitting(false);
      setError("コードまたはパスワードが違います");
      return;
    }

    router.push(safeReturnTo(searchParams.get("returnTo")));
    router.refresh();
  };

  return (
    <main className={styles.page}>
      <section className={styles.card} aria-labelledby="toss-login-title">
        <div className={styles.mark}><Image src="/themes/garden-shell/images/login/mark-tree-emblem.png" alt="Garden" width={72} height={72} priority unoptimized /></div>
        <p className={styles.eyebrow}>Garden toss portal</p>
        <h1 id="toss-login-title">関電メンバー トスポータル</h1>

        <form onSubmit={onSubmit} className={styles.form}>
          <label>
            <span>パートナーコード または 社員番号</span>
            <input
              autoComplete="username"
              inputMode="numeric"
              maxLength={7}
              onChange={(event) => setPartnerCode(event.target.value.replace(/[^0-9]/g, ""))}
              placeholder="7桁のコード / 社員番号"
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

