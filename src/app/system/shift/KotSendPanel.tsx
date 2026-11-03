"use client";

import { useRef, useState } from "react";
import Modal from "@/app/system/_components/Modal/Modal";
import DoneOverlay from "@/app/system/_components/DoneOverlay/DoneOverlay";
import {
  ActionButton,
  SubmitButton,
} from "@/app/system/forms/_components/form-kit";
import { shiftDate } from "./ShiftDays";

export type KotDisplayRow = {
  employee_id: string;
  work_date: string;
  kot_status?: string;
  kot_sent_at?: string | null;
  kot_error?: string | null;
};

export default function KotSendPanel({
  month,
  rows,
  people,
  prompt,
  onRefresh,
  onBusy,
  disabled = false,
}: {
  month: string;
  rows: KotDisplayRow[];
  people: { employee_id: string; name: string }[];
  prompt: number;
  onRefresh: () => void;
  onBusy: (busy: boolean) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [dismissed, setDismissed] = useState(0);
  const [progress, setProgress] = useState("");
  const [result, setResult] = useState("");
  const [error, setError] = useState("");
  const pending = useRef(false);
  const today = new Date().toLocaleDateString("sv-SE", {
    timeZone: "Asia/Tokyo",
  });
  const targets = rows.filter(
    (row) =>
      row.work_date > today &&
      ["unsent", "failed"].includes(row.kot_status || "unsent"),
  );
  const ids = people.filter((person) =>
    targets.some((row) => row.employee_id === person.employee_id),
  );
  const last = rows
    .map((row) => row.kot_sent_at)
    .filter((date): date is string => Boolean(date))
    .sort()
    .at(-1);
  const failures = rows.filter((row) => row.kot_status === "failed");
  const close = () => {
    setOpen(false);
    setDismissed(prompt);
  };

  async function send() {
    if (pending.current) return;
    pending.current = true;
    close();
    onBusy(true);
    setError("");
    setResult("");
    let sent = 0;
    let failed = 0;
    try {
      for (let index = 0; index < ids.length; index++) {
        setProgress(`${ids.length}人中 ${index + 1}人目を送信しています…`);
        const response = await fetch("/api/system/shift/team/kot", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ month, employee_id: ids[index].employee_id }),
        });
        const data = await response.json();
        if (!response.ok)
          throw new Error(data.error || "送信できませんでした。");
        sent += data.sent;
        failed += data.failed;
      }
      setResult(`送信しました（成功 ${sent}件・失敗 ${failed}件）`);
    } catch (error) {
      setError(
        `${(error as Error).message}（ここまで成功 ${sent}件・失敗 ${failed}件）`,
      );
    } finally {
      setProgress("");
      pending.current = false;
      onBusy(false);
      onRefresh();
    }
  }

  return (
    <section aria-label="KING OF TIME への送信">
      <h3>KING OF TIME への送信</h3>
      <p>
        送信済み {rows.filter((row) => row.kot_status === "sent").length}件　
        未送信{" "}
        {
          rows.filter((row) => !row.kot_status || row.kot_status === "unsent")
            .length
        }
        件　 失敗 {failures.length}件
      </p>
      {last && (
        <p>
          最後に送った日時{" "}
          {new Date(last).toLocaleString("ja-JP", {
            timeZone: "Asia/Tokyo",
            weekday: "short",
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          })}
        </p>
      )}
      {failures.length > 0 && (
        <ul aria-label="送信に失敗した日">
          {failures.map((row) => (
            <li key={`${row.employee_id}-${row.work_date}`}>
              失敗：
              {
                people.find((person) => person.employee_id === row.employee_id)
                  ?.name
              }{" "}
              {shiftDate(row.work_date)}「{row.kot_error}」
            </li>
          ))}
        </ul>
      )}
      <p>今日より前の日は送りません。今日の予定も送りません。</p>
      <ActionButton
        disabled={disabled || !!progress || !targets.length}
        onClick={() => setOpen(true)}
      >
        KING OF TIME へ送る
      </ActionButton>
      <p role="status">{result}</p>
      {error && <p role="alert">{error}</p>}
      {(open || prompt > dismissed) && (
        <Modal
          title="KING OF TIME へ送りますか？"
          onClose={close}
          actions={
            <SubmitButton busy={!!progress} onClick={() => void send()}>
              送信する
            </SubmitButton>
          }
        >
          <p>
            未送信・失敗の {targets.length}件を KING OF TIME
            の勤務予定に送ります。
          </p>
        </Modal>
      )}
      {progress && <DoneOverlay title={progress} />}
    </section>
  );
}
