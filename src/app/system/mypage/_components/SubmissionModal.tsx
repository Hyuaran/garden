"use client";
import { useState, type FormEvent } from "react";
import {
  SUBMISSION_LABELS,
  type SubmissionType,
} from "../_lib/submission-types";
import styles from "../mypage.module.css";
import { NDA_FULL_TEXT } from "../_lib/nda-content";

const todayJst = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
const definitions: Record<
  SubmissionType,
  Array<[string, string, string, boolean?]>
> = {
  emergency_contact: [
    ["selfAddress", "現住所", "text"],
    ["selfPhone", "個人の電話番号（携帯等）", "tel"],
    ["ecName", "緊急連絡先の氏名", "text"],
    ["ecRelationship", "本人との続柄", "text"],
    ["ecAddress", "緊急連絡先の住所（同一の場合は「同上」）", "text"],
    ["ecPhone", "緊急連絡先の電話番号", "tel"],
  ],
  commute_route: [
    ["station", "新しい最寄り駅", "text"],
    ["effectiveDate", "適用希望日", "date"],
    ["note", "補足（任意）", "textarea", true],
  ],
  bank_account: [
    ["bankName", "銀行名", "text"],
    ["bankCode", "金融機関コード（4桁）", "text"],
    ["branchName", "支店名", "text"],
    ["branchCode", "支店コード（3桁）", "text"],
    ["accountNumber", "口座番号（8桁以内）", "text"],
    ["holderKana", "口座名義カナ", "text"],
  ],
  resignation: [
    ["desiredDate", "退職希望日", "date"],
    ["reason", "理由（任意）", "textarea", true],
  ],
  nda: [
    ["pledgeDate", "誓約日", "date"],
    ["address", "住所", "text"],
    ["signature", "氏名（電子署名）", "text"],
  ],
};
export default function SubmissionModal({
  type,
  employeeName,
  onClose,
  onSent,
}: {
  type: SubmissionType;
  employeeName: string;
  onClose: () => void;
  onSent: () => void;
}) {
  const [values, setValues] = useState<Record<string, string | boolean>>(() =>
    type === "emergency_contact"
      ? { kind: "new" }
      : type === "nda"
        ? { kind: "new", pledgeDate: todayJst() }
        : ({} as Record<string, string | boolean>),
  );
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault();
    setSending(true);
    setError("");
    const response = await fetch("/api/system/mypage/submissions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ type, payload: values }),
    });
    const result = await response.json();
    setSending(false);
    if (!response.ok) return setError(result.error || "送信できませんでした。");
    onSent();
  }
  return (
    <div
      className={styles.modalBackdrop}
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <section
        className={styles.submissionModal}
        role="dialog"
        aria-modal="true"
        aria-labelledby="submission-title"
      >
        <h2 id="submission-title">{SUBMISSION_LABELS[type]}</h2>
        {type === "resignation" ? <p>送信後、事務から連絡します。</p> : null}
        {type === "nda" ? (
          <div className={styles.pledge}>{NDA_FULL_TEXT}</div>
        ) : null}
        <form onSubmit={submit}>
          {type === "emergency_contact" || type === "nda" ? (
            <>
              <fieldset>
                <legend>区分</legend>
                <label>
                  <input
                    type="radio"
                    name="kind"
                    value="new"
                    checked={values.kind === "new"}
                    onChange={(e) =>
                      setValues({ ...values, kind: e.target.value })
                    }
                  />
                  新規
                </label>
                <label>
                  <input
                    type="radio"
                    name="kind"
                    value={type === "emergency_contact" ? "change" : "resubmit"}
                    checked={
                      values.kind ===
                      (type === "emergency_contact" ? "change" : "resubmit")
                    }
                    onChange={(e) =>
                      setValues({ ...values, kind: e.target.value })
                    }
                  />
                  {type === "emergency_contact" ? "変更" : "再提出"}
                </label>
              </fieldset>
              {type === "emergency_contact" ? (
                <label>
                  提出者本人の氏名
                  <input value={employeeName} readOnly aria-readonly="true" />
                </label>
              ) : null}
            </>
          ) : null}
          {definitions[type].map(([key, label, input, optional]) => (
            <label key={key}>
              {label}
              {input === "textarea" ? (
                <textarea
                  value={String(values[key] ?? "")}
                  onChange={(e) =>
                    setValues({ ...values, [key]: e.target.value })
                  }
                />
              ) : (
                <input
                  type={input}
                  required={!optional}
                  value={String(values[key] ?? "")}
                  onChange={(e) =>
                    setValues({ ...values, [key]: e.target.value })
                  }
                />
              )}
            </label>
          ))}
          {type === "bank_account" ? (
            <p>種別は「普通」で受け付けます。</p>
          ) : null}
          {type === "nda" ? (
            <label className={styles.agree}>
              <input
                type="checkbox"
                checked={values.agreed === true}
                onChange={(e) =>
                  setValues({ ...values, agreed: e.target.checked })
                }
              />
              内容に同意します
            </label>
          ) : null}
          {error ? (
            <p role="alert" className={styles.error}>
              {error}
            </p>
          ) : null}
          <div className={styles.modalActions}>
            <button type="submit" disabled={sending}>
              {sending ? "送信中…" : "送信する"}
            </button>
            <button
              type="button"
              className={styles.secondaryButton}
              onClick={onClose}
            >
              閉じる
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
