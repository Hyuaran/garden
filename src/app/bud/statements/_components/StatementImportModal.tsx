"use client";

import { useState } from "react";
import { useBudState } from "../../_state/BudStateContext";
import { importBankStatements } from "../../_lib/statement-import";
import {
  detectSourceType,
  type StatementSourceType,
} from "../../_lib/statement-csv-parser";

interface BankAccount {
  account_id: string;
  bank_name: string;
  branch_name: string;
  account_number: string;
}

interface Props {
  open: boolean;
  bankAccounts: BankAccount[];
  onClose: () => void;
  onImported: () => void;
}

const SOURCE_TYPES: { value: StatementSourceType; label: string }[] = [
  { value: "rakuten_csv", label: "楽天銀行 CSV" },
  { value: "mizuho_csv", label: "みずほ銀行 CSV" },
  { value: "paypay_csv", label: "PayPay 銀行 CSV" },
];

export function StatementImportModal({
  open,
  bankAccounts,
  onClose,
  onImported,
}: Props) {
  const { sessionUser } = useBudState();
  const [bankAccountId, setBankAccountId] = useState("");
  const [sourceType, setSourceType] = useState<StatementSourceType>("rakuten_csv");
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [resultMsg, setResultMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const handleFileChange = async (f: File | null) => {
    setFile(f);
    setError(null);
    if (!f) return;
    try {
      const text = await f.text();
      const detected = detectSourceType(text);
      if (detected) setSourceType(detected);
    } catch {
      // ignore detection error
    }
  };

  const handleImport = async () => {
    setError(null);
    setResultMsg(null);
    if (!sessionUser) {
      setError("認証セッションが無効です");
      return;
    }
    if (!bankAccountId) {
      setError("対象口座を選択してください");
      return;
    }
    if (!file) {
      setError("CSV ファイルを選択してください");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("ファイルサイズが 5MB を超えています");
      return;
    }
    setSubmitting(true);
    try {
      const csvText = await file.text();
      const result = await importBankStatements({
        bankAccountId,
        sourceType,
        fileName: file.name,
        csvText,
        importedBy: sessionUser.user_id,
      });
      const msg =
        `取込完了: ${result.successCount} 件 / 重複スキップ ${result.skippedCount} 件 / ` +
        `エラー ${result.errorCount} 件 / 自動照合 ${result.autoMatchedCount} 件`;
      setResultMsg(msg);
      if (result.success) {
        onImported();
      }
    } catch (e) {
      setError(`取込中にエラー: ${(e as Error).message}`);
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
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h2 className="text-lg font-medium text-gray-900">
            銀行 CSV 取込
          </h2>
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
          <label className="block">
            <span className="text-xs text-gray-600">対象口座 *</span>
            <select
              value={bankAccountId}
              onChange={(e) => setBankAccountId(e.target.value)}
              disabled={submitting}
              className="mt-1 block w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
            >
              <option value="">選択してください</option>
              {bankAccounts.map((a) => (
                <option key={a.account_id} value={a.account_id}>
                  {a.bank_name} {a.branch_name} {a.account_number}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="text-xs text-gray-600">ファイル形式</span>
            <select
              value={sourceType}
              onChange={(e) =>
                setSourceType(e.target.value as StatementSourceType)
              }
              disabled={submitting}
              className="mt-1 block w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
            >
              {SOURCE_TYPES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-500 mt-1">
              ファイル選択後、ヘッダーから自動判定します（変更可）
            </p>
          </label>

          <label className="block">
            <span className="text-xs text-gray-600">CSV ファイル *</span>
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={(e) => void handleFileChange(e.target.files?.[0] ?? null)}
              disabled={submitting}
              className="mt-1 block w-full text-sm text-gray-900"
            />
            <p className="text-xs text-gray-500 mt-1">5MB 以下</p>
          </label>

          {resultMsg && (
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-900 text-sm rounded p-2">
              {resultMsg}
            </div>
          )}
          {error && (
            <div
              role="alert"
              className="bg-red-50 border border-red-200 text-red-800 text-sm rounded p-2"
            >
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
            閉じる
          </button>
          <button
            type="button"
            onClick={handleImport}
            disabled={submitting || !file || !bankAccountId}
            className="px-4 py-1.5 text-sm bg-emerald-600 text-white rounded hover:bg-emerald-700 disabled:opacity-50"
          >
            {submitting ? "取込中…" : "取込実行"}
          </button>
        </div>
      </div>
    </div>
  );
}
