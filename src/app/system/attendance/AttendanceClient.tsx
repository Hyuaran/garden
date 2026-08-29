"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { PUNCH_LABELS, PUNCH_TYPES, SYNC_LABELS, type AttendancePunch, type PunchType } from "../_lib/attendance";
import styles from "./attendance.module.css";

type ModalState = { type: PunchType; clientId: string; phase: "saving" | "success" | "error"; punchedAt?: string } | null;
const formatTime = (value: string) => new Intl.DateTimeFormat("ja-JP", {
  timeZone: "Asia/Tokyo", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
}).format(new Date(value));

export default function AttendanceClient({ registered, employeeName, canViewSync, embedded = false }: {
  registered: boolean; employeeName: string | null; canViewSync: boolean; embedded?: boolean;
}) {
  const [punches, setPunches] = useState<AttendancePunch[]>([]);
  const [loading, setLoading] = useState(registered);
  const [listError, setListError] = useState<string | null>(null);
  const [modal, setModal] = useState<ModalState>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  async function loadPunches() {
    if (!registered) return;
    try {
      const response = await fetch("/api/system/attendance/my", { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "打刻一覧を取得できませんでした");
      setPunches(result.punches);
      setListError(null);
    } catch (error) { setListError(error instanceof Error ? error.message : "打刻一覧を取得できませんでした"); }
    finally { setLoading(false); }
  }
  useEffect(() => { void loadPunches(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (modal) dialogRef.current?.focus(); }, [modal]);

  async function savePunch(type: PunchType, clientId: string) {
    setModal({ type, clientId, phase: "saving" });
    try {
      const response = await fetch("/api/system/attendance/punch", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ punch_type: type, client_punch_id: clientId }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "打刻を記録できませんでした");
      setModal({ type, clientId, phase: "success", punchedAt: result.punch.punched_at });
      await loadPunches();
    } catch { setModal({ type, clientId, phase: "error" }); }
  }
  function punch(type: PunchType) { void savePunch(type, crypto.randomUUID()); }
  return <div className={`${styles.shell} ${embedded ? styles.shellEmbedded : ""}`}>
    <main className={`${styles.main} ${embedded ? styles.mainEmbedded : ""}`}>
      <header className={styles.header}>
        <div>{!embedded && <><p className={styles.eyebrow}>Garden attendance</p><h1>勤怠打刻</h1></>}{employeeName && <p className={styles.employeeName}>{employeeName}さん</p>}</div>
        <div className={styles.headerActions}>{canViewSync && <Link className={styles.adminLink} href="/system/attendance/sync-status">同期状況</Link>}</div>
      </header>
      {!registered ? <section className={styles.notice} role="status">
        <h2>打刻できません</h2><p>打刻対象の従業員として登録されていません（管理者にご連絡ください）</p>
      </section> : <>
        <section aria-label="打刻操作" className={styles.punchGrid}>
          {PUNCH_TYPES.map((type) => <button key={type} type="button" disabled={modal?.phase === "saving"}
            className={styles[type]} onClick={() => punch(type)}>{PUNCH_LABELS[type]}</button>)}
        </section>
        <section className={styles.history}><h2>今日の打刻</h2>
          {listError && <p role="alert" className={styles.error}>{listError}</p>}
          {loading ? <p>読み込み中…</p> : punches.length === 0 ? <p className={styles.empty}>まだ打刻はありません。</p> :
            <ul>{punches.map((item) => <li key={item.id}><strong>{formatTime(item.punched_at)}</strong>
              <span>{PUNCH_LABELS[item.punch_type]}</span><small>{SYNC_LABELS[item.kot_sync_status] ?? item.kot_sync_status}</small></li>)}</ul>}
        </section>
      </>}
    </main>
    {modal && <div className={styles.backdrop} onMouseDown={(event) => { if (event.target === event.currentTarget && modal.phase !== "saving") setModal(null); }}>
      <div className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby="punch-dialog-title" tabIndex={-1} ref={dialogRef}>
        {modal.phase === "saving" && <><div className={styles.spinner} aria-hidden="true"/><h2 id="punch-dialog-title">{PUNCH_LABELS[modal.type]}を記録しています…</h2><p>保存が完了するまでお待ちください。</p></>}
        {modal.phase === "success" && <><div className={styles.successMark}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12.5l4.2 4.2L19 7"/></svg></div><h2 id="punch-dialog-title">{PUNCH_LABELS[modal.type]}を記録しました</h2><p className={styles.savedTime}>{formatTime(modal.punchedAt!)}</p><button type="button" onClick={() => setModal(null)}>閉じる</button></>}
        {modal.phase === "error" && <><h2 id="punch-dialog-title">記録できませんでした</h2><p>記録できませんでした。もう一度押してください。</p><div className={styles.dialogActions}><button type="button" onClick={() => void savePunch(modal.type, modal.clientId)}>再試行</button><button type="button" className={styles.secondary} onClick={() => setModal(null)}>閉じる</button></div></>}
      </div>
    </div>}
  </div>;
}
