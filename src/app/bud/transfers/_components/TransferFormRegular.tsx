"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useBudState } from "../../_state/BudStateContext";
import {
  createTransfer,
  transitionTransferStatus,
} from "../../_lib/transfer-mutations";
import { supabase } from "../../_lib/supabase";
import { buildDuplicateKey } from "../../_lib/duplicate-key";
import {
  validateRegularCreate,
  type DataSource,
} from "../_lib/transfer-create-schema";
import type { ValidationErrors } from "../_lib/transfer-form-schema";
import { uploadAttachment, removeAttachment } from "../_lib/attachment-upload";
import { BankPicker } from "./BankPicker";
import { VendorPicker, type Vendor } from "./VendorPicker";
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

type TransferInvoiceOcrResult = {
  payee_name: string | null;
  payee_bank_name: string | null;
  payee_bank_code: string | null;
  payee_branch_name: string | null;
  payee_branch_code: string | null;
  payee_account_type: "普通" | "当座" | "貯蓄" | null;
  payee_account_number: string | null;
  payee_account_holder_kana: string | null;
  amount: number | null;
  scheduled_date: string | null;
  invoice_no: string | null;
  confidence: "high" | "low";
};

type TransferInvoiceOcrResponse =
  | { ok: true; result: TransferInvoiceOcrResult }
  | { ok: false; error?: string };

const OCR_ACCOUNT_TYPE_TO_CODE: Record<
  NonNullable<TransferInvoiceOcrResult["payee_account_type"]>,
  string
> = {
  普通: "1",
  当座: "2",
  貯蓄: "4",
};

function appendInvoiceNoToNotes(current: string, invoiceNo: string) {
  const line = `請求書番号: ${invoiceNo}`;
  if (current.includes(line)) return current;
  return current.trim() ? `${current.trim()}\n${line}` : line;
}

