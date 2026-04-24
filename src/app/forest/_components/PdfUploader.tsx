"use client";

/**
 * PDF ドロップゾーン
 *
 * - ドラッグ&ドロップまたはタップで PDF 選択
 * - /api/forest/parse-pdf へ multipart POST
 * - 成功時: onExtracted(ParsePdfResult) コールバック
 * - 失敗時: onError(message) コールバック
 *
 * 認証: supabase.auth.getSession() で取得した access_token を
 *       Authorization Bearer ヘッダで送信する（サーバー側と整合）。
 */
import { useRef, useState, type ChangeEvent, type DragEvent } from "react";

import { C } from "../_constants/colors";
import type { ParsePdfResult } from "../_lib/types";
import { supabase } from "../_lib/supabase";

type Props = {
  onExtracted: (data: ParsePdfResult) => void;
  onError: (message: string) => void;
};

export function PdfUploader({ onExtracted, onError }: Props) {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function uploadFile(file: File) {
    if (!file.name.toLowerCase().endsWith(".pdf")) {
      onError("PDF ファイルを選択してください");
      return;
    }

    setIsUploading(true);
    try {
      // JWT を取得して Authorization ヘッダに載せる
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        onError("セッションが取得できません。再ログインしてください。");
        return;
      }

      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/forest/parse-pdf", {
        method: "POST",
        body: formData,
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        onError(json.error ?? "アップロード失敗");
        return;
      }
      onExtracted(json.data);
    } catch (e) {
      onError(e instanceof Error ? e.message : "通信エラー");
    } finally {
      setIsUploading(false);
    }
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) uploadFile(file);
  }

  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) uploadFile(file);
  }

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
      onClick={() => fileInputRef.current?.click()}
      style={{
        border: `2px dashed ${isDragging ? C.accentGreen : "#d8f3dc"}`,
        borderRadius: 12,
        padding: "32px 16px",
        textAlign: "center",
        cursor: "pointer",
        background: isDragging ? C.mintBg : "#fafbfa",
        color: C.textSub,
        fontSize: 14,
        transition: "all 0.15s",
      }}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept="application/pdf,.pdf"
        onChange={handleChange}
        style={{ display: "none" }}
      />
      {isUploading ? (
        <>📄 解析中...</>
      ) : (
        <>📄 PDFをここにドロップ（またはクリックして選択）</>
      )}
    </div>
  );
}
