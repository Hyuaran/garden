"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { ListProcessingOverlay } from "@/app/system/list/_components/ListProcessingOverlay";
import type { LineShiftBlock } from "../_lib/shukkin";
import styles from "./LineSendDialog.module.css";

type SendState = "confirm" | "sent" | "failed";
type PreviewMember = { employeeNumber: string; name: string; linked: boolean; blocked: boolean };
type SendResult = {
  sent?: Array<{ employeeNumber: string; name: string; shift: string }>;
  unlinked?: Array<{ employeeNumber: string; name: string; shift: string; reason?: "unlinked" | "blocked" }>;
  failed?: Array<{ employeeNumber: string; name: string; shift: string; error?: string }>;
  sentAt?: string;
  error?: string;
};
type Quota = { quota: number | null; used: number; remaining: number | null; needed: number; members: PreviewMember[]; ownLinked: boolean; passwordRequired?: boolean };

type Props = {
  open: boolean;
  date: string;
  blocks: LineShiftBlock[];
  onClose: () => void;
};

function formatSlashDate(value: string) {
  return value.replace(/-/g, "/");
}

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${map.year}-${map.month}-${map.day} ${map.hour}:${map.minute}:${map.second}`;
}

function displayName(member: { name: string; employeeNumber: string }) {
  return member.name.trim().split(/\s+/)[0] || member.employeeNumber;
}

export default function LineSendDialog({ open, date, blocks, onClose }: Props) {
  const [state, setState] = useState<SendState>("confirm");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [quota, setQuota] = useState<Quota | null>(null);
  const [testOnly, setTestOnly] = useState(false);
  const [password, setPassword] = useState("");
  const [result, setResult] = useState<SendResult | null>(null);

  const employeeNumbers = useMemo(() => [...new Set(blocks.flatMap((block) => block.people.map((person) => person.employeeNumber)))], [blocks]);
  const previewByNumber = useMemo(() => new Map((quota?.members ?? []).map((member) => [member.employeeNumber, member])), [quota]);
  const needed = useMemo(() => blocks.reduce((count, block) => count + block.people.filter((person) => previewByNumber.get(person.employeeNumber)?.linked).length, 0), [blocks, previewByNumber]);
  const quotaShortage = quota?.remaining !== null && quota?.remaining !== undefined && needed > quota.remaining;

  useEffect(() => {
    if (!open) return;
    setState("confirm");
    setSending(false);
    setError("");
    setResult(null);
    setTestOnly(false);
    setPassword("");
    let cancelled = false;
    const params = new URLSearchParams({ needed: String(employeeNumbers.length) });
    employeeNumbers.forEach((number) => params.append("employeeNumber", number));
    void fetch(`/api/system/shukkin/line-send?${params.toString()}`, { cache: "no-store" })
      .then((response) => response.json())
      .then((body: Quota) => {
        if (!cancelled) setQuota(body);
      })
      .catch(() => {
        if (!cancelled) setQuota({ quota: null, used: 0, remaining: null, needed: employeeNumbers.length, members: [], ownLinked: false });
      });
    return () => {
      cancelled = true;
    };
  }, [employeeNumbers, open]);

  useEffect(() => {
    if (!open || sending) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose, open, sending]);

  if (!open) return null;

  const rows = blocks.map((block) => {
    const sendable = block.people.filter((person) => previewByNumber.get(person.employeeNumber)?.linked);
    const undelivered = block.people.filter((person) => !previewByNumber.get(person.employeeNumber)?.linked);
    return { block, sendable, undelivered };
  });

  async function send() {
    if (sending || quotaShortage) return;
    setSending(true);
    setError("");
    try {
      const response = await fetch("/api/system/shukkin/line-send", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          date,
          testOnly,
          password: quota?.passwordRequired ? password : undefined,
          blocks: blocks.map((block) => ({
            shift: block.shift,
            employeeNumbers: block.people.map((person) => person.employeeNumber),
            message: block.message,
          })),
        }),
      });
      const body = await response.json().catch(() => ({})) as SendResult;
      if (!response.ok) {
        setState("failed");
        setError(typeof body.error === "string" ? body.error : "公式 LINE に送れませんでした。しばらくしてからもう一度お試しください");
        return;
      }
      setResult(body);
      setState((body.failed?.length ?? 0) > 0 ? "failed" : "sent");
      if ((body.failed?.length ?? 0) > 0) setError("一部の送信に失敗しました。");
    } finally {
      setSending(false);
    }
  }

  const sentCount = result?.sent?.length ?? 0;
  const unlinked = result?.unlinked?.filter((item) => item.reason !== "blocked") ?? [];
  const blocked = result?.unlinked?.filter((item) => item.reason === "blocked") ?? [];
  const failed = result?.failed ?? [];

  return <>
    {createPortal(
      <div className={styles.backdrop} onMouseDown={() => {
        if (!sending) onClose();
      }}>
        <div className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby="line-send-title" onMouseDown={(event) => event.stopPropagation()}>
          {state === "sent" ? <>
            <h2 id="line-send-title">送信しました</h2>
            <div className={styles.result}>
              <span>届けた {sentCount} 人</span>
              <span>届かなかった {unlinked.length + blocked.length} 人{unlinked.length > 0 ? `（未紐づけ：${unlinked.map((item) => item.name || item.employeeNumber).join("・")}）` : ""}{blocked.length > 0 ? `（ブロック中：${blocked.map((item) => item.name || item.employeeNumber).join("・")}）` : ""}</span>
            </div>
            {result?.sentAt && <p className={styles.sentAt}>時刻：{formatDateTime(result.sentAt)}</p>}
            <div className={styles.actions}>
              <button type="button" className={styles.primary} onClick={onClose}>閉じる</button>
            </div>
          </> : <>
            <h2 id="line-send-title">この内容で公式 LINE に送信します</h2>
            <p className={styles.destination}>スタッフ連絡用_official から、対象日 {formatSlashDate(date)} のシフト連絡を届けます</p>
            <p className={quotaShortage ? styles.danger : styles.quota}>
              今月の枠：{quota?.remaining === null || quota?.remaining === undefined ? `今回 ${needed} 通` : `残り ${quota.remaining} 通／今回 ${needed} 通`}
            </p>
            {quotaShortage && <p className={styles.danger}>今月の送信枠が足りません（残り {quota?.remaining} 通・今回 {needed} 通）。プランの変更が要ります。</p>}
            <table className={styles.table}>
              <thead><tr><th>シフト</th><th>送れる人</th><th>届かない人</th><th>文面</th></tr></thead>
              <tbody>
                {rows.map(({ block, sendable, undelivered }) => <tr key={block.shift}>
                  <td>{block.shift}</td>
                  <td className={styles.names}>{sendable.map(displayName).join("・") || "なし"}{sendable.length > 0 ? `（${sendable.length}）` : ""}</td>
                  <td className={styles.undelivered}>{undelivered.map((person) => {
                    const preview = previewByNumber.get(person.employeeNumber);
                    return `${displayName(person)}（${preview?.blocked ? "ブロック中" : "未"}）`;
                  }).join("・") || "なし"}</td>
                  <td><details className={styles.details}><summary>見る</summary><pre>{block.message}</pre></details></td>
                </tr>)}
              </tbody>
            </table>
            <label className={styles.testOnly}>
              <input type="checkbox" checked={testOnly} disabled={!quota?.ownLinked} onChange={(event) => setTestOnly(event.currentTarget.checked)} />
              自分だけに試し送り
              {!quota?.ownLinked && <small>自分の LINE を先に連携してください</small>}
            </label>
            {quota?.passwordRequired && <label className={styles.password}>
              送信パスワード
              <input type="password" value={password} autoComplete="off" inputMode="numeric" onChange={(event) => setPassword(event.currentTarget.value)} placeholder="事務から案内された番号" />
              <small>通数を無駄に使わないため、送信にはパスワードが要ります</small>
            </label>}
            {state === "failed" && error && <p className={styles.error} role="alert">{error}</p>}
            {failed.length > 0 && <p className={styles.error}>送れなかった人：{failed.map((item) => item.name || item.employeeNumber).join("・")}</p>}
            <div className={styles.actions}>
              <button type="button" className={styles.secondary} disabled={sending} onClick={onClose}>やめる</button>
              <button type="button" className={styles.primary} disabled={sending || blocks.length === 0 || Boolean(quotaShortage) || (Boolean(quota?.passwordRequired) && !password.trim())} onClick={() => void send()}>{state === "failed" ? "もう一度" : "送信する"}</button>
            </div>
          </>}
        </div>
      </div>,
      document.body,
    )}
    <ListProcessingOverlay open={sending} mode="search" title="公式 LINE に送信しています…" />
  </>;
}
