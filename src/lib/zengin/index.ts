/**
 * Garden-Bud / 全銀協 CSV ライブラリ — 公開 API
 *
 * 使用例:
 *   import { generateZenginCsv, toHalfWidthKana, validateTransfer } from "@/lib/zengin";
 *   const result = generateZenginCsv(transfers, source, { bank: "rakuten" });
 *   // result.content は Shift-JIS Buffer、result.filename は推奨ファイル名
 */

export { generateZenginCsv } from "./generator";
export { toHalfWidthKana } from "./kana-converter";
export { validateTransfer, validateSourceAccount } from "./validator";
export { getBankProfile } from "./bank-specific";
export type {
  BankType,
  AccountTypeCode,
  ZenginTransferInput,
  ZenginSourceAccount,
  ZenginOptions,
  ValidationResult,
  GenerateResult,
} from "./types";
