"use client";
import { useEffect, useRef, useState } from "react";
import type { LinkAlert } from "@/lib/bud/mf/link-alerts";
import type { MfAccount } from "@/lib/bud/mf/types";
import { accountDisplayName } from "@/lib/bud/mf/corporations";
import styles from "./bank.module.css";

export function WarningMark() {
 return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" role="img" aria-label="自動取得が止まっています"><path d="M12 3 2 21h20L12 3Z M12 9v5 M12 17v.1" /></svg>;
}
export default function LinkAlerts({ accounts, onChange }: { accounts: MfAccount[]; onChange: (alerts: LinkAlert[]) => void }) {
 const [alerts, setAlerts] = useState<LinkAlert[]>([]);
 const [error, setError] = useState("");
 const [busy, setBusy] = useState<string | null>(null);
 const dismissed = useRef(new Set<string>());
 useEffect(() => {
  if (!alerts.length) return;
  const delay = Math.max(0, Math.min(...alerts.map(a => Date.parse(a.received_at)+8*86400000))-Date.now());
  const timer = setTimeout(() => {
   const remaining = alerts.filter(a => Date.parse(a.received_at)+8*86400000 > Date.now());
   setAlerts(remaining); onChange(remaining);
  }, delay);
  return () => clearTimeout(timer);
 }, [alerts, onChange]);
 useEffect(() => {
  let cancelled = false;
  async function load() {
   try {
    const response = await fetch("/api/bud/mf-accounts/link-alerts", { cache: "no-store" });
    if (!response.ok) throw new Error();
    const data = await response.json();
    if (!cancelled) { const rows: LinkAlert[] = (data.alerts ?? []).filter((a: LinkAlert) => !dismissed.current.has(a.id) && Date.parse(a.received_at)+8*86400000 > Date.now()); setAlerts(rows); onChange(rows); setError(""); }
   } catch { if (!cancelled) setError("自動取得の知らせを読み込めませんでした。時間をおいてもう一度お試しください。"); }
  }
  void load();
  const timer = setInterval(() => { void load(); }, 60000);
  return () => { cancelled = true; clearInterval(timer); };
 }, [accounts, onChange]);
 return <>{error && <p role="alert" className={styles.error}>{error}</p>}{alerts.length > 0 && <div className={styles.linkAlerts} aria-label="自動取得の知らせ">{alerts.map(alert => {
  const account = accounts.find(a => a.mf_account_id === alert.mf_account_id);
  const [,month,day] = alert.last_success_date.split("-");
  return <div key={alert.id}><WarningMark /><span>マネーフォワードで自動取得が止まっている口座：{account ? accountDisplayName(account.name) : alert.mail_account_name}　{Number(month)}/{Number(day)} から・{alert.reason === "認証" ? "再連携が必要" : alert.reason_text || alert.reason}</span><button type="button" disabled={busy !== null} aria-label={`${account ? accountDisplayName(account.name) : alert.mail_account_name}の知らせを消す`} onClick={async () => {
   setBusy(alert.id); setError("");
   try {
    const response = await fetch("/api/bud/mf-accounts/link-alerts", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: alert.id }) });
    if (!response.ok) throw new Error();
    dismissed.current.add(alert.id);
    const remaining = alerts.filter(a => a.id !== alert.id); setAlerts(remaining); onChange(remaining);
   } catch { setError("知らせを消せませんでした。もう一度お試しください。"); }
   finally { setBusy(null); }
  }}>{busy === alert.id ? "消しています…" : "消す"}</button></div>;
 })}</div>}</>;
}
