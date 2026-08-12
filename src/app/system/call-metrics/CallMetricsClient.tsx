"use client";

import { useEffect, useState } from "react";
import type { CallMetricsResponse } from "../_lib/call-metrics";
import { defaultCallMetricDates } from "../_lib/call-metrics";
import styles from "./call-metrics.module.css";

const percent = (value: number) => `${(value * 100).toFixed(1)}%`;

export default function CallMetricsClient() {
  const defaults = defaultCallMetricDates();
  const [from, setFrom] = useState(defaults.from);
  const [to, setTo] = useState(defaults.to);
  const [listName, setListName] = useState("");
  const [data, setData] = useState<CallMetricsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true); setError(null);
    const params = new URLSearchParams({ from, to });
    if (listName.trim()) params.set("listName", listName.trim());
    try {
      const response = await fetch(`/api/system/call-metrics?${params}`, { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "集計の取得に失敗しました");
      setData(result);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "集計の取得に失敗しました"); }
    finally { setLoading(false); }
  }

  useEffect(() => { void load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const totalCalls = data?.metrics.reduce((sum, row) => sum + row.callCount, 0) ?? 0;

  return (
    <main className={styles.main}>
      <header>
        <p className={styles.eyebrow}>Garden System</p>
        <h1>コールセンター リスト別集計</h1>
        <p className={styles.notice}>現在は直近取込分のみの検算画面です。全期間の網羅値はStep2のバックフィル後に確認します。</p>
      </header>

      <form className={styles.filters} onSubmit={(event) => { event.preventDefault(); void load(); }}>
        <label>開始日<input type="date" value={from} onChange={(event) => setFrom(event.target.value)} required /></label>
        <label>終了日<input type="date" value={to} onChange={(event) => setTo(event.target.value)} required /></label>
        <label>診断対象リスト<input value={listName} onChange={(event) => setListName(event.target.value)} placeholder="空欄なら全体" /></label>
        <button type="submit" disabled={loading}>{loading ? "集計中…" : "再集計"}</button>
      </form>

      {error && <p className={styles.error} role="alert">{error}</p>}
      {data && <>
        <p className={styles.summary}>対象期間: {data.from}〜{data.to} ／ リスト数: {data.metrics.length} ／ コール数: {totalCalls.toLocaleString()}</p>
        <section>
          <h2>リスト別指標</h2>
          <div className={styles.tableWrap}><table>
            <thead><tr><th>リスト名</th><th>コール数</th><th>有効数</th><th>有効率</th><th>受注数</th><th>獲得数</th><th>コール受注率</th><th>リスト数</th><th>回転数</th><th>リスト受注率</th></tr></thead>
            <tbody>{data.metrics.length ? data.metrics.map((row) => <tr key={row.listName}>
              <td>{row.listName}</td><td>{row.callCount.toLocaleString()}</td><td>{row.effectiveCount.toLocaleString()}</td><td>{percent(row.effectiveRate)}</td><td>{row.orderCount.toLocaleString()}</td><td>{row.acquiredCount.toLocaleString()}</td><td>{percent(row.callOrderRate)}</td><td className={styles.pending}>未取得</td><td className={styles.pending}>未取得</td><td className={styles.pending}>未取得</td>
            </tr>) : <tr><td colSpan={10}>対象データがありません</td></tr>}</tbody>
          </table></div>
        </section>

        <section>
          <h2>result_flag 診断{data.diagnosticListName ? `（${data.diagnosticListName}）` : "（全体）"}</h2>
          <p>想定外の非空値は定義どおり「有効」に含まれます。</p>
          <div className={styles.tableWrap}><table className={styles.diagnostic}>
            <thead><tr><th>result_flag</th><th>件数</th><th>有効判定</th><th>値の判定</th></tr></thead>
            <tbody>{data.resultFlags.length ? data.resultFlags.map((row) => <tr key={row.resultFlag} className={row.isExpected ? undefined : styles.unexpected}>
              <td>{row.resultFlag}</td><td>{row.count.toLocaleString()}</td><td>{row.isEffective ? "有効" : "除外"}</td><td>{row.isExpected ? "想定内" : "想定外"}</td>
            </tr>) : <tr><td colSpan={4}>対象データがありません</td></tr>}</tbody>
          </table></div>
        </section>
      </>}
    </main>
  );
}

