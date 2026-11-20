"use client";

import { useEffect, useState } from "react";
import Modal from "@/app/system/_components/Modal/Modal";
import { ResultMessage } from "@/app/system/forms/_components/form-kit";
import { CLARITY_MASK } from "@/app/_lib/clarity-mask";
import type { loadCaseDetail } from "./actions";
import { DETAIL_CUSTOMER_FIELDS, DETAIL_ORDER_FIELDS, type CaseDetail, type CaseRow, type DetailField } from "./cases";
import PaymentDetails from "./PaymentDetails";
import CasePhotos from "./CasePhotos";
import styles from "./case-dialog.module.css";

function Details({ detail, fields }: { detail: CaseDetail; fields: readonly (readonly [DetailField, string])[] }) {
  return (
    <dl className={styles.values}>
      {fields.map(([field, label]) => {
        const value = detail[field];
        let display = value ?? "—";
        if (field === "billing_amount" && value !== null) display = `${Number(value).toLocaleString("ja-JP")} 円`;
        if (field === "address" && detail.postal_code) display = `〒${detail.postal_code} ${value ?? ""}`;
        return (
          <div key={field}>
            <dt>{label}</dt>
            <dd className={field === "billing_amount" ? styles.amount : undefined}>{display}</dd>
          </div>
        );
      })}
    </dl>
  );
}

export default function CaseDialog({ row, read, onClose }: {
  row: Pick<CaseRow, "kanri_no" | "kanri_no_raw" | "customer_name">; read: ReturnType<typeof loadCaseDetail>; onClose: () => void;
}) {
  const [result, setResult] = useState<Awaited<ReturnType<typeof loadCaseDetail>> | null>(null);
  useEffect(() => {
    let closed = false;
    void read.then(data => { if (!closed) setResult(data); });
    return () => { closed = true; };
  }, [read]);

  const title = [row.kanri_no ?? row.kanri_no_raw, row.customer_name ?? (result && "detail" in result ? result.detail.customer_name : null)].filter(Boolean).join(" ");
  return (
    <Modal size="lg" title={title || "案件詳細"} onClose={onClose} className="clarity-mask">
      <div {...CLARITY_MASK}>
        {!result ? <p role="status">読み込み中…</p> : "error" in result ? <ResultMessage>{result.error}</ResultMessage> : (
          <>
            <ResultMessage>{result.photoError}</ResultMessage>
            <div className={styles.detailColumns}>
              <Details detail={result.detail} fields={DETAIL_ORDER_FIELDS} />
              <Details detail={result.detail} fields={DETAIL_CUSTOMER_FIELDS} />
            </div>
            <PaymentDetails rows={result.payments ?? []} paidOn={result.paidOn} refundedOn={result.refundedOn} />
            {!result.photoError && <CasePhotos photos={result.photos} />}
            <section>
              <h3>備考</h3>
              <p className={styles.note}>{result.detail.note ?? "—"}</p>
            </section>
          </>
        )}
      </div>
    </Modal>
  );
}
