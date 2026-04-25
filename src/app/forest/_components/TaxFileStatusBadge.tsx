"use client";

/**
 * Garden-Forest TaxFileStatusBadge: 暫定 / 確定 のステータスバッジ。
 *
 * spec: docs/specs/2026-04-24-forest-t-f5-02-tax-files-list-ui.md §5 Step 3
 *
 * v9 準拠で `＜ ラベル ＞` の全角山括弧で囲む。
 * Forest 規約に従いインラインスタイル（Tailwind 不使用）。
 */

import type { TaxFileStatus } from "../_lib/types";
import { TAX_FILE_STATUS_LABELS } from "../_constants/tax-files";

type Props = {
  status: TaxFileStatus;
};

export function TaxFileStatusBadge({ status }: Props) {
  const config = TAX_FILE_STATUS_LABELS[status];
  return (
    <span
      style={{
        fontSize: 11,
        color: config.color,
        fontWeight: config.fontWeight,
        whiteSpace: "nowrap",
      }}
    >
      {`＜ ${config.label} ＞`}
    </span>
  );
}
