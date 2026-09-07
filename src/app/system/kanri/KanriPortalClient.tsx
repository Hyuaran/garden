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
import type { JissekiSheetGrid, KanriPerson } from "./_lib/calc/jisseki-sheet";
import { HOUHAN_PRODUCTS, type HouhanSheetGrid } from "./_lib/calc/houhan-sheet";
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
  initialPeople: KanriPerson[];
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
  jisseki?: JissekiSheetGrid;
  houhan?: HouhanSheetGrid;
  result?: { grid?: KanriSheetGrid };
  people?: KanriPerson[];
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

function personInputValue(inputs: KanriManualInputs, person: string, key: "landingHours" | "workHours" | "workDays" | "fieldPoints") {
  return inputs.personMonthly?.[person]?.[key] ?? "";
}

function fieldSalesDayValue(inputs: KanriManualInputs, person: string, date: string, key: "status" | "hours" | "rental" | "sales") {
  return inputs.fieldSales?.byPerson?.[person]?.days?.[date]?.[key] ?? "";
}

function fieldSalesWeightValue(inputs: KanriManualInputs, product: string, fallback: number) {
  return inputs.fieldSales?.weights?.[product] ?? inputs.monthlySettings?.fieldSalesWeights?.[product] ?? fallback;
}

async function readJson(response: Response): Promise<RunResponse> {
  try {
    return await response.json() as RunResponse;
  } catch {
    return {};
  }
}

