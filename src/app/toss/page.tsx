"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import { supabase } from "@/app/bloom/_lib/supabase";
import { fetchTossPartner, type TossPartner } from "./_lib/auth";
import styles from "./page.module.css";

export default function TossPortalPage() {
  const [partner, setPartner] = useState<TossPartner | null>(null);

  useEffect(() => {
    let cancelled = false;
    void supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return;
      const profile = await fetchTossPartner(data.user.id);
      if (!cancelled) setPartner(profile);
    });
    return () => { cancelled = true; };
  }, []);

  return (
    <main className={styles.page}>
      <header>
        <p>Garden Toss Portal</p>
        <h1>{partner ? `${partner.partner_name}さん` : "ようこそ"}</h1>
        <span>連携と進捗確認を、ここから迷わず行えます。</span>
      </header>
      <section className={styles.actions} aria-label="トスポータルメニュー">
        <Link href="/toss/new" className={styles.actionLink}>
          <i>01</i><h2>新規トスアップ入力</h2>
          <p>お客様情報を入力し、新しいトスアップを登録します。</p>
          <span>入力を開始</span>
        </Link>
        <article>
          <i>02</i><h2>一覧を見る</h2>
          <p>連携した案件の最新状況を一覧で確認できます。</p>
          <span>近日公開</span>
        </article>
      </section>
      <footer>パートナーコード {partner?.partner_code ?? "-------"}</footer>
    </main>
  );
}

