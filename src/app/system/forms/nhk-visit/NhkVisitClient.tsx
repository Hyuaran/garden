"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  buildNhkVisitReportMessage,
  calculateNhkVisitTotals,
  formatCompactVisitDate,
  NHK_VISIT_DESTINATIONS,
  NHK_VISIT_TASK_NAME,
  weekdayLabel,
  type NhkVisitDestination,
  type NhkVisitTransportFee,
} from "./_lib/nhk-visit";
import local from './nhk-visit.module.css';
import { FormPage, FormRow, RadioGroup, SelectField, Stepper, TextField, FixedValue, SubmitButton, ResultMessage, RecentList } from '../_components/form-kit';

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

export default function NhkVisitClient({ submitterName, employeeNumber, mobile = false }: { submitterName: string; employeeNumber: string; mobile?: boolean }) {
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

  return <FormPage mobile={mobile} title={mobile ? "NHK訪問業務 報告" : "NHK訪問業務 報告フォーム"} submitterName={submitterName} employeeNumber={employeeNumber} description="業務が終わったら、この画面に入力して送信してください。" guide={<p className={local.guide}><Link prefetch={false} href="/system/manuals/system/nhk-visit?tab=operation">使い方ガイドを見る</Link></p>}>
    <FormRow label={<>1 日付</>}>
      <TextField type="date" value={visitDate} onChange={(event) => setVisitDate(event.currentTarget.value)} />
    </FormRow>

    <FormRow label={<>2 時間</>}>
      <div className={local.timeRow}>
        <TextField type="time" value={startTime} onChange={(event) => setStartTime(event.currentTarget.value)} />
        <span>〜</span>
        <TextField type="time" value={endTime} onChange={(event) => setEndTime(event.currentTarget.value)} />
      </div>
    </FormRow>

    <FormRow label={<>3 派遣先</>}>
      <SelectField value={destination} onChange={(event) => setDestination(event.currentTarget.value)}>
        
        {NHK_VISIT_DESTINATIONS.map((item) => <option key={item} value={item}>{item}</option>)}
      </SelectField>
    </FormRow>

    <FormRow label={<>4 業務</>}>
      <FixedValue>{NHK_VISIT_TASK_NAME}</FixedValue>
    </FormRow>

    <FormRow label={<>5 成約件数</>} expanded>
      <div className={local.countGroup}>
        <h3>新規</h3>
        <Stepper label="地上" value={counts.newGround} onChange={value => { setCounts(current => ({ ...current, newGround: value })); setStatus(""); }} />
        <Stepper label="衛星" value={counts.newSatellite} onChange={value => { setCounts(current => ({ ...current, newSatellite: value })); setStatus(""); }} />
        <p className={local.total}>新規　計 <strong>{totals.newTotal}</strong> 件</p>
      </div>
      <div className={local.countGroup}>
        <h3>住所変更</h3>
        <Stepper label="地上" value={counts.addressGround} onChange={value => { setCounts(current => ({ ...current, addressGround: value })); setStatus(""); }} />
        <Stepper label="衛星" value={counts.addressSatellite} onChange={value => { setCounts(current => ({ ...current, addressSatellite: value })); setStatus(""); }} />
        <p className={local.total}>住所変更　計 <strong>{totals.addressTotal}</strong> 件</p>
      </div>
      <div className={local.countGroup}>
        <h3>口座・クレ</h3>
        <Stepper label="件数" value={counts.bankCredit} onChange={value => { setCounts(current => ({ ...current, bankCredit: value })); setStatus(""); }} />
      </div>
    </FormRow>

    <FormRow label={<>6 交通費</>}>
      <RadioGroup name="transportFee" label="交通費" options={["あり", "なし"]} value={transportFee} onChange={value => setTransportFee(value as NhkVisitTransportFee)} />
    </FormRow>

    <SubmitButton busy={sending} onClick={() => void submit()}>{mobile ? "送信する" : "報告内容を送信する"}</SubmitButton>

    <ResultMessage success={status.startsWith("送信しました")}>{status}</ResultMessage>

    {sentMessage && <section className={local.result}>
      <div className={local.resultHead}>
        <h2>報告内容</h2>
        <button type="button" className={local.copy} onClick={() => void copyText(sentMessage)}>コピー</button>
      </div>
      <pre className={local.preview}>{sentMessage}</pre>
    </section>}

    <RecentList title="直近 1 週間のあなたの報告" items={history.map((item) => {
          const itemTotals = calculateNhkVisitTotals(item);
          return <p key={item.id}>
            {formatCompactVisitDate(item.visit_date)}（{weekdayLabel(item.visit_date)}）{item.destination}　{item.start_time}〜{item.end_time}　新規{itemTotals.newTotal}・住所{itemTotals.addressTotal}・口座{item.bankCredit}　交通費{item.transport_fee}
          </p>;
        })} />
  </FormPage>;
}
