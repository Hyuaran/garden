"use client";

/**
 * Garden-Forest TaxFilesGroup: 法人 1 社分のアコーディオン。
 *
 * spec: docs/specs/2026-04-24-forest-t-f5-02-tax-files-list-ui.md §5 Step 4
 *
 * - ヘッダー: 法人名 + 開閉アイコン (＋/−)
 * - ボディ: ファイル行のリスト、または「（データなし）」
 * - クリックで signedURL を取得して別タブで開く
 *
 * Forest 規約に従いインラインスタイル（Tailwind 不使用）。
 */

import { useState } from "react";

import type { TaxFile } from "../_lib/types";
import { createTaxFileSignedUrl } from "../_lib/queries";
import { C } from "../_constants/colors";
import { FOREST_THEME } from "../_constants/theme";
import { TaxFileIcon } from "./TaxFileIcon";
import { TaxFileStatusBadge } from "./TaxFileStatusBadge";

type Props = {
  /** 日本語法人名（例: '株式会社ヒュアラン'） */
  companyLabel: string;
  files: TaxFile[];
  /** 既定: ファイルあり=true、なし=false（呼出側で制御） */
  defaultOpen?: boolean;
};

export function TaxFilesGroup({
  companyLabel,
  files,
  defaultOpen = true,
}: Props) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const hasFiles = files.length > 0;

  const handleOpen = async (storagePath: string) => {
    try {
      const url = await createTaxFileSignedUrl(storagePath, 600);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (e) {
      console.error("[TaxFilesGroup] signedUrl error", e);
      // 注: 本番運用ではトースト通知が望ましいが、Forest 既存パターンに合わせて alert
      alert("ファイルの取得に失敗しました");
    }
  };

  return (
    <div style={{ opacity: hasFiles ? 1 : 0.6 }}>
      {/* ヘッダー（法人名 + 開閉トグル） */}
      <button
        type="button"
        onClick={() => setIsOpen((o) => !o)}
        aria-expanded={isOpen}
        style={{
          width: "100%",
          textAlign: "left",
          fontSize: 13,
          fontWeight: 600,
          color: C.darkGreen,
          padding: "6px 0",
          borderBottom: `1px solid ${C.mintBg}`,
          display: "flex",
          alignItems: "center",
          gap: 6,
          background: "transparent",
          border: "none",
          borderBottomColor: C.mintBg,
          borderBottomStyle: "solid",
          borderBottomWidth: 1,
          cursor: "pointer",
          fontFamily: "inherit",
          userSelect: "none",
        }}
      >
        <span
          style={{
            display: "inline-flex",
            width: 18,
            height: 18,
            alignItems: "center",
            justifyContent: "center",
            fontSize: 14,
            color: C.textMuted,
            fontWeight: 500,
          }}
        >
          {isOpen ? "−" : "+"}
        </span>
        {companyLabel}
      </button>

      {/* ボディ */}
      {isOpen && (
        <div style={{ marginTop: 6 }}>
          {!hasFiles ? (
            <div
              style={{
                fontSize: 12,
                color: C.textMuted,
                padding: "6px 0 6px 24px",
              }}
            >
              （データなし）
            </div>
          ) : (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 8,
              }}
            >
              {files.map((f) => (
                <FileRow
                  key={f.id}
                  file={f}
                  onOpen={() => handleOpen(f.storage_path)}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function FileRow({
  file,
  onOpen,
}: {
  file: TaxFile;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: 10,
        background: "rgba(255,255,255,0.7)",
        borderRadius: 8,
        border: "none",
        textAlign: "left",
        width: "100%",
        cursor: "pointer",
        fontFamily: "inherit",
        transition: "background 0.15s",
      }}
    >
      <TaxFileIcon fileName={file.file_name} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 13,
            fontWeight: 500,
            display: "flex",
            alignItems: "center",
            gap: 8,
            flexWrap: "wrap",
          }}
        >
          <TaxFileStatusBadge status={file.status} />
          <span
            style={{
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {file.doc_name}
          </span>
        </div>
        <div
          style={{
            fontSize: 11,
            color: C.textMuted,
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginTop: 2,
          }}
        >
          <span>{`${formatConnectDate(file.uploaded_at)} 連携`}</span>
          {file.note && (
            <span style={{ color: FOREST_THEME.negative }}>
              {`※${file.note}`}
            </span>
          )}
        </div>
      </div>
      {/* 外部リンクアイコン（svg） */}
      <svg
        aria-hidden="true"
        style={{ flexShrink: 0, width: 16, height: 16, fill: C.textMuted }}
        viewBox="0 0 24 24"
      >
        <path d="M19 19H5V5h7V3H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7h-2v7zM14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3h-7z" />
      </svg>
    </button>
  );
}

/** ISO timestamp を 'YYYY/MM/DD' に整形。 */
function formatConnectDate(iso: string): string {
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}/${m}/${day}`;
}
