"use client";
import { useState } from "react";
import { ActionButton } from "@/app/system/forms/_components/form-kit";
import { DOCUMENT_LABELS, type HakenData } from "@/lib/haken/types";
import { conflictDate, conflictMismatch, todayJst } from "@/lib/haken/rules";
import styles from "./haken.module.css";

export default function IssueButtons({
  data,
  partyId,
  start,
  end,
  candidateId,
  issueBatchId,
  onError,
}: {
  data: HakenData;
  partyId: string;
  start: string;
  end: string;
  candidateId?: string;
  issueBatchId?: string;
  onError: (message: string) => void;
}) {
  const [issuedOn, setIssuedOn] = useState(todayJst());
  const [busy, setBusy] = useState(false);
  const party = data.parties.find((p) => p.id === partyId);
  const officeId = party?.issue_defaults.office_id;
  const periods = data.contracts
    .filter((c) => c.office_id === officeId)
    .sort((a, b) => a.period_start.localeCompare(b.period_start));
  const calculated = start
    ? conflictDate(
        [
          ...periods.map((c) => ({ start: c.period_start, end: c.period_end })),
          { start, end: end || null },
        ],
        start,
      )
    : null;
  const notified =
    periods
      .map((c) => c.notified_conflict_on)
      .filter(Boolean)
      .at(-1) ?? null;
  const mismatch = conflictMismatch(calculated, notified);
  async function download(docType: string) {
    setBusy(true);
    onError("");
    try {
      const response = await fetch("/api/system/haken/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          party_id: partyId,
          start,
          end,
          issued_on: issuedOn,
          doc_type: docType,
          hire_candidate_id: candidateId,
          issue_batch_id: issueBatchId,
        }),
      });
      if (!response.ok) throw new Error((await response.json()).error);
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = url;
      link.download = `${DOCUMENT_LABELS[docType]}_${party?.name}_${issuedOn.replaceAll("-", "")}.pdf`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      const warning = response.headers.get("X-Haken-Warning");
      if (warning) onError(decodeURIComponent(warning));
    } catch (error) {
      onError(
        error instanceof Error ? error.message : "書類を発行できませんでした。",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className={styles.issue}>
      <label>
        発行日{" "}
        <input
          type="date"
          value={issuedOn}
          onChange={(e) => setIssuedOn(e.target.value)}
        />
      </label>
      <p>ヒュアランが発行する書類</p>
      {mismatch && <p role="alert">通知した抵触日（{notified}）と違います</p>}
      {!officeId && party && (
        <p>派遣会社の詳細で、受入事業所を設定してください。</p>
      )}
      <div className={styles.issueButtons}>
        {["conflict_notice", "treatment", "reply"].map((type) => (
          <ActionButton
            key={type}
            disabled={
              busy || !partyId || !start || !end || !issuedOn || !officeId
            }
            onClick={() => void download(type)}
          >
            {DOCUMENT_LABELS[type]}をダウンロードする
          </ActionButton>
        ))}
      </div>
      <p>抵触日 {calculated ?? "未計算"}（計算）</p>
    </div>
  );
}
