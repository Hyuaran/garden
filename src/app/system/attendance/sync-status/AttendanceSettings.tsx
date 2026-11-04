"use client";
import { useEffect, useRef, useState } from "react";
import {
  ActionButton,
  TextField,
} from "@/app/system/forms/_components/form-kit";
export default function AttendanceSettings() {
  const [date, setDate] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  useEffect(() => {
    let active = true;
    void fetch("/api/system/attendance/settings")
      .then(async (response) => {
        if (!response.ok) throw new Error("開始日を読み込めませんでした。");
        const data = await response.json();
        if (active) setDate(data.kot_send_start_date || "");
      })
      .catch((error) => {
        if (active) setMessage(error.message);
      });
    return () => {
      active = false;
    };
  }, []);
  async function save() {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    try {
      const response = await fetch("/api/system/attendance/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kot_send_start_date: date || null }),
      });
      if (!response.ok) throw new Error("開始日を保存できませんでした。");
      setMessage("保存しました。");
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  return (
    <section style={{ minHeight: 150 }}>
      <h2>Garden の打刻の開始日</h2>
      <TextField
        type="date"
        aria-label="Garden の打刻の開始日"
        value={date}
        disabled={busy}
        onChange={(event) => setDate(event.target.value)}
      />
      <ActionButton disabled={busy} onClick={() => void save()}>
        保存する
      </ActionButton>
      <p>
        この日以降の打刻を KING OF TIME へ送ります。この日から KING OF TIME
        での直接の打刻を止めてください。
      </p>
      <p role="status">{message}</p>
    </section>
  );
}
