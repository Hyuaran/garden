"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ListProcessingOverlay } from "@/app/system/list/_components/ListProcessingOverlay";
import styles from "./ChatworkSendDialog.module.css";

type SendState = "confirm" | "sent" | "failed";

type Props = {
  open: boolean;
  text: string;
  date: string;
  time: string;
  onClose: () => void;
};

function formatSentAt(value: string) {
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

export default function ChatworkSendDialog({ open, text, date, time, onClose }: Props) {
  const [roomLabel, setRoomLabel] = useState("開発ルーム（テスト）");
  const [state, setState] = useState<SendState>("confirm");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [sentAt, setSentAt] = useState("");

  useEffect(() => {
    if (!open) return;
    setState("confirm");
    setSending(false);
    setError("");
    setSentAt("");
    let cancelled = false;
    void fetch("/api/system/shukkin/chatwork", { cache: "no-store" })
      .then((response) => response.json())
      .then((body) => {
        if (!cancelled && typeof body.roomLabel === "string") setRoomLabel(body.roomLabel);
      })
      .catch(() => {
        if (!cancelled) setRoomLabel("開発ルーム（テスト）");
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  useEffect(() => {
    if (!open || sending) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose, open, sending]);

  if (!open) return null;

  async function send() {
    if (sending) return;
    setSending(true);
    setError("");
    try {
      const response = await fetch("/api/system/shukkin/chatwork", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text, date, time }),
      });
      const body = await response.json().catch(() => ({})) as { error?: unknown; sentAt?: unknown };
      if (!response.ok) {
        setState("failed");
        setError(typeof body.error === "string" ? body.error : "Chatwork に送れませんでした。しばらくしてからもう一度お試しください");
        return;
      }
      setState("sent");
      setSentAt(typeof body.sentAt === "string" ? formatSentAt(body.sentAt) : formatSentAt(new Date().toISOString()));
    } finally {
      setSending(false);
    }
  }

  return <>
    {createPortal(
      <div className={styles.backdrop} onMouseDown={() => {
        if (!sending) onClose();
      }} data-garden-modal="overlay">
        <div className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby="chatwork-send-title" onMouseDown={(event) => event.stopPropagation()} data-garden-modal="panel">
          {state === "sent" ? <>
            <h2 id="chatwork-send-title">送信しました</h2>
            <p className={styles.destination}>送り先：{roomLabel}</p>
            {sentAt && <p className={styles.sentAt}>時刻：{sentAt}</p>}
            <div className={styles.actions} data-modal-actions>
              <button type="button" className={styles.primary} onClick={onClose} data-modal-action="secondary">閉じる</button>
            </div>
          </> : <>
            <h2 id="chatwork-send-title">この内容で Chatwork に送信します</h2>
            <p className={styles.destination}>送り先：{roomLabel}</p>
            <pre className={styles.preview}>{text}</pre>
            {state === "failed" && error && <p className={styles.error} role="alert">{error}</p>}
            <div className={styles.actions} data-modal-actions>
              <button type="button" className={styles.secondary} disabled={sending} onClick={onClose} data-modal-action="secondary">やめる</button>
              <button type="button" className={styles.primary} disabled={sending || !text.trim()} onClick={() => void send()} data-modal-action="primary">{state === "failed" ? "もう一度" : "送信する"}</button>
            </div>
          </>}
        </div>
      </div>,
      document.body,
    )}
    <ListProcessingOverlay open={sending} mode="search" title="Chatwork に送信しています…" />
  </>;
}
