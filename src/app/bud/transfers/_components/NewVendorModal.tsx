"use client";

import { useState } from "react";
import { supabase } from "../../_lib/supabase";

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
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-50"
      role="dialog"
      aria-modal="true"
    >
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h2 className="text-lg font-medium text-gray-900">新規取引先を追加</h2>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="text-gray-500 hover:text-gray-700"
            aria-label="閉じる"
          >
            ✕
          </button>
        </div>

        <div className="p-4 space-y-3">
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
              <span className="text-xs text-gray-600">預金種目 *</span>
              <select
                value={form.account_type}
                onChange={(e) => handleChange("account_type", e.target.value)}
                className="mt-1 block w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
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
            <div role="alert" className="bg-red-50 border border-red-200 text-red-800 text-sm rounded p-2">
              {error}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t px-4 py-3 bg-gray-50">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-200 rounded"
          >
            キャンセル
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className="px-4 py-1.5 text-sm bg-emerald-600 text-white rounded hover:bg-emerald-700 disabled:opacity-50"
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
      <span className="text-xs text-gray-600">{label}</span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        maxLength={maxLength}
        className="mt-1 block w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
      />
    </label>
  );
}
