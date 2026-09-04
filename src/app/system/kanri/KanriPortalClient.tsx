"use client";

import { useEffect, useMemo, useState } from "react";
import {
  isMonthEnd,
  monthRange,
  type KanriMode,
  type KanriSummary,
  type KanriWarning,
  weekdayJa,
} from "./_lib/kanri-core";
import type { KanriManualInputs, KanriSheetGrid } from "./_lib/calc/kanri-sheet";
import styles from "./kanri.module.css";

export type KanriRunView = {
  id: string;
  target_date: string;
  mode: KanriMode;
  creator_name: string;
  status: string;
  summary: KanriSummary | null;
  warnings: KanriWarning[] | null;
  started_at: string | null;
  finished_at: string | null;
  created_at: string;
};

type Props = {
  creatorName: string;
  today: string;
  initialRuns: KanriRunView[];
  initialHolidays: string[];
  initialProducts: string[];
  initialTeams: string[];
};

type RunResponse = {
  ok?: boolean;
  runId?: string;
  status?: string;
  summary?: KanriSummary;
  warnings?: KanriWarning[];
  error?: string;
  runs?: KanriRunView[];
  setting?: { holidays?: string[] };
  inputs?: KanriManualInputs;
  grid?: KanriSheetGrid;
  result?: { grid?: KanriSheetGrid };
};

export function nextModeForDate(targetDate: string, currentMode: KanriMode) {
  return isMonthEnd(targetDate) ? "closing" : currentMode;
}

function formatDate(date: string) {
  const [, month, day] = date.split("-").map(Number);
  return `${month}月${day}日（${weekdayJa(date)}）`;
}

