"use client";
import { useState, type FormEvent } from "react";
import {
  SUBMISSION_LABELS,
  type SubmissionType,
} from "../_lib/submission-types";
import { submissionFields } from "../_lib/submission-fields";
import styles from "../mypage.module.css";
import { NDA_FULL_TEXT } from "../_lib/nda-content";

const todayJst = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
export default function SubmissionModal({
  type,
  employeeName,
  initialValues,
  onClose,
  onSent,
}: {
  type: SubmissionType;
  employeeName: string;
  initialValues?: Record<string, string>;
  onClose: () => void;
  onSent: () => void;
}) {
  const [values, setValues] = useState<Record<string, string | boolean>>(() =>
    type === "emergency_contact"
      ? { kind: initialValues ? "change" : "new", ...(initialValues ?? {}) }
      : type === "nda"
        ? { kind: "new", pledgeDate: todayJst(), ...(initialValues ?? {}) }
        : ({ ...(initialValues ?? {}) } as Record<string, string | boolean>),
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
     data-garden-modal="overlay">
      <section
        className={styles.submissionModal}
        role="dialog"
        aria-modal="true"
        aria-labelledby="submission-title"
       data-garden-modal="panel">
        <h2 id="submission-title">{SUBMISSION_LABELS[type]}</h2>
        {type === "resignation" ? <p>送信後、事務から連絡します。</p> : null}
        {type === "nda" ? (
          <div className={styles.pledge}>{NDA_FULL_TEXT}</div>
        ) : null}
        <form onSubmit={submit}>
          {type === "emergency_contact" || type === "nda" ? (
            <>
              <fieldset className="garden-radio-group">
                <legend>区分</legend>
                <label className="garden-radio">
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
                <label className="garden-radio">
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
          {submissionFields[type].map(([key, label, input, optional]) => (
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
          <div className={styles.modalActions} data-modal-actions><button
              type="button"
              className={styles.secondaryButton}
              onClick={onClose}
             data-modal-action="secondary">
              閉じる
            </button>
<button type="submit" disabled={sending} data-modal-action="primary">
              {sending ? "送信中…" : "送信する"}
            </button></div>
        </form>
      </section>
    </div>
  );
}
