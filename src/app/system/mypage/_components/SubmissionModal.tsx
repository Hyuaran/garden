"use client";
import { useState, type FormEvent } from "react";
import {
  SUBMISSION_LABELS,
  type SubmissionType,
} from "../_lib/submission-types";
import styles from "../mypage.module.css";
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
  nda: [["signature", "氏名（電子署名）", "text"]],
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
    type === "emergency_contact" ? { kind: "new" } : ({} as Record<string, string | boolean>),
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
          <div className={styles.pledge}>
            業務上知り得た秘密および個人情報を、在職中および退職後も第三者へ漏らしません。
          </div>
        ) : null}
        <form onSubmit={submit}>
          {type === "emergency_contact" ? (
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
                    value="change"
                    checked={values.kind === "change"}
                    onChange={(e) =>
                      setValues({ ...values, kind: e.target.value })
                    }
                  />
                  変更
                </label>
              </fieldset>
              <label>
                提出者本人の氏名
                <input value={employeeName} readOnly aria-readonly="true" />
              </label>
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
