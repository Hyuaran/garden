"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import SystemBreadcrumb from "@/app/system/_components/SystemBreadcrumb/SystemBreadcrumb";
import type { KotDailyRow } from "@/app/system/kanri/_lib/kot-daily";
import {
  buildAttendanceMessage,
  buildLineShiftBlocks,
  compactSlashDate,
  defaultAttendanceTime,
  DEFAULT_PLAN_FIELDS,
  isWeekendOrHoliday,
  nextDateWithPlan,
  SHUKKIN_GROUPS,
  slashDate,
  summarizeKotCoverage,
  type ShukkinGroup,
  type ShukkinMember,
  type ShukkinPlanFields,
} from "./_lib/shukkin";
import styles from "./shukkin.module.css";

type Tab = "attendance" | "line" | "members";
type Summary = { startDate: string; endDate: string; peopleCount: number };

function todayJst() {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

function addDays(date: string, days: number) {
  const [year, month, day] = date.split("-").map(Number);
  const next = new Date(Date.UTC(year, month - 1, day + days));
  return next.toISOString().slice(0, 10);
}

function dateOptions(rows: KotDailyRow[]) {
  return [...new Set(rows.map((row) => row.date))].sort();
}

async function copyText(text: string) {
  await navigator.clipboard.writeText(text);
}

export default function ShukkinClient({ canEditMembers }: { canEditMembers: boolean }) {
  const today = useMemo(() => todayJst(), []);
  const [tab, setTab] = useState<Tab>("attendance");
  const [members, setMembers] = useState<ShukkinMember[]>([]);
  const [rows, setRows] = useState<KotDailyRow[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [fileName, setFileName] = useState("");
  const [message, setMessage] = useState("");
  const [loadingCsv, setLoadingCsv] = useState(false);
  const [loadingMembers, setLoadingMembers] = useState(true);
  const [attendanceDate, setAttendanceDate] = useState(today);
  const [attendanceTime, setAttendanceTime] = useState<"10:00" | "14:00">(() => defaultAttendanceTime(today));
  const [withConfirmation, setWithConfirmation] = useState(false);
  const [lineDate, setLineDate] = useState(addDays(today, 1));
  const [plans, setPlans] = useState<ShukkinPlanFields>(DEFAULT_PLAN_FIELDS);
  const [missingGroups, setMissingGroups] = useState<Record<string, ShukkinGroup>>({});
  const dates = useMemo(() => dateOptions(rows), [rows]);

  const loadMembers = useCallback(async () => {
    setLoadingMembers(true);
    const response = await fetch("/api/system/shukkin/members", { cache: "no-store" });
    if (response.ok) {
      const body = await response.json();
      setMembers(Array.isArray(body.members) ? body.members : []);
    }
    setLoadingMembers(false);
  }, []);

  useEffect(() => {
    void loadMembers();
  }, [loadMembers]);

  // シフト連絡の対象日：明日（予定のある次の日）。CSV に入っていなければ CSV の最後の日にする
  // （選択欄の値と中身が食い違って空になるのを防ぐ・2026-09-19 本番で発生）
  useEffect(() => {
    if (rows.length === 0) return;
    const candidate = nextDateWithPlan(rows, addDays(today, 1));
    const available = dateOptions(rows);
    setLineDate(available.includes(candidate) ? candidate : available[available.length - 1] ?? candidate);
  }, [rows, today]);
  const tomorrow = addDays(today, 1);
  const tomorrowMissing = rows.length > 0 && !dates.includes(tomorrow);

  const attendanceText = useMemo(() => buildAttendanceMessage({
    rows,
    members,
    date: attendanceDate,
    tableTime: attendanceTime,
    withConfirmation,
    planFields: plans,
  }), [attendanceDate, attendanceTime, members, plans, rows, withConfirmation]);

  const coverage = useMemo(() => summarizeKotCoverage({ rows, members, date: attendanceDate }), [attendanceDate, members, rows]);
  const lineBlocks = useMemo(() => buildLineShiftBlocks({ rows, members, date: lineDate }), [lineDate, members, rows]);
  const allLineText = useMemo(() => lineBlocks.map((block) => block.summary).join("\n\n\n"), [lineBlocks]);

  // 日別データは 1 日ずつ出すことが多いので、今日と明日の 2 ファイル（それ以上でも）をまとめて読み込む。
  // 期間で出した 1 ファイルでもよい。同じ人・同じ日の行は後から読んだ方で上書きする
  async function readCsvFiles(files: File[]) {
    if (files.length === 0) return;
    setLoadingCsv(true);
    setMessage("");
    try {
      const merged = new Map<string, KotDailyRow>();
      for (const file of files) {
        const form = new FormData();
        form.append("file", file);
        const response = await fetch("/api/system/shukkin/parse", { method: "POST", body: form });
        const body = await response.json();
        if (!response.ok) {
          setMessage(`${file.name}：${String(body.error ?? "CSV を読み込めませんでした")}`);
          return;
        }
        for (const row of (Array.isArray(body.rows) ? body.rows : []) as KotDailyRow[]) merged.set(`${row.employeeCode}-${row.date}`, row);
      }
      const nextRows = [...merged.values()];
      const dates = [...new Set(nextRows.map((row) => row.date))].sort();
      const nextSummary = { startDate: dates[0] ?? "", endDate: dates[dates.length - 1] ?? "", peopleCount: new Set(nextRows.map((row) => row.employeeCode)).size };
      setRows(nextRows);
      setSummary(nextSummary);
      setFileName(files.map((file) => file.name).join("、"));
      if (nextSummary.startDate && (attendanceDate < nextSummary.startDate || attendanceDate > nextSummary.endDate)) {
        setAttendanceDate(nextSummary.startDate);
        setAttendanceTime(defaultAttendanceTime(nextSummary.startDate));
      }
      setMessage("読み込みました");
    } finally {
      setLoadingCsv(false);
    }
  }

  function moveMember(index: number, delta: -1 | 1) {
    const current = [...members];
    const member = current[index];
    const targetIndex = index + delta;
    if (!member || !current[targetIndex] || current[targetIndex].groupName !== member.groupName) return;
    [current[index], current[targetIndex]] = [current[targetIndex], current[index]];
    setMembers(reindex(current));
  }

  function updateMember(index: number, next: Partial<ShukkinMember>) {
    setMembers(reindex(members.map((member, currentIndex) => currentIndex === index ? { ...member, ...next } : member)));
  }

  function removeMember(index: number) {
    setMembers(reindex(members.filter((_, currentIndex) => currentIndex !== index)));
  }

  function addMember(employeeNumber: string) {
    const normalized = employeeNumber.trim().padStart(4, "0");
    if (!/^\d{4}$/.test(normalized) || members.some((member) => member.employeeNumber === normalized)) return;
    setMembers(reindex([...members, { employeeNumber: normalized, name: "", groupName: "宮永チーム", sortOrder: 10, active: true }]));
  }

  function addKotMember(row: KotDailyRow, groupName: ShukkinGroup) {
    const employeeNumber = row.employeeCode.trim().padStart(4, "0");
    if (!/^\d{4}$/.test(employeeNumber) || members.some((member) => member.employeeNumber === employeeNumber)) return;
    const nextMembers = reindex([...members, {
      employeeNumber,
      name: "",
      displayName: row.name,
      groupName,
      sortOrder: 10,
      active: true,
    }]);
    setMembers(nextMembers);
    void saveMembers(nextMembers);
  }

  async function saveMembers(nextMembers = members) {
    setMessage("");
    const response = await fetch("/api/system/shukkin/members", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ members: nextMembers }),
    });
    const body = await response.json();
    if (!response.ok) {
      setMessage(String(body.error ?? "保存できませんでした"));
      return;
    }
    setMembers(Array.isArray(body.members) ? body.members : nextMembers);
    setMessage("保存しました");
  }

  return <div className={styles.pageShell}>
    <header className={styles.header}>
      <SystemBreadcrumb items={[{ label: "フォーム", href: "/system/forms" }, { label: "出勤表・シフト連絡" }]} />
      <h1>出勤表・シフト連絡</h1>
      <p className={styles.lead}>KING OF TIME の日別データ（出力の型「Garden管理表ポータル（日）」）を読み込むと、文面を作ります。</p>
    </header>

    <section className={styles.panel}>
      <h2>1. KOT の日別データ</h2>
      <div className={styles.fileRow}>
        <label className={styles.fileButton}>CSV を選ぶ<input type="file" accept=".csv,text/csv" multiple onChange={(event) => {
          void readCsvFiles(Array.from(event.currentTarget.files ?? []));
        }} /></label>
        <span>{fileName || "未選択"}</span>
        {summary && <strong>{slashDate(summary.startDate)}〜{slashDate(summary.endDate)}・{summary.peopleCount} 人</strong>}
        {loadingCsv && <span>読み込み中...</span>}
        {message && <span className={styles.message}>{message}</span>}
      </div>
      <p className={styles.hint}>今日の日別データ（出勤表用）と明日の日別データ（シフト連絡用）を、2 つまとめて選んでください。期間で出した 1 ファイルでも使えます。</p>
    </section>

    <div className={styles.tabs} role="tablist" aria-label="文面">
      <button type="button" aria-selected={tab === "attendance"} onClick={() => setTab("attendance")}>出勤表</button>
      <button type="button" aria-selected={tab === "line"} onClick={() => setTab("line")}>シフト連絡（LINE）</button>
      <button type="button" aria-selected={tab === "members"} onClick={() => setTab("members")}>並びの設定</button>
    </div>

    {tab === "attendance" && <section className={styles.workArea}>
      {/* ［コピー］は文面の枠の上の行の右端（シフト連絡のまとまりと同じ位置・2026-09-19 東海林さん） */}
      <div className={`${styles.controls} ${styles.attendanceControls}`}>
        <label>対象日<SelectDate value={attendanceDate} dates={dates} onChange={(date) => {
          setAttendanceDate(date);
          setAttendanceTime(defaultAttendanceTime(date));
        }} /></label>
        <div className={styles.radioGroup} aria-label="時刻">
          <span>時刻</span>
          {isWeekendOrHoliday(attendanceDate) && <label><input type="radio" checked={attendanceTime === "10:00"} onChange={() => setAttendanceTime("10:00")} />10:00</label>}
          <label><input type="radio" checked={attendanceTime === "14:00"} onChange={() => setAttendanceTime("14:00")} />14:00</label>
        </div>
        <label className={styles.check}><input type="checkbox" checked={withConfirmation} onChange={(event) => setWithConfirmation(event.currentTarget.checked)} />出勤の確認を付ける</label>
        <button type="button" className={styles.copy} onClick={() => void copyText(attendanceText)}>コピー</button>
      </div>
      <pre className={styles.preview}>{attendanceText}</pre>
      <PlanFields plans={plans} onChange={setPlans} />
      <Coverage
        coverage={coverage}
        canEditMembers={canEditMembers}
        missingGroups={missingGroups}
        onMissingGroupChange={(employeeNumber, groupName) => setMissingGroups((current) => ({ ...current, [employeeNumber]: groupName }))}
        onAddMissing={(row) => addKotMember(row, missingGroups[row.employeeCode] ?? "宮永チーム")}
      />
    </section>}

    {tab === "line" && <section className={styles.workArea}>
      <div className={styles.controls}>
        <label>対象日<SelectDate value={lineDate} dates={dates} onChange={setLineDate} /></label>
        <p className={styles.targetText}>対象：宮永チーム・小泉チーム・石原チーム・新人チームの全員</p>
      </div>
      {tomorrowMissing && <p className={styles.notice} role="status">明日（{compactSlashDate(tomorrow)}）の日別データが入っていません。KOT の日別データ出力で、出力対象年月を今日〜明日にして出してください。</p>}
      <div className={styles.blocks}>
        {/* 見出し＝シフト（人数）と［コピー］、その下に送る相手、送る文面（［コピー］で取れるのは文面だけ） */}
        {lineBlocks.map((block) => <article className={styles.lineBlock} key={block.shift}>
          <div className={styles.lineHead}>
            <h2>{block.shift}<span>（{block.recipients.length} 人）</span></h2>
            <button type="button" className={styles.copy} onClick={() => void copyText(block.message)} aria-label={`${block.shift} の文面をコピー`}>コピー</button>
          </div>
          <ul className={styles.lineRecipients} aria-label="送る相手">{block.recipients.map((line) => <li key={line}>{line}</li>)}</ul>
          <pre className={styles.preview}>{block.message}</pre>
        </article>)}
        {lineBlocks.length === 0 && <p className={styles.empty}>この日のシフト連絡はありません。</p>}
      </div>
      <button type="button" className={styles.primary} disabled={!allLineText} onClick={() => void copyText(allLineText)}>送る相手と文面をまとめてコピー</button>
    </section>}

    {tab === "members" && <section className={styles.workArea}>
      <div className={styles.memberHeader}>
        <p>{canEditMembers ? "保存するとすぐに文面へ反映されます。" : "並びの変更は責任者以上ができます。"}</p>
        {canEditMembers && <AddMember onAdd={addMember} />}
      </div>
      {loadingMembers ? <p>読み込み中...</p> : <div className={styles.memberColumns}>
        {SHUKKIN_GROUPS.map((group) => <div className={styles.memberGroup} key={group}>
          <h2>{group}</h2>
          {members.map((member, index) => ({ member, index })).filter((item) => item.member.groupName === group).map(({ member, index }) => (
            <div className={styles.memberRow} key={member.employeeNumber}>
              <span>{member.employeeNumber}</span>
              <strong>{member.name || member.displayName || "名前未設定"}</strong>
              <button type="button" disabled={!canEditMembers} onClick={() => moveMember(index, -1)}>↑</button>
              <button type="button" disabled={!canEditMembers} onClick={() => moveMember(index, 1)}>↓</button>
              <select disabled={!canEditMembers} value={member.groupName} onChange={(event) => updateMember(index, { groupName: event.currentTarget.value as ShukkinGroup })}>
                {SHUKKIN_GROUPS.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
              <button type="button" disabled={!canEditMembers} onClick={() => removeMember(index)}>外す</button>
            </div>
          ))}
        </div>)}
      </div>}
      {canEditMembers && <button type="button" className={styles.primary} onClick={() => void saveMembers()}>保存</button>}
    </section>}
  </div>;
}

