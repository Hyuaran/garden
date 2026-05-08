import type {
  RegularFormInput,
  CashbackFormInput,
  FormValidationResult,
  ValidationErrors,
} from "./transfer-form-schema";
import {
  validateRegularForm,
  validateCashbackForm,
} from "./transfer-form-schema";

export type { ValidationErrors } from "./transfer-form-schema";
import { isAtLeastNextBusinessDay } from "./business-day";

export const DATA_SOURCES = [
  "紙スキャン",
  "デジタル入力",
  "CSVインポート",
] as const;
export type DataSource = (typeof DATA_SOURCES)[number];

export const ATTACHMENT_MAX_BYTES = 10 * 1024 * 1024;
export const ATTACHMENT_ALLOWED_MIME_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
] as const;
export type AllowedAttachmentMime =
  (typeof ATTACHMENT_ALLOWED_MIME_TYPES)[number];

export interface AttachmentMeta {
  name: string;
  size: number;
  mimeType: string;
}

export interface TransferCreateOptions {
  dataSource: DataSource;
  saveAsConfirmed?: boolean;
  attachment?: AttachmentMeta | null;
  notes?: string | null;
  today: Date;
}

export interface RegularCreateInput extends RegularFormInput {}
export interface CashbackCreateInput extends CashbackFormInput {}

export function validateAttachment(
  meta: AttachmentMeta | null | undefined,
): { ok: true } | { ok: false; message: string } {
  if (!meta) return { ok: true };
  if (meta.size <= 0) {
    return { ok: false, message: "添付ファイルが空です" };
  }
  if (meta.size > ATTACHMENT_MAX_BYTES) {
    return {
      ok: false,
      message: `添付ファイルが 10MB を超えています（${Math.round(meta.size / 1024 / 1024)}MB）`,
    };
  }
  if (
    !ATTACHMENT_ALLOWED_MIME_TYPES.includes(
      meta.mimeType as AllowedAttachmentMime,
    )
  ) {
    return {
      ok: false,
      message: "添付は PDF / JPG / PNG のみ対応しています",
    };
  }
  return { ok: true };
}

export function validateNotes(
  notes: string | null | undefined,
): { ok: true } | { ok: false; message: string } {
  if (!notes) return { ok: true };
  if (notes.length > 500) {
    return { ok: false, message: "備考は 500 文字以下で入力してください" };
  }
  return { ok: true };
}

export function canSaveAsConfirmed(dataSource: DataSource): boolean {
  return dataSource === "デジタル入力";
}

export function validateRegularCreate(
  input: RegularCreateInput,
  options: TransferCreateOptions,
): FormValidationResult {
  const base = validateRegularForm(input);
  const errors: ValidationErrors = { ...base.errors };

  if (!DATA_SOURCES.includes(options.dataSource)) {
    errors.data_source = "データソースを選択してください";
  }

  if (
    input.scheduled_date &&
    !isAtLeastNextBusinessDay(input.scheduled_date, options.today)
  ) {
    errors.scheduled_date =
      "振込予定日は翌営業日以降を選択してください（当日振込は admin 判断で個別対応）";
  }

  if (
    input.due_date &&
    input.scheduled_date &&
    input.due_date < input.scheduled_date
  ) {
    errors.due_date = "支払期日は振込予定日以降にしてください";
  }

  const attachmentCheck = validateAttachment(options.attachment);
  if (!attachmentCheck.ok) {
    errors.attachment = attachmentCheck.message;
  }

  const notesCheck = validateNotes(options.notes);
  if (!notesCheck.ok) {
    errors.notes = notesCheck.message;
  }

  if (options.saveAsConfirmed && !canSaveAsConfirmed(options.dataSource)) {
    errors.save_as_confirmed =
      "確認済みとして保存はデジタル入力のみ許可されています";
  }

  return { valid: Object.keys(errors).length === 0, errors };
}

export function validateCashbackCreate(
  input: CashbackCreateInput,
  options: TransferCreateOptions,
): FormValidationResult {
  const base = validateCashbackForm(input);
  const errors: ValidationErrors = { ...base.errors };

  if (!DATA_SOURCES.includes(options.dataSource)) {
    errors.data_source = "データソースを選択してください";
  }

  if (
    input.scheduled_date &&
    !isAtLeastNextBusinessDay(input.scheduled_date, options.today)
  ) {
    errors.scheduled_date =
      "振込予定日は翌営業日以降を選択してください";
  }

  if (
    input.due_date &&
    input.scheduled_date &&
    input.due_date < input.scheduled_date
  ) {
    errors.due_date = "支払期日は振込予定日以降にしてください";
  }

  const attachmentCheck = validateAttachment(options.attachment);
  if (!attachmentCheck.ok) {
    errors.attachment = attachmentCheck.message;
  }

  const notesCheck = validateNotes(options.notes);
  if (!notesCheck.ok) {
    errors.notes = notesCheck.message;
  }

  if (options.saveAsConfirmed && !canSaveAsConfirmed(options.dataSource)) {
    errors.save_as_confirmed =
      "確認済みとして保存はデジタル入力のみ許可されています";
  }

  return { valid: Object.keys(errors).length === 0, errors };
}
