"use client";

import { useState } from "react";
import { supabase } from "../../_lib/supabase";
import { transferFormStyles as styles } from "./transferFormStyles";

export interface NewVendorFormInput {
  name: string;
  bank_name: string;
  bank_code: string;
  branch_name: string;
  branch_code: string;
  account_type: string;
  account_number: string;
  account_holder_kana: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: (vendor: { id: string } & NewVendorFormInput) => void;
}

const EMPTY: NewVendorFormInput = {
  name: "",
  bank_name: "",
  bank_code: "",
  branch_name: "",
  branch_code: "",
  account_type: "1",
  account_number: "",
  account_holder_kana: "",
};

export function NewVendorModal({ open, onClose, onCreated }: Props) {
  const [form, setForm] = useState<NewVendorFormInput>(EMPTY);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const handleChange = <K extends keyof NewVendorFormInput>(
    key: K,
    value: NewVendorFormInput[K],
  ) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async () => {
    setError(null);
    if (!form.name || !form.bank_code || !form.branch_code || !form.account_number) {
      setError("必須項目を入力してください");
      return;
    }
    setSubmitting(true);
    try {
      const { data, error: insertErr } = await supabase
        .from("root_vendors")
        .insert({
          vendor_name: form.name,
          payee_bank_name: form.bank_name || null,
          payee_bank_code: form.bank_code,
          payee_branch_name: form.branch_name || null,
          payee_branch_code: form.branch_code,
          payee_account_type: form.account_type,
          payee_account_number: form.account_number,
          payee_account_holder_kana: form.account_holder_kana || null,
        })
        .select("id")
        .single<{ id: string }>();

      if (insertErr || !data) {
        setError(
          insertErr?.message?.includes("row-level security")
            ? "取引先の追加には admin 権限が必要です。管理者に依頼してください。"
            : `登録に失敗しました: ${insertErr?.message ?? "unknown"}`,
        );
        return;
      }

      onCreated({ id: data.id, ...form });
      setForm(EMPTY);
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      role="dialog"
      aria-modal="true"
    >
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-[12px] border border-[rgba(179,137,46,0.18)] bg-bg-paper-soft shadow-garden-floating">
        <div className="flex items-center justify-between border-b border-[rgba(179,137,46,0.18)] px-5 py-4">
          <h2 className="font-shippori text-lg font-semibold text-text-main">新規取引先を追加</h2>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="text-text-sub transition hover:text-text-main disabled:opacity-50"
            aria-label="閉じる"
          >
            ✕
          </button>
        </div>

        <div className="space-y-3 p-5">
          <Field label="取引先名 *" value={form.name} onChange={(v) => handleChange("name", v)} />
          <div className="grid grid-cols-2 gap-3">
            <Field label="銀行名" value={form.bank_name} onChange={(v) => handleChange("bank_name", v)} />
            <Field label="銀行コード *（4桁）" value={form.bank_code} onChange={(v) => handleChange("bank_code", v)} maxLength={4} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="支店名" value={form.branch_name} onChange={(v) => handleChange("branch_name", v)} />
            <Field label="支店コード *（3桁）" value={form.branch_code} onChange={(v) => handleChange("branch_code", v)} maxLength={3} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className={styles.label}>預金種目 *</span>
              <select
                value={form.account_type}
                onChange={(e) => handleChange("account_type", e.target.value)}
                className={styles.field}
              >
                <option value="1">普通</option>
                <option value="2">当座</option>
                <option value="4">貯蓄</option>
              </select>
            </label>
            <Field label="口座番号 *（7桁）" value={form.account_number} onChange={(v) => handleChange("account_number", v)} maxLength={7} />
          </div>
          <Field label="口座名義カナ" value={form.account_holder_kana} onChange={(v) => handleChange("account_holder_kana", v)} />

          {error && (
            <div role="alert" className={styles.alert}>
              {error}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-[rgba(179,137,46,0.18)] bg-[rgba(212,165,65,0.08)] px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className={styles.secondaryButton}
          >
            キャンセル
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className={styles.goldButton}
          >
            {submitting ? "登録中…" : "登録"}
          </button>
        </div>
      </div>
    </div>
  );
}

interface FieldProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  maxLength?: number;
}

function Field({ label, value, onChange, maxLength }: FieldProps) {
  return (
    <label className="block">
      <span className={styles.label}>{label}</span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        maxLength={maxLength}
        className={styles.field}
      />
    </label>
  );
}
