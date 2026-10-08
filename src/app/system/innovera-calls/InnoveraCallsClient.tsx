"use client";

import { useEffect, useMemo, useState } from "react";
import { isRoleAtLeast, type GardenRole } from "@/app/root/_constants/types";
import SystemBreadcrumb from "@/app/system/_components/SystemBreadcrumb/SystemBreadcrumb";
import type { CallRecordingAccess } from "@/lib/innovera/call-access";
import MultiSelectFilter from "@/app/system/list/_components/MultiSelectFilter";
import styles from "./innovera-calls.module.css";

type ApiCall = {
  id: string;
  uniqid: string;
  startTime: string | null;
  displayTime: string;
  type: string;
  typeLabel: string;
  status: string;
  statusLabel: string;
  circuitId: string;
  circuitName: string;
  extension: string;
  employeeName: string;
  counterpartNumber: string;
  counterpartName: string;
  talkSeconds: number | null;
  talkTimeLabel: string;
  hasRecording: boolean;
  inProgress: boolean;
  canPlay: boolean;
};

type MappingResult = {
  mapped: Array<{ user: { number?: string | null; name?: string | null }; employee: { name?: string | null } | null }>;
  unmappedEmployees: Array<{ employee_id: string; name?: string | null; innovera_extension?: string | null; innovera_mobile_extension?: string | null }>;
  unmappedUsers: Array<{ id?: string | null; number?: string | null; name?: string | null }>;
};

type LineCircuit = {
  id: string;
  name: string;
  number: string;
  freeNumber: string;
  circuitNum: string;
};

type FilterOptions = {
  employees: Array<{ label: string; extensions: string[] }>;
  circuits: Array<{ value: string; label: string }>;
};

function todayJst() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

/** 見出し下の「INNOVERA最終更新」の日時（リストマスタと同じ 2026/10/08(木) 15:11 の形） */
function formatSyncStamp(value: Date) {
  const parts = new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(value);
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  return `${get("year")}/${get("month")}/${get("day")}(${get("weekday")}) ${get("hour")}:${get("minute")}`;
}

function shiftDate(date: string, days: number) {
  const value = new Date(`${date}T00:00:00+09:00`);
  value.setDate(value.getDate() + days);
  return value.toLocaleDateString("en-CA", { timeZone: "Asia/Tokyo" });
}

function weekStart(date: string) {
  const value = new Date(`${date}T00:00:00+09:00`);
  const day = value.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  value.setDate(value.getDate() + diff);
  return value.toLocaleDateString("en-CA", { timeZone: "Asia/Tokyo" });
}

function ownExtensionLabel(ownExtension: string | null, ownExtensions: string[], lineEmployee: { extension?: string | null; mobileExtension?: string | null } | null) {
  const pc = lineEmployee?.extension || ownExtension;
  const mobile = lineEmployee?.mobileExtension || ownExtensions.find((extension) => extension !== pc) || null;
  if (pc && mobile) return `（PC 内線 ${pc} ／ モバイル内線 ${mobile}）`;
  if (pc) return `（PC 内線 ${pc}）`;
  if (mobile) return `（モバイル内線 ${mobile}）`;
  return "";
}

function minuteValue(date: string, time: string) {
  return `${date}T${time}`;
}

// 空欄の補い方：日付が両方空なら今日、片方だけなら同じ日。時刻が空なら開始 00:00・終了 23:59
export function resolveRange(fromDate: string, fromTime: string, toDate: string, toTime: string, today: string) {
  const start = fromDate || toDate || today;
  const end = toDate || fromDate || today;
  return { fromDate: start, fromTime: fromTime || "00:00", toDate: end, toTime: toTime || "23:59" };
}

function validateRange(fromDate: string, fromTime: string, toDate: string, toTime: string) {
  if (!fromDate || !fromTime || !toDate || !toTime) return "日時の形式が正しくありません";
  const from = new Date(`${minuteValue(fromDate, fromTime)}:00+09:00`);
  const to = new Date(`${minuteValue(toDate, toTime)}:00+09:00`);
  const oldest = new Date(`${todayJst()}T00:00:00+09:00`);
  oldest.setFullYear(oldest.getFullYear() - 1);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return "日時の形式が正しくありません";
  if (from.getTime() > to.getTime()) return "開始は終了より前にしてください";
  if (from.getTime() < oldest.getTime()) return "1年より前の履歴は表示できません";
  if (to.getTime() - from.getTime() > 31 * 24 * 60 * 60 * 1000) return "期間は 31 日以内にしてください";
  return null;
}

