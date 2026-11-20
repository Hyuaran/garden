"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import DataTable, { type DataColumn, type RemoteTable } from "@/app/system/_components/DataTable/DataTable";
import Modal from "@/app/system/_components/Modal/Modal";
import { ActionButton, ActionRow, ResultMessage, TextField } from "@/app/system/forms/_components/form-kit";
import KandenSummary from "@/app/system/forms/kanden/KandenSummary";
import { CLARITY_MASK } from "@/app/_lib/clarity-mask";
import { acquisitionLabel, urgentLabel } from "@/lib/leaf-kanden/submissions";
import { loadSubmissionDetail } from "./actions";
import { CASE_DETAIL_ERROR, caseListHref, type IntakeRow } from "./cases";
import CasePhotos from "./CasePhotos";
import { setKandenPhotoPassword } from "./photo-password-actions";

const timestamp = new Intl.DateTimeFormat("ja-JP", {
  timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit",
  hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
});
const columns: DataColumn<IntakeRow>[] = [
  { id: "submitted_at", label: "送信日時", type: "date", value: row => row.submitted_at, render: row => timestamp.format(new Date(row.submitted_at)) },
  { id: "acquisition", label: "区分", type: "text", align: "mark", value: row => row.acquisition },
  { id: "kanri_no", label: "管理番号", type: "text", align: "fixed", value: row => row.kanri_no ?? "" },
  { id: "customer_name", label: "お客様名", type: "text", value: row => row.customer_name },
  { id: "products", label: "獲得内容", type: "text", value: acquisitionLabel },
  { id: "urgent_sw", label: "至急SW", type: "text", value: urgentLabel },
  { id: "specs_status", label: "諸元", type: "text", align: "mark", value: row => row.specs_status },
  { id: "photo_count", label: "写メ枚数", type: "number", value: row => row.photo_count },
  { id: "employee_name", label: "送った人", type: "text", value: row => row.employee_name },
];

function IntakeDialog({ read, onClose, year }: {
  read: ReturnType<typeof loadSubmissionDetail>; onClose: () => void; year: number;
}) {
  const [result, setResult] = useState<Awaited<typeof read> | null>(null);
  useEffect(() => {
    let closed = false;
    void read.then(value => { if (!closed) setResult(value); });
    return () => { closed = true; };
  }, [read]);

  return <Modal size="lg" title="フォーム受付の詳細" onClose={onClose} className="clarity-mask">
    <div {...CLARITY_MASK}>
      {!result ? <p role="status">読み込み中…</p> : result.row ? <>
        <ResultMessage>{result.photoError}</ResultMessage>
        <p>{timestamp.format(new Date(result.row.submitted_at))}　{result.row.employee_name} さん</p>
        <KandenSummary row={result.row} count={result.row.photo_count} specs={result.row.specs_status} />
        {result.orderId && <Link prefetch={false}
          href={`${caseListHref(year, "active")}&order=${encodeURIComponent(result.orderId)}`}>FileMaker の受注詳細を開く</Link>}
        {!result.photoError && <CasePhotos photos={result.photos} />}
      </> : <ResultMessage>{result.error}</ResultMessage>}
    </div>
  </Modal>;
}

export function FormIntake({ rows, year, remote, loading }: { rows: IntakeRow[]; year: number; remote: RemoteTable; loading: boolean }) {
  const [read, setRead] = useState<ReturnType<typeof loadSubmissionDetail> | null>(null);
  return <div {...CLARITY_MASK}>
    <DataTable rows={rows} columns={columns} rowKey={row => row.id}
      defaultSort={{ id: "submitted_at", direction: "desc" }} pageSize={50} remote={remote} loading={loading}
      searchPlaceholder="管理番号・お客様名・送った人"
      emptyText="該当する送信はありません。"
      onRowClick={row => setRead(loadSubmissionDetail(row.id).catch(() => ({ error: CASE_DETAIL_ERROR })))} />
    {read && <IntakeDialog read={read} year={year} onClose={() => setRead(null)} />}
  </div>;
}

export function PhotoPasswordSettings({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function save() {
    setBusy(true);
    setError("");
    try {
      const result = await setKandenPhotoPassword(password);
      if (result.error) setError(result.error);
      else onSaved();
    } catch {
      setError("パスワードを設定できませんでした。もう一度お試しください。");
    } finally {
      setBusy(false);
    }
  }

  return <Modal title="画像保存のパスワードを設定" size="sm" onClose={onClose} dismissible={!busy}>
    <ResultMessage>{error}</ResultMessage>
    <form onSubmit={event => { event.preventDefault(); void save(); }}>
      <TextField aria-label="新しいパスワード" type="password" autoComplete="new-password" required
        value={password} onChange={event => setPassword(event.target.value)} disabled={busy} />
      <ActionRow>
        <ActionButton disabled={busy} onClick={onClose}>戻る</ActionButton>
        <ActionButton type="submit" disabled={busy || !password}>設定する</ActionButton>
      </ActionRow>
    </form>
  </Modal>;
}
