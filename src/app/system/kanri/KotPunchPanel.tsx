"use client";
import { useEffect, useRef, useState } from "react";
import Modal from "@/app/system/_components/Modal/Modal";
import DoneOverlay from "@/app/system/_components/DoneOverlay/DoneOverlay";
import {
  ActionButton,
  SubmitButton,
} from "@/app/system/forms/_components/form-kit";
import styles from "./kot-punch-panel.module.css";

type SendRow = {
  employee_id: string;
  name: string;
  work_date: string;
  status: string;
  reason: string;
  transformed: { punches: unknown[] };
  error?: string | null;
  previousStatus?: string;
};
type SendData = { startDate: string | null; rows: SendRow[] };
type Closing = { name: string; employeeKey: string; isClosing: boolean };
async function json(response: Response) {
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "処理できませんでした。");
  return data;
}
export default function KotPunchPanel({
  date,
  onGate,
}: {
  date: string;
  onGate: (ready: boolean) => void;
}) {
  const [data, setData] = useState<SendData | null>(null);
  const [closing, setClosing] = useState<Closing[] | null>(null);
  const [closingError, setClosingError] = useState("");
  const [error, setError] = useState("");
  const [result, setResult] = useState("");
  const [confirm, setConfirm] = useState<"send" | "bypass" | null>(null);
  const [progress, setProgress] = useState("");
  const [checking, setChecking] = useState(false);
  const pending = useRef(false);
  const gateRef = useRef(onGate);
  gateRef.current = onGate;
  const activeDate = useRef(date);
  activeDate.current = date;
  useEffect(() => {
    let active = true;
    setClosing(null);
    setClosingError("");
    setData(null);
    gateRef.current(false);
    // 分類はGarden内の読み取りだけ。KING OF TIMEの締めはボタンでだけ読む。
    void fetch("/api/system/attendance/kot-send?date=" + date)
      .then(json)
      .then((data) => {
        if (
          !Array.isArray(data.rows) ||
          !(data.startDate === null || typeof data.startDate === "string")
        )
          throw new Error("送信対象を読み込めませんでした。");
        if (active) setData(data);
      })
      .catch((error) => {
        if (active) setError(error.message);
      });
    return () => {
      active = false;
    };
  }, [date]);
  async function refresh() {
    const snapshot = date;
    const next = await json(
      await fetch("/api/system/attendance/kot-send?date=" + snapshot),
    );
    if (activeDate.current === snapshot) setData(next);
  }
  async function checkClosing() {
    if (pending.current) return;
    const snapshot = date;
    pending.current = true;
    setChecking(true);
    setClosingError("");
    gateRef.current(false);
    try {
      const response = await json(
        await fetch("/api/system/kanri/kot-closing?date=" + snapshot),
      );
      if (activeDate.current !== snapshot) return;
      setClosing(response.rows);
      gateRef.current(response.confirmed === true);
    } catch (error) {
      if (activeDate.current === snapshot) {
        setClosing(null);
        setClosingError((error as Error).message);
      }
    } finally {
      pending.current = false;
      setChecking(false);
    }
  }
  const ready =
    data?.rows.filter(
      (row) =>
        row.status === "ready" ||
        (row.previousStatus === "unknown" && row.status === "expired"),
    ) || [];
  async function send() {
    if (pending.current) return;
    pending.current = true;
    setConfirm(null);
    setError("");
    let sent = 0,
      failed = 0;
    try {
      for (let index = 0; index < ready.length; index++) {
        setProgress(`${ready.length}人中 ${index + 1}人目を送信しています…`);
        const row = ready[index];
        const response = await json(
          await fetch("/api/system/attendance/kot-send", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              date: row.work_date,
              employee_id: row.employee_id,
            }),
          }),
        );
        if (response.status === "sent") sent++;
        else failed++;
      }
      setResult(`送信しました（成功 ${sent}人・失敗 ${failed}人）`);
      await refresh();
    } catch (error) {
      setError(
        `${(error as Error).message}（成功 ${sent}人・失敗 ${failed}人）`,
      );
    } finally {
      setProgress("");
      pending.current = false;
    }
  }
  async function manual(row: SendRow) {
    if (pending.current) return;
    pending.current = true;
    try {
      await json(
        await fetch("/api/system/attendance/kot-send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            date: row.work_date,
            employee_id: row.employee_id,
            manual: true,
          }),
        }),
      );
      await refresh();
    } catch (error) {
      setError((error as Error).message);
    } finally {
      pending.current = false;
    }
  }
  return (
    <section className={styles.panel} aria-label="打刻と締め">
      <h2>打刻と締め　対象日 {date}</h2>
      <div className={styles.sending} aria-busy={!data}>
        {!data ? (
          <p>読み込み中です…</p>
        ) : !data.startDate || data.startDate > date ? (
          <p>打刻は KING OF TIME で直接行っています。</p>
        ) : (
          <>
            <h3>打刻を KING OF TIME へ送る</h3>
            <p>
              送れる {ready.length}人（
              {ready.reduce(
                (sum, row) => sum + row.transformed.punches.length,
                0,
              )}
              件）　 要確認{" "}
              {data.rows.filter((row) => row.status === "needs_check").length}
              人　 修正待ち{" "}
              {data.rows.filter((row) => row.status === "pending").length}人　
              期限切れ{" "}
              {data.rows.filter((row) => row.status === "expired").length}人
            </p>
            <ul>
              {data.rows
                .filter((row) => row.status !== "ready" || row.error)
                .map((row) => (
                  <li key={row.employee_id + row.work_date}>
                    {row.name} {row.work_date}：{row.error || row.reason}
                    {row.status === "expired" && (
                      <ActionButton onClick={() => void manual(row)}>
                        入力済みにする
                      </ActionButton>
                    )}
                  </li>
                ))}
            </ul>
            <ActionButton
              disabled={!!progress || checking || !ready.length}
              onClick={() => setConfirm("send")}
            >
              KING OF TIME へ送る
            </ActionButton>
          </>
        )}
      </div>
      {result && <p role="status">{result}</p>}
      {error && <p role="alert">{error}</p>}
      <div className={styles.closing}>
        <h3>KING OF TIME の締め</h3>
        {closing ? (
          <p>
            締めずみ {closing.filter((row) => row.isClosing).length}人　未{" "}
            {closing.filter((row) => !row.isClosing).length}人 （
            {closing
              .filter((row) => !row.isClosing)
              .map((row) => row.name)
              .join("・")}
            ）
          </p>
        ) : (
          <p>締めの確認が必要です。</p>
        )}
        <p>KING OF TIME の画面で締めてから、もう一度確かめてください。</p>
        <ActionButton
          disabled={checking || !!progress}
          onClick={() => void checkClosing()}
        >
          {checking ? "確かめています…" : "締めを確かめる"}
        </ActionButton>
        {closingError && (
          <>
            <p role="alert">締めを確かめられませんでした。{closingError}</p>
            <ActionButton onClick={() => setConfirm("bypass")}>
              確かめずに進む
            </ActionButton>
          </>
        )}
      </div>
      {confirm && (
        <Modal
          title={
            confirm === "send"
              ? "KING OF TIME へ送りますか？"
              : "締めを確かめずに進みますか？"
          }
          onClose={() => setConfirm(null)}
          actions={
            <SubmitButton
              busy={false}
              onClick={() => {
                if (confirm === "send") void send();
                else {
                  gateRef.current(true);
                  setConfirm(null);
                }
              }}
            >
              {confirm === "send" ? "送信する" : "確かめずに進む"}
            </SubmitButton>
          }
        >
          <p>
            {confirm === "send"
              ? `${ready.length}人分（${ready.reduce((sum, row) => sum + row.transformed.punches.length, 0)}件）を送ります。送った打刻は Garden から修正できません。`
              : "締めずみを確認できていません。対象日を確認してから取り込んでください。"}
          </p>
        </Modal>
      )}
      {progress && <DoneOverlay title={progress} />}
    </section>
  );
}
