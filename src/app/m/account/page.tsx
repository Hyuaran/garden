"use client";

import { useEffect, useMemo, useState } from "react";

import { signOutUnified, useAuthUnified } from "@/app/_lib/auth-unified";
import { createBrowserClient } from "@/app/_lib/supabase/browser";

import { getMyEmployee, type MobileEmployee } from "../_lib/mobile-expenses";

export default function MobileAccountPage() {
  const supabase = useMemo(() => createBrowserClient(), []);
  const { role, employeeNumber } = useAuthUnified();
  const [employee, setEmployee] = useState<MobileEmployee | null>(null);
  const roleLabel = useMemo(() => role ?? "未設定", [role]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void (async () => {
        setEmployee(await getMyEmployee(supabase));
      })();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [supabase]);

  const logout = async () => {
    await signOutUnified();
    window.location.href = "/login?returnTo=/m";
  };

  return (
    <main style={page}>
      <header style={head}>
        <h1 style={title}>アカウント</h1>
        <p style={lead}>ログイン中のユーザー情報です。</p>
      </header>

      <section style={card}>
        <div style={avatar}>G</div>
        <div style={row}>
          <span style={label}>氏名</span>
          <span style={value}>{employee?.name ?? "未設定"}</span>
        </div>
        <div style={row}>
          <span style={label}>社員番号</span>
          <span style={value}>{employee?.employee_number ?? employeeNumber ?? "未設定"}</span>
        </div>
        <div style={row}>
          <span style={label}>ロール</span>
          <span style={value}>{roleLabel}</span>
        </div>
      </section>

      <button type="button" style={logoutBtn} onClick={() => void logout()}>
        ログアウト
      </button>
    </main>
  );
}

const page: React.CSSProperties = { minHeight: "100dvh", background: "#f7f4ec", padding: "20px 16px 18px", maxWidth: 560, margin: "0 auto" };
const head: React.CSSProperties = { marginBottom: 18 };
const title: React.CSSProperties = { margin: 0, color: "#3d3528", fontSize: 24 };
const lead: React.CSSProperties = { margin: "6px 0 0", color: "#7b745f", fontSize: 12 };
const card: React.CSSProperties = { background: "#fffdf6", border: "1px solid rgba(179,137,46,0.2)", borderRadius: 16, padding: 18, boxShadow: "0 2px 8px rgba(61,53,40,0.05)" };
const avatar: React.CSSProperties = { width: 54, height: 54, borderRadius: 999, background: "rgba(212,165,65,0.18)", color: "#b3892e", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, fontWeight: 700, marginBottom: 14 };
const row: React.CSSProperties = { display: "flex", justifyContent: "space-between", gap: 12, padding: "11px 0", borderTop: "1px dashed rgba(180,165,130,0.22)" };
const label: React.CSSProperties = { color: "#7b745f", fontSize: 13 };
const value: React.CSSProperties = { color: "#3d3528", fontSize: 13, fontWeight: 700, textAlign: "right" };
const logoutBtn: React.CSSProperties = { width: "100%", border: "none", borderRadius: 14, padding: 14, marginTop: 16, background: "#3d3528", color: "#fff", fontWeight: 700, fontSize: 15 };
