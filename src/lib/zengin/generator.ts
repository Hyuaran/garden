/**
 * Garden-Bud / 全銀協 CSV — ジェネレータ（orchestrator）
 *
 * 振込データの配列と振込元口座情報を受け取り、全銀協フォーマットの
 * 完全な CSV（Shift-JIS エンコード済 Buffer）を生成する。
 */

import type {
  ZenginTransferInput,
  ZenginSourceAccount,
  ZenginOptions,
  GenerateResult,
} from "./types";
import { validateTransfer } from "./validator";
import { buildHeaderRecord } from "./records/header";
import { buildDataRecord } from "./records/data";
import { buildTrailerRecord } from "./records/trailer";
import { buildEndRecord } from "./records/end";
import { encodeToShiftJis } from "./encoding";
import { getBankProfile } from "./bank-specific";

export function generateZenginCsv(
  transfers: ZenginTransferInput[],
  source: ZenginSourceAccount,
  options: ZenginOptions,
): GenerateResult {
  // 1. 空配列チェック
  if (transfers.length === 0) {
    throw new Error("振込データが空です");
  }

  // 2. バリデーション
  const errors: string[] = [];
  transfers.forEach((t, idx) => {
    const result = validateTransfer(t);
    if (!result.valid) {
      errors.push(`[${idx}] ${result.errors.join(", ")}`);
    }
  });
  if (errors.length > 0) {
    throw new Error(`バリデーションエラー:\n${errors.join("\n")}`);
  }

  // 3. 銀行プロファイル取得（京都銀行はここで throw）
  const profile = getBankProfile(options.bank);

  // 4. 合計計算
  const totalAmount = transfers.reduce((sum, t) => sum + t.amount, 0);

  // 5. 各レコード組立
  const lines: string[] = [
    buildHeaderRecord(source),
    ...transfers.map(buildDataRecord),
    buildTrailerRecord(transfers.length, totalAmount),
    buildEndRecord(),
  ];

  // 6. 行結合 + 銀行別末尾処理
  let text = lines.join(profile.lineEnding) + profile.lineEnding;
  if (profile.useEofMark) {
    text += "\x1A";
  }

  // 7. Shift-JIS エンコード
  const content = encodeToShiftJis(text);

  // 8. ファイル名生成
  const today = new Date();
  const yyyymmdd =
    today.getFullYear().toString() +
    String(today.getMonth() + 1).padStart(2, "0") +
    String(today.getDate()).padStart(2, "0");
  const filename = `zengin_${yyyymmdd}_${options.bank}${profile.fileExtension}`;

  return {
    content,
    filename,
    recordCount: transfers.length,
    totalAmount,
  };
}