function formatRange(fromDate: string, fromTime: string, toDate: string, toTime: string) {
  return `${fromDate} ${fromTime} ～ ${toDate} ${toTime}`;
}

// 日時は「2026-10-08 13:54:57」の形（日付と秒まで・東海林さん指定）
function callDisplayTime(call: ApiCall) {
  return call.startTime || call.displayTime;
}

export default function InnoveraCallsClient({
  access,
  ownExtension,
  ownExtensions,
  ownName = "",
  role,
}: {
  access: CallRecordingAccess;
  ownExtension: string | null;
  ownExtensions: string[];
  ownName?: string;
  role: GardenRole;
}) {
  const [fromDate, setFromDate] = useState("");
  const [fromTime, setFromTime] = useState("");
  const [toDate, setToDate] = useState("");
  const [toTime, setToTime] = useState("");
  const [selectedExtensions, setSelectedExtensions] = useState<string[]>(access === "own" ? [] : ownExtensions);
  const [circuit, setCircuit] = useState("");
  const [type, setType] = useState("");
  const [status, setStatus] = useState("");
  const [number, setNumber] = useState("");
  const [calls, setCalls] = useState<ApiCall[]>([]);
  const [counts, setCounts] = useState({ total: 0, success: 0, missed: 0, inProgress: 0 });
  const [filterOptions, setFilterOptions] = useState<FilterOptions>({ employees: [], circuits: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [playing, setPlaying] = useState<ApiCall | null>(null);
  const [page, setPage] = useState(1);
  const [shownRange, setShownRange] = useState(() => resolveRange("", "", "", "", todayJst()));
  const PAGE_SIZE = 100;
  const [lineLoading, setLineLoading] = useState(true);
  const [lineError, setLineError] = useState<string | null>(null);
  const [lineMessage, setLineMessage] = useState<string | null>(null);
  const [lastLoadedAt, setLastLoadedAt] = useState<Date | null>(null);
  const [currentLine, setCurrentLine] = useState<LineCircuit | null>(null);
  const [lineEmployee, setLineEmployee] = useState<{ extension?: string | null; mobileExtension?: string | null } | null>(null);
  const [circuits, setCircuits] = useState<LineCircuit[]>([]);
  const [selectedCircuit, setSelectedCircuit] = useState("");
  const [lineDialog, setLineDialog] = useState<{ step: "confirm" | "working" | "done" | "error"; next: LineCircuit | null; message?: string } | null>(null);

  const showAllControls = access !== "own";
  const canSeeMapping = isRoleAtLeast(role, "admin");
  const [mapping, setMapping] = useState<MappingResult | null>(null);
  const [mappingError, setMappingError] = useState<string | null>(null);

  function closePlayer() {
    setPlaying(null);
  }

  function applyPreset(kind: "today" | "yesterday" | "week") {
    const base = todayJst();
    const start = kind === "today" ? base : kind === "yesterday" ? shiftDate(base, -1) : weekStart(base);
    const end = kind === "yesterday" ? start : base;
    setFromDate(start);
    setFromTime("00:00");
    setToDate(end);
    setToTime("23:59");
  }

  async function loadMapping() {
    try {
      const response = await fetch("/api/system/innovera-calls/mapping", { cache: "no-store" });
      const body = await response.json() as MappingResult & { ok: boolean; error?: string };
      if (!response.ok || !body.ok) throw new Error(body.error || "紐づけの確認に失敗しました");
      setMapping(body);
      setMappingError(null);
    } catch (cause) {
      setMappingError(cause instanceof Error ? cause.message : "紐づけの確認に失敗しました");
    }
  }

  async function loadCalls() {
    setPage(1);
    const range = resolveRange(fromDate, fromTime, toDate, toTime, todayJst());
    const validation = validateRange(range.fromDate, range.fromTime, range.toDate, range.toTime);
    if (validation) {
      setError(validation);
      return;
    }
    setLoading(true);
    setError(null);
    closePlayer();
    const params = new URLSearchParams({
      from: minuteValue(range.fromDate, range.fromTime),
      to: minuteValue(range.toDate, range.toTime),
    });
    setShownRange(range);
    for (const item of selectedExtensions) params.append("extension", item);
    if (circuit) params.set("circuit", circuit);
    if (type) params.set("type", type);
    if (status) params.set("status", status);
    if (number.trim()) params.set("number", number.trim());
    try {
      const response = await fetch(`/api/system/innovera-calls?${params}`, { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "INNOVERA に接続できませんでした");
      setCalls(result.calls ?? []);
      setCounts(result.counts ?? { total: 0, success: 0, missed: 0, inProgress: 0 });
      setFilterOptions(result.filterOptions ?? { employees: [], circuits: [] });
      setLastLoadedAt(new Date());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "INNOVERA に接続できませんでした");
      setCalls([]);
    } finally {
      setLoading(false);
    }
  }

  async function loadLine() {
    setLineLoading(true);
    setLineError(null);
    try {
      const response = await fetch("/api/system/innovera-calls/line", { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "発信番号を確認できませんでした");
      setCurrentLine(result.current ?? null);
      setLineEmployee(result.employee ?? null);
      setCircuits(result.circuits ?? []);
      setSelectedCircuit(result.current?.id ?? "");
    } catch (cause) {
      setLineError(cause instanceof Error ? cause.message : "発信番号を確認できませんでした");
    } finally {
      setLineLoading(false);
    }
  }

  function openLineDialog() {
    if (!selectedCircuit) return;
    const next = circuits.find((item) => item.id === selectedCircuit) ?? null;
    setLineMessage(null);
    setLineError(null);
    setLineDialog({ step: "confirm", next });
  }

  async function changeLine() {
    if (!selectedCircuit || !lineDialog || lineDialog.step !== "confirm") return;
    setLineDialog({ ...lineDialog, step: "working" });
    try {
      const response = await fetch("/api/system/innovera-calls/line", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ circuitId: selectedCircuit }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "発信番号を変更できませんでした");
      setCurrentLine(result.current);
      setLineMessage("変更しました");
      setLineDialog({ step: "done", next: result.current ?? lineDialog.next });
      window.setTimeout(() => setLineDialog((current) => (current?.step === "done" ? null : current)), 1500);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "発信番号を変更できませんでした";
      setLineError(message);
      setLineDialog({ step: "error", next: lineDialog.next, message });
    }
  }

  useEffect(() => {
    if (canSeeMapping) void loadMapping();
  }, [canSeeMapping]);

  useEffect(() => {
    void loadCalls();
    void loadLine();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    function closeOnEsc(event: KeyboardEvent) {
      if (event.key === "Escape") closePlayer();
    }
    document.addEventListener("keydown", closeOnEsc);
    return () => document.removeEventListener("keydown", closeOnEsc);
  }, []);

  const pageCount = Math.max(1, Math.ceil(calls.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pagedCalls = useMemo(() => calls.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE), [calls, currentPage]);

  // リストマスタと同じ複数選択プルダウンに渡す形。値＝その人の内線（カンマ区切り）
  const employeeChoices = useMemo(() => {
    const sameSet = (a: string[], b: string[]) => a.length === b.length && a.every((item) => b.includes(item));
    const list = filterOptions.employees.map((employee) => ({ label: employee.label, extensions: employee.extensions }));
    if (ownExtensions.length > 0 && !list.some((employee) => sameSet(employee.extensions, ownExtensions))) {
      list.unshift({ label: ownName ? `${ownName}（自分）` : "自分", extensions: ownExtensions });
    }
    return list;
  }, [filterOptions.employees, ownExtensions, ownName]);
  const employeeOptionGroups = useMemo(() => ([{
    options: employeeChoices.map((employee) => ({
      value: employee.extensions.join(","),
      label: employee.label,
      count: calls.filter((call) => employee.extensions.includes(call.extension)).length,
      empty: false,
    })),
  }]), [employeeChoices, calls]);
  const selectedEmployeeValues = useMemo(() => {
    const set = new Set(selectedExtensions);
    return employeeChoices
      .filter((employee) => employee.extensions.length > 0 && employee.extensions.every((extension) => set.has(extension)))
      .map((employee) => employee.extensions.join(","));
  }, [employeeChoices, selectedExtensions]);
  function applyEmployeeSelection(values: string[]) {
    setSelectedExtensions(Array.from(new Set(values.flatMap((value) => value.split(",")).filter(Boolean))));
  }

  const ownSelected = useMemo(() => {
    const own = new Set(ownExtensions);
    return selectedExtensions.length > 0 && selectedExtensions.every((extension) => own.has(extension));
  }, [ownExtensions, selectedExtensions]);
  const ownExtensionText = ownExtensionLabel(ownExtension, ownExtensions, lineEmployee);
  const rangeText = formatRange(shownRange.fromDate, shownRange.fromTime, shownRange.toDate, shownRange.toTime);

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <SystemBreadcrumb items={[{ label: "INNOVERA履歴・録音" }]} />
        <h1>INNOVERA履歴・録音</h1>
        <div className={styles.syncStatus}>
          <span>INNOVERA最終更新：{loading ? "取得中..." : lastLoadedAt ? formatSyncStamp(lastLoadedAt) : "未取得"}</span>
          <button
            type="button"
            className={`${styles.syncIconButton} ${loading ? styles.syncIconBusy : ""}`}
            onClick={() => void loadCalls()}
            disabled={loading}
            aria-label="INNOVERA から取り直す"
            title={loading ? "取得しています…" : "INNOVERA から取り直す（いまの絞り込み条件で最新の通話履歴を取得します）"}
          >
            <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false">
              <path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
              <path d="M19.8 4.6v4.2h-4.2z" fill="currentColor" />
            </svg>
          </button>
        </div>
      </header>

      <section className={styles.linePanel}>
        <div>
          <h2>自分の発信番号</h2>
          <p>{lineLoading ? "確認中..." : currentLine ? currentLine.name : "未設定"}</p>
          {ownExtensionText && <p>{ownExtensionText}</p>}
        </div>
        <select value={selectedCircuit} onChange={(event) => setSelectedCircuit(event.target.value)} disabled={lineLoading || !circuits.length}>
          <option value="">選択してください</option>
          {circuits.map((item) => (
            <option key={item.id} value={item.id}>{item.name}</option>
          ))}
        </select>
        <button type="button" onClick={openLineDialog} disabled={!selectedCircuit || selectedCircuit === currentLine?.id}>変更する</button>
        {lineMessage && <span className={styles.ok}>{lineMessage}</span>}
        {lineError && <span className={styles.error}>{lineError}</span>}
      </section>

      <form className={styles.filters} onSubmit={(event) => { event.preventDefault(); void loadCalls(); }}>
        <div className={styles.filterRow}>
        <label>開始<input type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} /></label>
        <label className={styles.timeField}>時刻<input type="time" value={fromTime} onChange={(event) => setFromTime(event.target.value)} /></label>
        <span className={styles.rangeSeparator}>～</span>
        <label>終了<input type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} /></label>
        <label className={styles.timeField}>時刻<input type="time" value={toTime} onChange={(event) => setToTime(event.target.value)} /></label>
        <div className={styles.presetButtons}>
          <button type="button" onClick={() => applyPreset("today")}>今日</button>
          <button type="button" onClick={() => applyPreset("yesterday")}>昨日</button>
          <button type="button" onClick={() => applyPreset("week")}>今週</button>
        </div>
        {showAllControls && (
          <div className={styles.employeePicker}>
            <MultiSelectFilter
              label="担当"
              value={selectedEmployeeValues}
              groups={employeeOptionGroups}
              onChange={applyEmployeeSelection}
              searchable={employeeChoices.length > 12}
              countNote="（ ）は表示中の期間の通話数です。何も選ばなければ全員"
            />
            {ownExtensions.length > 0 && (
              <button type="button" className={styles.ownOnly} onClick={() => setSelectedExtensions(ownExtensions)} disabled={ownSelected}>自分だけ</button>
            )}
          </div>
        )}
        </div>
        <div className={styles.filterRow}>
        <label className={styles.circuitField}>回線<select value={circuit} onChange={(event) => setCircuit(event.target.value)}><option value="">すべて</option>{filterOptions.circuits.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
        <label>発着<select value={type} onChange={(event) => setType(event.target.value)}><option value="">すべて</option><option value="2">発信</option><option value="1">着信</option></select></label>
        <label>結果<select value={status} onChange={(event) => setStatus(event.target.value)}><option value="">すべて</option><option value="1">通話成功</option><option value="2">通話中に切断</option><option value="3">不在</option></select></label>
        <label className={styles.numberField}>番号<input value={number} onChange={(event) => setNumber(event.target.value)} /></label>
        <button type="submit" className={styles.submit} disabled={loading}>{loading ? "表示中..." : "表示"}</button>
        </div>
      </form>

      {error && <p className={styles.error} role="alert">{error}</p>}
      <p className={styles.summary}>{rangeText} の通話 {counts.total.toLocaleString()} 件（通話成功 {counts.success.toLocaleString()}・不在 {counts.missed.toLocaleString()}・通話中 {counts.inProgress.toLocaleString()}）</p>

      {pageCount > 1 && (
        <div className={styles.pager} aria-label="ページ送り">
          <button type="button" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={currentPage <= 1}>前の 100 件</button>
          <span>{(currentPage - 1) * PAGE_SIZE + 1}〜{Math.min(currentPage * PAGE_SIZE, calls.length)} 件 ／ 全 {calls.length.toLocaleString()} 件（{currentPage} / {pageCount} ページ）</span>
          <button type="button" onClick={() => setPage((current) => Math.min(pageCount, current + 1))} disabled={currentPage >= pageCount}>次の 100 件</button>
        </div>
      )}

      <div className={styles.tableWrap}>
        <table>
          <thead>
            <tr><th>日時</th><th>発着</th><th>相手の番号</th><th>回線</th><th>担当</th><th>通話時間</th><th>結果</th><th>録音</th></tr>
          </thead>
          <tbody>
            {pagedCalls.length ? pagedCalls.map((call) => (
              <tr key={call.id}>
                <td>{callDisplayTime(call)}</td>
                <td>{call.typeLabel}</td>
                <td>{call.counterpartNumber || "-"}</td>
                <td>{call.circuitName || "-"}</td>
                <td>{call.employeeName || call.extension || "-"}</td>
                <td>{call.inProgress ? "通話中" : call.talkTimeLabel}</td>
                <td>{call.inProgress ? "通話中" : call.statusLabel}</td>
                <td>{call.canPlay && (call.talkSeconds ?? 0) > 0 ? <button type="button" onClick={() => setPlaying(call)}>再生</button> : call.inProgress ? "通話中" : "-"}</td>
              </tr>
            )) : <tr><td colSpan={8}>{loading ? "読み込み中..." : "履歴がありません"}</td></tr>}
          </tbody>
        </table>
      </div>

      {pageCount > 1 && (
        <div className={styles.pager} aria-label="ページ送り（下）">
          <button type="button" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={currentPage <= 1}>前の 100 件</button>
          <span>{currentPage} / {pageCount} ページ</span>
          <button type="button" onClick={() => setPage((current) => Math.min(pageCount, current + 1))} disabled={currentPage >= pageCount}>次の 100 件</button>
        </div>
      )}

      {lineDialog && (
        <div className={styles.modalBackdrop} onMouseDown={(event) => { if (event.target === event.currentTarget && lineDialog.step !== "working") setLineDialog(null); }}>
          <div className={`${styles.modal} ${styles.modalSmall}`} role="dialog" aria-modal="true" aria-labelledby="line-dialog-title" aria-busy={lineDialog.step === "working"}>
            <div className={styles.modalHead}>
              <h2 id="line-dialog-title">発信番号の変更</h2>
              {lineDialog.step !== "working" && <button type="button" onClick={() => setLineDialog(null)} aria-label="閉じる">×</button>}
            </div>
            <div className={styles.modalBody}>
              {lineDialog.step === "confirm" && (
                <>
                  <dl className={styles.lineChange}>
                    <div className={styles.lineChangeRow}>
                      <dt>現状</dt>
                      <dd>{currentLine?.name ?? "未設定"}</dd>
                    </div>
                    <div className={`${styles.lineChangeRow} ${styles.lineChangeNext}`}>
                      <dt>変更後</dt>
                      <dd>{lineDialog.next?.name ?? "選択した回線"}</dd>
                    </div>
                  </dl>
                  <p className={styles.lineChangeAsk}>変更しますが、本当によろしいですか？</p>
                  <div className={styles.modalActions}>
                    <button type="button" className={styles.modalSecondary} onClick={() => setLineDialog(null)}>キャンセル</button>
                    <button type="button" onClick={() => void changeLine()}>変更する</button>
                  </div>
                </>
              )}
              {lineDialog.step === "working" && (
                <div className={styles.working} role="status" aria-live="assertive">
                  <div className={styles.spinner} aria-hidden="true" />
                  <p>発信番号を変更しています…</p>
                </div>
              )}
              {lineDialog.step === "done" && (
                <div className={styles.working} role="status" aria-live="polite">
                  <p className={styles.ok}>変更しました：{lineDialog.next?.name ?? ""}</p>
                </div>
              )}
              {lineDialog.step === "error" && (
                <>
                  <p className={styles.error} role="alert">{lineDialog.message}</p>
                  <div className={styles.modalActions}>
                    <button type="button" className={styles.modalSecondary} onClick={() => setLineDialog(null)}>閉じる</button>
                    <button type="button" onClick={() => setLineDialog({ step: "confirm", next: lineDialog.next })}>もう一度</button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {playing && (
        <div className={styles.modalBackdrop} onMouseDown={(event) => { if (event.target === event.currentTarget) closePlayer(); }}>
          <div className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="recording-title">
            <div className={styles.modalHead}>
              <h2 id="recording-title">録音の再生</h2>
              <button type="button" onClick={closePlayer} aria-label="閉じる">×</button>
            </div>
            <div className={styles.modalBody}>
              <p>{playing.startTime ?? playing.displayTime}　{playing.typeLabel}　{playing.circuitName || "-"}</p>
              <p>相手 {playing.counterpartNumber || "-"}　担当 {playing.employeeName || playing.extension || "-"}　通話時間 {playing.talkTimeLabel}</p>
              <audio
                controls
                autoPlay
                controlsList="nodownload"
                src={`/api/system/innovera-calls/recording/${encodeURIComponent(playing.id)}?uniqid=${encodeURIComponent(playing.uniqid)}&date=${encodeURIComponent((playing.startTime ?? fromDate).slice(0, 10))}`}
              />
              <p className={styles.modalNote}>ダウンロードや削除はできません。</p>
            </div>
          </div>
        </div>
      )}

      {canSeeMapping && (
        <details className={styles.mappingNote}>
          <summary>内線の紐づけ確認{mapping ? `（未登録の従業員 ${mapping.unmappedEmployees.length} 人・未登録の内線 ${mapping.unmappedUsers.length}）` : ""}</summary>
          {mappingError && <p className={styles.error}>{mappingError}</p>}
          {!mapping && !mappingError && <p>確認中...</p>}
          {mapping && (
            <>
              <p>内線が紐づいていない従業員（在籍中）：{mapping.unmappedEmployees.length ? mapping.unmappedEmployees.map((employee) => {
                const extensions = [employee.innovera_extension, employee.innovera_mobile_extension].filter(Boolean).join(" ／ ");
                return `${employee.name}${extensions ? `（内線 ${extensions} は INNOVERA に無い）` : ""}`;
              }).join(" ／ ") : "なし"}</p>
              <p>従業員に紐づいていない内線：{mapping.unmappedUsers.length ? mapping.unmappedUsers.map((user) => `${user.number}${user.name ? `（${user.name}）` : ""}`).join(" ／ ") : "なし"}</p>
              <p>紐づいている内線：{mapping.mapped.length} 件。紐づけは Root の従業員編集「INNOVERA 内線番号（PC）」と「INNOVERA 内線番号（モバイル）」で行います。</p>
            </>
          )}
        </details>
      )}
    </div>
  );
}
