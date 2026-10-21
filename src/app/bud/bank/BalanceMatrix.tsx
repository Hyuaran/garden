"use client";
import Link from "next/link";
import { WarningMark } from "./LinkAlerts";
import type { LinkAlert } from "@/lib/bud/mf/link-alerts";
import { accountAxes, accountDisplayName } from "@/lib/bud/mf/corporations";
import { useEffect, useRef, useState } from "react";
import { buildMatrix, deltaLabel, summarize } from "@/lib/bud/mf/matrix";
import { corporationName } from "@/lib/bud/mf/corporations";
import type { ArrivalTotals, AxisOrder, BalanceSnapshot, MfAccount } from "@/lib/bud/mf/types";
import styles from "./bank.module.css";
function Delta({ value }: { value: number | null }) {
 return value === null ? null : <span className={value > 0 ? styles.increase : value < 0 ? styles.decrease : styles.unchanged}>{deltaLabel(value)}</span>;
}
function Amount({ value, total = false }: { value: ReturnType<typeof summarize>; total?: boolean }) {
 return <><strong>{value.balance === null ? value.manual && !total ? "MFで確認" : "—" : value.balance.toLocaleString("ja-JP") + " 円"}</strong><Delta value={value.delta} />
 {value.manual > 0 && (value.balance !== null || total) && <small>MFで確認 {value.manual} 口座を除く</small>}
 {!total && value.notes.map(note => <small className={styles.balanceNote} key={note}>{note}</small>)}
 {!total && value.count > 1 && <small>{value.count} 口座</small>}
</>;
}
const emptyAxes: AxisOrder[] = [];
export default function BalanceMatrix({ accounts, linkAlerts = [], arrivalTotal, axes = emptyAxes, snapshots = [], reordering, onError }: { linkAlerts?: LinkAlert[]; arrivalTotal?: ArrivalTotals; accounts: MfAccount[]; axes?: AxisOrder[]; snapshots?: BalanceSnapshot[]; reordering: boolean; onError: (message: string) => void }) {
 const [order, setOrder] = useState(axes);
 const [saving, setSaving] = useState(0);
 const current = useRef(order);
 const queue = useRef(Promise.resolve());
 const drag = useRef<{ axis: AxisOrder["axis"]; key: string } | null>(null);
 useEffect(() => { setOrder(axes); current.current = axes; }, [axes]);
 const matrix = buildMatrix(accounts, order, snapshots);
 function move(axis: AxisOrder["axis"], key: string, target: string) {
  if (key === target) return;
  const visible = axis === "corp" ? matrix.corps : matrix.banks;
  const keys = [...new Set([...current.current.filter(o => o.axis === axis).sort((a,b) => a.sort_order-b.sort_order).map(o => o.key), ...visible])];
  const from = keys.indexOf(key), to = keys.indexOf(target);
  if (from < 0 || to < 0) return;
  keys.splice(to, 0, keys.splice(from,1)[0]);
  const previous = current.current;
  const next = [...previous.filter(o => o.axis !== axis), ...keys.map((key,sort_order) => ({axis,key,sort_order}))];
  current.current = next; setOrder(next); setSaving(n => n+1);
  queue.current = queue.current.then(async () => {
   try {
    const response = await fetch("/api/bud/mf-accounts", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "axis-order", axis, keys }) });
    if (!response.ok) throw new Error();
   } catch {
    onError("並び順を保存できませんでした。もう一度お試しください。");
    if (current.current === next) { current.current = previous; setOrder(previous); }
   } finally { setSaving(n => n-1); }
  });
 }
 function heading(axis: AxisOrder["axis"], key: string, index: number, keys: string[]) {
  const name = axis === "corp" ? corporationName(key) : key;
  return <div className={styles.axisHeading} draggable={reordering} onDragStart={e => { drag.current = {axis,key}; e.dataTransfer.setData("text/plain",key); }} onDragEnd={() => { drag.current = null; }} onDragOver={e => { if (reordering && drag.current?.axis === axis) e.preventDefault(); }} onDrop={e => { e.preventDefault(); if (reordering && drag.current?.axis === axis) move(axis,drag.current.key,key); drag.current = null; }}>
   <span>{name}</span>{reordering && <div className={styles.axisButtons}><button aria-label={name + (axis === "corp" ? "を上へ" : "を左へ")} disabled={index === 0} onClick={() => move(axis,key,keys[index-1])}>{axis === "corp" ? "↑" : "←"}</button><button aria-label={name + (axis === "corp" ? "を下へ" : "を右へ")} disabled={index === keys.length-1} onClick={() => move(axis,key,keys[index+1])}>{axis === "corp" ? "↓" : "→"}</button></div>}
  </div>;
 }
 const total = matrix.cell();
 return <><div className={styles.total}><span>グループ合計</span><strong>{total.balance === null ? "—" : total.balance.toLocaleString("ja-JP") + " 円"}</strong>{arrivalTotal && <span><Delta value={arrivalTotal.delta} />（入金 {arrivalTotal.income.toLocaleString("ja-JP")}・出金 {arrivalTotal.expense.toLocaleString("ja-JP")}）</span>}{total.manual > 0 && <small>MFで確認 {total.manual} 口座を除く</small>}</div>
 <small role="status">{saving > 0 ? "並び順を保存中…" : ""}</small>
 <div className={styles.tableWrap} role="region" aria-label="法人別・銀行別の口座残高" tabIndex={0}><table className={styles.matrix}><thead><tr><th scope="col">法人</th>{matrix.banks.map((bank,i) => <th scope="col" key={bank}>{heading("bank",bank,i,matrix.banks)}</th>)}<th scope="col">合計</th></tr></thead><tbody>{matrix.corps.map((corp,i) => <tr key={corp}><th scope="row">{heading("corp",corp,i,matrix.corps)}</th>{matrix.banks.map(bank => <td key={bank}>{(list => list.map(a => <div key={a.mf_account_id}>{linkAlerts.some(alert => alert.mf_account_id === a.mf_account_id) && <WarningMark />}<Link className={list.length === 1 ? `${styles.detailLink} ${styles.stretchLink}` : styles.detailLink} aria-label={accountDisplayName(a.name) + "の明細"} href={`/bud/bank/accounts/${encodeURIComponent(a.mf_account_id)}`}><strong>{(a.balance_mode === "manual_check" || a.balance === null || (a.balance_mode === "anchor" && (a.anchor_balance == null || !a.anchor_date))) ? "MFで確認" : Number(a.balance).toLocaleString("ja-JP") + " 円"}</strong></Link></div>))(accounts.filter(a => a.kind === "bank" && !a.hidden && accountAxes(a.name).corp_code === corp && accountAxes(a.name).bank_name === bank))}<Delta value={matrix.cell(corp,bank).delta} />{matrix.cell(corp,bank).notes.map(note => <small className={styles.balanceNote} key={note}>{note}</small>)}</td>)}<td><Amount total value={matrix.cell(corp)} /></td></tr>)}</tbody><tfoot><tr><th scope="row">合計</th>{matrix.banks.map(bank => <td key={bank}><Amount total value={matrix.cell(undefined,bank)} /></td>)}<td><Amount total value={total} /></td></tr></tfoot></table></div></>;
}
