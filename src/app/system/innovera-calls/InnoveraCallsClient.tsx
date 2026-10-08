"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { isRoleAtLeast, type GardenRole } from "@/app/root/_constants/types";
import SystemBreadcrumb from "@/app/system/_components/SystemBreadcrumb/SystemBreadcrumb";
import type { CallRecordingAccess } from "@/lib/innovera/call-access";
import styles from "./innovera-calls.module.css";

type ApiCall = {
  id: string;
  uniqid: string;
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

function ownExtensionLabel(ownExtension: string | null, ownExtensions: string[], lineEmployee: { extension?: string | null; mobileExtension?: string | null } | null) {
  const pc = lineEmployee?.extension || ownExtension;
  const mobile = lineEmployee?.mobileExtension || ownExtensions.find((extension) => extension !== pc) || null;
  if (pc && mobile) return `（PC 内線 ${pc} ／ モバイル内線 ${mobile}）`;
  if (pc) return `（PC 内線 ${pc}）`;
  if (mobile) return `（モバイル内線 ${mobile}）`;
  return "";
}

export default function InnoveraCallsClient({
  access,
  ownExtension,
  ownExtensions,
  role,
}: {
  access: CallRecordingAccess;
  ownExtension: string | null;
  ownExtensions: string[];
  role: GardenRole;
}) {
  const [date, setDate] = useState(todayJst());
  const [mine, setMine] = useState(access === "own");
  const [extension, setExtension] = useState("");
  const [circuit, setCircuit] = useState("");
  const [type, setType] = useState("");
  const [status, setStatus] = useState("");
  const [number, setNumber] = useState("");
  const [calls, setCalls] = useState<ApiCall[]>([]);
  const [counts, setCounts] = useState({ total: 0, success: 0, missed: 0, inProgress: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [playing, setPlaying] = useState<string | null>(null);
  const [lineLoading, setLineLoading] = useState(true);
  const [lineError, setLineError] = useState<string | null>(null);
  const [lineMessage, setLineMessage] = useState<string | null>(null);
  const [currentLine, setCurrentLine] = useState<LineCircuit | null>(null);
  const [lineEmployee, setLineEmployee] = useState<{ extension?: string | null; mobileExtension?: string | null } | null>(null);
  const [circuits, setCircuits] = useState<LineCircuit[]>([]);
  const [selectedCircuit, setSelectedCircuit] = useState("");

  const showAllControls = access !== "own";
  const canSeeMapping = isRoleAtLeast(role, "admin");
  const [mapping, setMapping] = useState<MappingResult | null>(null);
  const [mappingError, setMappingError] = useState<string | null>(null);

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
    setLoading(true);
    setError(null);
    setPlaying(null);
    const params = new URLSearchParams({ date });
    if (mine) params.set("mine", "1");
    if (extension) {
      for (const item of extension.split(",").map((value) => value.trim()).filter(Boolean)) {
        params.append("extension", item);
      }
    }
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

  async function changeLine() {
    if (!selectedCircuit) return;
    const next = circuits.find((item) => item.id === selectedCircuit);
    const ok = window.confirm(`${currentLine?.name ?? "現在の発信番号"} から ${next?.name ?? "選択した回線"} に変更します。よろしいですか。`);
    if (!ok) return;
    setLineMessage(null);
    setLineError(null);
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
    } catch (cause) {
      setLineError(cause instanceof Error ? cause.message : "発信番号を変更できませんでした");
    }
  }

  useEffect(() => {
    if (canSeeMapping) void loadMapping();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canSeeMapping]);

  useEffect(() => {
    void loadCalls();
    void loadLine();
  }, []);

  const employeeOptions = useMemo(() => {
    const byName = new Map<string, Set<string>>();
    for (const call of calls) {
      const label = call.employeeName || call.extension;
      if (!label || !call.extension) continue; // 担当の内線が無い行（自動留守録など）は選択肢に出さない
      if (!byName.has(label)) byName.set(label, new Set());
      if (call.extension) byName.get(label)?.add(call.extension);
    }
    return Array.from(byName.entries()).map(([label, values]) => [Array.from(values).join(","), label] as const);
  }, [calls]);
  const circuitOptions = useMemo(() => {
    return Array.from(new Map(calls.map((call) => [call.circuitId, call.circuitName || call.circuitId])).entries());
  }, [calls]);
  const ownExtensionText = ownExtensionLabel(ownExtension, ownExtensions, lineEmployee);

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <SystemBreadcrumb items={[{ label: "INNOVERA履歴・録音" }]} />
        <h1>INNOVERA履歴・録音</h1>
        <p>INNOVERA の通話履歴を見て、終話してから 1 分たった通話の録音をその場で聞けます。録音や履歴は消せません。</p>
      </header>

      <section className={styles.linePanel}>
        <div>
          <h2>自分の発信番号</h2>
          <p>{lineLoading ? "確認中..." : currentLine ? `${currentLine.name} ${currentLine.freeNumber || currentLine.number}` : "未設定"}</p>
          {ownExtensionText && <p>{ownExtensionText}</p>}
        </div>
        <select value={selectedCircuit} onChange={(event) => setSelectedCircuit(event.target.value)} disabled={lineLoading || !circuits.length}>
          <option value="">選択してください</option>
          {circuits.map((item) => (
            <option key={item.id} value={item.id}>{item.name} {item.freeNumber || item.number}</option>
          ))}
        </select>
        <button type="button" onClick={() => void changeLine()} disabled={!selectedCircuit || selectedCircuit === currentLine?.id}>変更する</button>
        {lineMessage && <span className={styles.ok}>{lineMessage}</span>}
        {lineError && <span className={styles.error}>{lineError}</span>}
      </section>

      <form className={styles.filters} onSubmit={(event) => { event.preventDefault(); void loadCalls(); }}>
        <label>日付<input type="date" value={date} onChange={(event) => setDate(event.target.value)} /></label>
        {showAllControls && <label className={styles.check}><input type="checkbox" checked={mine} onChange={(event) => setMine(event.target.checked)} />自分だけ</label>}
        {showAllControls && <label>担当<select value={extension} onChange={(event) => setExtension(event.target.value)}><option value="">全員</option>{employeeOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>}
        <label>回線<select value={circuit} onChange={(event) => setCircuit(event.target.value)}><option value="">すべて</option>{circuitOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label>発着<select value={type} onChange={(event) => setType(event.target.value)}><option value="">すべて</option><option value="2">発信</option><option value="1">着信</option></select></label>
        <label>結果<select value={status} onChange={(event) => setStatus(event.target.value)}><option value="">すべて</option><option value="1">通話成功</option><option value="2">通話中に切断</option><option value="3">不在</option></select></label>
        <label>番号<input value={number} onChange={(event) => setNumber(event.target.value)} /></label>
        <button type="submit" disabled={loading}>{loading ? "表示中..." : "表示"}</button>
      </form>

      {error && <p className={styles.error} role="alert">{error}</p>}
      <p className={styles.summary}>{date} の通話 {counts.total.toLocaleString()} 件（通話成功 {counts.success.toLocaleString()}・不在 {counts.missed.toLocaleString()}・通話中 {counts.inProgress.toLocaleString()}）</p>

      <div className={styles.tableWrap}>
        <table>
          <thead>
            <tr><th>時刻</th><th>発着</th><th>相手の番号</th><th>回線</th><th>担当</th><th>通話時間</th><th>結果</th><th>録音</th></tr>
          </thead>
          <tbody>
            {calls.length ? calls.map((call) => (
              <Fragment key={call.id}>
                <tr>
                  <td>{call.displayTime}</td>
                  <td>{call.typeLabel}</td>
                  <td>{call.counterpartNumber || "-"}</td>
                  <td>{call.circuitName || "-"}</td>
                  <td>{call.employeeName || call.extension || "-"}</td>
                  <td>{call.inProgress ? "通話中" : call.talkTimeLabel}</td>
                  <td>{call.inProgress ? "通話中" : call.statusLabel}</td>
                  <td>{call.canPlay ? <button type="button" onClick={() => setPlaying(playing === call.id ? null : call.id)}>再生</button> : call.inProgress ? "通話中" : "-"}</td>
                </tr>
                {playing === call.id && (
                  <tr>
                    <td colSpan={8}>
                      <audio
                        controls
                        controlsList="nodownload"
                        src={`/api/system/innovera-calls/recording/${encodeURIComponent(call.id)}?uniqid=${encodeURIComponent(call.uniqid)}&date=${encodeURIComponent(date)}`}
                      />
                    </td>
                  </tr>
                )}
              </Fragment>
            )) : <tr><td colSpan={8}>{loading ? "読み込み中..." : "履歴がありません"}</td></tr>}
          </tbody>
        </table>
      </div>

      {canSeeMapping && (
        <section className={styles.mappingNote}>
          <h2>内線の紐づけ確認</h2>
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
        </section>
      )}
    </div>
  );
}
