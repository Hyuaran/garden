"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
import {
  hasAnyPayeasyNumber,
  normalizePayeasyNumber,
  type PaymentCategory,
  type RegisteredMethod,
} from "../_lib/payment-category";
import type { ValidationErrors } from "../_lib/transfer-form-schema";
import { uploadAttachment, removeAttachment } from "../_lib/attachment-upload";
import { BankPicker } from "./BankPicker";
import { VendorPicker, type Vendor } from "./VendorPicker";
import { DataSourceSelector } from "./DataSourceSelector";
import { AttachmentUploader } from "./AttachmentUploader";
import { DuplicateWarning } from "./DuplicateWarning";
import { KanaPreview } from "./KanaPreview";
import { transferFormStyles as styles } from "./transferFormStyles";

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
  payeasy_biller_no: string | null;
  payeasy_customer_no: string | null;
  payeasy_confirm_no: string | null;
  confidence: "high" | "low";
};

type TransferInvoiceOcrResponse =
  | { ok: true; result: TransferInvoiceOcrResult }
  | { ok: false; error?: string };

type TransferInboxItem = {
  id: string;
  file_name: string;
  mime_type: "application/pdf" | "image/jpeg" | "image/png";
  storage_path: string;
  public_url: string | null;
  imported_at: string;
};

type TransferInboxResponse =
  | { ok: true; item: TransferInboxItem | null }
  | { ok: false; error?: string };

type TransferInboxAttachment = {
  id: string;
  fileName: string;
  mimeType: "application/pdf" | "image/jpeg" | "image/png";
  storagePath: string;
  publicUrl: string | null;
};

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