function formatDateTime(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function statusLabel(status: string) {
  if (status === "fetched") return "取り込み完了";
  if (status === "failed") return "取り込み失敗";
  if (status === "fetching") return "取り込み中";
  return "準備中";
}

function modeLabel(mode: KanriMode) {
  return mode === "closing" ? "締めチェック" : "デイリー";
}

function creditBreakdown(summary: KanriSummary) {
  const apps = summary.credit_card.apps ?? {};
  const parts = Object.entries(apps).filter(([, count]) => count > 0).map(([app, count]) => `${app} ${count}`);
  return parts.length ? `（内訳: ${parts.join(" / ")}）` : "";
}

function emptyInputs(): KanriManualInputs {
  return { hoursByTeamByDate: {}, openRateByTeamByProduct: {} };
}

function formatNumber(value: number | null | undefined, digits = 0) {
  if (value === null || value === undefined) return "—";
  return new Intl.NumberFormat("ja-JP", { maximumFractionDigits: digits, minimumFractionDigits: digits }).format(value);
}

function formatRate(value: number | null | undefined) {
  if (value === null || value === undefined) return "—";
  return `${formatNumber(value * 100, 1)}%`;
}

function inputValue(inputs: KanriManualInputs, team: string, date: string) {
  return inputs.hoursByTeamByDate[team]?.[date] ?? "";
}

function rateValue(inputs: KanriManualInputs, team: string, product: string) {
  return inputs.openRateByTeamByProduct[team]?.[product] ?? "";
}

async function readJson(response: Response): Promise<RunResponse> {
  try {
    return await response.json() as RunResponse;
  } catch {
    return {};
  }
}

export default function KanriPortalClient({ creatorName, today, initialRuns, initialHolidays, initialProducts, initialTeams }: Props) {
  const [targetDate, setTargetDate] = useState(today);
  const [mode, setMode] = useState<KanriMode>(isMonthEnd(today) ? "closing" : "daily");
  const [runs, setRuns] = useState(initialRuns);
  const [latest, setLatest] = useState<KanriRunView | null>(initialRuns[0] ?? null);
  const [holidays, setHolidays] = useState<string[]>(initialHolidays);
  const [message, setMessage] = useState("");
  const [inputs, setInputs] = useState<KanriManualInputs>(emptyInputs());
  const [grid, setGrid] = useState<KanriSheetGrid | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [calculating, setCalculating] = useState(false);
  const range = useMemo(() => monthRange(targetDate), [targetDate]);
  const dayCount = Number(range.end.slice(-2));
  const monthDays = useMemo(() => Array.from({ length: dayCount }, (_, index) => {
    const day = index + 1;
    const date = `${range.yearMonth}-${String(day).padStart(2, "0")}`;
    return { day, date, label: `${Number(range.yearMonth.slice(5))}/${day}（${weekdayJa(date)}）` };
  }), [dayCount, range.yearMonth]);

  async function refreshRuns() {
    const response = await fetch("/api/system/kanri/runs?limit=10");
    const json = await readJson(response);
    if (response.ok && json.runs) {
      setRuns(json.runs);
      setLatest(json.runs[0] ?? null);
    }
  }

  async function loadMonthSetting(nextDate: string) {
    const nextMonth = monthRange(nextDate).yearMonth;
    const response = await fetch(`/api/system/kanri/month-settings/${nextMonth}`);
    const json = await readJson(response);
    if (response.ok) setHolidays(json.setting?.holidays ?? []);
  }

  async function loadInputs(nextYearMonth: string) {
    const response = await fetch(`/api/system/kanri/inputs/${nextYearMonth}`);
    const json = await readJson(response);
    if (response.ok) setInputs(json.inputs ?? emptyInputs());
  }

  async function loadResult(runId: string) {
    const response = await fetch(`/api/system/kanri/runs/${runId}/result?sheet=kanri`);
    const json = await readJson(response);
    if (response.ok && json.result?.grid) setGrid(json.result.grid);
  }

  useEffect(() => {
    void loadInputs(range.yearMonth);
  }, [range.yearMonth]);

  useEffect(() => {
    if (latest?.id) void loadResult(latest.id);
  }, [latest?.id]);

  function changeDate(nextDate: string) {
    setTargetDate(nextDate);
    setMode((current) => nextModeForDate(nextDate, current));
    if (monthRange(nextDate).yearMonth !== range.yearMonth) {
      void loadMonthSetting(nextDate);
      void loadInputs(monthRange(nextDate).yearMonth);
    }
  }

  async function importData() {
    setLoading(true);
    setMessage("");
    try {
      const response = await fetch("/api/system/kanri/runs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetDate, mode }),
      });
      const json = await readJson(response);
      if (!response.ok || !json.summary) {
        setMessage(json.error ?? "取り込みを完了できませんでした。時間をおいてもう一度試してください。");
        return;
      }
      setLatest({
        id: String(json.runId),
        target_date: targetDate,
        mode,
        creator_name: creatorName,
        status: String(json.status),
        summary: json.summary,
        warnings: json.warnings ?? [],
        started_at: null,
        finished_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
      });
      await refreshRuns();
      await loadInputs(range.yearMonth);
    } finally {
      setLoading(false);
    }
  }

  function toggleHoliday(day: number) {
    const date = `${range.yearMonth}-${String(day).padStart(2, "0")}`;
    setHolidays((current) => current.includes(date)
      ? current.filter((item) => item !== date)
      : [...current, date].sort());
  }

  async function saveHolidays() {
    setSaving(true);
    setMessage("");
    try {
      const response = await fetch(`/api/system/kanri/month-settings/${range.yearMonth}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ holidays }),
      });
      const json = await readJson(response);
      if (!response.ok) setMessage(json.error ?? "定休日を保存できませんでした。");
      else setHolidays(json.setting?.holidays ?? holidays);
    } finally {
      setSaving(false);
    }
  }

  function updateHour(team: string, date: string, value: string) {
    const number = value === "" ? 0 : Number(value);
    if (!Number.isFinite(number)) return;
    setInputs((current) => ({
      ...current,
      hoursByTeamByDate: {
        ...current.hoursByTeamByDate,
        [team]: { ...(current.hoursByTeamByDate[team] ?? {}), [date]: number },
      },
    }));
  }

  function updateRate(team: string, product: string, value: string) {
    const number = value === "" ? 0 : Number(value);
    if (!Number.isFinite(number)) return;
    setInputs((current) => ({
      ...current,
      openRateByTeamByProduct: {
        ...current.openRateByTeamByProduct,
        [team]: { ...(current.openRateByTeamByProduct[team] ?? {}), [product]: number },
      },
    }));
  }

  async function saveInputs() {
    setSaving(true);
    setMessage("");
    try {
      const response = await fetch(`/api/system/kanri/inputs/${range.yearMonth}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inputs }),
      });
      const json = await readJson(response);
      if (!response.ok) setMessage(json.error ?? "入力値を保存できませんでした。");
      else setInputs(json.inputs ?? inputs);
    } finally {
      setSaving(false);
    }
  }

  async function calculateSheet() {
    if (!latest?.id) {
      setMessage("先にデータを取り込んでください。");
      return;
    }
    setCalculating(true);
    setMessage("");
    try {
      const response = await fetch(`/api/system/kanri/runs/${latest.id}/calculate`, { method: "POST" });
      const json = await readJson(response);
      if (!response.ok || !json.grid) setMessage(json.error ?? "計算できませんでした。");
      else setGrid(json.grid);
    } finally {
      setCalculating(false);
    }
  }

  const selectedHolidayText = holidays.map((date) => `${Number(date.slice(-2))}日`).join(", ") || "未選択";

  return <div className={styles.pageShell}>
    <header className={styles.header}>
      <p className={styles.eyebrow}>System / 管理表ポータル</p>
      <h1>管理表ポータル</h1>
    </header>

    <section className={styles.panel}>
      <p className={styles.greeting}>お疲れ様です。{formatDate(targetDate)}の管理表を {creatorName} が作成します。</p>
      <div className={styles.controls}>
        <label>対象日<input type="date" value={targetDate} onChange={(event) => changeDate(event.target.value)} /></label>
        <fieldset>
          <legend>種類</legend>
          <label><input type="radio" name="kanri-mode" checked={mode === "daily"} onChange={() => setMode("daily")} />デイリー</label>
          <label><input type="radio" name="kanri-mode" checked={mode === "closing"} onChange={() => setMode("closing")} />締めチェック</label>
        </fieldset>
      </div>
      <p className={styles.hint}>月末日を選ぶと自動で「締めチェック」に切り替わります。</p>
      <button className={styles.primary} type="button" disabled={loading} onClick={() => void importData()}>
        {loading ? "取り込んでいます" : "データを取り込む"}
      </button>
    </section>

    <section className={styles.panel}>
      <h2>稼働時間と開通率</h2>
      <div className={styles.monthHeader}>{range.yearMonth.replace("-", "年")}月</div>
      <div className={styles.inputScroller}>
        <table className={styles.inputTable}>
          <thead>
            <tr>
              <th>日</th>
              {initialTeams.map((team) => <th key={team}>{team} h</th>)}
            </tr>
          </thead>
          <tbody>
            {monthDays.map((day) => <tr key={day.date}>
              <th>{holidays.includes(day.date) ? "定休日" : day.label}</th>
              {initialTeams.map((team) => <td key={`${team}-${day.date}`}>
                <input type="number" step="0.1" value={inputValue(inputs, team, day.date)} onChange={(event) => updateHour(team, day.date, event.target.value)} />
              </td>)}
            </tr>)}
          </tbody>
        </table>
      </div>
      <div className={styles.inputScroller}>
        <table className={styles.inputTable}>
          <thead>
            <tr>
              <th>チーム</th>
              {initialProducts.map((product) => <th key={product}>{product}</th>)}
            </tr>
          </thead>
          <tbody>
            {initialTeams.map((team) => <tr key={team}>
              <th>{team}</th>
              {initialProducts.map((product) => <td key={`${team}-${product}`}>
                <input type="number" step="0.01" value={rateValue(inputs, team, product)} onChange={(event) => updateRate(team, product, event.target.value)} />
              </td>)}
            </tr>)}
          </tbody>
        </table>
      </div>
      <button className={styles.secondary} type="button" disabled={saving} onClick={() => void saveInputs()}>{saving ? "保存しています" : "保存"}</button>
    </section>

    {message && <p className={styles.message} role="status">{message}</p>}

    <section className={styles.panel}>
      <h2>取り込みの結果（最新）</h2>
      {latest?.summary ? <>
        <div className={styles.resultMeta}>
          <span>状態: {statusLabel(latest.status)}</span>
          <span>{formatDateTime(latest.finished_at ?? latest.created_at)}</span>
          <span>作成者: {latest.creator_name}</span>
        </div>
        <dl className={styles.summaryList}>
          <div><dt>{latest.summary.kintone_customer.label}</dt><dd>{latest.summary.kintone_customer.count}{latest.summary.kintone_customer.unit}</dd></div>
          <div><dt>{latest.summary.kanden_report.label}</dt><dd>{latest.summary.kanden_report.count}{latest.summary.kanden_report.unit}</dd></div>
          <div><dt>{latest.summary.credit_card.label}</dt><dd>{latest.summary.credit_card.count}{latest.summary.credit_card.unit}{creditBreakdown(latest.summary)}</dd></div>
          <div><dt>{latest.summary.roster.label}</dt><dd>{latest.summary.roster.count}{latest.summary.roster.unit}</dd></div>
        </dl>
        <div className={styles.warningBlock}>
          <h3>注意（{latest.warnings?.length ?? 0}件）</h3>
          <p>出せますが、翌日に確認してください</p>
          {(latest.warnings?.length ?? 0) > 0 && <ul>{latest.warnings?.map((warning, index) => <li key={`${warning.code}-${index}`}>{warning.message}</li>)}</ul>}
        </div>
      </> : <p className={styles.empty}>まだ取り込み結果がありません。</p>}
    </section>

    <section className={styles.panel}>
      <div className={styles.sectionHeader}>
        <h2>管理表（計算結果）</h2>
        <button className={styles.primaryInline} type="button" disabled={calculating} onClick={() => void calculateSheet()}>{calculating ? "計算しています" : "計算する"}</button>
      </div>
      <p className={styles.hint}>最新の取り込みをもとに計算します。</p>
      {grid ? <div className={styles.resultScroller}>
        <table className={styles.resultTable}>
          <thead>
            <tr>
              <th className={styles.stickyCell}>日</th>
              <th>全体 h</th>
              <th>全体 率</th>
              <th>全体 合計</th>
              {grid.teams.flatMap((team) => [
                <th key={`${team}-h`}>{team} h</th>,
                <th key={`${team}-rate`}>{team} 率</th>,
                <th key={`${team}-total`}>{team} 合計</th>,
                ...grid.products.map((product) => <th key={`${team}-${product}`}>{product}</th>),
              ])}
            </tr>
          </thead>
          <tbody>
            <tr className={styles.totalRow}>
              <th className={styles.stickyCell}>実数</th>
              <td>{formatNumber(grid.totals.all.hours, 1)}</td>
              <td>{formatRate(grid.totals.all.efficiency)}</td>
              <td>{formatNumber(grid.totals.all.total)}</td>
              {grid.teams.flatMap((team) => [
                <td key={`total-${team}-h`}>{formatNumber(grid.totals.teams[team].hours, 1)}</td>,
                <td key={`total-${team}-rate`}>{formatRate(grid.totals.teams[team].efficiency)}</td>,
                <td key={`total-${team}-total`}>{formatNumber(grid.totals.teams[team].total)}</td>,
                ...grid.products.map((product) => <td key={`total-${team}-${product}`}>{formatNumber(grid.totals.teams[team].products[product])}</td>),
              ])}
            </tr>
            <tr className={styles.totalRow}>
              <th className={styles.stickyCell}>ポイント</th>
              <td>—</td>
              <td>{formatNumber(grid.totals.all.pointEfficiency, 1)}</td>
              <td>{formatNumber(grid.totals.all.points, 1)}</td>
              {grid.teams.flatMap((team) => [
                <td key={`points-${team}-h`}>—</td>,
                <td key={`points-${team}-rate`}>{formatNumber(grid.totals.teams[team].hours === 0 ? null : grid.totals.teams[team].points / grid.totals.teams[team].hours, 1)}</td>,
                <td key={`points-${team}-total`}>{formatNumber(grid.totals.teams[team].points, 1)}</td>,
                ...grid.products.map((product) => <td key={`points-${team}-${product}`}>{formatNumber(grid.totals.teams[team].pointsByProduct[product], 1)}</td>),
              ])}
            </tr>
            <tr className={styles.totalRow}>
              <th className={styles.stickyCell}>額</th>
              <td>{formatNumber(grid.totals.all.amountPerHour)}</td>
              <td>—</td>
              <td>{formatNumber(grid.totals.all.amount)}</td>
              {grid.teams.flatMap((team) => [
                <td key={`amount-${team}-h`}>{formatNumber(grid.totals.teams[team].hours === 0 ? null : grid.totals.teams[team].amount / grid.totals.teams[team].hours)}</td>,
                <td key={`amount-${team}-rate`}>—</td>,
                <td key={`amount-${team}-total`}>{formatNumber(grid.totals.teams[team].amount)}</td>,
                ...grid.products.map((product) => <td key={`amount-${team}-${product}`}>{formatNumber(grid.totals.teams[team].amountByProduct[product])}</td>),
              ])}
            </tr>
            {grid.days.map((day) => <tr key={day.date}>
              <th className={styles.stickyCell}>{day.day === "定休日" ? "定休日" : `${Number(day.date.slice(5, 7))}/${Number(day.date.slice(8, 10))}（${day.weekday}）`}</th>
              <td>{formatNumber(day.all.hours, 1)}</td>
              <td>{formatRate(day.all.efficiency)}</td>
              <td>{formatNumber(day.all.total)}</td>
              {grid.teams.flatMap((team) => [
                <td key={`${day.date}-${team}-h`}>{formatNumber(day.teams[team].hours, 1)}</td>,
                <td key={`${day.date}-${team}-rate`}>{formatRate(day.teams[team].efficiency)}</td>,
                <td key={`${day.date}-${team}-total`}>{formatNumber(day.teams[team].total)}</td>,
                ...grid.products.map((product) => <td key={`${day.date}-${team}-${product}`}>{formatNumber(day.teams[team].products[product])}</td>),
              ])}
            </tr>)}
          </tbody>
        </table>
      </div> : <p className={styles.empty}>まだ計算結果がありません。</p>}
    </section>

    <section className={styles.panel}>
      <h2>今月の定休日</h2>
      <div className={styles.monthHeader}>{range.yearMonth.replace("-", "年")}月 <span>選んだ日: {selectedHolidayText}</span></div>
      <div className={styles.calendar} aria-label="定休日">
        {Array.from({ length: dayCount }, (_, index) => index + 1).map((day) => {
          const date = `${range.yearMonth}-${String(day).padStart(2, "0")}`;
          return <button key={date} type="button" aria-pressed={holidays.includes(date)} onClick={() => toggleHoliday(day)}>{day}</button>;
        })}
      </div>
      <button className={styles.secondary} type="button" disabled={saving} onClick={() => void saveHolidays()}>{saving ? "保存しています" : "保存"}</button>
    </section>

    <section className={styles.history}>
      <h2>過去の取り込み（直近10件）</h2>
      {runs.length > 0 ? <ul>{runs.map((run) => <li key={run.id}>
        <span>{formatDateTime(run.finished_at ?? run.created_at)}</span>
        <span>{modeLabel(run.mode)}</span>
        <span>{run.creator_name}</span>
        <span>{statusLabel(run.status)}</span>
      </li>)}</ul> : <p className={styles.empty}>履歴はまだありません。</p>}
    </section>
  </div>;
}
