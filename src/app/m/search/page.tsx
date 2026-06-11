"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

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
        <h1 style={title}>検索</h1>
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="モジュール、店名、金額、状態" style={input} autoFocus />
      </header>

      {!loaded && <div style={notice}>読み込み中...</div>}
      {loaded && results.length === 0 && <div style={notice}>見つかりませんでした。</div>}

      <div style={list}>
        {results.map((item) => (
          <Link key={item.id} href={item.href} style={row}>
            <span style={kindIcon}>{item.kind === "module" ? "□" : "¥"}</span>
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

const page: React.CSSProperties = { minHeight: "100dvh", background: "#f7f4ec", padding: "20px 16px 18px", maxWidth: 560, margin: "0 auto" };
const head: React.CSSProperties = { marginBottom: 16 };
const title: React.CSSProperties = { margin: "0 0 12px", color: "#3d3528", fontSize: 24 };
const input: React.CSSProperties = { width: "100%", boxSizing: "border-box", border: "1px solid #d8cfba", borderRadius: 14, padding: "13px 14px", background: "#fffdf6", color: "#3d3528", fontSize: 16 };
const notice: React.CSSProperties = { background: "#fffdf6", border: "1px solid #e2ddcf", borderRadius: 14, padding: 22, textAlign: "center", color: "#6d6356", fontSize: 13 };
const list: React.CSSProperties = { display: "flex", flexDirection: "column", gap: 9 };
const row: React.CSSProperties = { display: "flex", alignItems: "center", gap: 12, background: "#fffdf6", border: "1px solid rgba(179,137,46,0.18)", borderRadius: 14, padding: 13, color: "#3d3528", textDecoration: "none" };
const kindIcon: React.CSSProperties = { width: 34, height: 34, borderRadius: 10, background: "rgba(212,165,65,0.14)", color: "#b3892e", display: "inline-flex", alignItems: "center", justifyContent: "center", fontWeight: 700 };
const rowTitle: React.CSSProperties = { display: "block", fontSize: 14, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" };
const rowSub: React.CSSProperties = { display: "block", marginTop: 3, fontSize: 11, color: "#7b745f", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" };