export function TransferFormRegular({ inboxId }: { inboxId?: string | null }) {
  const router = useRouter();
  const { sessionUser } = useBudState();
  const invoiceOcrInputRef = useRef<HTMLInputElement>(null);
  const inboxOcrStartedRef = useRef(false);

  const [dataSource, setDataSource] = useState<DataSource>("デジタル入力");
  const [executeCompanyId, setExecuteCompanyId] = useState("");
  const [sourceAccountId, setSourceAccountId] = useState("");
  const [vendor, setVendor] = useState<Vendor | null>(null);
  const [amount, setAmount] = useState<number | "">("");
  const [paymentCategory, setPaymentCategory] = useState<PaymentCategory>("transfer");
  const [registeredMethod, setRegisteredMethod] = useState<RegisteredMethod | "">("");
  const [payeasyBillerNo, setPayeasyBillerNo] = useState("");
  const [payeasyCustomerNo, setPayeasyCustomerNo] = useState("");
  const [payeasyConfirmNo, setPayeasyConfirmNo] = useState("");
  const [feeBearer, setFeeBearer] = useState("当方負担");
  const [scheduledDate, setScheduledDate] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState("");
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
  const [inboxAttachment, setInboxAttachment] =
    useState<TransferInboxAttachment | null>(null);

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
    payment_category: paymentCategory,
    registered_method: registeredMethod || null,
    payeasy_biller_no: normalizePayeasyNumber(payeasyBillerNo) || null,
    payeasy_customer_no: normalizePayeasyNumber(payeasyCustomerNo) || null,
    payeasy_confirm_no: normalizePayeasyNumber(payeasyConfirmNo) || null,
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
    setInboxAttachment(null);
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

  const handleInboxOcr = async (id: string) => {
    setOcrBusy(true);
    setOcrMessage("未処理トレイの請求書をOCRしています。");
    setServerError(null);
    try {
      const inboxRes = await fetch(
        `/api/bud/transfer-inbox?id=${encodeURIComponent(id)}`,
      );
      const inboxJson = (await inboxRes.json()) as TransferInboxResponse;
      if (!inboxRes.ok || !inboxJson.ok || !inboxJson.item) {
        throw new Error(
          inboxJson.ok
            ? "未処理トレイのファイルが見つかりません"
            : inboxJson.error ?? "未処理トレイの取得に失敗しました",
        );
      }

      const item = inboxJson.item;
      setAttachmentFile(null);
      setInboxAttachment({
        id: item.id,
        fileName: item.file_name,
        mimeType: item.mime_type,
        storagePath: item.storage_path,
        publicUrl: item.public_url,
      });
      setDataSource("紙スキャン");

      const ocrRes = await fetch("/api/bud/transfer-invoice-ocr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storagePath: item.storage_path,
          mimeType: item.mime_type,
        }),
      });
      const ocrJson = (await ocrRes.json()) as TransferInvoiceOcrResponse;
      if (!ocrRes.ok || !ocrJson.ok) {
        throw new Error(
          ocrJson.ok
            ? "請求書OCRに失敗しました"
            : ocrJson.error ?? "請求書OCRに失敗しました",
        );
      }
      applyInvoiceOcrResult(ocrJson.result);
      setOcrMessage(
        ocrJson.result.confidence === "low"
          ? "未処理トレイのOCR結果を反映しました。未読取・低信頼の項目を確認してください。"
          : "未処理トレイのOCR結果を反映しました。",
      );
    } catch (error) {
      setServerError(error instanceof Error ? error.message : String(error));
      setOcrMessage(null);
    } finally {
      setOcrBusy(false);
    }
  };

  useEffect(() => {
    if (!inboxId || inboxOcrStartedRef.current) return;
    inboxOcrStartedRef.current = true;
    void handleInboxOcr(inboxId);
    // The inbox OCR should run exactly once for the initial inbox id.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inboxId]);

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
    const nextPayeasy = {
      payeasy_biller_no: result.payeasy_biller_no,
      payeasy_customer_no: result.payeasy_customer_no,
      payeasy_confirm_no: result.payeasy_confirm_no,
    };
    if (hasAnyPayeasyNumber(nextPayeasy)) {
      setPaymentCategory("payeasy");
      setPayeasyBillerNo(normalizePayeasyNumber(result.payeasy_biller_no));
      setPayeasyCustomerNo(normalizePayeasyNumber(result.payeasy_customer_no));
      setPayeasyConfirmNo(normalizePayeasyNumber(result.payeasy_confirm_no));
    }
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
      let attachmentUrl: string | undefined =
        inboxAttachment?.publicUrl ?? undefined;
      const attachmentMimeType = attachmentFile?.type ?? inboxAttachment?.mimeType;
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
            attachmentMimeType === "application/pdf" ? attachmentUrl : null,
          scan_image_url:
            attachmentMimeType && attachmentMimeType !== "application/pdf"
              ? attachmentUrl
              : null,
        },
        sessionUser.user_id,
      );

      if (inboxAttachment) {
        const consumeRes = await fetch("/api/bud/transfer-inbox", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "consume",
            id: inboxAttachment.id,
            transferId: transfer.transfer_id,
          }),
        });
        const consumeJson = (await consumeRes.json()) as {
          ok: boolean;
          error?: string;
        };
        if (!consumeRes.ok || !consumeJson.ok) {
          throw new Error(
            consumeJson.error ?? "未処理トレイの消費済み更新に失敗しました",
          );
        }
      }

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
    <div className={styles.shell}>
      <section className={styles.formGrid}>
        <div className={styles.column}>
          <article className={styles.ocrPanel}>
            <div className={styles.cardHeader}>
              <h2 className={styles.panelTitle}>
                <span className={styles.titleIcon}>読</span>
                請求書OCR自動入力
              </h2>
              <button
                type="button"
                onClick={() => invoiceOcrInputRef.current?.click()}
                disabled={busy}
                className={`${styles.goldButton} shrink-0`}
              >
                {ocrBusy ? "OCR中…" : "請求書を選択"}
              </button>
            </div>
            <div className={styles.cardBody}>
              <p className={styles.ocrText}>
                PDF・画像の請求書から、取引先名、金額、期日などを自動で読み取り、下の入力欄へ下書き反映します。読み取り後も内容を確認・修正できます。
              </p>
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
                <p className="mt-3 text-xs text-[#b3892e]" role="status">
                  {ocrMessage}
                </p>
              )}
              {inboxAttachment && (
                <p className={`${styles.ocrText} mt-3`}>
                  未処理トレイ添付: {inboxAttachment.fileName}
                </p>
              )}
            </div>
          </article>

          <DataSourceSelector
            value={dataSource}
            onChange={setDataSource}
            disabled={busy}
          />

          <article className={styles.softPanel}>
            <div className={styles.cardHeader}>
              <h2 className={styles.panelTitle}>
                <span className={styles.titleIcon}>区</span>
                支払区分
              </h2>
            </div>
            <div className={styles.cardBody}>
              <div className={styles.sourceOptions}>
                {[
                  ["transfer", "振込", "銀行振込として全銀CSV対象にします。"],
                  ["payeasy", "ペイジー", "3番号を控えて銀行画面で支払います。"],
                  ["cash", "現金", "現金精算として扱います。"],
                  ["registered", "決済登録済", "クレカ・口座振替など登録済の支払です。"],
                ].map(([value, title, text]) => (
                  <label
                    key={value}
                    className={`${styles.sourceOption} ${
                      paymentCategory === value ? styles.sourceOptionActive : ""
                    }`}
                  >
                    <input
                      type="radio"
                      name="payment_category"
                      value={value}
                      checked={paymentCategory === value}
                      onChange={() => setPaymentCategory(value as PaymentCategory)}
                      disabled={busy}
                      className="sr-only"
                    />
                    <span className={styles.sourceOptionTitle}>{title}</span>
                    <span className={styles.sourceOptionText}>{text}</span>
                  </label>
                ))}
              </div>

              {paymentCategory === "payeasy" && (
                <div className={`${styles.fieldGrid} mt-4`}>
                  <div className={styles.fieldGridThree}>
                    <label className="block">
                      <span className={styles.label}>収納機関番号 *</span>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={payeasyBillerNo}
                        onChange={(e) => setPayeasyBillerNo(normalizePayeasyNumber(e.target.value))}
                        disabled={busy}
                        className={styles.field}
                      />
                      {errors.payeasy_biller_no && (
                        <p className={styles.error} role="alert">
                          {errors.payeasy_biller_no}
                        </p>
                      )}
                    </label>
                    <label className="block">
                      <span className={styles.label}>お客様番号 *</span>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={payeasyCustomerNo}
                        onChange={(e) => setPayeasyCustomerNo(normalizePayeasyNumber(e.target.value))}
                        disabled={busy}
                        className={styles.field}
                      />
                      {errors.payeasy_customer_no && (
                        <p className={styles.error} role="alert">
                          {errors.payeasy_customer_no}
                        </p>
                      )}
                    </label>
                    <label className="block">
                      <span className={styles.label}>確認番号 *</span>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={payeasyConfirmNo}
                        onChange={(e) => setPayeasyConfirmNo(normalizePayeasyNumber(e.target.value))}
                        disabled={busy}
                        className={styles.field}
                      />
                      {errors.payeasy_confirm_no && (
                        <p className={styles.error} role="alert">
                          {errors.payeasy_confirm_no}
                        </p>
                      )}
                    </label>
                  </div>
                </div>
              )}

              {paymentCategory === "registered" && (
                <label className="mt-4 block">
                  <span className={styles.label}>決済方法 *</span>
                  <select
                    value={registeredMethod}
                    onChange={(e) => setRegisteredMethod(e.target.value as RegisteredMethod | "")}
                    disabled={busy}
                    className={styles.field}
                  >
                    <option value="">選択してください</option>
                    <option value="credit_card">クレカ</option>
                    <option value="direct_debit">口座振替</option>
                    <option value="auto_transfer">自動振込</option>
                  </select>
                  {errors.registered_method && (
                    <p className={styles.error} role="alert">
                      {errors.registered_method}
                    </p>
                  )}
                </label>
              )}
            </div>
          </article>

          <article className={styles.softPanel}>
            <div className={styles.cardHeader}>
              <h2 className={styles.panelTitle}>
                <span className={styles.titleIcon}>基</span>
                基本情報
              </h2>
            </div>
            <div className={styles.cardBody}>
              <BankPicker
                executeCompanyId={executeCompanyId}
                onCompanyChange={setExecuteCompanyId}
                sourceAccountId={sourceAccountId}
                onAccountChange={(acc) => setSourceAccountId(acc?.id ?? "")}
                disabled={busy}
              />
              {errors.execute_company_id && (
                <p className={styles.error} role="alert">
                  {errors.execute_company_id}
                </p>
              )}
              {errors.source_account_id && (
                <p className={styles.error} role="alert">
                  {errors.source_account_id}
                </p>
              )}
            </div>
          </article>
        </div>

        <div className={styles.column}>
          <article className={styles.softPanel}>
            <div className={styles.cardHeader}>
              <h2 className={styles.panelTitle}>
                <span className={styles.titleIcon}>振</span>
                振込先
              </h2>
            </div>
            <div className={styles.cardBody}>
              <div className={styles.fieldGrid}>
                <VendorPicker
                  selectedVendorId={vendor?.id ?? ""}
                  onSelect={setVendor}
                  disabled={busy}
                />
                {vendor && !vendor.id && (
                  <p className="text-xs text-[#b3892e]">
                    OCRで読み取った振込先です。既存取引先を使う場合は選択し直してください。
                  </p>
                )}
                {errors.payee_name && (
                  <p className={styles.error} role="alert">
                    {errors.payee_name}
                  </p>
                )}
                {vendor && (
                  <div className={styles.infoCard}>
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
                <div className={styles.fieldGridTwo}>
                  <label className="block">
                    <span className={styles.label}>振込金額 *（円）</span>
                    <input
                      type="number"
                      min="1"
                      max="9999999999"
                      value={amount}
                      onChange={(e) =>
                        setAmount(e.target.value === "" ? "" : Number(e.target.value))
                      }
                      disabled={busy}
                      className={styles.field}
                    />
                    {errors.amount && (
                      <p className={styles.error} role="alert">
                        {errors.amount}
                      </p>
                    )}
                  </label>
                  <fieldset>
                    <legend className={styles.label}>手数料負担</legend>
                    <div className={styles.segmented}>
                      {[
                        ["当方負担", "当方"],
                        ["先方負担", "先方"],
                      ].map(([value, label]) => (
                        <label
                          key={value}
                          className={`${styles.segmentOption} ${
                            feeBearer === value ? styles.segmentOptionActive : ""
                          }`}
                        >
                          <input
                            type="radio"
                            name="fee_bearer"
                            value={value}
                            checked={feeBearer === value}
                            onChange={() => setFeeBearer(value)}
                            disabled={busy}
                            className="sr-only"
                          />
                          <span>{label}</span>
                        </label>
                      ))}
                    </div>
                  </fieldset>
                </div>
                <div className={styles.fieldGridTwo}>
                  <label className="block">
                    <span className={styles.label}>振込予定日 *（翌営業日以降）</span>
                    <input
                      type="date"
                      value={scheduledDate}
                      onChange={(e) => setScheduledDate(e.target.value)}
                      disabled={busy}
                      className={styles.field}
                    />
                    {errors.scheduled_date && (
                      <p className={styles.error} role="alert">
                        {errors.scheduled_date}
                      </p>
                    )}
                  </label>
                  <label className="block">
                    <span className={styles.label}>支払期日（任意）</span>
                    <input
                      type="date"
                      value={dueDate}
                      onChange={(e) => setDueDate(e.target.value)}
                      disabled={busy}
                      className={styles.field}
                    />
                    {errors.due_date && (
                      <p className={styles.error} role="alert">
                        {errors.due_date}
                      </p>
                    )}
                  </label>
                </div>
              </div>
            </div>
          </article>

          <article className={styles.panel}>
            <div className={styles.cardHeader}>
              <h2 className={styles.panelTitle}>
                <span className={styles.titleIcon}>添</span>
                添付・備考
              </h2>
            </div>
            <div className={styles.cardBody}>
              <div className={styles.fieldGrid}>
                <div>
                  <span className={styles.label}>ファイル選択</span>
                  <AttachmentUploader
                    file={attachmentFile}
                    onChange={setAttachmentFile}
                    errorMessage={errors.attachment ?? null}
                    disabled={busy}
                  />
                </div>
                <label className="block">
                  <span className={styles.label}>備考</span>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    disabled={busy}
                    rows={4}
                    className={`${styles.field} min-h-32 items-start pt-3.5 leading-[1.7]`}
                  />
                  <span className={styles.hint}>500文字以内</span>
                  {errors.notes && (
                    <p className={styles.error} role="alert">
                      {errors.notes}
                    </p>
                  )}
                </label>
              </div>
            </div>
          </article>
        </div>
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
          className={styles.alert}
        >
          {serverError}
        </div>
      )}

      <section className={styles.footerPanel}>
        <div className={styles.flowNote}>
          <span className={styles.flowRound}>承</span>
          <span>保存後は「承認待ち」に入り、manager → admin の確認フローへ進みます。</span>
        </div>
        <div className={styles.footerButtons}>
          <button
            type="button"
            onClick={() => router.push("/bud/transfers")}
            disabled={busy}
            className={styles.secondaryButton}
          >
            キャンセル
          </button>
          <button
            type="button"
            onClick={() => handleSubmit(false)}
            disabled={busy}
            className={styles.mutedButton}
          >
            {submitting ? "送信中…" : "下書き保存"}
          </button>
          {canConfirm && (
            <button
              type="button"
              onClick={() => handleSubmit(true)}
              disabled={busy}
              className={styles.goldButton}
            >
              {submitting ? "送信中…" : "確認済みとして保存"}
            </button>
          )}
        </div>
      </section>
    </div>
  );
}
