"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import SystemBreadcrumb from "@/app/system/_components/SystemBreadcrumb/SystemBreadcrumb";
import {
  isMonthEnd,
  monthRange,
  type KanriMode,
  type KanriSummary,
  type KanriWarning,
  weekdayJa,
} from "./_lib/kanri-core";
import type { KanriKotDailyIssue, KanriManualInputs, KanriSheetGrid } from "./_lib/calc/kanri-sheet";
import type { JissekiSheetGrid, KanriPerson } from "./_lib/calc/jisseki-sheet";
import { HOUHAN_PRODUCTS, type HouhanSheetGrid } from "./_lib/calc/houhan-sheet";
import { APORAN_TEAM_LABELS, APORAN_TEAM_ORDER, type AporanSheetGrid, type AporanTeamKey } from "./_lib/calc/aporan-sheet";
import { INCENTIVE_TEAM_LABELS, INCENTIVE_TEAM_ORDER, type IncentiveSheetGrid } from "./_lib/calc/incentive-sheet";
import type { PayrollSheetGrid } from "./_lib/calc/payroll-sheet";
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
  canWrite?: boolean;
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
  aporan?: AporanSheetGrid;
  incentive?: IncentiveSheetGrid;
  payroll?: PayrollSheetGrid;
  result?: { grid?: KanriSheetGrid | JissekiSheetGrid | HouhanSheetGrid | AporanSheetGrid | IncentiveSheetGrid | PayrollSheetGrid };
  people?: KanriPerson[];
  kotDaily?: KanriManualInputs["kotDaily"] | null;
  chatwork?: NonNullable<KanriSummary["chatwork"]>;
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