export function TransferFormRegular() {
  const router = useRouter();
  const { sessionUser } = useBudState();
  const invoiceOcrInputRef = useRef<HTMLInputElement>(null);

  const [dataSource, setDataSource] = useState<DataSource>("デジタル入力");
  const [executeCompanyId, setExecuteCompanyId] = useState("");
  const [sourceAccountId, setSourceAccountId] = useState("");
  const [vendor, setVendor] = useState<Vendor | null>(null);
  const [amount, setAmount] = useState<number | "">("");
  const [feeBearer, setFeeBearer] = useState("当方負担");
  const [scheduledDate, setScheduledDate] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState("");
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);

  const [errors, setErrors] = useState<ValidationErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [ocrBusy, setOcrBusy] = useState(false);
  const [ocrMessage, setOcrMessage] = useState<string | null>(null);
  const [dupes, setDupes] = useState<DuplicateHit[]>([]);
  const [dupesAcknowledged, setDupesAcknowledged] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const today = useMemo(() => new Date(), []);
  const canConfirm = dataSource === "デジタル入力";
  const busy = submitting || ocrBusy;

  const buildInput = () => ({
    request_company_id: executeCompanyId,
    execute_company_id: executeCompanyId,
    source_account_id: sourceAccountId,
    vendor_id: vendor?.id || undefined,
    payee_name: vendor?.vendor_name ?? "",
    payee_bank_name: vendor?.payee_bank_name ?? "",
    payee_bank_code: vendor?.payee_bank_code ?? "",
    payee_branch_name: vendor?.payee_branch_name ?? "",
    payee_branch_code: vendor?.payee_branch_code ?? "",
    payee_account_type: vendor?.payee_account_type ?? "1",
    payee_account_number: vendor?.payee_account_number ?? "",
    payee_account_holder_kana: vendor?.payee_account_holder_kana ?? "",
    amount: typeof amount === "number" ? amount : 0,
    scheduled_date: scheduledDate,
    due_date: dueDate || undefined,
    description: notes || undefined,
    fee_bearer: feeBearer,
  });

  const handleInvoiceOcrFile = async (file: File | null) => {
    if (!file) return;
    setOcrBusy(true);
    setOcrMessage(null);
    setServerError(null);
    setAttachmentFile(file);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/bud/transfer-invoice-ocr", {
        method: "POST",
        body: formData,
      });
      const json = (await res.json()) as TransferInvoiceOcrResponse;
      if (!res.ok || !json.ok) {
        throw new Error(
          json.ok
            ? "請求書OCRに失敗しました"
            : json.error ?? "請求書OCRに失敗しました",
        );
      }
      applyInvoiceOcrResult(json.result);
      setOcrMessage(
        json.result.confidence === "low"
          ? "OCR結果を反映しました。未読取・低信頼の項目を確認してください。"
          : "OCR結果を反映しました。",
      );
    } catch (error) {
      setServerError(error instanceof Error ? error.message : String(error));
    } finally {
      setOcrBusy(false);
      if (invoiceOcrInputRef.current) invoiceOcrInputRef.current.value = "";
    }
  };

  const applyInvoiceOcrResult = (result: TransferInvoiceOcrResult) => {
    setVendor((current) => ({
      id: current?.id ?? "",
      vendor_name: result.payee_name ?? current?.vendor_name ?? "",
      payee_bank_name:
        result.payee_bank_name ?? current?.payee_bank_name ?? null,
      payee_bank_code: result.payee_bank_code ?? current?.payee_bank_code ?? "",
      payee_branch_name:
        result.payee_branch_name ?? current?.payee_branch_name ?? null,
      payee_branch_code:
        result.payee_branch_code ?? current?.payee_branch_code ?? "",
      payee_account_type:
        (result.payee_account_type
          ? OCR_ACCOUNT_TYPE_TO_CODE[result.payee_account_type]
          : null) ??
        current?.payee_account_type ??
        "1",
      payee_account_number:
        result.payee_account_number ?? current?.payee_account_number ?? "",
      payee_account_holder_kana:
        result.payee_account_holder_kana ??
        current?.payee_account_holder_kana ??
        "",
    }));
    if (typeof result.amount === "number") setAmount(result.amount);
    if (result.scheduled_date) setScheduledDate(result.scheduled_date);
    const invoiceNo = result.invoice_no;
    if (invoiceNo) {
      setNotes((current) => appendInvoiceNoToNotes(current, invoiceNo));
    }
    setDupes([]);
    setDupesAcknowledged(false);
  };

  const checkDuplicates = async (): Promise<DuplicateHit[]> => {
    if (!vendor || typeof amount !== "number" || !scheduledDate) return [];
    const key = buildDuplicateKey({
      scheduled_date: scheduledDate,
      payee_bank_code: vendor.payee_bank_code,
      payee_branch_code: vendor.payee_branch_code,
      payee_account_number: vendor.payee_account_number,
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
    if (ocrBusy) return;
    setServerError(null);

    const input = buildInput();
    const attachmentMeta = attachmentFile
      ? {
          name: attachmentFile.name,
          size: attachmentFile.size,
          mimeType: attachmentFile.type,
        }
      : null;
    const result = validateRegularCreate(input, {
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
          transfer_category: "regular",
          data_source: dataSource,
          ...input,
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
      <h1 className="text-2xl font-bold text-gray-800">新規振込依頼（通常）</h1>

      <section className="border border-amber-200 rounded-lg p-4 bg-amber-50/70 space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <h2 className="text-sm font-medium text-amber-900">
              請求書OCR自動入力
            </h2>
            <p className="text-xs text-amber-800">
              PDF / JPG / PNG から振込先・金額・振込予定日を読み取り、添付にも設定します。
            </p>
          </div>
          <button
            type="button"
            onClick={() => invoiceOcrInputRef.current?.click()}
            disabled={busy}
            className="shrink-0 rounded bg-amber-700 px-4 py-2 text-sm text-white hover:bg-amber-800 disabled:opacity-50"
          >
            {ocrBusy ? "OCR中…" : "請求書を選択"}
          </button>
        </div>
        <input
          ref={invoiceOcrInputRef}
          type="file"
          accept="application/pdf,image/jpeg,image/png"
          className="hidden"
          disabled={busy}
          onChange={(e) =>
            void handleInvoiceOcrFile(e.target.files?.[0] ?? null)
          }
        />
        {ocrMessage && (
          <p className="text-xs text-amber-900" role="status">
            {ocrMessage}
          </p>
        )}
      </section>

      <DataSourceSelector
        value={dataSource}
        onChange={setDataSource}
        disabled={busy}
      />

      <section className="border border-gray-200 rounded-lg p-4 bg-white space-y-3">
        <h2 className="text-sm font-medium text-gray-700">基本情報</h2>
        <BankPicker
          executeCompanyId={executeCompanyId}
          onCompanyChange={setExecuteCompanyId}
          sourceAccountId={sourceAccountId}
          onAccountChange={(acc) => setSourceAccountId(acc?.id ?? "")}
          disabled={busy}
        />
        {errors.execute_company_id && (
          <p className="text-xs text-red-600" role="alert">
            {errors.execute_company_id}
          </p>
        )}
        {errors.source_account_id && (
          <p className="text-xs text-red-600" role="alert">
            {errors.source_account_id}
          </p>
        )}
      </section>

      <section className="border border-gray-200 rounded-lg p-4 bg-white space-y-3">
        <h2 className="text-sm font-medium text-gray-700">振込先</h2>
        <VendorPicker
          selectedVendorId={vendor?.id ?? ""}
          onSelect={setVendor}
          disabled={busy}
        />
        {vendor && !vendor.id && (
          <p className="text-xs text-amber-700">
            OCRで読み取った振込先です。既存取引先を使う場合は選択し直してください。
          </p>
        )}
        {errors.payee_name && (
          <p className="text-xs text-red-600" role="alert">
            {errors.payee_name}
          </p>
        )}
        {vendor && (
          <div className="text-xs text-gray-500 bg-gray-50 rounded p-2 space-y-0.5">
            <div>
              銀行: {vendor.payee_bank_name ?? "—"}（{vendor.payee_bank_code}）
            </div>
            <div>
              支店: {vendor.payee_branch_name ?? "—"}（
              {vendor.payee_branch_code}）
            </div>
            <div>口座: {vendor.payee_account_number}</div>
            <div>
              名義: {vendor.payee_account_holder_kana ?? "—"}
              <KanaPreview
                input={vendor.payee_account_holder_kana ?? ""}
                label=""
              />
            </div>
          </div>
        )}
        <label className="block">
          <span className="text-xs text-gray-600">振込金額 *（円）</span>
          <input
            type="number"
            min="1"
            max="9999999999"
            value={amount}
            onChange={(e) =>
              setAmount(e.target.value === "" ? "" : Number(e.target.value))
            }
            disabled={busy}
            className="mt-1 block w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
          />
          {errors.amount && (
            <p className="text-xs text-red-600" role="alert">
              {errors.amount}
            </p>
          )}
        </label>
        <fieldset>
          <legend className="text-xs text-gray-600">手数料負担</legend>
          <div className="flex gap-4 mt-1">
            {["当方負担", "先方負担"].map((fb) => (
              <label
                key={fb}
                className="inline-flex items-center gap-2 text-sm cursor-pointer"
              >
                <input
                  type="radio"
                  name="fee_bearer"
                  value={fb}
                  checked={feeBearer === fb}
                  onChange={() => setFeeBearer(fb)}
                  disabled={busy}
                  className="accent-emerald-600"
                />
                <span className="text-gray-900">{fb}</span>
              </label>
            ))}
          </div>
        </fieldset>
      </section>

      <section className="border border-gray-200 rounded-lg p-4 bg-white space-y-3">
        <h2 className="text-sm font-medium text-gray-700">日付</h2>
        <label className="block">
          <span className="text-xs text-gray-600">振込予定日 *（翌営業日以降）</span>
          <input
            type="date"
            value={scheduledDate}
            onChange={(e) => setScheduledDate(e.target.value)}
            disabled={busy}
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
            disabled={busy}
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
          disabled={busy}
        />
        <label className="block">
          <span className="text-xs text-gray-600">備考（500 文字以下）</span>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            disabled={busy}
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
          disabled={busy}
          className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded"
        >
          キャンセル
        </button>
        <button
          type="button"
          onClick={() => handleSubmit(false)}
          disabled={busy}
          className="px-4 py-2 text-sm bg-gray-700 text-white rounded hover:bg-gray-800 disabled:opacity-50"
        >
          {submitting ? "送信中…" : "下書き保存"}
        </button>
        {canConfirm && (
          <button
            type="button"
            onClick={() => handleSubmit(true)}
            disabled={busy}
            className="px-4 py-2 text-sm bg-emerald-600 text-white rounded hover:bg-emerald-700 disabled:opacity-50"
          >
            {submitting ? "送信中…" : "確認済みとして保存"}
          </button>
        )}
      </div>
    </div>
  );
}
