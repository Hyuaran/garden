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
      <div className="flex items-center gap-3">
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
          className={styles.linkButton}
        >
          📎 ファイルを選択
        </button>
        {file ? (
          <>
            <span className="max-w-xs truncate text-sm text-text-main">
              {file.name}
            </span>
            <span className={styles.hint}>
              ({Math.round(file.size / 1024)} KB)
            </span>
            <button
              type="button"
              onClick={() => onChange(null)}
              disabled={disabled}
              className="text-xs text-text-warning underline transition hover:opacity-80"
            >
              削除
            </button>
          </>
        ) : (
          <span className={styles.hint}>未選択</span>
        )}
      </div>
      <p className={`${styles.hint} mt-1`}>
        PDF / JPG / PNG、10MB 以下
      </p>
      {displayError && (
        <p className={`${styles.error} mt-1`} role="alert">
          {displayError}
        </p>
      )}
    </div>
  );
}
