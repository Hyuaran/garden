"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useBudState } from "../../_state/BudStateContext";
import {
  createTransfer,
  transitionTransferStatus,
} from "../../_lib/transfer-mutations";
import { supabase } from "../../_lib/supabase";
import { buildDuplicateKey } from "../../_lib/duplicate-key";
import {
  validateCashbackCreate,
  type DataSource,
} from "../_lib/transfer-create-schema";
import type { ValidationErrors } from "../_lib/transfer-form-schema";
import { uploadAttachment, removeAttachment } from "../_lib/attachment-upload";
import { BankPicker } from "./BankPicker";
import { DataSourceSelector } from "./DataSourceSelector";
import { AttachmentUploader } from "./AttachmentUploader";
import { DuplicateWarning } from "./DuplicateWarning";
import { KanaPreview } from "./KanaPreview";

interface DuplicateHit {
  transfer_id: string;
  payee_name: string;
  amount: number;
  scheduled_date: string | null;
  status: string;
}

export function TransferFormCashback() {
  const router = useRouter();
  const { sessionUser } = useBudState();

  const [dataSource, setDataSource] = useState<DataSource>("デジタル入力");
  const [executeCompanyId, setExecuteCompanyId] = useState("");
  const [sourceAccountId, setSourceAccountId] = useState("");
  const [amount, setAmount] = useState<number | "">("");
  const [scheduledDate, setScheduledDate] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState("");
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);

  const [applicantName, setApplicantName] = useState("");
  const [applicantNameKana, setApplicantNameKana] = useState("");
  const [applicantPhone, setApplicantPhone] = useState("");
  const [productName, setProductName] = useState("");
  const [channelName, setChannelName] = useState("");

  const [bankName, setBankName] = useState("");
  const [bankCode, setBankCode] = useState("");
  const [branchName, setBranchName] = useState("");
  const [branchCode, setBranchCode] = useState("");
  const [accountType, setAccountType] = useState("1");
  const [accountNumber, setAccountNumber] = useState("");
  const [holderKana, setHolderKana] = useState("");

  const [errors, setErrors] = useState<ValidationErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [dupes, setDupes] = useState<DuplicateHit[]>([]);
  const [dupesAcknowledged, setDupesAcknowledged] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const today = useMemo(() => new Date(), []);
  const canConfirm = dataSource === "デジタル入力";

  const buildInput = () => ({
    request_company_id: executeCompanyId,
    execute_company_id: executeCompanyId,
    source_account_id: sourceAccountId,
    payee_name: applicantName,
    payee_bank_code: bankCode,
    payee_branch_code: branchCode,
    payee_account_type: accountType,
    payee_account_number: accountNumber,
    payee_account_holder_kana: holderKana,
    amount: typeof amount === "number" ? amount : 0,
    scheduled_date: scheduledDate,
    due_date: dueDate || undefined,
    description: notes || undefined,
    cashback_applicant_name: applicantName,
    cashback_applicant_name_kana: applicantNameKana,
    cashback_product_name: productName,
    cashback_channel_name: channelName,
  });

  const checkDuplicates = async (): Promise<DuplicateHit[]> => {
    if (typeof amount !== "number" || !scheduledDate || !bankCode || !branchCode || !accountNumber) return [];
    const key = buildDuplicateKey({
      scheduled_date: scheduledDate,
      payee_bank_code: bankCode,
      payee_branch_code: branchCode,
      payee_account_number: accountNumber,
      amount,
    });
    if (!key) return [];
    const { data } = await supabase
      .from("bud_transfers")
      .select("transfer_id, payee_name, amount, scheduled_date, status")
      .eq("duplicate_key", key)
      .neq("status", "振込完了")
      .limit(5);
    return (data ?? []) as DuplicateHit[];
  };

  const handleSubmit = async (saveAsConfirmed: boolean) => {
    if (!sessionUser) return;
    setServerError(null);

    const input = buildInput();
    const attachmentMeta = attachmentFile
      ? {
          name: attachmentFile.name,
          size: attachmentFile.size,
          mimeType: attachmentFile.type,
        }
      : null;
    const result = validateCashbackCreate(input, {
      dataSource,
      saveAsConfirmed,
      attachment: attachmentMeta,
      notes,
      today,
    });
    setErrors(result.errors);
    if (!result.valid) return;

    if (!dupesAcknowledged) {
      const foundDupes = await checkDuplicates();
      if (foundDupes.length > 0) {
        setDupes(foundDupes);
        return;
      }
    }

    setSubmitting(true);
    let uploadedPath: string | null = null;
    try {
      let attachmentUrl: string | undefined;
      if (attachmentFile) {
        const tempHint = `${executeCompanyId}/${Date.now()}`;
        const up = await uploadAttachment(attachmentFile, tempHint);
        if (!up.success || !up.publicUrl) {
          setServerError(`添付アップロードに失敗: ${up.error ?? "unknown"}`);
          return;
        }
        uploadedPath = up.path ?? null;
        attachmentUrl = up.publicUrl;
      }

      const transfer = await createTransfer(
        {
          transfer_category: "cashback",
          data_source: dataSource,
          ...input,
          payee_bank_name: bankName || null,
          payee_branch_name: branchName || null,
          cashback_applicant_phone: applicantPhone || null,
          invoice_pdf_url:
            attachmentFile?.type === "application/pdf" ? attachmentUrl : null,
          scan_image_url:
            attachmentFile && attachmentFile.type !== "application/pdf"
              ? attachmentUrl
              : null,
        },
        sessionUser.user_id,
      );

      if (saveAsConfirmed) {
        const transRes = await transitionTransferStatus({
          transferId: transfer.transfer_id,
          toStatus: "確認済み",
        });
        if (!transRes.success) {
          setServerError(
            `確認済み遷移に失敗: ${transRes.error}（下書きとして保存されました）`,
          );
          router.push(`/bud/transfers/${transfer.transfer_id}`);
          return;
        }
      }

      router.push("/bud/transfers");
    } catch (e) {
      if (uploadedPath) {
        await removeAttachment(uploadedPath).catch(() => {});
      }
      setServerError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <h1 className="text-2xl font-bold text-gray-800">
        新規振込依頼（キャッシュバック）
      </h1>

      <DataSourceSelector
        value={dataSource}
        onChange={setDataSource}
        disabled={submitting}
      />

      <section className="border border-gray-200 rounded-lg p-4 bg-white space-y-3">
        <h2 className="text-sm font-medium text-gray-700">販売法人・支払元</h2>
        <BankPicker
          executeCompanyId={executeCompanyId}
          onCompanyChange={setExecuteCompanyId}
          sourceAccountId={sourceAccountId}
          onAccountChange={(acc) => setSourceAccountId(acc?.id ?? "")}
          disabled={submitting}
        />
      </section>

      <section className="border border-gray-200 rounded-lg p-4 bg-white space-y-3">
        <h2 className="text-sm font-medium text-gray-700">申込者・商材</h2>
        <TextField
          label="申込者名 *"
          value={applicantName}
          onChange={setApplicantName}
          disabled={submitting}
          error={errors.cashback_applicant_name}
        />
        <TextField
          label="申込者名カナ *"
          value={applicantNameKana}
          onChange={setApplicantNameKana}
          disabled={submitting}
          error={errors.cashback_applicant_name_kana}
        />
        <KanaPreview input={applicantNameKana} />
        <TextField
          label="電話番号（任意）"
          value={applicantPhone}
          onChange={setApplicantPhone}
          disabled={submitting}
        />
        <TextField
          label="商材名 *"
          value={productName}
          onChange={setProductName}
          disabled={submitting}
          error={errors.cashback_product_name}
        />
        <TextField
          label="商流名 *"
          value={channelName}
          onChange={setChannelName}
          disabled={submitting}
          error={errors.cashback_channel_name}
        />
      </section>

      <section className="border border-gray-200 rounded-lg p-4 bg-white space-y-3">
        <h2 className="text-sm font-medium text-gray-700">振込先口座（手入力）</h2>
        <div className="grid grid-cols-2 gap-3">
          <TextField
            label="銀行名"
            value={bankName}
            onChange={setBankName}
            disabled={submitting}
          />
          <TextField
            label="銀行コード *（4桁）"
            value={bankCode}
            onChange={setBankCode}
            maxLength={4}
            disabled={submitting}
            error={errors.payee_bank_code}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <TextField
            label="支店名"
            value={branchName}
            onChange={setBranchName}
            disabled={submitting}
          />
          <TextField
            label="支店コード *（3桁）"
            value={branchCode}
            onChange={setBranchCode}
            maxLength={3}
            disabled={submitting}
            error={errors.payee_branch_code}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="text-xs text-gray-600">預金種目 *</span>
            <select
              value={accountType}
              onChange={(e) => setAccountType(e.target.value)}
              disabled={submitting}
              className="mt-1 block w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
            >
              <option value="1">普通</option>
              <option value="2">当座</option>
              <option value="4">貯蓄</option>
            </select>
          </label>
          <TextField
            label="口座番号 *（1〜7桁）"
            value={accountNumber}
            onChange={setAccountNumber}
            maxLength={7}
            disabled={submitting}
            error={errors.payee_account_number}
          />
        </div>
        <TextField
          label="口座名義カナ *"
          value={holderKana}
          onChange={setHolderKana}
          disabled={submitting}
          error={errors.payee_account_holder_kana}
        />
        <KanaPreview input={holderKana} />
      </section>

      <section className="border border-gray-200 rounded-lg p-4 bg-white space-y-3">
        <h2 className="text-sm font-medium text-gray-700">金額・日付</h2>
        <label className="block">
          <span className="text-xs text-gray-600">CB 金額 *（円）</span>
          <input
            type="number"
            min="1"
            max="9999999999"
            value={amount}
            onChange={(e) =>
              setAmount(e.target.value === "" ? "" : Number(e.target.value))
            }
            disabled={submitting}
            className="mt-1 block w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
          />
          {errors.amount && (
            <p className="text-xs text-red-600" role="alert">
              {errors.amount}
            </p>
          )}
        </label>
        <label className="block">
          <span className="text-xs text-gray-600">振込予定日 *（翌営業日以降）</span>
          <input
            type="date"
            value={scheduledDate}
            onChange={(e) => setScheduledDate(e.target.value)}
            disabled={submitting}
            className="mt-1 block w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
          />
          {errors.scheduled_date && (
            <p className="text-xs text-red-600" role="alert">
              {errors.scheduled_date}
            </p>
          )}
        </label>
        <label className="block">
          <span className="text-xs text-gray-600">支払期日（任意）</span>
          <input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            disabled={submitting}
            className="mt-1 block w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
          />
          {errors.due_date && (
            <p className="text-xs text-red-600" role="alert">
              {errors.due_date}
            </p>
          )}
        </label>
      </section>

      <section className="border border-gray-200 rounded-lg p-4 bg-white space-y-3">
        <h2 className="text-sm font-medium text-gray-700">添付・備考</h2>
        <AttachmentUploader
          file={attachmentFile}
          onChange={setAttachmentFile}
          errorMessage={errors.attachment ?? null}
          disabled={submitting}
        />
        <label className="block">
          <span className="text-xs text-gray-600">備考（500 文字以下）</span>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            disabled={submitting}
            rows={3}
            className="mt-1 block w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
          />
          {errors.notes && (
            <p className="text-xs text-red-600" role="alert">
              {errors.notes}
            </p>
          )}
        </label>
      </section>

      <DuplicateWarning
        duplicates={dupes}
        onForceContinue={() => {
          setDupesAcknowledged(true);
          setDupes([]);
        }}
      />

      {serverError && (
        <div
          role="alert"
          className="bg-red-50 border border-red-200 text-red-800 text-sm rounded p-3"
        >
          {serverError}
        </div>
      )}

      <div className="flex justify-end gap-2 pt-2">
        <button
          type="button"
          onClick={() => router.push("/bud/transfers")}
          disabled={submitting}
          className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded"
        >
          キャンセル
        </button>
        <button
          type="button"
          onClick={() => handleSubmit(false)}
          disabled={submitting}
          className="px-4 py-2 text-sm bg-gray-700 text-white rounded hover:bg-gray-800 disabled:opacity-50"
        >
          {submitting ? "送信中…" : "下書き保存"}
        </button>
        {canConfirm && (
          <button
            type="button"
            onClick={() => handleSubmit(true)}
            disabled={submitting}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {submitting ? "送信中…" : "確認済みとして保存"}
          </button>
        )}
      </div>
    </div>
  );
}

interface TextFieldProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  maxLength?: number;
  error?: string;
}

function TextField({ label, value, onChange, disabled, maxLength, error }: TextFieldProps) {
  return (
    <label className="block">
      <span className="text-xs text-gray-600">{label}</span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        maxLength={maxLength}
        className="mt-1 block w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
      />
      {error && (
        <p className="text-xs text-red-600" role="alert">
          {error}
        </p>
      )}
    </label>
  );
}
