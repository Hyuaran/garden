"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import { supabase } from "@/app/bloom/_lib/supabase";
import { fetchTossPartner, type TossPartner } from "../_lib/auth";
import { PartnerHeaderActions } from "../_components/PartnerHeaderActions";
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
        <nav className={styles.headerNav}><p>Garden toss portal</p><PartnerHeaderActions /></nav>
        <h1>{partner ? `${partner.partner_name}さん` : "ようこそ"}</h1>
        <span>お取次ぎありがとうございます！</span>
      </header>
      <section className={styles.actions} aria-label="トスポータルメニュー">
        <Link href="/p/toss/new" className={styles.actionLink}>
          <i>01</i><h2>トスアップ入力</h2>
          <p>新規トスアップ案件を登録します。既に取次済みの案件に追記がある場合は、担当者へ個別に連絡してください。</p>
          <span>フォーム</span>
        </Link>
        <Link href="/p/toss/board" className={styles.actionLink}>
          <i>02</i><h2>案件一覧確認</h2>
          <p>連携した案件の最新状況を一覧で確認できます。この情報はタイムリーに更新されています。</p>
          <span>進捗</span>
        </Link>
      </section>
      <footer>パートナーコード {partner?.partner_code ?? "-------"}</footer>
    </main>
  );
}

