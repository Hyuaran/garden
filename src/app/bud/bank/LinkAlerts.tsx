"use client";
import { useEffect, useRef, useState } from "react";
import type { LinkAlert } from "@/lib/bud/mf/link-alerts";
import type { MfAccount } from "@/lib/bud/mf/types";
import { accountDisplayName } from "@/lib/bud/mf/corporations";
import { NoticeDialog } from "@/app/_components/notices/NoticeDialog";
import styles from "./bank.module.css";

export function WarningMark() {
 return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" role="img" aria-label="自動取得が止まっています"><path d="M12 3 2 21h20L12 3Z M12 9v5 M12 17v.1" /></svg>;
}
export default function LinkAlerts({ accounts, onChange }: { accounts: MfAccount[]; onChange: (alerts: LinkAlert[]) => void }) {
 const [alerts, setAlerts] = useState<LinkAlert[]>([]);
 const [error, setError] = useState("");
 const [busy, setBusy] = useState<string | null>(null);
 const [confirming, setConfirming] = useState<LinkAlert | null>(null);
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
 const nameOf = (alert: LinkAlert) => { const account = accounts.find(a => a.mf_account_id === alert.mf_account_id); return account ? accountDisplayName(account.name) : alert.mail_account_name; };
 const complete = async (alert: LinkAlert) => {
  setBusy(alert.id); setError("");
  try {
   const response = await fetch("/api/bud/mf-accounts/link-alerts", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: alert.id }) });
   if (!response.ok) throw new Error();
   dismissed.current.add(alert.id);
   const remaining = alerts.filter(a => a.id !== alert.id); setAlerts(remaining); onChange(remaining);
  } catch { setError("完了にできませんでした。もう一度お試しください。"); }
  finally { setBusy(null); }
 };
 return <>{error && <p role="alert" className={styles.error}>{error}</p>}{alerts.length > 0 && <div className={styles.linkAlerts} aria-label="自動取得の知らせ">{alerts.map(alert => {
  // 表記：「マネーフォワードで自動取得が止まっている可能性あり：京都銀行（ヒュアラン）　26/8/11 ～」（2026-10-21 東海林さん）
  const [year,month,day] = alert.last_success_date.split("-");
  return <div key={alert.id}><WarningMark /><span>マネーフォワードで自動取得が止まっている可能性あり：{nameOf(alert)}　{year.slice(2)}/{Number(month)}/{Number(day)} ～</span><button type="button" disabled={busy !== null} aria-label={`${nameOf(alert)}の知らせを完了にする`} onClick={() => setConfirming(alert)}>{busy === alert.id ? "完了にしています…" : "完了"}</button></div>;
 })}</div>}
 {confirming && <NoticeDialog title="完了にしますか？" onClose={() => setConfirming(null)} footer={<><button type="button" onClick={() => setConfirming(null)}>やめる</button><button type="button" className={styles.confirmPrimary} onClick={() => { const target = confirming; setConfirming(null); void complete(target); }}>完了にする</button></>}>
  <p>{nameOf(confirming)} の「自動取得が止まっている可能性あり」の知らせを完了にします。マネーフォワードで連携し直したあとに押してください。</p>
  <p>完了にしても、次の週の知らせメールにまた載ったときは、もう一度表示されます。</p>
 </NoticeDialog>}</>;
}
