"use client";
import { useEffect, useState } from "react";
import SystemBreadcrumb from "@/app/system/_components/SystemBreadcrumb/SystemBreadcrumb";
import DataTable, { type DataColumn } from "@/app/system/_components/DataTable/DataTable";
import { accountDisplayName } from "@/lib/bud/mf/corporations";
import { validTransactionPeriod, journalLabel, transactionAmount } from "@/lib/bud/mf/transactions";
import type { CardTransaction, MfAccount } from "@/lib/bud/mf/types";
import PeriodSelect from "./PeriodSelect";
import styles from "./bank.module.css";

type Detail = { fiscalYears?: number[]; account: MfAccount; transactions: CardTransaction[] };
const yen = (n: number) => `${n.toLocaleString("ja-JP")} 円`;
const income = (t: CardTransaction) => t.side === "INCOME" ? Number(t.value) : 0;
const expense = (t: CardTransaction) => t.side === "EXPENSE" ? Number(t.value) : 0;
export default function TransactionDetail({ id, initialPeriod = "current" }: { id: string; initialPeriod?: string }) {
  const [period,setPeriod] = useState(validTransactionPeriod(initialPeriod) ? initialPeriod : "current");
  const [data,setData] = useState<Detail | null>(null);
  const [error,setError] = useState("");
  const [loading,setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    setLoading(true); setError("");
    const fallback = "明細を読み込めませんでした。時間をおいてもう一度お試しください。";
    fetch(`/api/bud/mf-accounts/transactions?${new URLSearchParams({ id, period })}`, { cache:"no-store" }).catch(() => { throw new Error(fallback); }).then(async response => {
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? fallback);
      if (active) setData(result);
    }).catch(e => { if (active) { setData(null); setError(e instanceof Error ? e.message : "明細を読み込めませんでした"); } }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  },[id,period]);
  const name = data ? accountDisplayName(data.account.name) : "";
  const card = data?.account.kind === "card";
  const columns: DataColumn<CardTransaction>[] = [
    { id:"date", label:"日付", value:t => t.date, type:"date", filterValue:t => `${t.date.slice(0,4)}年${Number(t.date.slice(5,7))}月` },
    { id:"content", label:"内容", value:t => t.content, type:"text", wrap:true },
    ...(card ? [{ id:"amount", label:"金額", value:transactionAmount, type:"number" as const, right:true, render:(t: CardTransaction) => yen(transactionAmount(t)) }] : [
      { id:"income", label:"入金", value:income, filterValue:(t: CardTransaction) => t.side === "INCOME" ? String(income(t)) : "", type:"number" as const, right:true, render:(t: CardTransaction) => t.side === "INCOME" ? yen(income(t)) : "" },
      { id:"expense", label:"出金", value:expense, filterValue:(t: CardTransaction) => t.side === "EXPENSE" ? String(expense(t)) : "", type:"number" as const, right:true, render:(t: CardTransaction) => t.side === "EXPENSE" ? yen(expense(t)) : "" },
    ]),
    { id:"journal", label:"仕訳", value:t => journalLabel(t.journalizing_status), type:"text", align:"mark" },
  ];
  const periodControl = <PeriodSelect value={period} onChange={value => {
    setPeriod(value); const url = new URL(window.location.href); url.searchParams.set("period", value); window.history.replaceState(null, "", url);
  }} fiscalStart={data?.account.fiscal_start_date} years={data?.fiscalYears ?? []} />;
  return <div className={styles.pageShell}>
    <SystemBreadcrumb root={{ label:"Bud", href:"/bud/dashboard" }} items={[{ label:"口座残高・カード利用", href:card ? "/bud/bank?tab=card" : "/bud/bank" },{ label:name }]} />
    <h1>{name || " "}</h1>
    {error && <p role="alert">{error}</p>}
    <span role="status">{loading ? "読み込み中…" : ""}</span>
    {!data && error && <div className={styles.toolbar}>{periodControl}</div>}
    {data && <>
      <DataTable key={`${id}:${period}`} rows={data.transactions} columns={columns} rowKey={t => t.mf_transaction_id} defaultSort={{ id:"date", direction:"desc" }} toolbar={periodControl}
        searchText={t => `${t.content} ${Number(t.value)} ${Number(t.value).toLocaleString("ja-JP")} ${transactionAmount(t)} ${transactionAmount(t).toLocaleString("ja-JP")}`}
        summary={rows => <>
          {!card && <div className={styles.statBox}><small>今の残高</small><strong>{data.account.balance_mode === "manual_check" || data.account.balance === null ? "マネーフォワードで確認" : yen(Number(data.account.balance))}</strong></div>}
          {card
            ? <div className={styles.statBox}><small>合計</small><strong>{yen(rows.reduce((sum,t) => sum + transactionAmount(t),0))}</strong></div>
            : <><div className={styles.statBox}><small>入金</small><strong className={styles.increase}>{yen(rows.reduce((sum,t) => sum + income(t),0))}</strong></div><div className={styles.statBox}><small>出金</small><strong className={styles.decrease}>{yen(rows.reduce((sum,t) => sum + expense(t),0))}</strong></div></>}
          <div className={styles.statBox}><small>件数</small><strong>{rows.length.toLocaleString("ja-JP")} 件</strong></div>
        </>} />
    </>}
  </div>;
}
