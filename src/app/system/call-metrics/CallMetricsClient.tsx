"use client";
import { useUrlTab } from "@/app/system/_components/SystemTabs/useUrlTab";
import { SystemViewHeading } from "@/app/system/_components/ViewPermissionButton/SystemViewContext";
import { SystemViewButton, useSystemView } from "@/app/system/_components/ViewPermissionButton/SystemViewContext";
import StickyTable from "@/app/system/_components/StickyTable/useStickyTable";
import UpdatedStamp, { UpdatedStampRow } from "@/app/system/_components/UpdatedStamp/UpdatedStamp";
import SystemTabs from "@/app/system/_components/SystemTabs/SystemTabs";

import { useEffect, useState } from "react";
import { CLARITY_MASK } from "@/app/_lib/clarity-mask";
import SystemBreadcrumb from "@/app/system/_components/SystemBreadcrumb/SystemBreadcrumb";
import type { CallMetricsResponse } from "../_lib/call-metrics";
import { defaultCallMetricDates, formatCallsPerWorkHour, formatWorkTime, summarizeCallMetrics } from "../_lib/call-metrics";
import { LP_FUNNEL_DEFINITIONS, LP_FUNNEL_FILTER_NOTE, LP_FUNNEL_LEAD_NOTE, LP_FUNNEL_START_NOTE, lpFunnelCalcNotes, lpFunnelHeaders, lpFunnelNoRecordList, lpFunnelTableA, lpFunnelTableB, lpFunnelTreeLinks, type LpFunnelViewRow } from "../_lib/lp-funnel-view";
import styles from "./call-metrics.module.css";

function formatJstDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const parts = new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")} ${get("hour")}:${get("minute")}:${get("second")}`;
}

// 表A・表B の共通の描き方：親は太字＋帯、子は罫線でつなぐ（縦の線が行をまたいでつながる）。率は太い区切り線の下（PDF と同じ・2026-10-15）
const TREE_STEP = 18;
function FunnelTable({ title, headers, rows }: { title: string; headers: string[]; rows: LpFunnelViewRow[] }) {
  const links = lpFunnelTreeLinks(rows);
  const firstRate = rows.findIndex((row) => row.kind === "rate");
  return <>
    <h2>{title}</h2>
    <div className={styles.tableWrap}><StickyTable>
      <thead><tr>{headers.map((header) => <th key={header}>{header}</th>)}</tr></thead>
      <tbody>{rows.map((row, index) => {
        const tree = row.kind === "node" || row.kind === "group";
        const level = tree ? row.level : 0;
        const rowClass = [
          tree && level === 0 ? styles.funnelTop : "",
          tree && level === 1 ? styles.funnelBranch : "",
          row.kind === "rate" ? styles.funnelRate : "",
          row.kind === "note" ? styles.funnelNote : "",
          index === firstRate ? styles.funnelRateStart : "",
        ].filter(Boolean).join(" ");
        const link = links[index];
        return <tr key={`${index}-${row.label}`} className={rowClass || undefined}>
          <td className={[styles.funnelLabel, "garden-cell-text"].join(" ")} style={{ paddingLeft: `${13 + level * TREE_STEP}px` }}>
            {tree && level > 0 ? <>
              {link.continues.map((on, depth) => on ? <span key={depth} aria-hidden className={styles.treeVert} style={{ left: `${13 + depth * TREE_STEP + 6}px` }}/> : null)}
              <span aria-hidden className={link.last ? `${styles.treeOwn} ${styles.treeLast}` : styles.treeOwn} style={{ left: `${13 + (level - 1) * TREE_STEP + 6}px` }}/>
            </> : null}
            {row.label}
          </td>
          {row.values.map((value, valueIndex) => <td key={valueIndex} className="garden-cell-number">{value}</td>)}
        </tr>;
      })}</tbody>
    </StickyTable></div>
  </>;
}

