"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import SystemBreadcrumb from "@/app/system/_components/SystemBreadcrumb/SystemBreadcrumb";
import {
  buildNhkVisitReportMessage,
  calculateNhkVisitTotals,
  formatCompactVisitDate,
  formatVisitDate,
  NHK_VISIT_DESTINATIONS,
  NHK_VISIT_TASK_NAME,
  weekdayLabel,
  type NhkVisitDestination,
  type NhkVisitTransportFee,
} from "./_lib/nhk-visit";
import styles from "./nhk-visit.module.css";

type Counts = {
  newGround: number;
  newSatellite: number;
  addressGround: number;
  addressSatellite: number;
  bankCredit: number;
};

type ReportHistory = Counts & {
  id: string;
  visit_date: string;
  start_time: string;
  end_time: string;
  destination: NhkVisitDestination;
  transport_fee: NhkVisitTransportFee;
};

function todayJst() {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function normalizeReport(row: Record<string, unknown>): ReportHistory {
  return {
    id: String(row.id),
    visit_date: String(row.visit_date),
    start_time: String(row.start_time).slice(0, 5),
    end_time: String(row.end_time).slice(0, 5),
    destination: row.destination as NhkVisitDestination,
    transport_fee: row.transport_fee as NhkVisitTransportFee,
    newGround: Number(row.new_ground ?? 0),
    newSatellite: Number(row.new_satellite ?? 0),
    addressGround: Number(row.address_ground ?? 0),
    addressSatellite: Number(row.address_satellite ?? 0),
    bankCredit: Number(row.bank_credit ?? 0),
  };
}

async function copyText(text: string) {
  await navigator.clipboard.writeText(text);
}

export default function NhkVisitClient({ submitterName, employeeNumber }: { submitterName: string; employeeNumber: string }) {
  const today = useMemo(() => todayJst(), []);
  const [visitDate, setVisitDate] = useState(today);
  const [startTime, setStartTime] = useState("09:30");
  const [endTime, setEndTime] = useState("18:00");
  const [destination, setDestination] = useState("");
  const [counts, setCounts] = useState<Counts>({ newGround: 0, newSatellite: 0, addressGround: 0, addressSatellite: 0, bankCredit: 0 });
  const [transportFee, setTransportFee] = useState<NhkVisitTransportFee>("あり");
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState("");
  const [sentMessage, setSentMessage] = useState("");
  const [history, setHistory] = useState<ReportHistory[]>([]);

  const totals = useMemo(() => calculateNhkVisitTotals(counts), [counts]);
  const previewMessage = useMemo(() => destination ? buildNhkVisitReportMessage({
    visitDate,
    startTime,
    endTime,
    destination: destination as NhkVisitDestination,
    newGround: counts.newGround,
    newSatellite: counts.newSatellite,
    addressGround: counts.addressGround,
    addressSatellite: counts.addressSatellite,
    bankCredit: counts.bankCredit,
    transportFee,
  }) : "", [counts, destination, endTime, startTime, transportFee, visitDate]);

  const loadHistory = useCallback(async () => {
    const response = await fetch("/api/system/nhk-visit?mine=1", { cache: "no-store" });
    if (!response.ok) return;
    const body = await response.json();
    setHistory(Array.isArray(body.reports) ? body.reports.map(normalizeReport) : []);
  }, []);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  function updateCount(key: keyof Counts, delta: -1 | 1) {
    setCounts((current) => ({ ...current, [key]: Math.max(0, current[key] + delta) }));
    setStatus("");
  }

  async function submit() {
    setSending(true);
    setStatus("");
    try {
      const response = await fetch("/api/system/nhk-visit", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ visitDate, startTime, endTime, destination, ...counts, transportFee }),
      });
      const body = await response.json();
      if (!response.ok) {
        setStatus(String(body.error ?? "送信できませんでした"));
        return;
      }
      setSentMessage(String(body.message ?? previewMessage));
      setStatus(body.kintoneStatus === "synced" ? "送信しました（Kintone にも記録しました）" : "送信しました（Kintone は後で送り直します）");
      await loadHistory();
    } finally {
      setSending(false);
    }
  }

  return <div className={styles.pageShell}>
    <header className={styles.header}>
      <SystemBreadcrumb items={[{ label: "フォーム", href: "/system/forms" }, { label: "NHK訪問業務 報告フォーム" }]} />
      <h1>NHK訪問業務 報告フォーム</h1>
      <p className={styles.lead}>業務が終わったら、この画面に入力して送信してください。</p>
    </header>

    {/* 使い方は画面の中に書かず、画像つきの使い方ガイド（マニュアル①）へ送る（東海林さん 2026-09-24） */}
    <p className={styles.guide}>
      <a href="/system/manuals/system/nhk-visit?tab=operation">使い方ガイドを見る</a>
    </p>

    <p className={styles.sender}>送信者　{submitterName}（{employeeNumber}）</p>

    <section className={styles.panel}>
      <h2>1 日付</h2>
      <input type="date" value={visitDate} onChange={(event) => setVisitDate(event.currentTarget.value)} />
    </section>

    <section className={styles.panel}>
      <h2>2 時間</h2>
      <div className={styles.timeRow}>
        <input type="time" value={startTime} onChange={(event) => setStartTime(event.currentTarget.value)} />
        <span>〜</span>
        <input type="time" value={endTime} onChange={(event) => setEndTime(event.currentTarget.value)} />
      </div>
    </section>

    <section className={styles.panel}>
      <h2>3 派遣先</h2>
      <select value={destination} onChange={(event) => setDestination(event.currentTarget.value)}>
        <option value="">選択してください</option>
        {NHK_VISIT_DESTINATIONS.map((item) => <option key={item} value={item}>{item}</option>)}
      </select>
    </section>

    <section className={styles.panel}>
      <h2>4 業務</h2>
      <p className={styles.fixedText}>{NHK_VISIT_TASK_NAME}</p>
    </section>

    <section className={styles.panel}>
      <h2>5 成約件数</h2>
      <div className={styles.countGroup}>
        <h3>■新規</h3>
        <Counter label="地上" value={counts.newGround} onMinus={() => updateCount("newGround", -1)} onPlus={() => updateCount("newGround", 1)} />
        <Counter label="衛星" value={counts.newSatellite} onMinus={() => updateCount("newSatellite", -1)} onPlus={() => updateCount("newSatellite", 1)} />
        <p className={styles.total}>新規　計 <strong>{totals.newTotal}</strong> 件</p>
      </div>
      <div className={styles.countGroup}>
        <h3>■住所変更</h3>
        <Counter label="地上" value={counts.addressGround} onMinus={() => updateCount("addressGround", -1)} onPlus={() => updateCount("addressGround", 1)} />
        <Counter label="衛星" value={counts.addressSatellite} onMinus={() => updateCount("addressSatellite", -1)} onPlus={() => updateCount("addressSatellite", 1)} />
        <p className={styles.total}>住所変更　計 <strong>{totals.addressTotal}</strong> 件</p>
      </div>
      <div className={styles.countGroup}>
        <h3>■口座・クレ</h3>
        <Counter label="件数" value={counts.bankCredit} onMinus={() => updateCount("bankCredit", -1)} onPlus={() => updateCount("bankCredit", 1)} />
      </div>
    </section>

    <section className={styles.panel}>
      <h2>6 交通費</h2>
      <div className={styles.segmented}>
        {(["あり", "なし"] as const).map((item) => <label key={item}>
          <input type="radio" name="transportFee" checked={transportFee === item} onChange={() => setTransportFee(item)} />
          <span>{item}</span>
        </label>)}
      </div>
    </section>

    <button type="button" className={styles.primary} disabled={sending} onClick={() => void submit()}>
      {sending ? "送信中..." : "報告内容を送信する"}
    </button>

    {status && <p className={status.startsWith("送信しました") ? styles.message : styles.error} role="status">{status}</p>}

    {sentMessage && <section className={styles.result}>
      <div className={styles.resultHead}>
        <h2>報告内容</h2>
        <button type="button" className={styles.copy} onClick={() => void copyText(sentMessage)}>コピー</button>
      </div>
      <pre className={styles.preview}>{sentMessage}</pre>
    </section>}

    <section className={styles.history}>
      <h2>直近 1 週間のあなたの報告</h2>
      {history.length === 0 ? <p className={styles.empty}>まだありません</p> : <div className={styles.historyBox}>
        {history.map((item) => {
          const itemTotals = calculateNhkVisitTotals(item);
          return <p key={item.id}>
            {formatCompactVisitDate(item.visit_date)}（{weekdayLabel(item.visit_date)}）{item.destination}　{item.start_time}〜{item.end_time}　新規{itemTotals.newTotal}・住所{itemTotals.addressTotal}・口座{item.bankCredit}　交通費{item.transport_fee}
          </p>;
        })}
      </div>}
    </section>
  </div>;
}

function Counter({ label, value, onMinus, onPlus }: { label: string; value: number; onMinus: () => void; onPlus: () => void }) {
  return <div className={styles.counter}>
    <span>{label}</span>
    <button type="button" onClick={onMinus} aria-label={`${label}を減らす`}>－</button>
    <output>{value}</output>
    <button type="button" onClick={onPlus} aria-label={`${label}を増やす`}>＋</button>
  </div>;
}
