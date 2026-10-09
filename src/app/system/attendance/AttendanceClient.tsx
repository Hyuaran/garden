"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { CLARITY_MASK } from "@/app/_lib/clarity-mask";
import SystemBreadcrumb from "@/app/system/_components/SystemBreadcrumb/SystemBreadcrumb";
import { PUNCH_LABELS, PUNCH_TYPES, SYNC_LABELS, type AttendancePunch, type PunchType } from "../_lib/attendance";
import styles from "./attendance.module.css";

type ModalState = { type: PunchType; clientId: string; phase: "saving" | "success" | "error"; punchedAt?: string; message?: string; extension?: string } | null;
type ExtensionDialog = { clientId: string; extension: string; error: string | null; saving: boolean } | null;
const formatTime = (value: string) => new Intl.DateTimeFormat("ja-JP", {
  timeZone: "Asia/Tokyo", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
}).format(new Date(value));

export default function AttendanceClient({ registered, employeeName, canViewSync, needsExtension = false, embedded = false }: {
  registered: boolean; employeeName: string | null; canViewSync: boolean; needsExtension?: boolean; embedded?: boolean;
}) {
  const [punches, setPunches] = useState<AttendancePunch[]>([]);
  const [loading, setLoading] = useState(registered);
  const [listError, setListError] = useState<string | null>(null);
  const [modal, setModal] = useState<ModalState>(null);
  const [extensionDialog, setExtensionDialog] = useState<ExtensionDialog>(null);
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

  async function savePunch(type: PunchType, clientId: string, extension?: string) {
    setModal({ type, clientId, phase: "saving", extension });
    try {
      const response = await fetch("/api/system/attendance/punch", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ punch_type: type, client_punch_id: clientId, ...(extension ? { extension } : {}) }),
      });
      const result = await response.json();
      if (!response.ok && type === "clock_in" && extension && (response.status === 400 || response.status === 409)) {
        // 内線の検査で止まったときは、小窓に戻して赤字で理由を見せる（打刻は記録されていない）
        setModal(null);
        setExtensionDialog({ clientId, extension, error: result.error || "内線番号を登録できませんでした", saving: false });
        return;
      }
      if (!response.ok) throw new Error(result.error || "打刻を記録できませんでした");
      setModal({ type, clientId, phase: "success", punchedAt: result.punch.punched_at });
      await loadPunches();
    } catch (error) { setModal({ type, clientId, phase: "error", extension, message: error instanceof Error ? error.message : "打刻を記録できませんでした" }); }
  }
  async function submitExtensionPunch() {
    if (!extensionDialog) return;
    const extension = extensionDialog.extension.trim();
    if (!/^\d{3,5}$/.test(extension)) {
      setExtensionDialog({ ...extensionDialog, error: extension ? "内線番号は数字で入力してください" : "今日の内線番号を入力してください" });
      return;
    }
    setExtensionDialog({ ...extensionDialog, saving: true, error: null });
    setExtensionDialog(null);
    await savePunch("clock_in", extensionDialog.clientId, extension);
  }
  function punch(type: PunchType) {
    const clientId = crypto.randomUUID();
    if (type === "clock_in" && needsExtension) {
      setExtensionDialog({ clientId, extension: "", error: null, saving: false });
      return;
    }
    void savePunch(type, clientId);
  }
  return <div className={`${styles.shell} ${embedded ? styles.shellEmbedded : ""}`}>
    <main className={`${styles.main} ${embedded ? styles.mainEmbedded : ""}`}>
      <header className={styles.header}>
        <div>{!embedded && <><SystemBreadcrumb items={[{ label: "勤怠打刻" }]} /><h1>勤怠打刻</h1></>}{employeeName && <p className={styles.employeeName} {...CLARITY_MASK}>{employeeName}さん</p>}</div>
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
    {extensionDialog && <div className={styles.backdrop} onMouseDown={(event) => { if (event.target === event.currentTarget && !extensionDialog.saving) setExtensionDialog(null); }}>
      <div className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby="extension-dialog-title" tabIndex={-1} ref={dialogRef}>
        <h2 id="extension-dialog-title">出勤</h2>
        <label className={styles.extensionField}>今日の内線番号
          <input
            value={extensionDialog.extension}
            onChange={(event) => setExtensionDialog({ ...extensionDialog, extension: event.target.value.replace(/\D/g, "").slice(0, 5), error: null })}
            onKeyDown={(event) => { if (event.key === "Enter" && !event.nativeEvent.isComposing) { event.preventDefault(); void submitExtensionPunch(); } }}
            autoFocus
            autoComplete="off"
            inputMode="numeric"
            pattern="[0-9]*"
            disabled={extensionDialog.saving}
          />
        </label>
        <p className={styles.dialogNote}>座った席の電話機の内線（4 桁）です</p>
        {extensionDialog.error && <p className={styles.error} role="alert">{extensionDialog.error}</p>}
        <div className={styles.dialogActions}>
          <button type="button" className={styles.secondary} onClick={() => setExtensionDialog(null)} disabled={extensionDialog.saving}>やめる</button>
          <button type="button" onClick={() => void submitExtensionPunch()} disabled={extensionDialog.saving}>出勤する</button>
        </div>
      </div>
    </div>}
    {modal && <div className={styles.backdrop} onMouseDown={(event) => { if (event.target === event.currentTarget && modal.phase !== "saving") setModal(null); }}>
      <div className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby="punch-dialog-title" tabIndex={-1} ref={dialogRef}>
        {modal.phase === "saving" && <><div className={styles.spinner} aria-hidden="true"/><h2 id="punch-dialog-title">{PUNCH_LABELS[modal.type]}を記録しています…</h2><p>保存が完了するまでお待ちください。</p></>}
        {modal.phase === "success" && <><div className={styles.successMark}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12.5l4.2 4.2L19 7"/></svg></div><h2 id="punch-dialog-title">{PUNCH_LABELS[modal.type]}を記録しました</h2><p className={styles.savedTime}>{formatTime(modal.punchedAt!)}</p><button type="button" onClick={() => setModal(null)}>閉じる</button></>}
        {modal.phase === "error" && <><h2 id="punch-dialog-title">記録できませんでした</h2><p>{modal.message ? `${modal.message}。もう一度押してください。` : "記録できませんでした。もう一度押してください。"}</p><div className={styles.dialogActions}><button type="button" onClick={() => void savePunch(modal.type, modal.clientId, modal.extension)}>再試行</button><button type="button" className={styles.secondary} onClick={() => setModal(null)}>閉じる</button></div></>}
      </div>
    </div>}
  </div>;
}
