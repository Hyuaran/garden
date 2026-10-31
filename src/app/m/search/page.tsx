"use client";

import HelpButton from "@/app/system/_components/HelpButton/HelpButton";
import SystemTabs from "@/app/system/_components/SystemTabs/SystemTabs";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { MobileIcon } from "../_components/MobileIcon";

import { createBrowserClient } from "@/app/_lib/supabase/browser";

import { formatYen, getMyEmployee, searchMyExpenseRequests, statusLabel, type MobileExpenseRequest } from "../_lib/mobile-expenses";
import { MOBILE_MODULES } from "../_lib/mobile-modules";

type Result = {
  id: string;
  title: string;
  sub: string;
  href: string;
  kind: "module" | "expense";
};

export default function MobileSearchPage() {
  const supabase = useMemo(() => createBrowserClient(), []);
  const [query, setQuery] = useState("");
  const [expenses, setExpenses] = useState<MobileExpenseRequest[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void (async () => {
        const employee = await getMyEmployee(supabase);
        if (employee) setExpenses(await searchMyExpenseRequests(supabase, employee.employee_id));
        setLoaded(true);
      })();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [supabase]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    const moduleResults: Result[] = MOBILE_MODULES.map((module) => ({
      id: `module-${module.key}`,
      title: module.label,
      sub: module.descriptionLines.join(" / "),
      href: module.href,
      kind: "module",
    }));
    const expenseResults: Result[] = expenses.map((row) => ({
      id: `expense-${row.id}`,
      title: row.store_name ?? "店名未入力",
      sub: `${formatYen(row.amount)} / ${statusLabel(row.status)} / ${row.receipt_date ?? "日付未入力"}`,
      href: "/m/bud/drive",
      kind: "expense",
    }));
    const all = [moduleResults, expenseResults].flat();
    if (!q) return all.slice(0, 12);
    return all.filter((item) => `${item.title} ${item.sub}`.toLowerCase().includes(q)).slice(0, 30);
  }, [expenses, query]);

  return (
    <main style={page}>
      <header style={head}>
        <div className="garden-help-heading"><h1 style={title}>検索</h1><HelpButton /></div>
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="モジュール、店名、金額、状態" style={input} autoFocus />
      </header><SystemTabs />

      {!loaded && <div style={notice}>読み込み中...</div>}
      {loaded && results.length === 0 && <div style={notice}>見つかりませんでした。</div>}

      <div style={list}>
        {results.map((item) => (
          <Link key={item.id} href={item.href} style={row}>
            <span style={kindIcon}><MobileIcon name={item.kind === "module" ? "modules" : "receipt"}/></span>
            <span style={{ minWidth: 0 }}>
              <span style={rowTitle}>{item.title}</span>
              <span style={rowSub}>{item.sub}</span>
            </span>
          </Link>
        ))}
      </div>
    </main>
  );
}

const page: React.CSSProperties = { minHeight: "100dvh", background: "var(--m-bg)", padding: "20px 16px 18px", maxWidth: 560, margin: "0 auto" };
const head: React.CSSProperties = { marginBottom: 16 };
const title: React.CSSProperties = { margin: "0 0 12px", color: "var(--m-ink)", fontSize: 24 };
const input: React.CSSProperties = { width: "100%", boxSizing: "border-box", border: "1px solid var(--m-line)", borderRadius: 14, padding: "13px 14px", background: "var(--m-card)", color: "var(--m-ink)", fontSize: 16 };
const notice: React.CSSProperties = { background: "var(--m-card)", border: "1px solid var(--m-line)", borderRadius: 14, padding: 22, textAlign: "center", color: "var(--m-sub)", fontSize: 13 };
const list: React.CSSProperties = { display: "flex", flexDirection: "column", gap: 9 };
const row: React.CSSProperties = { display: "flex", alignItems: "center", gap: 12, background: "var(--m-card)", border: "1px solid var(--m-line)", borderRadius: 14, padding: 13, color: "var(--m-ink)", textDecoration: "none" };
const kindIcon: React.CSSProperties = { width: 34, height: 34, borderRadius: 10, background: "var(--m-tint)", color: "var(--m-accent)", display: "inline-flex", alignItems: "center", justifyContent: "center", fontWeight: 700 };
const rowTitle: React.CSSProperties = { display: "block", fontSize: 14, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" };
const rowSub: React.CSSProperties = { display: "block", marginTop: 3, fontSize: 11, color: "var(--m-sub)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" };
