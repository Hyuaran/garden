"use client";

import { useRef } from "react";
import {
  validateAttachment,
  type AttachmentMeta,
  ATTACHMENT_ALLOWED_MIME_TYPES,
} from "../_lib/transfer-create-schema";

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
          className="bg-white border border-gray-300 text-gray-700 text-sm px-3 py-1.5 rounded hover:bg-gray-50 disabled:opacity-50"
        >
          📎 ファイルを選択
        </button>
        {file ? (
          <>
            <span className="text-sm text-gray-700 truncate max-w-xs">
              {file.name}
            </span>
            <span className="text-xs text-gray-500">
              ({Math.round(file.size / 1024)} KB)
            </span>
            <button
              type="button"
              onClick={() => onChange(null)}
              disabled={disabled}
              className="text-xs text-red-600 hover:text-red-700 underline"
            >
              削除
            </button>
          </>
        ) : (
          <span className="text-xs text-gray-400">未選択</span>
        )}
      </div>
      <p className="text-xs text-gray-500 mt-1">
        PDF / JPG / PNG、10MB 以下
      </p>
      {displayError && (
        <p className="text-xs text-red-600 mt-1" role="alert">
          {displayError}
        </p>
      )}
    </div>
  );
}
