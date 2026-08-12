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
  const [activeTab, setActiveTab] = useState<"employees" | "lists" | "definitions">("employees");

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
        <p className={styles.eyebrow}>Garden call portal</p>
        <h1>テレマ コール集計ポータル</h1>
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
        <div className={styles.tabs} role="tablist" aria-label="集計表示">
          <button type="button" role="tab" aria-selected={activeTab === "employees"} onClick={() => setActiveTab("employees")}>従業員ごと</button>
          <button type="button" role="tab" aria-selected={activeTab === "lists"} onClick={() => setActiveTab("lists")}>リストごと</button>
          <button type="button" role="tab" aria-selected={activeTab === "definitions"} onClick={() => setActiveTab("definitions")}>定義方法</button>
        </div>

        {activeTab === "employees" && <section role="tabpanel">
          <h2>従業員ごとの指標</h2>
          <div className={styles.tableWrap}><table>
            <thead><tr><th>社員名</th><th>コール数</th><th>有効数</th><th>有効率</th><th>受注数</th><th>獲得数</th><th>コール受注率</th></tr></thead>
            <tbody>{data.employeeMetrics.length ? data.employeeMetrics.map((row) => <tr key={row.employeeName}>
              <td>{row.employeeName}</td><td>{row.callCount.toLocaleString()}</td><td>{row.effectiveCount.toLocaleString()}</td><td>{percent(row.effectiveRate)}</td><td>{row.orderCount.toLocaleString()}</td><td>{row.acquiredCount.toLocaleString()}</td><td>{percent(row.callOrderRate)}</td>
            </tr>) : <tr><td colSpan={7}>対象データがありません</td></tr>}</tbody>
          </table></div>
        </section>}

        {activeTab === "lists" && <section role="tabpanel">
          <h2>リストごとの指標</h2>
          <div className={styles.tableWrap}><table>
            <thead><tr><th>リスト名</th><th>コール数</th><th>有効数</th><th>有効率</th><th>受注数</th><th>獲得数</th><th>コール受注率</th><th>リスト数</th><th>回転数</th><th>リスト受注率</th></tr></thead>
            <tbody>{data.metrics.length ? data.metrics.map((row) => <tr key={row.listName}>
              <td>{row.listName}</td><td>{row.callCount.toLocaleString()}</td><td>{row.effectiveCount.toLocaleString()}</td><td>{percent(row.effectiveRate)}</td><td>{row.orderCount.toLocaleString()}</td><td>{row.acquiredCount.toLocaleString()}</td><td>{percent(row.callOrderRate)}</td><td className={styles.pending}>未取得</td><td className={styles.pending}>未取得</td><td className={styles.pending}>未取得</td>
            </tr>) : <tr><td colSpan={10}>対象データがありません</td></tr>}</tbody>
          </table></div>
        </section>}

        {activeTab === "definitions" && <section role="tabpanel">
          <h2>集計の定義</h2>
          <dl className={styles.definitions}>
            <div><dt>コール数</dt><dd>架電回数</dd></div>
            <div><dt>有効</dt><dd>会話できたコール。留守・無効・空を除きます。</dd></div>
            <div><dt>有効率</dt><dd>有効数 ÷ コール数</dd></div>
            <div><dt>受注</dt><dd>結果フラグが「前確OK」のコール</dd></div>
            <div><dt>獲得</dt><dd>内定として受注とは別にカウント</dd></div>
            <div><dt>コール受注率</dt><dd>受注数 ÷ コール数</dd></div>
            <div><dt>リスト数・回転数・リスト受注率</dt><dd>リストデータ取込後に対応</dd></div>
          </dl>
          <h2>result_flag 診断{data.diagnosticListName ? `（${data.diagnosticListName}）` : "（全体）"}</h2>
          <p>想定外の非空値は定義どおり「有効」に含まれます。</p>
          <div className={styles.tableWrap}><table className={styles.diagnostic}>
            <thead><tr><th>result_flag</th><th>件数</th><th>有効判定</th><th>値の判定</th></tr></thead>
            <tbody>{data.resultFlags.length ? data.resultFlags.map((row) => <tr key={row.resultFlag} className={row.isExpected ? undefined : styles.unexpected}>
              <td>{row.resultFlag}</td><td>{row.count.toLocaleString()}</td><td>{row.isEffective ? "有効" : "無効"}</td><td>{row.isExpected ? "想定内" : "想定外"}</td>
            </tr>) : <tr><td colSpan={4}>対象データがありません</td></tr>}</tbody>
          </table></div>
        </section>}
      </>}
    </main>
  );
}