function reindex(members: ShukkinMember[]) {
  return SHUKKIN_GROUPS.flatMap((groupName) => members
    .filter((member) => member.groupName === groupName)
    .map((member, index) => ({ ...member, sortOrder: (index + 1) * 10 })));
}

function SelectDate({ value, dates, onChange }: { value: string; dates: string[]; onChange: (date: string) => void }) {
  return dates.length > 0 ? <select value={value} onChange={(event) => onChange(event.currentTarget.value)}>
    {dates.map((date) => <option key={date} value={date}>{slashDate(date)}</option>)}
  </select> : <input type="date" value={value} onChange={(event) => onChange(event.currentTarget.value)} />;
}

function PlanFields({ plans, onChange }: { plans: ShukkinPlanFields; onChange: (plans: ShukkinPlanFields) => void }) {
  const fields: Array<[keyof ShukkinPlanFields, string]> = [
    ["hyuaran", "ヒュアラン予定"],
    ["interview", "面接予定"],
    ["training", "研修予定"],
    ["ueda", "上田予定"],
    ["afterConfirm", "後確予定"],
  ];
  return <div className={styles.planFields}>
    {fields.map(([key, label]) => <label key={key}><span>{label}</span><textarea value={plans[key]} onChange={(event) => onChange({ ...plans, [key]: event.currentTarget.value })} /></label>)}
  </div>;
}

