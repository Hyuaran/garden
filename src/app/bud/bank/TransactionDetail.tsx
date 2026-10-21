"use client";
import { useEffect, useState } from "react";
import SystemBreadcrumb from "@/app/system/_components/SystemBreadcrumb/SystemBreadcrumb";
import { accountDisplayName } from "@/lib/bud/mf/corporations";
import { journalLabel, transactionAmount } from "@/lib/bud/mf/transactions";
import type { CardTransaction, MfAccount } from "@/lib/bud/mf/types";
import styles from "./bank.module.css";

type Detail = { account: MfAccount; transactions: CardTransaction[]; total: number; amount: number };
const yen = (n: number) => `${n.toLocaleString("ja-JP")} 円`;
export default function TransactionDetail({ id, initialPeriod = "current" }: { id: string; initialPeriod?: string }) {
  const [period,setPeriod] = useState(["current","last","year"].includes(initialPeriod) ? initialPeriod : "current");
  const [page,setPage] = useState(1);
  const [data,setData] = useState<Detail | null>(null);
  const [error,setError] = useState("");
  const [loading,setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    setLoading(true); setError("");
    const fallback = "明細を読み込めませんでした。時間をおいてもう一度お試しください。";
    fetch(`/api/bud/mf-accounts/transactions?${new URLSearchParams({ id, period, page:String(page) })}`, { cache:"no-store" }).catch(() => { throw new Error(fallback); }).then(async response => {
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? fallback);
      if (active) setData(result);
    }).catch(e => { if (active) { setData(null); setError(e instanceof Error ? e.message : "明細を読み込めませんでした"); } }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  },[id,period,page]);
  const name = data ? accountDisplayName(data.account.name) : "明細";
  const card = data?.account.kind === "card";
  return <div className={styles.pageShell}>
    <SystemBreadcrumb root={{ label:"Bud", href:"/bud/dashboard" }} items={[{ label:"口座残高・カード利用", href:card ? "/bud/bank?tab=card" : "/bud/bank" },{ label:name }]} />
    <h1>{name}</h1>
    {error && <p role="alert">{error}</p>}
    <div className={styles.toolbar}><label>期間 <select value={period} onChange={e => { setPeriod(e.target.value); setPage(1); }}><option value="current">今月</option><option value="last">先月</option><option value="year">今年度</option></select></label>{data && <strong>合計 {yen(data.amount)}・{data.total} 件</strong>}<span role="status">{loading ? "読み込み中…" : ""}</span></div>
    {data && <>
      {!card && <p>今の残高 {data.account.balance_mode === "manual_check" || data.account.balance === null ? "MFで確認" : yen(Number(data.account.balance))}</p>}
      <div className={styles.tableWrap}><table className={styles.details}><thead><tr><th>日付</th><th>内容</th>{card ? <th>金額</th> : <><th>入金</th><th>出金</th></>}<th>仕訳</th></tr></thead><tbody>{data.transactions.map(t => <tr key={t.mf_transaction_id}><td>{t.date}</td><td>{t.content}</td>{card ? <td className={styles.money}>{yen(transactionAmount(t))}</td> : <><td className={styles.money}>{t.side === "INCOME" ? yen(Number(t.value)) : ""}</td><td className={styles.money}>{t.side === "EXPENSE" ? yen(Number(t.value)) : ""}</td></>}<td>{journalLabel(t.journalizing_status)}</td></tr>)}</tbody></table>{!data.total && <p>この期間の明細はありません。</p>}</div>
      <div className={styles.toolbar}><button disabled={loading || page <= 1} onClick={() => setPage(page-1)}>前へ</button><span>{page} / {Math.max(1,Math.ceil(data.total/100))}</span><button disabled={loading || page*100 >= data.total} onClick={() => setPage(page+1)}>次へ</button></div>
    </>}
  </div>;
}
