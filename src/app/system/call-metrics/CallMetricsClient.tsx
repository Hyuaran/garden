"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@/app/_lib/supabase/browser";
import type { CallMetricsResponse } from "../_lib/call-metrics";
import { callsPerWorkHour, defaultCallMetricDates, formatWorkTime, summarizeCallMetrics } from "../_lib/call-metrics";
import styles from "./call-metrics.module.css";

const percent = (value: number) => `${(value * 100).toFixed(1)}%`;
const weekday = ["日", "月", "火", "水", "木", "金", "土"];
function formatJst(value: string | null) {
  if (!value) return "データなし";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "データなし";
  const parts = new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  const jstDate = new Date(date.toLocaleString("en-US", { timeZone: "Asia/Tokyo" }));
  return `${get("year")}/${get("month")}/${get("day")}(${weekday[jstDate.getDay()]}) ${get("hour")}:${get("minute")}`;
}
// 稼働時間から引く休憩。変更したら supabase/migrations の稼働時間の計算も直すこと。
const BREAKS = [
  { start: "11:15", end: "11:30", length: "15分" },
  { start: "13:00", end: "14:00", length: "60分" },
  { start: "15:20", end: "15:30", length: "10分" },
  { start: "16:45", end: "17:00", length: "15分" },
  { start: "18:20", end: "18:30", length: "10分" },
  { start: "19:50", end: "20:00", length: "10分" },
] as const;

const FLAG_RULES = [
  ["留守", "無効"], ["無効", "無効"], ["担不", "有効"], ["見込", "有効"],
  ["獲得", "有効"], ["トス", "有効"], ["NG", "有効"], ["前確OK", "有効"], ["前確NG", "有効"],
] as const;

