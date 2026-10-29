"use client";
import { useState, type FormEvent } from "react";
import Modal from "@/app/system/_components/Modal/Modal";
import { FormRow, RadioGroup, SubmitButton, NumberField, TextField, TextArea } from "@/app/system/forms/_components/form-kit";
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
    if (sending) return;
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
    <Modal title={SUBMISSION_LABELS[type]} onClose={onClose}>
        {type === "resignation" ? <p>送信後、事務から連絡します。</p> : null}
        {type === "nda" ? (
          <div className={styles.pledge}>{NDA_FULL_TEXT}</div>
        ) : null}
        <form onSubmit={submit}>
          {type === "emergency_contact" || type === "nda" ? (
            <>
              <FormRow label="区分"><RadioGroup name="kind" label="区分"
                options={["新規", type === "emergency_contact" ? "変更" : "再提出"]}
                value={values.kind === "new" ? "新規" : type === "emergency_contact" ? "変更" : "再提出"}
                onChange={value=>setValues({...values,kind:value === "新規" ? "new" : type === "emergency_contact" ? "change" : "resubmit"})}/></FormRow>
              {type === "emergency_contact" ? (
                <label>
                  提出者本人の氏名
                  <TextField value={employeeName} readOnly aria-readonly="true" />
                </label>
              ) : null}
            </>
          ) : null}
          {submissionFields[type].map(([key, label, input, optional], index) => (
            <FormRow key={key} label={<label htmlFor={`submission-${key}`}>{index + 1} {label}</label>}>
              {input === "textarea" ? (
                <TextArea id={`submission-${key}`} required={!optional}
                  placeholder={type === "dependents" && key === "details" ? "増える人・外れる人の氏名、続柄、生年月日、その年の収入の見込みを入力してください。" : undefined}
                  value={String(values[key] ?? "")}
                  onChange={(e) =>
                    setValues({ ...values, [key]: e.target.value })
                  }
                />
              ) : input === "number" ? (
                <NumberField id={`submission-${key}`} type="number" min={0} step={1} required={!optional}
                  value={String(values[key] ?? "")}
                  onChange={(e) => setValues({ ...values, [key]: e.target.value })} />
              ) : (
                <TextField id={`submission-${key}`}
                  type={input}
                  required={!optional}
                  value={String(values[key] ?? "")}
                  onChange={(e) =>
                    setValues({ ...values, [key]: e.target.value })
                  }
                />
              )}
            </FormRow>
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
<SubmitButton type="submit" busy={sending} data-modal-action="primary">
              {sending ? "送信中…" : "送信する"}
            </SubmitButton></div>
        </form>
    </Modal>
  );
}