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
import { transferFormStyles as styles } from "./transferFormStyles";

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
    <div className={styles.shell}>
      <section className={styles.formGrid}>
        <div className={styles.column}>
          <DataSourceSelector
            value={dataSource}
            onChange={setDataSource}
            disabled={submitting}
          />

          <article className={styles.softPanel}>
            <div className={styles.cardHeader}>
              <h2 className={styles.panelTitle}>
                <span className={styles.titleIcon}>基</span>
                販売法人・支払元
              </h2>
            </div>
            <div className={styles.cardBody}>
              <BankPicker
                executeCompanyId={executeCompanyId}
                onCompanyChange={setExecuteCompanyId}
              sourceAccountId={sourceAccountId}
              onAccountChange={(acc) => setSourceAccountId(acc?.id ?? "")}
                disabled={submitting}
              />
            </div>
          </article>

          <article className={styles.softPanel}>
            <div className={styles.cardHeader}>
              <h2 className={styles.panelTitle}>
                <span className={styles.titleIcon}>申</span>
                申込者・商材
              </h2>
            </div>
            <div className={styles.cardBody}>
              <div className={styles.fieldGridTwo}>
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
                <div className={styles.fullSpan}>
                  <KanaPreview input={applicantNameKana} />
                </div>
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
              </div>
            </div>
          </article>
        </div>

        <div className={styles.column}>
          <article className={styles.softPanel}>
            <div className={styles.cardHeader}>
              <h2 className={styles.panelTitle}>
                <span className={styles.titleIcon}>振</span>
                振込先口座（手入力）
              </h2>
            </div>
            <div className={styles.cardBody}>
              <div className={styles.fieldGridTwo}>
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
                <label className="block">
                  <span className={styles.label}>預金種目 *</span>
                  <select
                    value={accountType}
                    onChange={(e) => setAccountType(e.target.value)}
                    disabled={submitting}
                    className={styles.field}
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
                <div className={styles.fullSpan}>
                  <TextField
                    label="口座名義カナ *"
                    value={holderKana}
                    onChange={setHolderKana}
                    disabled={submitting}
                    error={errors.payee_account_holder_kana}
                  />
                  <KanaPreview input={holderKana} />
                </div>
              </div>
            </div>
          </article>

          <article className={styles.softPanel}>
            <div className={styles.cardHeader}>
              <h2 className={styles.panelTitle}>
                <span className={styles.titleIcon}>金</span>
                金額・日付
              </h2>
            </div>
            <div className={styles.cardBody}>
              <div className={styles.fieldGridTwo}>
                <label className="block">
                  <span className={styles.label}>CB 金額 *（円）</span>
                  <input
                    type="number"
                    min="1"
                    max="9999999999"
                    value={amount}
                    onChange={(e) =>
                      setAmount(e.target.value === "" ? "" : Number(e.target.value))
                    }
                    disabled={submitting}
                    className={styles.field}
                  />
                  {errors.amount && (
                    <p className={styles.error} role="alert">
                      {errors.amount}
                    </p>
                  )}
                </label>
                <label className="block">
                  <span className={styles.label}>振込予定日 *（翌営業日以降）</span>
                  <input
                    type="date"
                    value={scheduledDate}
                    onChange={(e) => setScheduledDate(e.target.value)}
                    disabled={submitting}
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
                    disabled={submitting}
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
                    disabled={submitting}
                  />
                </div>
                <label className="block">
                  <span className={styles.label}>備考</span>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    disabled={submitting}
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
            disabled={submitting}
            className={styles.secondaryButton}
          >
            キャンセル
          </button>
          <button
            type="button"
            onClick={() => handleSubmit(false)}
            disabled={submitting}
            className={styles.mutedButton}
          >
            {submitting ? "送信中…" : "下書き保存"}
          </button>
          {canConfirm && (
            <button
              type="button"
              onClick={() => handleSubmit(true)}
              disabled={submitting}
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
      <span className={styles.label}>{label}</span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        maxLength={maxLength}
        className={styles.field}
      />
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
    </label>
  );
}