export default function CallMetricsClient() {
  const router = useRouter();
  const defaults = defaultCallMetricDates();
  const [from, setFrom] = useState(defaults.from);
  const [to, setTo] = useState(defaults.to);
  const [listName, setListName] = useState("");
  const [employeeName, setEmployeeName] = useState("");
  const [data, setData] = useState<CallMetricsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"employees" | "lists" | "definitions">("employees");

  async function load() {
    setLoading(true); setError(null);
    const params = new URLSearchParams({ from, to });
    if (listName.trim()) params.set("listName", listName.trim());
    if (employeeName.trim()) params.set("employeeName", employeeName.trim());
    try {
      const response = await fetch(`/api/system/call-metrics?${params}`, { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "集計の取得に失敗しました");
      setData(result);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "集計の取得に失敗しました"); }
    finally { setLoading(false); }
  }

  useEffect(() => { void load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const summary = data ? summarizeCallMetrics(data) : null;
  const totalCalls = summary?.totalCalls ?? 0;

  async function logout() {
    await createBrowserClient().auth.signOut();
    router.replace("/login?returnTo=%2Fsystem%2Fcall-metrics");
    router.refresh();
  }

  return (
    <div className={styles.pageShell} data-testid="call-metrics-page-shell">
      <main className={styles.main}>
      <header className={styles.header}>
        <div><p className={styles.eyebrow}>Garden call portal</p><h1>テレマ コール集計ポータル</h1></div>
        <button type="button" className={styles.logout} onClick={() => void logout()}>ログアウト</button>
      </header>

      <form className={styles.filters} onSubmit={(event) => { event.preventDefault(); void load(); }}>
        <label>開始日<input type="date" value={from} onChange={(event) => setFrom(event.target.value)} required /></label>
        <label>終了日<input type="date" value={to} onChange={(event) => setTo(event.target.value)} required /></label>
        <label>リスト名<input value={listName} onChange={(event) => setListName(event.target.value)} placeholder="完全一致・任意" /></label>
        <label>従業員名<input value={employeeName} onChange={(event) => setEmployeeName(event.target.value)} placeholder="完全一致・任意" /></label>
        <button type="submit" disabled={loading}>{loading ? "集計中…" : "再集計"}</button>
      </form>

      {error && <p className={styles.error} role="alert">{error}</p>}
      {data && <>
        <p className={styles.period}>対象期間: {data.from}〜{data.to} ／ リスト数: {data.metrics.length} ／ コール数: {totalCalls.toLocaleString()}</p>
        <div className={styles.summaryBand} aria-label="対象期間の集計サマリー">
          <span>従業員数: {(summary?.employeeCount ?? 0).toLocaleString()} ／ 総コール数: {totalCalls.toLocaleString()}</span>
          <span>平均コール数: {(summary?.averageCalls ?? 0).toFixed(1)}</span>
          <span>有効率: {percent(summary?.effectiveRate ?? 0)}</span>
          <span>受注率: {percent(summary?.acquiredRate ?? 0)}（受注数 {(summary?.totalAcquired ?? 0).toLocaleString()}件）／前確OK率: {percent(summary?.preconfirmRate ?? 0)}（前確OK数 {(summary?.totalOrders ?? 0).toLocaleString()}件）</span>
          <span>最終更新: {formatJst(data.lastImportedAt)}</span>
        </div>
        <div className={styles.tabs} role="tablist" aria-label="集計表示">
          <button type="button" role="tab" aria-selected={activeTab === "employees"} onClick={() => setActiveTab("employees")}>従業員ごと</button>
          <button type="button" role="tab" aria-selected={activeTab === "lists"} onClick={() => setActiveTab("lists")}>リストごと</button>
          <button type="button" role="tab" aria-selected={activeTab === "definitions"} onClick={() => setActiveTab("definitions")}>定義方法</button>
        </div>

        {activeTab === "employees" && <section role="tabpanel">
          <h2>従業員ごとの指標</h2>
          <div className={`${styles.tableWrap} ${styles.stickyFirst}`}><table>
            <thead><tr><th>社員名</th><th>稼働時間</th><th>コール数</th><th>時間ごとコール</th><th>有効数</th><th>有効率</th><th>トス数</th><th>トス率</th><th>受注数</th><th>前確OK数</th><th>見込</th><th>担不</th><th>留守</th><th>無効</th></tr></thead>
            <tbody>{data.employeeMetrics.length ? data.employeeMetrics.map((row) => <tr key={row.employeeName}>
              <td>{row.employeeName}</td><td>{formatWorkTime(row.workSeconds)}</td><td>{row.callCount.toLocaleString()}</td><td>{callsPerWorkHour(row.callCount, row.workSeconds)?.toFixed(2) ?? "-"}</td><td>{row.effectiveCount.toLocaleString()}</td><td>{percent(row.effectiveRate)}</td><td className={row.tossCount === 0 ? styles.zeroValue : styles.strongValue}>{row.tossCount.toLocaleString()}</td><td>{percent(row.callCount ? row.tossCount / row.callCount : 0)}</td><td className={row.acquiredCount === 0 ? styles.zeroValue : styles.strongValue}>{row.acquiredCount.toLocaleString()}</td><td className={row.orderCount === 0 ? styles.zeroValue : styles.strongValue}>{row.orderCount.toLocaleString()}</td><td>{row.prospectCount.toLocaleString()}</td><td>{row.absentCount.toLocaleString()}</td><td>{row.awayCount.toLocaleString()}</td><td>{row.invalidCount.toLocaleString()}</td>
            </tr>) : <tr><td colSpan={14}>対象データがありません</td></tr>}</tbody>
          </table></div>
        </section>}

        {activeTab === "lists" && <section role="tabpanel">
          <h2>リストごとの指標</h2>
          <div className={`${styles.tableWrap} ${styles.stickyFirst}`}><table>
            <thead><tr><th>リスト名</th><th>コール数</th><th>有効数</th><th>有効率</th><th>トス数</th><th>トス率</th><th>受注数</th><th>受注率</th><th>前確OK数</th><th>前確OK率</th><th>リスト数</th><th>回転数</th><th>リスト受注率</th></tr></thead>
            <tbody>{data.metrics.length ? data.metrics.map((row) => <tr key={row.listName}>
              <td>{row.listName}</td><td>{row.callCount.toLocaleString()}</td><td>{row.effectiveCount.toLocaleString()}</td><td>{percent(row.effectiveRate)}</td><td>{row.tossCount.toLocaleString()}</td><td>{percent(row.callCount ? row.tossCount / row.callCount : 0)}</td><td>{row.acquiredCount.toLocaleString()}</td><td>{percent(row.callAcquiredRate)}</td><td>{row.orderCount.toLocaleString()}</td><td>{percent(row.callOrderRate)}</td><td className={styles.pending}>未取得</td><td className={styles.pending}>未取得</td><td className={styles.pending}>未取得</td>
            </tr>) : <tr><td colSpan={13}>対象データがありません</td></tr>}</tbody>
          </table></div>
        </section>}

        {activeTab === "definitions" && <section role="tabpanel">
          <h2>集計の定義</h2>
          <div className={`${styles.definitionTable} ${styles.definitionFit}`}><table>
            <thead><tr><th>指標</th><th>定義</th></tr></thead>
            <tbody>
              <tr><td>コール数</td><td>架電回数</td></tr>
              <tr><td>有効</td><td>会話できたコール。留守・無効・空白（無効扱い）を除きます。</td></tr>
              <tr><td>有効率</td><td>有効数 ÷ コール数</td></tr>
              <tr><td>トス数</td><td>結果フラグが「トス」のコール</td></tr>
              <tr><td>受注数</td><td>結果フラグが「獲得」のコール（コール履歴では「獲得」、ポータルでは「受注」と表示）</td></tr>
              <tr><td>前確OK数</td><td>結果フラグが「前確OK」のコール</td></tr>
              <tr><td>稼働時間</td><td>その日の最初のコールから最後のコールまでの時間から、休憩時間（下表）を引いた実働時間です。その休憩の時間帯をまたいで働いていた場合に、その休憩の長さをまるごと引きます（休憩中に架電していても、別の時間に同じ長さの休憩を取っているため引きます）。休憩の途中から働き始めた日・途中で終えた日は、その休憩は引きません。</td></tr>
              <tr><td>時間ごとコール</td><td>コール数 ÷ 稼働時間（時間）。1時間あたり何件かけたかです。</td></tr>
              <tr><td>見込</td><td>結果フラグが「見込」のコール</td></tr>
              <tr><td>担不</td><td>結果フラグが「担不」（担当者不在）のコール</td></tr>
              <tr><td>留守</td><td>結果フラグが「留守」のコール</td></tr>
              <tr><td>無効</td><td>結果フラグが「無効」のコール</td></tr>
              <tr><td>リスト絞り込み時の稼働時間</td><td>リストで絞り込んだ場合、稼働時間はそのリストを架電していた時間の幅になります。</td></tr>
              <tr><td>Excel集計表との差</td><td>※ 従来のExcel集計表は休憩を引いていないため、こちらの方が短く出ます。</td></tr>
              <tr><td>リスト数・回転数・リスト受注率</td><td>リストデータ取込後に対応</td></tr>
            </tbody>
          </table></div>
          <h2>休憩時間割</h2>
          <p className={styles.period}>★ 休憩の時間帯が変わったときは、この表と稼働時間の計算式を変更する必要のため、管理者へ問合せてください。</p>
          <div className={`${styles.definitionTable} ${styles.definitionFit}`}><table>
            <thead><tr><th>回</th><th>開始</th><th>終了</th><th>長さ</th></tr></thead>
            <tbody>
              {BREAKS.map((row, index) => <tr key={row.start}>
                <td>{index + 1}</td><td>{row.start}</td><td>{row.end}</td><td>{row.length}</td>
              </tr>)}
              <tr><td colSpan={3}>合計</td><td>2時間</td></tr>
            </tbody>
          </table></div>
          <h2>コール履歴のフラグ名 → ポータル表示名</h2>
          <div className={`${styles.definitionTable} ${styles.definitionFit}`}><table>
            <thead><tr><th>コール履歴</th><th>ポータル表示</th></tr></thead>
            <tbody><tr><td>獲得</td><td>受注数</td></tr><tr><td>前確OK</td><td>前確OK数</td></tr><tr><td>トス</td><td>トス数</td></tr></tbody>
          </table></div>
          <h2>結果フラグの扱い（分類ルール）</h2>
          <div className={`${styles.definitionTable} ${styles.definitionFit}`}><table>
            <thead><tr><th>結果フラグ</th><th>扱い</th></tr></thead>
            <tbody>{FLAG_RULES.map(([flag, handling]) => <tr key={flag}>
              <td>{flag}</td><td>{handling}</td>
            </tr>)}</tbody>
          </table></div>
        </section>}
      </>}
      </main>
    </div>
  );
}
