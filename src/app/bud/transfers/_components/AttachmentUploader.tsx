"use client";

import { useRef } from "react";
import {
  validateAttachment,
  type AttachmentMeta,
  ATTACHMENT_ALLOWED_MIME_TYPES,
} from "../_lib/transfer-create-schema";
import { transferFormStyles as styles } from "./transferFormStyles";

interface Props {
  file: File | null;
  onChange: (file: File | null) => void;
  errorMessage?: string | null;
  disabled?: boolean;
}

export function AttachmentUploader({
  file,
  onChange,
  errorMessage,
  disabled,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const meta: AttachmentMeta | null = file
    ? { name: file.name, size: file.size, mimeType: file.type }
    : null;

  const preCheck = meta ? validateAttachment(meta) : { ok: true as const };
  const displayError =
    errorMessage ??
    (preCheck.ok ? null : preCheck.message);

  return (
    <div>
      <div className="grid gap-2">
        <input
          ref={inputRef}
          type="file"
          accept={ATTACHMENT_ALLOWED_MIME_TYPES.join(",")}
          disabled={disabled}
          onChange={(e) => onChange(e.target.files?.[0] ?? null)}
          className="hidden"
        />
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={disabled}
          className={styles.fileBox}
        >
          <b className={styles.fileBoxTitle}>
            {file ? file.name : "PDF / JPG / PNG をここへ添付"}
          </b>
          <small className={styles.fileBoxText}>
            {file
              ? `${Math.round(file.size / 1024)} KB`
              : "10MB以下。請求書・見積書などの根拠資料を添付できます。"}
          </small>
        </button>
        {file ? (
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => onChange(null)}
              disabled={disabled}
              className="text-xs text-text-warning underline transition hover:opacity-80"
            >
              削除
            </button>
          </div>
        ) : null}
      </div>
      {displayError && (
        <p className={`${styles.error} mt-1`} role="alert">
          {displayError}
        </p>
      )}
    </div>
  );
}