function Coverage({
  coverage,
  canEditMembers,
  missingGroups,
  onMissingGroupChange,
  onAddMissing,
}: {
  coverage: ReturnType<typeof summarizeKotCoverage>;
  canEditMembers: boolean;
  missingGroups: Record<string, ShukkinGroup>;
  onMissingGroupChange: (employeeNumber: string, groupName: ShukkinGroup) => void;
  onAddMissing: (row: KotDailyRow) => void;
}) {
  return <div className={styles.coverage}>
    <span>KOT に居ない人 {coverage.missingInKot.length} 人：{coverage.missingInKot.map((member) => member.name || member.displayName || member.employeeNumber).join("、") || "なし"}</span>
    <div className={styles.missingOrder}>
      <span>並びに無い人 {coverage.missingInOrder.length} 人：{coverage.missingInOrder.map((row) => row.name).join("、") || "なし"}</span>
      {coverage.missingInOrder.length > 0 && <div className={styles.missingOrderRows}>
        {coverage.missingInOrder.map((row) => {
          const employeeNumber = row.employeeCode.trim().padStart(4, "0");
          return <div className={styles.missingOrderRow} key={employeeNumber}>
            <span>{employeeNumber}</span>
            <strong>{row.name}</strong>
            <select
              disabled={!canEditMembers}
              value={missingGroups[row.employeeCode] ?? "宮永チーム"}
              onChange={(event) => onMissingGroupChange(row.employeeCode, event.currentTarget.value as ShukkinGroup)}
            >
              {SHUKKIN_GROUPS.map((group) => <option key={group} value={group}>{group}</option>)}
            </select>
            <button type="button" disabled={!canEditMembers} onClick={() => onAddMissing(row)}>並びに足す</button>
          </div>;
        })}
      </div>}
    </div>
  </div>;
}

function AddMember({ onAdd }: { onAdd: (employeeNumber: string) => void }) {
  const [value, setValue] = useState("");
  return <div className={styles.addMember}>
    <input value={value} placeholder="社員番号" onChange={(event) => setValue(event.currentTarget.value)} />
    <button type="button" onClick={() => {
      onAdd(value);
      setValue("");
    }}>足す</button>
  </div>;
}