const percent = (value: number) => `${(value * 100).toFixed(1)}%`;
const maybeNumber = (value: number | null | undefined) => value == null ? "-" : value.toLocaleString("ja-JP");
const maybeTime = (value: number | null | undefined) => value == null ? "-" : formatWorkTime(value);
function formatJstTime(value: string | null | undefined) {
  if (!value) return "データなし";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "データなし";
  const parts = new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  return `${get("hour")}:${get("minute")}`;
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
  const defaults = defaultCallMetricDates();
  const [from, setFrom] = useState(defaults.from);
  const [to, setTo] = useState(defaults.to);
  const [listName, setListName] = useState("");
  const [employeeName, setEmployeeName] = useState("");
  const [data, setData] = useState<CallMetricsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { allowedTab } = useSystemView();
  const [requestedTab, setActiveTab] = useUrlTab<"employees" | "lists" | "definitions" | "webinbound">("employees", key => ["employees", "lists", "definitions", "webinbound"].includes(key) && allowedTab(key));
  const activeTab = allowedTab(requestedTab) ? requestedTab : (["employees", "lists", "definitions", "webinbound"] as const).find(key => allowedTab(key));

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
  const emptyRate = totalCalls === 0;

  return (
    <div className={styles.pageShell} data-testid="call-metrics-page-shell">
      <div className={styles.main}>
      <header className={styles.header}>
        <div><SystemBreadcrumb items={[{ label: "テレマ コール集計" }]} /><SystemViewHeading showActions={["employees", "lists", "definitions", "webinbound"].filter(key => allowedTab(key)).length <= 1} actions={<SystemViewButton tabKey={activeTab} />}><h1>テレマ コール集計</h1></SystemViewHeading></div>
      </header>
      {data && <UpdatedStampRow><UpdatedStamp label="コール履歴" date={data.lastImportedAt} emptyText="データなし" /></UpdatedStampRow>}

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
          <span>平均コール数: {emptyRate ? "-" : (summary?.averageCalls ?? 0).toFixed(1)}</span>
          <span>有効率: {emptyRate ? "-" : percent(summary?.effectiveRate ?? 0)}</span>
          <span>受注率: {emptyRate ? "-" : percent(summary?.acquiredRate ?? 0)}（受注数 {(summary?.totalAcquired ?? 0).toLocaleString()}件）／前確OK率: {emptyRate ? "-" : percent(summary?.preconfirmRate ?? 0)}（前確OK数 {(summary?.totalOrders ?? 0).toLocaleString()}件）</span>
          {data.innovera && <span className={data.innovera.stopped ? styles.warningText : undefined}>{data.innovera.stopped ? `INNOVERA 取込停止中（最終 ${formatJstTime(data.innovera.lastSyncAt)}）` : `INNOVERA 最終取込 ${formatJstTime(data.innovera.lastSyncAt)}`}</span>}
        </div>
        <SystemTabs aria-label="集計表示" actions={<SystemViewButton tabKey={activeTab} />}>
          {allowedTab("employees") && <button type="button" role="tab" aria-selected={activeTab === "employees"} onClick={() => setActiveTab("employees")}>従業員ごと</button>}
          {allowedTab("lists") && <button type="button" role="tab" aria-selected={activeTab === "lists"} onClick={() => setActiveTab("lists")}>リストごと</button>}
          {allowedTab("definitions") && <button type="button" role="tab" aria-selected={activeTab === "definitions"} onClick={() => setActiveTab("definitions")}>定義方法</button>}
          {allowedTab("webinbound") && <button type="button" role="tab" aria-selected={activeTab === "webinbound"} onClick={() => setActiveTab("webinbound")}>WEBインバウンド</button>}
        </SystemTabs>

        {activeTab === "webinbound" && <section role="tabpanel">
          <p className={styles.period}>{LP_FUNNEL_FILTER_NOTE}</p>
          {data.lpFunnel ? <>
            <FunnelTable title="対応（表A）" headers={lpFunnelHeaders(data.lpFunnel)} rows={lpFunnelTableA(data.lpFunnel)}/>
            <FunnelTable title="結果（表B）" headers={lpFunnelHeaders(data.lpFunnel)} rows={lpFunnelTableB(data.lpFunnel)}/>
            <p className={styles.period}>{LP_FUNNEL_LEAD_NOTE}</p>
            <h2>記録なし（kintone に登録の無い応答）</h2>
            <p className={styles.period}>着信に出たのに kintone に番号の一致する記録が無い問い合わせです。番号を確かめて kintone に登録してください。</p>
            <div className={styles.tableWrap}><StickyTable>
              <thead><tr><th>着信日時</th><th>発信元番号</th><th>応答した内線</th><th>事業</th></tr></thead>
              <tbody {...CLARITY_MASK}>{lpFunnelNoRecordList(data.lpFunnel).length ? lpFunnelNoRecordList(data.lpFunnel).map((item) => <tr key={`${item.startTime}-${item.number}`}>
                <td className="garden-cell-fixed">{formatJstDateTime(item.startTime)}</td><td className="garden-cell-fixed">{item.number}</td><td className="garden-cell-fixed">{item.extension ?? "-"}</td><td className="garden-cell-text">{item.bizName}</td>
              </tr>) : <tr><td colSpan={4} className="garden-cell-text">記録なしはありません</td></tr>}</tbody>
            </StickyTable></div>
            {lpFunnelCalcNotes(data.lpFunnel).map((note) => <p className={styles.note} key={note}>{note}</p>)}
            <p className={styles.period}>{LP_FUNNEL_START_NOTE}</p>
          </> : <p className={styles.note}>WEBインバウンドの対応と結果を取得できませんでした（LP系の範囲〈kintone 事業マスタ〉を読めなかったときはここが空になります）。</p>}
        </section>}

        {activeTab === "employees" && <section role="tabpanel">
          <h2>従業員ごとの指標</h2>
          <div className={`${styles.tableWrap} ${styles.stickyFirst}`}><StickyTable>
            <thead><tr><th colSpan={15}>テレマ</th><th colSpan={4} className={styles.lpStart}>WEBインバウンド（LP系）</th></tr><tr><th>社員名</th><th>稼働時間</th><th>通話時間</th><th>コール数</th><th>コール数/h</th><th>有効数</th><th>有効率</th><th>トス数</th><th>トス率</th><th>受注数</th><th>前確OK数</th><th>見込</th><th>担不</th><th>留守</th><th>無効</th><th className={styles.lpStart}>LP応答</th><th>LP発信</th><th>LP通話時間</th><th>LP申込み</th></tr></thead>
            <tbody {...CLARITY_MASK}>{data.employeeMetrics.length ? data.employeeMetrics.map((row) => {
              // 「（内線未登録）n席」の行は FileMaker 由来の列を「-」にする（§5.5.2）
              const unregistered = row.employeeName.startsWith("（内線未登録）");
              const fm = (value: string) => unregistered ? "-" : value;
              const tone = (value: number) => unregistered ? undefined : value === 0 ? styles.zeroValue : styles.strongValue;
              return <tr key={row.employeeName}>
              <td title={row.unregisteredExtensionDetails?.join("、")} className="garden-cell-text">{row.employeeName}</td><td className="garden-cell-number">{fm(formatWorkTime(row.workSeconds))}</td><td className="garden-cell-number">{maybeTime(row.talkSecondsOther)}</td><td className="garden-cell-number">{fm(row.callCount.toLocaleString())}</td><td className="garden-cell-number">{fm(formatCallsPerWorkHour(row.callCount, row.workSeconds))}</td><td className="garden-cell-number">{fm(row.effectiveCount.toLocaleString())}</td><td className="garden-cell-number">{fm(percent(row.effectiveRate))}</td><td className={[tone(row.tossCount), "garden-cell-number"].join(" ")}>{fm(row.tossCount.toLocaleString())}</td><td className="garden-cell-number">{fm(percent(row.callCount ? row.tossCount / row.callCount : 0))}</td><td className={[tone(row.acquiredCount), "garden-cell-number"].join(" ")}>{fm(row.acquiredCount.toLocaleString())}</td><td className={[tone(row.orderCount), "garden-cell-number"].join(" ")}>{fm(row.orderCount.toLocaleString())}</td><td className="garden-cell-number">{fm(row.prospectCount.toLocaleString())}</td><td className="garden-cell-number">{fm(row.absentCount.toLocaleString())}</td><td className="garden-cell-number">{fm(row.awayCount.toLocaleString())}</td><td className="garden-cell-number">{fm(row.invalidCount.toLocaleString())}</td><td className={[styles.lpStart, "garden-cell-number"].join(" ")}>{maybeNumber(row.lpAnswered)}</td><td className="garden-cell-number">{maybeNumber(row.lpOutbound)}</td><td className="garden-cell-number">{maybeTime(row.lpTalkSeconds)}</td><td className="garden-cell-number">{maybeNumber(row.lpApplications)}</td>
            </tr>; }) : <tr><td colSpan={19} className="garden-cell-text">対象データがありません</td></tr>}</tbody>
          </StickyTable></div>
          {data.listName && <p className={styles.period}>リスト名で絞り込んだ場合も、通話時間と WEBインバウンド（LP系）はリスト名では絞り込みません。</p>}
          <h2>事業別の小計</h2>
          <div className={styles.tableWrap}><StickyTable>
            <thead><tr><th>事業</th><th>着信</th><th>応答</th><th>不在</th><th>留守電</th><th>発信</th><th>発信の応答</th><th>通話時間</th><th>申込み</th></tr></thead>
            <tbody>{[...(data.lp?.businesses ?? []), ...(data.lp?.totals ? [data.lp.totals] : [])].map((row) => <tr key={row.bizCode}>
              <td className="garden-cell-text">{row.bizName}</td><td className="garden-cell-number">{maybeNumber(row.inbound)}</td><td className="garden-cell-number">{maybeNumber(row.answered)}</td><td className="garden-cell-number">{maybeNumber(row.missed)}</td><td className="garden-cell-number">{maybeNumber(row.voicemail)}</td><td className="garden-cell-number">{maybeNumber(row.outbound)}</td><td className="garden-cell-number">{maybeNumber(row.outboundAnswered)}</td><td className="garden-cell-number">{maybeTime(row.talkSeconds)}</td><td className="garden-cell-number">{maybeNumber(row.applications)}{row.unassignedApplications ? `（うち担当者未設定 ${row.unassignedApplications}）` : ""}</td>
            </tr>)}</tbody>
          </StickyTable></div>
          {data.lp?.unregisteredExtensionSummary && <p className={styles.period}>{data.lp.unregisteredExtensionSummary}</p>}
          {data.lp?.notes.map((note) => <p className={styles.note} key={note}>{note}</p>)}
        </section>}

        {activeTab === "lists" && <section role="tabpanel">
          <h2>リストごとの指標</h2>
          <div className={`${styles.tableWrap} ${styles.stickyFirst}`}><StickyTable>
            <thead><tr><th>リスト名</th><th>コール数</th><th>有効数</th><th>有効率</th><th>トス数</th><th>トス率</th><th>受注数</th><th>受注率</th><th>前確OK数</th><th>前確OK率</th><th>リスト数</th><th>回転数</th><th>リスト受注率</th></tr></thead>
            <tbody>{data.metrics.length ? data.metrics.map((row) => <tr key={row.listName}>
              <td className="garden-cell-text">{row.listName}</td><td className="garden-cell-number">{row.callCount.toLocaleString()}</td><td className="garden-cell-number">{row.effectiveCount.toLocaleString()}</td><td className="garden-cell-number">{percent(row.effectiveRate)}</td><td className="garden-cell-number">{row.tossCount.toLocaleString()}</td><td className="garden-cell-number">{percent(row.callCount ? row.tossCount / row.callCount : 0)}</td><td className="garden-cell-number">{row.acquiredCount.toLocaleString()}</td><td className="garden-cell-number">{percent(row.callAcquiredRate)}</td><td className="garden-cell-number">{row.orderCount.toLocaleString()}</td><td className="garden-cell-number">{percent(row.callOrderRate)}</td><td className={[styles.pending, "garden-cell-number"].join(" ")}>未取得</td><td className={[styles.pending, "garden-cell-number"].join(" ")}>未取得</td><td className={[styles.pending, "garden-cell-number"].join(" ")}>未取得</td>
            </tr>) : <tr><td colSpan={13} className="garden-cell-text">対象データがありません</td></tr>}</tbody>
          </StickyTable></div>
        </section>}

        {activeTab === "definitions" && <section role="tabpanel">
          <h2>集計の定義</h2>
          <div className={`${styles.definitionTable} ${styles.definitionFit}`}><StickyTable>
            <thead><tr><th>指標</th><th>定義</th></tr></thead>
            <tbody>
              <tr><td className="garden-cell-text">コール数</td><td className="garden-cell-text">架電回数</td></tr>
              <tr><td className="garden-cell-text">有効</td><td className="garden-cell-text">会話できたコール。留守・無効・空白（無効扱い）を除きます。</td></tr>
              <tr><td className="garden-cell-text">有効率</td><td className="garden-cell-text">有効数 ÷ コール数</td></tr>
              <tr><td className="garden-cell-text">トス数</td><td className="garden-cell-text">結果フラグが「トス」のコール</td></tr>
              <tr><td className="garden-cell-text">受注数</td><td className="garden-cell-text">結果フラグが「獲得」のコール（コール履歴では「獲得」、ポータルでは「受注」と表示）</td></tr>
              <tr><td className="garden-cell-text">前確OK数</td><td className="garden-cell-text">結果フラグが「前確OK」のコール</td></tr>
              <tr><td className="garden-cell-text">受注率</td><td className="garden-cell-text">受注数 ÷ 有効数（2026-10-09 から。以前は総コール数で割っていました）</td></tr>
              <tr><td className="garden-cell-text">前確OK率</td><td className="garden-cell-text">前確OK数 ÷ 受注数。受注が 0 件の日は 0％（2026-10-09 から。以前は総コール数で割っていました）</td></tr>
              <tr><td className="garden-cell-text">稼働時間</td><td className="garden-cell-text">その日の最初のコールから最後のコールまでの時間から、休憩時間（下表）を引いた実働時間です。その休憩の時間帯をまたいで働いていた場合に、その休憩の長さをまるごと引きます（休憩中に架電していても、別の時間に同じ長さの休憩を取っているため引きます）。休憩の途中から働き始めた日・途中で終えた日は、その休憩は引きません。</td></tr>
              <tr><td className="garden-cell-text">コール数/h</td><td className="garden-cell-text">コール数 ÷ 稼働時間（時間）。1時間あたり何件かけたかです。</td></tr>
              <tr><td className="garden-cell-text">見込</td><td className="garden-cell-text">結果フラグが「見込」のコール</td></tr>
              <tr><td className="garden-cell-text">担不</td><td className="garden-cell-text">結果フラグが「担不」（担当者不在）のコール</td></tr>
              <tr><td className="garden-cell-text">留守</td><td className="garden-cell-text">結果フラグが「留守」のコール</td></tr>
              <tr><td className="garden-cell-text">無効</td><td className="garden-cell-text">結果フラグが「無効」のコール</td></tr>
              <tr><td className="garden-cell-text">リスト絞り込み時の稼働時間</td><td className="garden-cell-text">リストで絞り込んだ場合、稼働時間はそのリストを架電していた時間の幅になります。</td></tr>
              <tr><td className="garden-cell-text">Excel集計表との差</td><td className="garden-cell-text">※ 従来のExcel集計表は休憩を引いていないため、こちらの方が短く出ます。</td></tr>
              <tr><td className="garden-cell-text">リスト数・回転数・リスト受注率</td><td className="garden-cell-text">リストデータ取込後に対応</td></tr>
            </tbody>
          </StickyTable></div>
          <h2>休憩時間割</h2>
          <p className={styles.period}>※ 休憩の時間帯が変わったときは、この表と稼働時間の計算式を変更する必要のため、管理者へ問合せてください。</p>
          <div className={`${styles.definitionTable} ${styles.definitionFit}`}><StickyTable>
            <thead><tr><th>回</th><th>開始</th><th>終了</th><th>長さ</th></tr></thead>
            <tbody>
              {BREAKS.map((row, index) => <tr key={row.start}>
                <td className="garden-cell-fixed">{index + 1}</td><td className="garden-cell-fixed">{row.start}</td><td className="garden-cell-fixed">{row.end}</td><td className="garden-cell-number">{row.length}</td>
              </tr>)}
              <tr><td colSpan={3} className="garden-cell-text">合計</td><td className="garden-cell-number">2時間</td></tr>
            </tbody>
          </StickyTable></div>
          <h2>コール履歴のフラグ名 → ポータル表示名</h2>
          <div className={`${styles.definitionTable} ${styles.definitionFit}`}><StickyTable>
            <thead><tr><th>コール履歴</th><th>ポータル表示</th></tr></thead>
            <tbody><tr><td className="garden-cell-text">獲得</td><td className="garden-cell-text">受注数</td></tr><tr><td className="garden-cell-text">前確OK</td><td className="garden-cell-text">前確OK数</td></tr><tr><td className="garden-cell-text">トス</td><td className="garden-cell-text">トス数</td></tr></tbody>
          </StickyTable></div>
          <h2>結果フラグの扱い（分類ルール）</h2>
          <div className={`${styles.definitionTable} ${styles.definitionFit}`}><StickyTable>
            <thead><tr><th>結果フラグ</th><th>扱い</th></tr></thead>
            <tbody>{FLAG_RULES.map(([flag, handling]) => <tr key={flag}>
              <td className="garden-cell-text">{flag}</td><td className="garden-cell-text">{handling}</td>
            </tr>)}</tbody>
          </StickyTable></div>
          <h2>通話時間と WEBインバウンド（LP系）</h2>
          <div className={`${styles.definitionTable} ${styles.definitionFit}`}><StickyTable>
            <thead><tr><th>指標</th><th>定義</th></tr></thead>
            <tbody>
              <tr><td className="garden-cell-text">通話時間</td><td className="garden-cell-text">INNOVERA の通話秒数を従業員ごとに合計します。テレマ側に通話がなく、INNOVERA にも該当がない場合は「-」です。</td></tr>
              <tr><td className="garden-cell-text">LP応答</td><td className="garden-cell-text">稼働中の LP 系回線への着信のうち、応答した件数です。</td></tr>
              <tr><td className="garden-cell-text">LP発信</td><td className="garden-cell-text">稼働中の LP 系回線からの発信件数です。</td></tr>
              <tr><td className="garden-cell-text">LP通話時間</td><td className="garden-cell-text">LP 系回線の着信・発信の通話時間合計です。</td></tr>
              <tr><td className="garden-cell-text">LP申込み</td><td className="garden-cell-text">kintone の LP 顧客アプリで、対応状況が「申込み」かつ作成日時が対象期間内の件数です。</td></tr>
            </tbody>
          </StickyTable></div>
          <h2>WEBインバウンドの対応と結果</h2>
          <div className={`${styles.definitionTable} ${styles.definitionFit}`}><StickyTable>
            <thead><tr><th>項目</th><th>定義</th></tr></thead>
            <tbody>{LP_FUNNEL_DEFINITIONS.map(([item, definition]) => <tr key={item}>
              <td className="garden-cell-text">{item}</td><td className="garden-cell-text">{definition}</td>
            </tr>)}</tbody>
          </StickyTable></div>
        </section>}
      </>}
      </div>
    </div>
  );
}
