/**
 * Garden-Bud / 全銀協 CSV — バリデーション
 *
 * 振込1件ごとに、全銀協フォーマットが要求する各項目の妥当性を検証する。
 * エラーがあれば valid=false で errors を返す（CSV 生成は中断）。
 */

import type { ZenginTransferInput, ValidationResult } from "./types";
import { toHalfWidthKana } from "./kana-converter";

const MAX_AMOUNT = 9_999_999_999; // 10桁上限
const MAX_KANA_LENGTH = 30;
const VALID_ACCOUNT_TYPES = ["1", "2", "4"];

function isDigitString(value: string, length: number): boolean {
  return new RegExp(`^\\d{${length}}$`).test(value);
}

function isDigitStringUpTo(value: string, maxLength: number): boolean {
  return new RegExp(`^\\d{1,${maxLength}}$`).test(value);
}

export function validateTransfer(t: ZenginTransferInput): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // 銀行コード（4桁数字）
  if (!isDigitString(t.payee_bank_code, 4)) {
    errors.push(
      `銀行コードは4桁の数字である必要があります: "${t.payee_bank_code}"`,
    );
  }

  // 支店コード（3桁数字）
  if (!isDigitString(t.payee_branch_code, 3)) {
    errors.push(
      `支店コードは3桁の数字である必要があります: "${t.payee_branch_code}"`,
    );
  }

  // 預金種目（1/2/4）
  if (!VALID_ACCOUNT_TYPES.includes(t.payee_account_type)) {
    errors.push(
      `預金種目は 1(普通) / 2(当座) / 4(貯蓄) のいずれかです: "${t.payee_account_type}"`,
    );
  }

  // 口座番号（1〜7桁数字）
  if (!isDigitStringUpTo(t.payee_account_number, 7)) {
    errors.push(
      `口座番号は1〜7桁の数字である必要があります: "${t.payee_account_number}"`,
    );
  }

  // 受取人名カナ（空でない、変換後30桁以内）
  if (!t.payee_account_holder_kana || t.payee_account_holder_kana.trim() === "") {
    errors.push("受取人名カナが空です");
  } else {
    const { kana, warnings: kanaWarnings } = toHalfWidthKana(
      t.payee_account_holder_kana,
    );
    warnings.push(...kanaWarnings);
    if (kana.length > MAX_KANA_LENGTH) {
      errors.push(
        `受取人名カナは半角 ${MAX_KANA_LENGTH} 桁以内です: "${kana}" (${kana.length}桁)`,
      );
    }
    if (kana.length === 0) {
      errors.push("受取人名カナが変換後に空になりました（漢字等のみの入力）");
    }
  }

  // 金額（正の整数、上限）
  if (!Number.isInteger(t.amount)) {
    errors.push(`金額は整数である必要があります: ${t.amount}`);
  } else if (t.amount <= 0) {
    errors.push(`金額は 1 円以上である必要があります: ${t.amount}`);
  } else if (t.amount > MAX_AMOUNT) {
    errors.push(
      `金額が上限を超えています（最大 ${MAX_AMOUNT.toLocaleString()} 円）: ${t.amount}`,
    );
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}
