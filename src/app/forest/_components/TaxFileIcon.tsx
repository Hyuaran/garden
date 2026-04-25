"use client";

/**
 * Garden-Forest TaxFileIcon: 拡張子別の小さなアイコン。
 *
 * spec: docs/specs/2026-04-24-forest-t-f5-02-tax-files-list-ui.md §5 Step 2
 *
 * - 32×32px、丸角、白文字、拡張子に応じた背景色
 * - 拡張子辞書にない場合は赤系 fallback で `${EXT}` を表示
 * - Forest 規約に従いインラインスタイル（Tailwind 不使用）
 */

import {
  TAX_FILE_ICON_CONFIG,
  TAX_FILE_ICON_FALLBACK_BG,
} from "../_constants/tax-files";

type Props = {
  fileName: string;
};

export function TaxFileIcon({ fileName }: Props) {
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
  const config = TAX_FILE_ICON_CONFIG[ext];
  const background = config?.background ?? TAX_FILE_ICON_FALLBACK_BG;
  const label = config?.label ?? ext.toUpperCase();

  return (
    <div
      style={{
        width: 32,
        height: 32,
        borderRadius: 6,
        background,
        color: "#fff",
        fontSize: 11,
        fontWeight: 700,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        fontFamily: "inherit",
      }}
    >
      {label}
    </div>
  );
}
