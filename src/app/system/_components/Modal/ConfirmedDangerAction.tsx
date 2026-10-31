"use client";

import { useRef, useState } from "react";
import Modal from "./Modal";

/** 編集の小窓から、確認を経て状態変更・削除を実行する。 */
export default function ConfirmedDangerAction({ label, disabled, onConfirm }: {
  label: string;
  disabled?: boolean;
  onConfirm: () => void | Promise<unknown>;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const lock = useRef(false);
  async function execute() {
    if (disabled || lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try { await onConfirm(); setOpen(false); }
    catch { setError("処理できませんでした。もう一度お試しください。"); }
    finally { lock.current = false; setBusy(false); }
  }
  return <>
    <button type="button" data-modal-action="danger" style={{ marginRight: "auto" }} disabled={disabled || busy} onClick={() => setOpen(true)}>{label}</button>
    {open && <Modal title={`${label}の確認`} size="sm" onClose={() => { if (!busy) setOpen(false); }} actions={<>
      <button type="button" data-modal-action="secondary" disabled={busy} onClick={() => setOpen(false)}>やめる</button>
      <button type="button" data-modal-action="danger" disabled={disabled || busy} onClick={() => void execute()}>{busy ? "処理中..." : label}</button>
    </>}><p>この行を{label}しますか？</p>{error && <p role="alert">{error}</p>}</Modal>}
  </>;
}