export default function KanriPortalClient({ creatorName, today, initialRuns, initialHolidays, initialProducts, initialTeams, initialPeople }: Props) {
  const [activeTab, setActiveTab] = useState<"kanri" | "jisseki" | "houhan" | "settings">("kanri");
  const [targetDate, setTargetDate] = useState(today);
  const [mode, setMode] = useState<KanriMode>(isMonthEnd(today) ? "closing" : "daily");
  const [runs, setRuns] = useState(initialRuns);
  const [latest, setLatest] = useState<KanriRunView | null>(initialRuns[0] ?? null);
  const [holidays, setHolidays] = useState<string[]>(initialHolidays);
  const [message, setMessage] = useState("");
  const [inputs, setInputs] = useState<KanriManualInputs>(emptyInputs());
  const [people, setPeople] = useState<KanriPerson[]>(initialPeople);
  const [grid, setGrid] = useState<KanriSheetGrid | null>(null);
  const [jisseki, setJisseki] = useState<JissekiSheetGrid | null>(null);
  const [houhan, setHouhan] = useState<HouhanSheetGrid | null>(null);
  const [selectedFieldSalesPerson, setSelectedFieldSalesPerson] = useState(initialPeople.find((person) => person.active !== false && person.is_field_sales)?.name ?? "");
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
    const jissekiResponse = await fetch(`/api/system/kanri/runs/${runId}/result?sheet=jisseki`);
    const jissekiJson = await readJson(jissekiResponse) as { result?: { grid?: JissekiSheetGrid } };
    if (jissekiResponse.ok && jissekiJson.result?.grid) setJisseki(jissekiJson.result.grid);
    const houhanResponse = await fetch(`/api/system/kanri/runs/${runId}/result?sheet=houhan`);
    const houhanJson = await readJson(houhanResponse) as { result?: { grid?: HouhanSheetGrid } };
    if (houhanResponse.ok && houhanJson.result?.grid) setHouhan(houhanJson.result.grid);
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

  function updatePersonMonthly(person: string, key: "landingHours" | "workHours" | "workDays" | "fieldPoints", value: string) {
    const number = value === "" ? 0 : Number(value);
    if (!Number.isFinite(number)) return;
    setInputs((current) => ({
      ...current,
      personMonthly: {
        ...(current.personMonthly ?? {}),
        [person]: { ...(current.personMonthly?.[person] ?? {}), [key]: number },
      },
    }));
  }

  function updateFieldSalesWeight(product: string, value: string) {
    const number = value === "" ? 0 : Number(value);
    if (!Number.isFinite(number)) return;
    setInputs((current) => ({
      ...current,
      fieldSales: {
        ...(current.fieldSales ?? {}),
        weights: { ...(current.fieldSales?.weights ?? current.monthlySettings?.fieldSalesWeights ?? {}), [product]: number },
      },
      monthlySettings: {
        ...(current.monthlySettings ?? {}),
        fieldSalesWeights: { ...(current.monthlySettings?.fieldSalesWeights ?? current.fieldSales?.weights ?? {}), [product]: number },
      },
    }));
  }

  function updateFieldSalesDay(person: string, date: string, key: "status" | "hours" | "rental" | "sales", value: string) {
    const nextValue = key === "status" ? value : value === "" ? 0 : Number(value);
    if (key !== "status" && !Number.isFinite(nextValue as number)) return;
    setInputs((current) => ({
      ...current,
      fieldSales: {
        ...(current.fieldSales ?? {}),
        weights: current.fieldSales?.weights ?? current.monthlySettings?.fieldSalesWeights,
        byPerson: {
          ...(current.fieldSales?.byPerson ?? {}),
          [person]: {
            ...(current.fieldSales?.byPerson?.[person] ?? {}),
            days: {
              ...(current.fieldSales?.byPerson?.[person]?.days ?? {}),
              [date]: {
                ...(current.fieldSales?.byPerson?.[person]?.days?.[date] ?? {}),
                [key]: nextValue,
              },
            },
          },
        },
      },
    }));
  }

  function updateMonthlySetting(path: "target" | "incentive", key: string, value: string) {
    const number = value === "" ? 0 : Number(value.replace(/,/g, ""));
    if (!Number.isFinite(number)) return;
    setInputs((current) => ({
      ...current,
      monthlySettings: path === "target"
        ? {
          ...(current.monthlySettings ?? {}),
          targetPointsByTeam: { ...(current.monthlySettings?.targetPointsByTeam ?? {}), [key]: number },
        }
        : {
          ...(current.monthlySettings ?? {}),
          incentive: { ...(current.monthlySettings?.incentive ?? {}), [key]: number },
        },
    }));
  }

  function updatePerson(index: number, key: keyof KanriPerson, value: string | boolean) {
    setPeople((current) => current.map((person, personIndex) => {
      if (personIndex !== index) return person;
      return { ...person, [key]: key === "base_wage" ? (value === "" ? null : Number(value)) : value };
    }));
  }

  function addPerson() {
    setPeople((current) => [...current, {
      name: "",
      kot_name: "",
      team: initialTeams[0] ?? "",
      department: initialTeams[0] ?? "",
      employment_kind: "社員",
      base_wage: null,
      is_field_sales: false,
      active: true,
      sort_order: (current.length + 1) * 10,
    }]);
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
      else {
        setGrid(json.grid);
        if (json.houhan) setHouhan(json.houhan);
        if (json.jisseki) setJisseki(json.jisseki);
      }
    } finally {
      setCalculating(false);
    }
  }

  async function savePeople() {
    setSaving(true);
    setMessage("");
    try {
      const response = await fetch("/api/system/kanri/people", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ people }),
      });
      const json = await readJson(response);
      if (!response.ok) setMessage(json.error ?? "人の設定を保存できませんでした。");
      else setPeople(json.people ?? people);
    } finally {
      setSaving(false);
    }
  }

  const selectedHolidayText = holidays.map((date) => `${Number(date.slice(-2))}日`).join(", ") || "未選択";
  const fieldSalesPeople = people.filter((person) => person.active !== false && person.is_field_sales);
  const selectedFieldSales = fieldSalesPeople.find((person) => person.name === selectedFieldSalesPerson) ?? fieldSalesPeople[0] ?? null;
  const selectedHouhan = houhan?.people.find((person) => person.personName === selectedFieldSales?.name) ?? houhan?.people[0] ?? null;

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

    <nav className={styles.tabs} aria-label="表示切替">
      <button type="button" aria-current={activeTab === "kanri" ? "page" : undefined} onClick={() => setActiveTab("kanri")}>管理表</button>
      <button type="button" aria-current={activeTab === "jisseki" ? "page" : undefined} onClick={() => setActiveTab("jisseki")}>実績管理</button>
      <button type="button" aria-current={activeTab === "houhan" ? "page" : undefined} onClick={() => setActiveTab("houhan")}>訪問販売</button>
      <button type="button" aria-current={activeTab === "settings" ? "page" : undefined} onClick={() => setActiveTab("settings")}>設定</button>
    </nav>

    {activeTab === "kanri" && <>
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
    </>}

    {activeTab === "jisseki" && <>
      <section className={styles.panel}>
        <h2>今月の設定</h2>
        <div className={styles.compactGrid}>
          {["テレマ全体", "宮永チーム", "小泉チーム", "石原チーム", "新人チーム"].map((team) => <label key={team}>{team}
            <input type="number" step="0.1" value={inputs.monthlySettings?.targetPointsByTeam?.[team] ?? ""} onChange={(event) => updateMonthlySetting("target", team, event.target.value)} />
          </label>)}
          <label>目標P<input type="number" step="0.1" value={inputs.monthlySettings?.incentive?.targetPoints ?? ""} onChange={(event) => updateMonthlySetting("incentive", "targetPoints", event.target.value)} /></label>
          <label>達成金合計<input type="number" step="1" value={inputs.monthlySettings?.incentive?.achievementBonusTotal ?? ""} onChange={(event) => updateMonthlySetting("incentive", "achievementBonusTotal", event.target.value)} /></label>
          <label>チーム勝利金<input type="number" step="1" value={inputs.monthlySettings?.incentive?.teamVictoryBonus ?? ""} onChange={(event) => updateMonthlySetting("incentive", "teamVictoryBonus", event.target.value)} /></label>
        </div>
        <button className={styles.secondary} type="button" disabled={saving} onClick={() => void saveInputs()}>{saving ? "保存しています" : "保存"}</button>
      </section>

      <section className={styles.panel}>
        <h2>人ごとの今月の値</h2>
        <div className={styles.inputScroller}>
          <table className={styles.inputTable}>
            <thead><tr><th>氏名</th><th>チーム</th><th>区分/時給</th><th>着地予想h</th><th>稼働時間h</th><th>稼働日数</th><th>訪販の合計評価</th></tr></thead>
            <tbody>{people.filter((person) => person.active !== false).map((person) => <tr key={person.name || String(person.sort_order)}>
              <th>{person.name}</th>
              <td>{person.team}</td>
              <td>{person.employment_kind === "アルバイト" ? formatNumber(Number(person.base_wage ?? 0)) : person.employment_kind}</td>
              <td><input type="number" step="0.1" value={personInputValue(inputs, person.name, "landingHours")} onChange={(event) => updatePersonMonthly(person.name, "landingHours", event.target.value)} /></td>
              <td>{person.is_field_sales ? "訪問販売から反映" : <input type="number" step="0.1" value={personInputValue(inputs, person.name, "workHours")} onChange={(event) => updatePersonMonthly(person.name, "workHours", event.target.value)} />}</td>
              <td><input type="number" step="1" value={personInputValue(inputs, person.name, "workDays")} onChange={(event) => updatePersonMonthly(person.name, "workDays", event.target.value)} /></td>
              <td>{person.is_field_sales ? "訪問販売から反映" : ""}</td>
            </tr>)}</tbody>
          </table>
        </div>
        <button className={styles.secondary} type="button" disabled={saving} onClick={() => void saveInputs()}>{saving ? "保存しています" : "保存"}</button>
      </section>

      <section className={styles.panel}>
        <div className={styles.sectionHeader}>
          <h2>実績管理（計算結果）</h2>
          <button className={styles.primaryInline} type="button" disabled={calculating} onClick={() => void calculateSheet()}>{calculating ? "計算しています" : "計算する"}</button>
        </div>
        {(jisseki?.missingCommuteNames.length ?? 0) > 0 && <div className={styles.warningBlock}>
          <h3>台帳に交通費が無い人</h3>
          <p>{jisseki?.missingCommuteNames.join("、")}</p>
        </div>}
        {jisseki ? <div className={styles.resultScroller}>
          <table className={styles.resultTable}>
            <thead><tr>
              <th className={styles.stickyCell}>氏名</th><th>KOT用</th><th>基準時給</th><th>部署</th><th>チーム</th><th>着地</th><th>稼働h</th><th>獲得P</th><th>効率</th><th>日数</th><th>交通費</th>
              {jisseki.productColumns.map((column, index) => <th key={`${column.product}-${column.kind}-${index}`}>{column.label}</th>)}
            </tr></thead>
            <tbody>{jisseki.rows.map((row) => <tr key={row.personName}>
              <th className={styles.stickyCell}>{row.personName}</th><td>{row.kotName}</td><td>{typeof row.wageLabel === "number" ? formatNumber(row.wageLabel) : row.wageLabel}</td><td>{row.department}</td><td>{row.team}</td>
              <td>{formatNumber(row.landingHours, 1)}</td><td>{formatNumber(row.workHours, 1)}</td><td>{formatNumber(row.totalPoints, 1)}</td><td>{formatNumber(row.efficiency, 3)}</td><td>{formatNumber(row.workDays)}</td><td>{formatNumber(row.commuteDailyAllowance)}</td>
              {jisseki.productColumns.map((column, index) => {
                const suffix = column.kind === "hikari_toss" ? "toss" : column.kind === "hikari_ap" ? "ap" : "single";
                return <td key={`${row.personName}-${index}`}>{formatNumber(row.counts[`${column.product}:${suffix}`] ?? 0)}</td>;
              })}
            </tr>)}</tbody>
          </table>
        </div> : <p className={styles.empty}>まだ計算結果がありません。</p>}
      </section>
    </>}

    {activeTab === "houhan" && <>
      <section className={styles.panel}>
        <h2>今月の設定</h2>
        <div className={styles.compactGrid}>
          {HOUHAN_PRODUCTS.map((product) => <label key={product.key}>{product.label}
            <input type="number" step="0.1" value={fieldSalesWeightValue(inputs, product.key, product.defaultWeight)} onChange={(event) => updateFieldSalesWeight(product.key, event.target.value)} />
          </label>)}
        </div>
        <button className={styles.secondary} type="button" disabled={saving} onClick={() => void saveInputs()}>{saving ? "保存しています" : "保存"}</button>
      </section>

      <section className={styles.panel}>
        <div className={styles.sectionHeader}>
          <h2>訪問販売</h2>
          <button className={styles.primaryInline} type="button" disabled={calculating} onClick={() => void calculateSheet()}>{calculating ? "計算しています" : "計算する"}</button>
        </div>
        {fieldSalesPeople.length > 0 ? <>
          <div className={styles.personTabs} aria-label="担当者">
            {fieldSalesPeople.map((person) => <button
              key={person.name}
              type="button"
              aria-current={(selectedFieldSales?.name ?? "") === person.name ? "page" : undefined}
              onClick={() => setSelectedFieldSalesPerson(person.name)}
            >{person.name}</button>)}
          </div>
          <div className={styles.resultMeta}>
            <span>合計評価実績 {formatNumber(selectedHouhan?.totals.points, 1)}</span>
            <span>実数 {formatNumber(selectedHouhan?.totals.actualCount)}</span>
            <span>稼働h {formatNumber(selectedHouhan?.totals.hours, 1)}</span>
          </div>
          <div className={styles.resultScroller}>
            <table className={styles.resultTable}>
              <thead><tr>
                <th className={styles.stickyCell}>日付</th><th>状態</th><th>稼働h</th>
                {HOUHAN_PRODUCTS.map((product) => <th key={product.key}>{product.label}</th>)}
                <th>実数</th><th>個人評価</th><th>確認</th>
              </tr></thead>
              <tbody>
                {monthDays.map((day) => {
                  const calculated = selectedHouhan?.days.find((row) => row.date === day.date);
                  const personName = selectedFieldSales?.name ?? "";
                  return <tr key={day.date}>
                    <th className={styles.stickyCell}>{day.label}</th>
                    <td><select value={String(fieldSalesDayValue(inputs, personName, day.date, "status"))} onChange={(event) => updateFieldSalesDay(personName, day.date, "status", event.target.value)}><option value=""></option><option value="出勤">出勤</option><option value="公休">公休</option><option value="ゼロ">ゼロ</option></select></td>
                    <td><input type="number" step="0.1" value={fieldSalesDayValue(inputs, personName, day.date, "hours")} onChange={(event) => updateFieldSalesDay(personName, day.date, "hours", event.target.value)} /></td>
                    {HOUHAN_PRODUCTS.map((product) => {
                      const manualKey = product.manualKey;
                      return manualKey
                        ? <td key={product.key}><input type="number" step="1" value={fieldSalesDayValue(inputs, personName, day.date, manualKey)} onChange={(event) => updateFieldSalesDay(personName, day.date, manualKey, event.target.value)} /></td>
                        : <td key={product.key}>{formatNumber(calculated?.products[product.key])}</td>;
                    })}
                    <td>{formatNumber(calculated?.actualCount)}</td>
                    <td>{formatNumber(calculated?.personalPoints, 1)}</td>
                    <td>{calculated?.missingReport ? "報告なし" : ""}</td>
                  </tr>;
                })}
                {selectedHouhan && <tr className={styles.totalRow}>
                  <th className={styles.stickyCell}>合計（×係数）</th><td></td><td>{formatNumber(selectedHouhan.totals.hours, 1)}</td>
                  {HOUHAN_PRODUCTS.map((product) => <td key={product.key}>{formatNumber(selectedHouhan.totals.pointsByProduct[product.key], 1)}</td>)}
                  <td>{formatNumber(selectedHouhan.totals.actualCount)}</td><td>{formatNumber(selectedHouhan.totals.points, 1)}</td><td></td>
                </tr>}
              </tbody>
            </table>
          </div>
          <button className={styles.secondary} type="button" disabled={saving} onClick={() => void saveInputs()}>{saving ? "保存しています" : "保存"}</button>
        </> : <p className={styles.empty}>訪問販売の担当者が設定されていません。</p>}
      </section>
    </>}

    {activeTab === "settings" && <section className={styles.panel}>
      <div className={styles.sectionHeader}>
        <h2>人の設定</h2>
        <button className={styles.secondary} type="button" onClick={addPerson}>行を足す</button>
      </div>
      <div className={styles.inputScroller}>
        <table className={styles.inputTable}>
          <thead><tr><th>氏名</th><th>KOT用</th><th>チーム</th><th>部署</th><th>区分</th><th>基準時給</th><th>訪販</th><th>有効</th></tr></thead>
          <tbody>{people.map((person, index) => <tr key={`${person.name}-${index}`}>
            <td><input value={person.name} onChange={(event) => updatePerson(index, "name", event.target.value)} /></td>
            <td><input value={person.kot_name ?? ""} onChange={(event) => updatePerson(index, "kot_name", event.target.value)} /></td>
            <td><select value={person.team} onChange={(event) => updatePerson(index, "team", event.target.value)}>{[...new Set([...initialTeams, person.team, "訪問営業"])].filter(Boolean).map((team) => <option key={team}>{team}</option>)}</select></td>
            <td><input value={person.department} onChange={(event) => updatePerson(index, "department", event.target.value)} /></td>
            <td><select value={person.employment_kind} onChange={(event) => updatePerson(index, "employment_kind", event.target.value)}>{["社員", "アルバイト", "派遣"].map((kind) => <option key={kind}>{kind}</option>)}</select></td>
            <td><input type="number" value={person.base_wage ?? ""} onChange={(event) => updatePerson(index, "base_wage", event.target.value)} disabled={person.employment_kind !== "アルバイト"} /></td>
            <td><input type="checkbox" checked={Boolean(person.is_field_sales)} onChange={(event) => updatePerson(index, "is_field_sales", event.target.checked)} /></td>
            <td><input type="checkbox" checked={person.active !== false} onChange={(event) => updatePerson(index, "active", event.target.checked)} /></td>
          </tr>)}</tbody>
        </table>
      </div>
      <button className={styles.secondary} type="button" disabled={saving} onClick={() => void savePeople()}>{saving ? "保存しています" : "保存"}</button>
    </section>}
  </div>;
}