function chatworkStatusText(summary: KanriSummary | null | undefined) {
  if (!summary?.chatwork) return "";
  return `送信済み（${formatDateTime(summary.chatwork.sentAt)}・${summary.chatwork.by}）`;
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

function aporanTargetValue(inputs: KanriManualInputs, key: AporanTeamKey) {
  return inputs.monthlySettings?.aporanTargets?.[key] ?? "";
}

function incentiveValue(inputs: KanriManualInputs, key: "targetPoints" | "achievementBonusTotal" | "teamVictoryBonus") {
  return inputs.monthlySettings?.incentive?.[key] ?? "";
}

function payrollSettingValue(inputs: KanriManualInputs, key: "baseWage" | "trainingWage", fallback: number) {
  return inputs.monthlySettings?.payroll?.[key] ?? fallback;
}

function payrollPersonValue(inputs: KanriManualInputs, person: string, key: "nextStatus" | "wageAdjustment" | "referralPoints" | "trainingHours" | "hiringBonus" | "talentReferralIncentive" | "dealIncentive") {
  return inputs.payrollByPerson?.[person]?.[key] ?? "";
}

function hasKotPersonValue(inputs: KanriManualInputs, person: string, key: "landingHours" | "workHours" | "workDays") {
  return Boolean(inputs.kotDaily && inputs.personMonthly?.[person]?.[key] !== undefined);
}

function kotHoursBasis(inputs: KanriManualInputs) {
  return inputs.monthlySettings?.kot?.hoursBasis ?? "plan";
}

function kotDispatchNames(inputs: KanriManualInputs) {
  return (inputs.monthlySettings?.kot?.includeDispatchNames ?? ["梶野 恵園"]).join("、");
}

function kotIssueSummary(issues: KanriKotDailyIssue[] | undefined) {
  const counts = {
    遅刻: issues?.filter((issue) => issue.kind === "遅刻").length ?? 0,
    早退: issues?.filter((issue) => issue.kind === "早退").length ?? 0,
    予定なしの出勤: issues?.filter((issue) => issue.kind === "予定なしの出勤").length ?? 0,
    予定ありで打刻なし: issues?.filter((issue) => issue.kind === "予定ありで打刻なし").length ?? 0,
  };
  return `遅刻 ${counts.遅刻} 件・早退 ${counts.早退} 件・予定なしの出勤 ${counts.予定なしの出勤} 件・予定ありで打刻なし ${counts.予定ありで打刻なし} 件`;
}

async function readJson(response: Response): Promise<RunResponse> {
  try {
    return await response.json() as RunResponse;
  } catch {
    return {};
  }
}

export default function KanriPortalClient({ creatorName, today, initialRuns, initialHolidays, initialProducts, initialTeams, initialPeople, canWrite = true }: Props) {
  const [activeTab, setActiveTab] = useState<"kanri" | "jisseki" | "aporan" | "houhan" | "incentive" | "payroll" | "settings">(canWrite ? "kanri" : "payroll");
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
  const [aporan, setAporan] = useState<AporanSheetGrid | null>(null);
  const [incentive, setIncentive] = useState<IncentiveSheetGrid | null>(null);
  const [payroll, setPayroll] = useState<PayrollSheetGrid | null>(null);
  const [selectedFieldSalesPerson, setSelectedFieldSalesPerson] = useState(initialPeople.find((person) => person.active !== false && person.is_field_sales)?.name ?? "");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [calculating, setCalculating] = useState(false);
  const [excelDownloading, setExcelDownloading] = useState(false);
  const [chatworkSending, setChatworkSending] = useState(false);
  const [kotFile, setKotFile] = useState<File | null>(null);
  const [kotImporting, setKotImporting] = useState(false);
  const [showKotDetails, setShowKotDetails] = useState(false);
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
    try {
      const response = await fetch(`/api/system/kanri/runs/${runId}/result?sheet=kanri`);
      const json = await readJson(response) as { result?: { grid?: KanriSheetGrid } };
      if (response.ok && json.result?.grid) setGrid(json.result.grid);
      const jissekiResponse = await fetch(`/api/system/kanri/runs/${runId}/result?sheet=jisseki`);
      const jissekiJson = await readJson(jissekiResponse) as { result?: { grid?: JissekiSheetGrid } };
      if (jissekiResponse.ok && jissekiJson.result?.grid) setJisseki(jissekiJson.result.grid);
      const houhanResponse = await fetch(`/api/system/kanri/runs/${runId}/result?sheet=houhan`);
      const houhanJson = await readJson(houhanResponse) as { result?: { grid?: HouhanSheetGrid } };
      if (houhanResponse.ok && houhanJson.result?.grid) setHouhan(houhanJson.result.grid);
      const aporanResponse = await fetch(`/api/system/kanri/runs/${runId}/result?sheet=aporan`);
      const aporanJson = await readJson(aporanResponse) as { result?: { grid?: AporanSheetGrid } };
      if (aporanResponse.ok && aporanJson.result?.grid) setAporan(aporanJson.result.grid);
      const incentiveResponse = await fetch(`/api/system/kanri/runs/${runId}/result?sheet=incentive`);
      const incentiveJson = await readJson(incentiveResponse) as { result?: { grid?: IncentiveSheetGrid } };
      if (incentiveResponse.ok && incentiveJson.result?.grid) setIncentive(incentiveJson.result.grid);
      const payrollResponse = await fetch(`/api/system/kanri/runs/${runId}/result?sheet=payroll`);
      const payrollJson = await readJson(payrollResponse) as { result?: { grid?: PayrollSheetGrid } };
      if (payrollResponse.ok && payrollJson.result?.grid) setPayroll(payrollJson.result.grid);
    } catch {
      return;
    }
  }

  useEffect(() => {
    if (canWrite) void loadInputs(range.yearMonth);
  }, [canWrite, range.yearMonth]);

  useEffect(() => {
    if (latest?.id) void loadResult(latest.id);
  }, [latest?.id]);

  function changeDate(nextDate: string) {
    setTargetDate(nextDate);
    setMode((current) => nextModeForDate(nextDate, current));
    if (monthRange(nextDate).yearMonth !== range.yearMonth) {
      if (canWrite) {
        void loadMonthSetting(nextDate);
        void loadInputs(monthRange(nextDate).yearMonth);
      }
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

  function updateMonthlySetting(path: "target" | "aporan" | "incentive" | "payroll", key: string, value: string) {
    const number = value === "" ? null : Number(value.replace(/,/g, ""));
    if (number !== null && !Number.isFinite(number)) return;
    setInputs((current) => ({
      ...current,
      monthlySettings: path === "target"
        ? {
          ...(current.monthlySettings ?? {}),
          targetPointsByTeam: { ...(current.monthlySettings?.targetPointsByTeam ?? {}), [key]: number },
        }
        : path === "aporan"
          ? {
            ...(current.monthlySettings ?? {}),
            aporanTargets: { ...(current.monthlySettings?.aporanTargets ?? {}), [key]: number },
          }
          : path === "incentive"
            ? {
              ...(current.monthlySettings ?? {}),
              incentive: { ...(current.monthlySettings?.incentive ?? {}), [key]: number },
            }
            : {
            ...(current.monthlySettings ?? {}),
              payroll: { ...(current.monthlySettings?.payroll ?? {}), [key]: number },
            },
    }));
  }

  function updateKotSetting(key: "hoursBasis" | "includeDispatchNames", value: string) {
    setInputs((current) => ({
      ...current,
      monthlySettings: {
        ...(current.monthlySettings ?? {}),
        kot: {
          ...(current.monthlySettings?.kot ?? {}),
          [key]: key === "includeDispatchNames"
            ? value.split(/[、,\n]/).map((name) => name.trim()).filter(Boolean)
            : value,
        },
      },
    }));
  }

  function updatePayrollPerson(person: string, key: "nextStatus" | "wageAdjustment" | "referralPoints" | "trainingHours" | "hiringBonus" | "talentReferralIncentive" | "dealIncentive", value: string) {
    const nextValue = key === "nextStatus" ? value : value === "" ? 0 : Number(value.replace(/,/g, ""));
    if (key !== "nextStatus" && !Number.isFinite(nextValue as number)) return;
    setInputs((current) => ({
      ...current,
      payrollByPerson: {
        ...(current.payrollByPerson ?? {}),
        [person]: { ...(current.payrollByPerson?.[person] ?? {}), [key]: nextValue },
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
        if (json.aporan) setAporan(json.aporan);
        if (json.incentive) setIncentive(json.incentive);
        if (json.payroll) setPayroll(json.payroll);
      }
    } finally {
      setCalculating(false);
    }
  }

  async function exportExcel() {
    if (!latest?.id) {
      setMessage("先にデータを取り込んでください。");
      return;
    }
    setExcelDownloading(true);
    setMessage("");
    try {
      const response = await fetch(`/api/system/kanri/runs/${latest.id}/excel`);
      if (!response.ok) {
        const json = await readJson(response);
        setMessage(json.error ?? "Excel を作成できませんでした。");
        return;
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `kanri-report-${latest.target_date.replaceAll("-", "")}.xlsx`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } finally {
      setExcelDownloading(false);
    }
  }

  async function sendChatwork() {
    if (!latest?.id) {
      setMessage("先にデータを取り込んでください。");
      return;
    }
    if (!canExportExcel) {
      setMessage("先に「計算する」を押してください");
      return;
    }
    if (latest.summary?.chatwork && !window.confirm("もう一度送りますか")) return;

    setChatworkSending(true);
    setMessage("");
    try {
      const response = await fetch(`/api/system/kanri/runs/${latest.id}/chatwork`, { method: "POST" });
      const json = await readJson(response);
      if (!response.ok || !json.chatwork) {
        setMessage(json.error ?? "Chatwork に送れませんでした。管理者へ問い合わせてください");
        return;
      }
      const nextSummary = { ...(latest.summary ?? {}), chatwork: json.chatwork } as KanriSummary;
      setLatest((current) => current ? { ...current, summary: nextSummary } : current);
      setRuns((current) => current.map((run) => run.id === latest.id ? { ...run, summary: nextSummary } : run));
    } finally {
      setChatworkSending(false);
    }
  }

  async function importKotDaily() {
    if (!latest?.id) {
      setMessage("先にデータを取り込んでください。");
      return;
    }
    if (!kotFile) {
      setMessage("KOT のファイルを選んでください。");
      return;
    }
    setKotImporting(true);
    setMessage("");
    try {
      const form = new FormData();
      form.append("file", kotFile);
      form.append("hoursBasis", kotHoursBasis(inputs));
      form.append("includeDispatchNames", kotDispatchNames(inputs));
      const response = await fetch(`/api/system/kanri/runs/${latest.id}/kot`, { method: "POST", body: form });
      const json = await readJson(response);
      if (!response.ok || !json.inputs) {
        setMessage(json.error ?? "勤怠を取り込めませんでした。");
        return;
      }
      setInputs(json.inputs);
      if (json.summary) setLatest((current) => current ? { ...current, summary: json.summary as KanriSummary } : current);
      setMessage("勤怠を取り込みました。");
    } finally {
      setKotImporting(false);
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
  const canExportExcel = Boolean(latest?.id && grid && jisseki && aporan && houhan && incentive && payroll);
  const chatworkStatus = chatworkStatusText(latest?.summary);
  const latestImport = latest?.summary?.kintone_customer ? { run: latest, summary: latest.summary } : null;

  return <div className={styles.pageShell}>
    <header className={styles.header}>
      <SystemBreadcrumb items={[{ label: "管理表ポータル" }]} />
      <h1>管理表ポータル</h1>
    </header>
    <div className={styles.monitorEntry}>
      <Link href="/system/kanri/display" target="_blank" rel="noreferrer" className={styles.monitorButton}>モニター表示</Link>
    </div>

    {canWrite && <section className={styles.panel}>
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
      <div className={styles.actionRow}>
        <button className={styles.primary} type="button" disabled={loading} onClick={() => void importData()}>
          {loading ? "取り込んでいます" : "データを取り込む"}
        </button>
        <button className={styles.primary} type="button" disabled={calculating || !latest?.id} onClick={() => void calculateSheet()}>
          {calculating ? "計算しています" : "計算する"}
        </button>
        <button className={styles.secondary} type="button" disabled={excelDownloading || !canExportExcel} onClick={() => void exportExcel()}>
          {excelDownloading ? "書き出しています" : "Excel を書き出す"}
        </button>
        <button className={styles.secondary} type="button" disabled={chatworkSending || !canExportExcel} onClick={() => void sendChatwork()}>
          {chatworkSending ? "送っています" : "Chatwork に送る"}
        </button>
        {!canExportExcel && <span className={styles.actionReason}>計算前は書き出せません</span>}
        {chatworkStatus && <span className={styles.actionReason}>{chatworkStatus}</span>}
      </div>
    </section>}

    <nav className={styles.tabs} aria-label="表示切替">
      {canWrite && <>
        <button type="button" aria-current={activeTab === "kanri" ? "page" : undefined} onClick={() => setActiveTab("kanri")}>管理表</button>
        <button type="button" aria-current={activeTab === "jisseki" ? "page" : undefined} onClick={() => setActiveTab("jisseki")}>実績管理</button>
        <button type="button" aria-current={activeTab === "aporan" ? "page" : undefined} onClick={() => setActiveTab("aporan")}>アポラン</button>
        <button type="button" aria-current={activeTab === "houhan" ? "page" : undefined} onClick={() => setActiveTab("houhan")}>訪問販売</button>
        <button type="button" aria-current={activeTab === "incentive" ? "page" : undefined} onClick={() => setActiveTab("incentive")}>インセ計算</button>
      </>}
      <button type="button" aria-current={activeTab === "payroll" ? "page" : undefined} onClick={() => setActiveTab("payroll")}>給与試算</button>
      {canWrite && <button type="button" aria-current={activeTab === "settings" ? "page" : undefined} onClick={() => setActiveTab("settings")}>設定</button>}
    </nav>

    {activeTab === "kanri" && <>
    <section className={styles.panel}>
      <h2>勤怠（KOT）</h2>
      <p className={styles.hint}>KOT の「日別データ[CSV]」（レイアウト Garden管理表ポータル（日））を選んで取り込みます。</p>
      <div className={styles.kotUpload}>
        <input type="file" accept=".csv,text/csv" onChange={(event) => setKotFile(event.target.files?.[0] ?? null)} />
        <button className={styles.primaryInline} type="button" disabled={kotImporting} onClick={() => void importKotDaily()}>{kotImporting ? "取り込んでいます" : "取り込む"}</button>
      </div>
      {inputs.kotDaily?.summary ? <div className={styles.kotResult}>
        <p>取り込み結果：{inputs.kotDaily.summary.startDate.replace(/-/g, "/")}〜{inputs.kotDaily.summary.endDate.slice(5).replace("-", "/")}・{inputs.kotDaily.summary.peopleCount} 人・{inputs.kotDaily.summary.rowCount.toLocaleString("ja-JP")} 行。稼働時間（{inputs.kotDaily.summary.hoursBasis === "plan" ? "予定" : "実績"}）を {inputs.kotDaily.summary.teamDayCount} マスに入れました。</p>
        <p>台帳に無い名前 {inputs.kotDaily.summary.missingNames.length} 人 ／ 手入力を上書きしたマス {inputs.kotDaily.summary.overwrittenCells.length}</p>
        <p>勤怠の確認：{kotIssueSummary(inputs.kotDaily.issues)} <button className={styles.linkButton} type="button" onClick={() => setShowKotDetails((current) => !current)}>{showKotDetails ? "閉じる" : "明細を見る"}</button></p>
        {showKotDetails && <div className={styles.resultScroller}>
          <table className={styles.resultTable}>
            <thead><tr><th className={styles.stickyCell}>日付</th><th>チーム</th><th>氏名</th><th>種類</th><th>予定</th><th>打刻</th><th>差</th></tr></thead>
            <tbody>{inputs.kotDaily.issues.map((issue, index) => <tr key={`${issue.date}-${issue.name}-${issue.kind}-${index}`}>
              <th className={styles.stickyCell}>{issue.date.replace(/-/g, "/")}</th>
              <td>{issue.team || "—"}</td>
              <td>{issue.name}</td>
              <td>{issue.kind}</td>
              <td>{issue.planned || "—"}</td>
              <td>{issue.punched || "—"}</td>
              <td>{issue.diffMinutes === null ? "—" : `${issue.diffMinutes} 分`}</td>
            </tr>)}</tbody>
          </table>
        </div>}
      </div> : <p className={styles.empty}>まだ勤怠の取り込み結果がありません。</p>}
      <p className={styles.hint}>KOT の打刻は編集後の時刻です。数分の遅れは編集で消えていることがあります。</p>
    </section>

    <section className={styles.panel}>
      <h2>今月の設定（勤怠）</h2>
      <div className={styles.controls}>
        <fieldset>
          <legend>稼働時間の元</legend>
          <label><input type="radio" name="kot-hours-basis" checked={kotHoursBasis(inputs) === "plan"} onChange={() => updateKotSetting("hoursBasis", "plan")} />予定</label>
          <label><input type="radio" name="kot-hours-basis" checked={kotHoursBasis(inputs) === "actual"} onChange={() => updateKotSetting("hoursBasis", "actual")} />実績</label>
        </fieldset>
        <label>チーム時間に入れる派遣<input type="text" value={kotDispatchNames(inputs)} onChange={(event) => updateKotSetting("includeDispatchNames", event.target.value)} /></label>
      </div>
      <button className={styles.secondary} type="button" disabled={saving} onClick={() => void saveInputs()}>{saving ? "保存しています" : "保存"}</button>
    </section>

    <section className={styles.panel}>
      <h2>稼働時間と開通率</h2>
      <p className={styles.hint}>勤怠を取り込むと稼働時間は上書きされます。取り込み後も手で直せます。</p>
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
      {latestImport ? <>
        <div className={styles.resultMeta}>
          <span>状態: {statusLabel(latestImport.run.status)}</span>
          <span>{formatDateTime(latestImport.run.finished_at ?? latestImport.run.created_at)}</span>
          <span>作成者: {latestImport.run.creator_name}</span>
        </div>
        <dl className={styles.summaryList}>
          <div><dt>{latestImport.summary.kintone_customer.label}</dt><dd>{latestImport.summary.kintone_customer.count}{latestImport.summary.kintone_customer.unit}</dd></div>
          <div><dt>{latestImport.summary.kanden_report.label}</dt><dd>{latestImport.summary.kanden_report.count}{latestImport.summary.kanden_report.unit}</dd></div>
          <div><dt>{latestImport.summary.credit_card.label}</dt><dd>{latestImport.summary.credit_card.count}{latestImport.summary.credit_card.unit}{creditBreakdown(latestImport.summary)}</dd></div>
          <div><dt>{latestImport.summary.roster.label}</dt><dd>{latestImport.summary.roster.count}{latestImport.summary.roster.unit}</dd></div>
        </dl>
        <div className={styles.warningBlock}>
          <h3>注意（{latestImport.run.warnings?.length ?? 0}件）</h3>
          <p>出せますが、翌日に確認してください</p>
          {(latestImport.run.warnings?.length ?? 0) > 0 && <ul>{latestImport.run.warnings?.map((warning, index) => <li key={`${warning.code}-${index}`}>{warning.message}</li>)}</ul>}
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
              <td><input type="number" step="0.1" value={personInputValue(inputs, person.name, "landingHours")} onChange={(event) => updatePersonMonthly(person.name, "landingHours", event.target.value)} />{hasKotPersonValue(inputs, person.name, "landingHours") && <span className={styles.sourceBadge}>KOT から</span>}</td>
              <td>{person.is_field_sales ? "訪問販売から反映" : <><input type="number" step="0.1" value={personInputValue(inputs, person.name, "workHours")} onChange={(event) => updatePersonMonthly(person.name, "workHours", event.target.value)} />{hasKotPersonValue(inputs, person.name, "workHours") && <span className={styles.sourceBadge}>KOT から</span>}</>}</td>
              <td><input type="number" step="1" value={personInputValue(inputs, person.name, "workDays")} onChange={(event) => updatePersonMonthly(person.name, "workDays", event.target.value)} />{hasKotPersonValue(inputs, person.name, "workDays") && <span className={styles.sourceBadge}>KOT から</span>}</td>
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

    {activeTab === "aporan" && <>
      <section className={styles.panel}>
        <h2>今月の設定</h2>
        <div className={styles.compactGrid}>
          {APORAN_TEAM_ORDER.map((key) => <label key={key}>{APORAN_TEAM_LABELS[key]}
            <input type="number" step="0.1" value={aporanTargetValue(inputs, key)} onChange={(event) => updateMonthlySetting("aporan", key, event.target.value)} />
          </label>)}
        </div>
        <button className={styles.secondary} type="button" disabled={saving} onClick={() => void saveInputs()}>{saving ? "保存しています" : "保存"}</button>
      </section>

      <section className={styles.panel}>
        <div className={styles.sectionHeader}>
          <h2>チーム別</h2>
          <button className={styles.primaryInline} type="button" disabled={calculating} onClick={() => void calculateSheet()}>{calculating ? "計算しています" : "計算する"}</button>
        </div>
        {aporan ? <div className={styles.resultScroller}>
          <table className={styles.resultTable}>
            <thead><tr>
              <th className={styles.stickyCell}></th>
              {aporan.teamOrder.map((key) => <th key={key}>{aporan.teams[key].label}</th>)}
            </tr></thead>
            <tbody>
              <tr><th className={styles.stickyCell}>効率</th>{aporan.teamOrder.map((key) => <td key={`${key}-efficiency`}>{formatNumber(aporan.teams[key].efficiency, 4)}</td>)}</tr>
              <tr><th className={styles.stickyCell}>実績P</th>{aporan.teamOrder.map((key) => <td key={`${key}-actual`}>{formatNumber(aporan.teams[key].actualPoints, 1)}</td>)}</tr>
              <tr><th className={styles.stickyCell}>目標P</th>{aporan.teamOrder.map((key) => <td key={`${key}-target`}>{formatNumber(aporan.teams[key].targetPoints, 1)}</td>)}</tr>
              <tr><th className={styles.stickyCell}>現時点必要P</th>{aporan.teamOrder.map((key) => <td key={`${key}-current`}>{formatNumber(aporan.teams[key].currentRequiredPoints, 1)}</td>)}</tr>
              <tr><th className={styles.stickyCell}>稼働h</th>{aporan.teamOrder.map((key) => <td key={`${key}-work`}>{formatNumber(aporan.teams[key].workHours, 1)}</td>)}</tr>
              <tr><th className={styles.stickyCell}>着地予想h</th>{aporan.teamOrder.map((key) => <td key={`${key}-landing-hours`}>{formatNumber(aporan.teams[key].landingHours, 1)}</td>)}</tr>
              <tr><th className={styles.stickyCell}>着地予想P</th>{aporan.teamOrder.map((key) => <td key={`${key}-landing-points`}>{formatNumber(aporan.teams[key].landingPoints, 1)}</td>)}</tr>
              <tr><th className={styles.stickyCell}>達成率</th>{aporan.teamOrder.map((key) => <td key={`${key}-achievement`}>{formatRate(aporan.teams[key].achievementRate)}</td>)}</tr>
            </tbody>
          </table>
        </div> : <p className={styles.empty}>まだ計算結果がありません。</p>}
      </section>

      <section className={styles.panel}>
        <h2>アポインターランキング</h2>
        {aporan ? <div className={styles.resultScroller}>
          <table className={styles.resultTable}>
            <thead><tr>
              <th className={styles.stickyCell}>順位</th><th>部署</th><th>氏名</th><th>ステータス</th><th>時給</th><th>獲得P</th><th>稼働時間</th><th>効率</th><th>着地時間</th><th>デジタル着地</th>
            </tr></thead>
            <tbody>{aporan.ranking.map((row) => <tr key={`${row.rank}-${row.personName}`}>
              <th className={styles.stickyCell}>{row.rank}</th>
              <td>{row.department}</td>
              <td>{row.personName}</td>
              <td>{row.status ?? "—"}</td>
              <td>{typeof row.wageLabel === "number" ? formatNumber(row.wageLabel) : row.wageLabel}</td>
              <td>{formatNumber(row.totalPoints, 1)}</td>
              <td>{formatNumber(row.workHours, 1)}</td>
              <td>{formatNumber(row.displayEfficiency, 2)}</td>
              <td>{formatNumber(row.landingHours, 1)}</td>
              <td>{formatNumber(row.digitalLanding, 1)}</td>
            </tr>)}</tbody>
          </table>
        </div> : <p className={styles.empty}>まだ計算結果がありません。</p>}
      </section>
    </>}

    {activeTab === "incentive" && <>
      <section className={styles.panel}>
        <h2>今月の設定</h2>
        <div className={styles.compactGrid}>
          <label>インセの目標P
            <input type="number" step="0.1" value={incentiveValue(inputs, "targetPoints")} onChange={(event) => updateMonthlySetting("incentive", "targetPoints", event.target.value)} />
          </label>
          <label>達成金合計
            <input type="number" step="1" value={incentiveValue(inputs, "achievementBonusTotal")} onChange={(event) => updateMonthlySetting("incentive", "achievementBonusTotal", event.target.value)} />
          </label>
          <label>チーム勝利金
            <input type="number" step="1" value={incentiveValue(inputs, "teamVictoryBonus")} onChange={(event) => updateMonthlySetting("incentive", "teamVictoryBonus", event.target.value)} />
          </label>
        </div>
        <button className={styles.secondary} type="button" disabled={saving} onClick={() => void saveInputs()}>{saving ? "保存しています" : "保存"}</button>
      </section>

      <section className={styles.panel}>
        <div className={styles.sectionHeader}>
          <h2>チーム別</h2>
          <button className={styles.primaryInline} type="button" disabled={calculating} onClick={() => void calculateSheet()}>{calculating ? "計算しています" : "計算する"}</button>
        </div>
        {incentive ? <div className={styles.resultScroller}>
          <table className={styles.resultTable}>
            <thead><tr>
              <th className={styles.stickyCell}></th>
              {INCENTIVE_TEAM_ORDER.map((key) => <th key={key}>{INCENTIVE_TEAM_LABELS[key]}</th>)}
            </tr></thead>
            <tbody>
              <tr><th className={styles.stickyCell}>稼働日数</th>{INCENTIVE_TEAM_ORDER.map((key) => <td key={`${key}-days`}>{formatNumber(incentive.teams[key].workDays)}</td>)}</tr>
              <tr><th className={styles.stickyCell}>稼働時間</th>{INCENTIVE_TEAM_ORDER.map((key) => <td key={`${key}-hours`}>{formatNumber(incentive.teams[key].landingHours, 1)}</td>)}</tr>
              <tr><th className={styles.stickyCell}>目標P</th>{INCENTIVE_TEAM_ORDER.map((key) => <td key={`${key}-target`}>{formatNumber(incentive.teams[key].targetPoints, 1)}</td>)}</tr>
              <tr><th className={styles.stickyCell}>着地P</th>{INCENTIVE_TEAM_ORDER.map((key) => <td key={`${key}-actual`}>{formatNumber(incentive.teams[key].actualPoints, 1)}</td>)}</tr>
              <tr><th className={styles.stickyCell}>達成率</th>{INCENTIVE_TEAM_ORDER.map((key) => <td key={`${key}-rate`}>{formatRate(incentive.teams[key].achievementRate)}</td>)}</tr>
              <tr><th className={styles.stickyCell}>効率</th>{INCENTIVE_TEAM_ORDER.map((key) => <td key={`${key}-efficiency`}>{formatNumber(incentive.teams[key].efficiency, 4)}</td>)}</tr>
              <tr><th className={styles.stickyCell}>個人P（リーダー）</th>{INCENTIVE_TEAM_ORDER.map((key) => <td key={`${key}-leader`}>{formatNumber(incentive.teams[key].leaderPoints, 1)}</td>)}</tr>
              <tr><th className={styles.stickyCell}>個人P比率</th>{INCENTIVE_TEAM_ORDER.map((key) => <td key={`${key}-leader-rate`}>{formatRate(incentive.teams[key].leaderPointRate)}</td>)}</tr>
              <tr><th className={styles.stickyCell}>P達成金</th>{INCENTIVE_TEAM_ORDER.map((key) => <td key={`${key}-achievement-bonus`}>{formatNumber(incentive.teams[key].achievementBonus)}</td>)}</tr>
              <tr><th className={styles.stickyCell}>P達成支給額</th>{INCENTIVE_TEAM_ORDER.map((key) => <td key={`${key}-achievement-payout`}>{formatNumber(incentive.teams[key].achievementPayout)}</td>)}</tr>
              <tr><th className={styles.stickyCell}>チーム勝利支給額</th>{INCENTIVE_TEAM_ORDER.map((key) => <td key={`${key}-victory`}>{formatNumber(incentive.teams[key].teamVictoryBonus)}</td>)}</tr>
              <tr><th className={styles.stickyCell}>目標P超え</th>{INCENTIVE_TEAM_ORDER.map((key) => <td key={`${key}-target-over`}>{formatNumber(incentive.teams[key].targetOverBonus)}</td>)}</tr>
              <tr><th className={styles.stickyCell}>●P達成金</th>{INCENTIVE_TEAM_ORDER.map((key) => <td key={`${key}-point-achievement`}>{formatNumber(incentive.teams[key].pointAchievementBonus)}</td>)}</tr>
              <tr><th className={styles.stickyCell}>合計インセン</th>{INCENTIVE_TEAM_ORDER.map((key) => <td key={`${key}-total`}>{formatNumber(incentive.teams[key].totalIncentive)}</td>)}</tr>
            </tbody>
          </table>
        </div> : <p className={styles.empty}>まだ計算結果がありません。</p>}
      </section>

      <section className={styles.panel}>
        <h2>テレマ全体</h2>
        {incentive ? <div className={styles.resultMeta}>
          <span>稼働時間 {formatNumber(incentive.overall.landingHours, 1)}</span>
          <span>時間効率 {formatNumber(incentive.overall.timeEfficiency, 3)}</span>
          <span>目標P {formatNumber(incentive.overall.targetPoints, 1)}</span>
          <span>達成金合計 {formatNumber(incentive.overall.achievementBonusTotal)}</span>
          <span>1人 {formatNumber(incentive.overall.perPersonAchievementBonus)}</span>
        </div> : <p className={styles.empty}>まだ計算結果がありません。</p>}
      </section>
    </>}

    {activeTab === "payroll" && <>
      <section className={styles.panel}>
        <h2>今月の設定</h2>
        <div className={styles.compactGrid}>
          <label>基準時給
            <input type="number" step="1" value={payrollSettingValue(inputs, "baseWage", payroll?.settings.baseWage ?? 1177)} onChange={(event) => updateMonthlySetting("payroll", "baseWage", event.target.value)} disabled={!canWrite} />
          </label>
          <label>研修時給
            <input type="number" step="1" value={payrollSettingValue(inputs, "trainingWage", payroll?.settings.trainingWage ?? 1500)} onChange={(event) => updateMonthlySetting("payroll", "trainingWage", event.target.value)} disabled={!canWrite} />
          </label>
        </div>
        <div className={styles.resultMeta}>
          <span>期間 {payroll ? `${payroll.period.start.replaceAll("-", "/")}〜${payroll.period.end.replaceAll("-", "/")}` : `${range.start.replaceAll("-", "/")}〜${range.end.replaceAll("-", "/")}`}</span>
          <span>支給予定日 {payroll ? payroll.period.scheduledPayDate.replaceAll("-", "/") : "—"}</span>
        </div>
        {canWrite && <button className={styles.secondary} type="button" disabled={saving} onClick={() => void saveInputs()}>{saving ? "保存しています" : "保存"}</button>}
      </section>

      <section className={styles.panel}>
        <div className={styles.sectionHeader}>
          <h2>人ごと</h2>
          {canWrite && <button className={styles.primaryInline} type="button" disabled={calculating} onClick={() => void calculateSheet()}>{calculating ? "計算しています" : "計算する"}</button>}
        </div>
        {payroll ? <div className={styles.resultScroller}>
          <table className={styles.resultTable}>
            <thead><tr>
              <th className={styles.stickyCell}>順位</th><th>部署</th><th>氏名</th><th>現ステータス</th><th>効率</th><th>現時給</th>
              <th>次月ステータス</th><th>査定±</th><th>次月時給</th><th>AP時給</th><th>獲得P</th><th>紹介P</th><th>合計P</th>
              <th>基本</th><th>APインセン</th><th>研修h</th><th>研修手当</th><th>社長賞</th><th>件数賞</th><th>入社祝い金</th><th>人材紹介</th><th>案件</th><th>支給合計</th><th>所定h</th><th>勤務日数</th><th>交通費往復</th><th>交通費合計</th>
            </tr></thead>
            <tbody>{payroll.rows.map((row) => <tr key={`${row.rank}-${row.personName}`}>
              <th className={styles.stickyCell}>{row.rank}</th>
              <td>{row.department}</td>
              <td>{row.personName}</td>
              <td>{row.currentStatus ?? "—"}</td>
              <td>{formatNumber(row.timeEfficiency, 2)}</td>
              <td>{typeof row.currentWage === "number" ? formatNumber(row.currentWage) : row.currentWage}</td>
              <td>{canWrite ? <input value={payrollPersonValue(inputs, row.personName, "nextStatus")} onChange={(event) => updatePayrollPerson(row.personName, "nextStatus", event.target.value)} /> : (row.nextStatus || "—")}</td>
              <td>{canWrite ? <input type="number" step="1" value={payrollPersonValue(inputs, row.personName, "wageAdjustment")} onChange={(event) => updatePayrollPerson(row.personName, "wageAdjustment", event.target.value)} /> : formatNumber(row.wageAdjustment)}</td>
              <td>{formatNumber(row.nextWage)}</td>
              <td>{formatNumber(row.apHourlyWage)}</td>
              <td>{formatNumber(row.acquiredPoints, 1)}</td>
              <td>{canWrite ? <input type="number" step="0.1" value={payrollPersonValue(inputs, row.personName, "referralPoints")} onChange={(event) => updatePayrollPerson(row.personName, "referralPoints", event.target.value)} /> : formatNumber(row.referralPoints, 1)}</td>
              <td>{formatNumber(row.totalPoints, 1)}</td>
              <td>{formatNumber(row.basePay)}</td>
              <td>{formatNumber(row.apIncentive)}</td>
              <td>{canWrite ? <input type="number" step="0.1" value={payrollPersonValue(inputs, row.personName, "trainingHours")} onChange={(event) => updatePayrollPerson(row.personName, "trainingHours", event.target.value)} /> : formatNumber(row.trainingHours, 1)}</td>
              <td>{formatNumber(row.trainingAllowance)}</td>
              <td>{formatNumber(row.presidentAward)}</td>
              <td>{formatNumber(row.pointAward)}</td>
              <td>{canWrite ? <input type="number" step="1" value={payrollPersonValue(inputs, row.personName, "hiringBonus")} onChange={(event) => updatePayrollPerson(row.personName, "hiringBonus", event.target.value)} /> : formatNumber(row.hiringBonus)}</td>
              <td>{canWrite ? <input type="number" step="1" value={payrollPersonValue(inputs, row.personName, "talentReferralIncentive")} onChange={(event) => updatePayrollPerson(row.personName, "talentReferralIncentive", event.target.value)} /> : formatNumber(row.talentReferralIncentive)}</td>
              <td>{canWrite ? <input type="number" step="1" value={payrollPersonValue(inputs, row.personName, "dealIncentive")} onChange={(event) => updatePayrollPerson(row.personName, "dealIncentive", event.target.value)} /> : formatNumber(row.dealIncentive)}</td>
              <td>{formatNumber(row.totalPayout)}</td>
              <td>{formatNumber(row.scheduledHours, 1)}</td>
              <td>{formatNumber(row.workDays)}</td>
              <td>{formatNumber(row.commuteDailyAllowance)}</td>
              <td>{formatNumber(row.commuteTotal)}</td>
            </tr>)}</tbody>
          </table>
        </div> : <p className={styles.empty}>まだ計算結果がありません。</p>}
        {canWrite && <button className={styles.secondary} type="button" disabled={saving} onClick={() => void saveInputs()}>{saving ? "保存しています" : "保存"}</button>}
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
