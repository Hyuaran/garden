"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

import { createBrowserClient } from "@/app/_lib/supabase/browser";

import { budBackLink, budCard, budHeader, budLead, budMobile, budNotice, budPage, budTitle } from "../_lib/mobile-theme";

// allowed=Bud権限あり(レビュー可) / employee=一般従業員(申請・申請状況のみ)
type AccessState = "loading" | "allowed" | "employee";

const MENU = [
  {
    href: "/m/bud/submit",
    mark: "01",
    title: "申請する",
    body: "レシートを撮影して、経費申請を送ります。",
  },
  {
    href: "/m/bud/drive",
    mark: "02",
    title: "申請状況をみる",
    body: "Driveと同じフォルダ感覚で、確認待ちや差戻しを見ます。",
  },
  {
    href: "/bud/expenses",
    mark: "03",
    title: "レビュー",
    body: "承認待ち、完了待ち、仕訳化はPC画面で確認します。",
  },
];

export default function MobileBudHome() {
  const supabase = useMemo(() => createBrowserClient(), []);
  const [access, setAccess] = useState<AccessState>("loading");

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void (async () => {
        const { data } = await supabase.rpc("bud_has_access");
        setAccess(data ? "allowed" : "employee");
      })();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [supabase]);

  if (access === "loading") {
    return (
      <main style={budPage}>
        <section style={{ ...budNotice, marginTop: 24 }}>Budの権限を確認しています...</section>
      </main>
    );
  }

  // 一般従業員には申請・申請状況の2つを見せる（レビューはBud権限者のみ）
  const menu = access === "allowed" ? MENU : MENU.filter((item) => item.href !== "/bud/expenses");

  return (
    <main style={budPage}>
      <header style={budHeader}>
        <Link href="/m" style={budBackLink} aria-label="ホームへ戻る">
          ‹
        </Link>
        <div>
          <h1 style={budTitle}>Bud</h1>
          <p style={budLead}>日々の経費を、庭の帳面へ静かに整えます。</p>
        </div>
      </header>

      <section style={hero}>
        <div style={heroMark}>Bud</div>
        <div style={heroText}>経理・精算</div>
      </section>

      <div style={menuStack}>
        {menu.map((item) => (
          <Link key={item.href} href={item.href} style={menuCard}>
            <span style={menuMark}>{item.mark}</span>
            <span style={{ minWidth: 0, flex: 1 }}>
              <span style={menuTitle}>{item.title}</span>
              <span style={menuBody}>{item.body}</span>
            </span>
            <span style={arrow}>›</span>
          </Link>
        ))}
      </div>
    </main>
  );
}

const hero: React.CSSProperties = {
  ...budCard,
  padding: "18px 20px",
  marginBottom: 16,
  background:
    "linear-gradient(135deg, rgba(255,253,246,0.96), rgba(250,246,236,0.88)), radial-gradient(circle at 90% 10%, rgba(212,165,65,0.22), transparent 40%)",
};
const heroMark: React.CSSProperties = {
  color: budMobile.colors.gold,
  fontFamily: budMobile.font.number,
  fontSize: 34,
  lineHeight: 1,
  letterSpacing: "0.04em",
};
const heroText: React.CSSProperties = { marginTop: 8, color: budMobile.colors.sub, fontSize: 13, letterSpacing: "0.12em" };
const menuStack: React.CSSProperties = { display: "flex", flexDirection: "column", gap: 12 };
const menuCard: React.CSSProperties = {
  ...budCard,
  display: "flex",
  alignItems: "center",
  gap: 14,
  padding: "16px 15px",
  color: budMobile.colors.text,
  textDecoration: "none",
};
const menuMark: React.CSSProperties = {
  width: 42,
  height: 42,
  borderRadius: 999,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  background: "rgba(212,165,65,0.14)",
  color: budMobile.colors.gold,
  fontFamily: budMobile.font.number,
  fontSize: 16,
  flexShrink: 0,
};
const menuTitle: React.CSSProperties = { display: "block", fontSize: 16, fontWeight: 700, letterSpacing: "0.04em" };
const menuBody: React.CSSProperties = { display: "block", marginTop: 4, color: budMobile.colors.sub, fontSize: 12, lineHeight: 1.55 };
const arrow: React.CSSProperties = { color: budMobile.colors.goldStrong, fontSize: 22, flexShrink: 0 };
