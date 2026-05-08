/**
 * Garden-Bud / 全銀協 CSV — バリデーション
 *
 * 振込1件ごとに、全銀協フォーマットが要求する各項目の妥当性を検証する。
 * エラーがあれば valid=false で errors を返す（CSV 生成は中断）。
 */

import type {
  ZenginTransferInput,
  ZenginSourceAccount,
  ValidationResult,
} from "./types";
import { toHalfWidthKana } from "./kana-converter";

const MAX_AMOUNT = 9_999_999_999; // 10桁上限
const MAX_KANA_LENGTH = 30;
const MAX_CONSIGNOR_NAME_LENGTH = 40;
const MAX_BANK_NAME_LENGTH = 15;
const MAX_BRANCH_NAME_LENGTH = 15;
const VALID_ACCOUNT_TYPES = ["1", "2", "4"];

function isDigitString(value: string, length: number): boolean {
  return new RegExp(`^\\d{${length}}$`).test(value);
}

function isDigitStringUpTo(value: string, maxLength: number): boolean {
  return new RegExp(`^\\d{1,${maxLength}}$`).test(value);
}

/** 既に半角（ASCII 0x20-0x7E + 半角カナ領域 0xFF61-0xFF9F）のみで構成されているか */
function isAllHalfWidth(value: string): boolean {
  return /^[\x20-\x7E\uFF61-\uFF9F]*$/.test(value);
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

/**
 * 振込元口座情報（ヘッダレコード用）の妥当性を検証する。
 *
 * - consignor_name / source_bank_name / source_branch_name は「半角」であること。
 *   全角が混入していると SJIS エンコード時に 1 文字が 2 byte となり
 *   120 byte 固定長が崩れる。ここで reject する（caller が事前に半角変換する責務）。
 * - 各種コード桁数は仕様どおり厳密にチェックする。
 */
export function validateSourceAccount(
  source: ZenginSourceAccount,
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // 依頼人コード（1〜10桁数字）
  if (!isDigitStringUpTo(source.consignor_code, 10)) {
    errors.push(
      `依頼人コードは1〜10桁の数字である必要があります: "${source.consignor_code}"`,
    );
  }

  // 依頼人名（半角、40桁以内）
  if (!source.consignor_name || source.consignor_name.length === 0) {
    errors.push("依頼人名が空です");
  } else if (!isAllHalfWidth(source.consignor_name)) {
    errors.push(
      `依頼人名に全角文字が含まれています（半角で指定してください）: "${source.consignor_name}"`,
    );
  } else if (source.consignor_name.length > MAX_CONSIGNOR_NAME_LENGTH) {
    errors.push(
      `依頼人名は半角 ${MAX_CONSIGNOR_NAME_LENGTH} 桁以内です: "${source.consignor_name}" (${source.consignor_name.length}桁)`,
    );
  }

  // 振込指定日（4桁 MMDD）
  if (!isDigitString(source.transfer_date, 4)) {
    errors.push(
      `振込指定日は4桁（MMDD）の数字である必要があります: "${source.transfer_date}"`,
    );
  }

  // 振込元金融機関コード（4桁）
  if (!isDigitString(source.source_bank_code, 4)) {
    errors.push(
      `振込元金融機関コードは4桁の数字である必要があります: "${source.source_bank_code}"`,
    );
  }

  // 振込元金融機関名（半角、15桁以内）
  if (!source.source_bank_name || source.source_bank_name.length === 0) {
    errors.push("振込元金融機関名が空です");
  } else if (!isAllHalfWidth(source.source_bank_name)) {
    errors.push(
      `振込元金融機関名に全角文字が含まれています（半角で指定してください）: "${source.source_bank_name}"`,
    );
  } else if (source.source_bank_name.length > MAX_BANK_NAME_LENGTH) {
    errors.push(
      `振込元金融機関名は半角 ${MAX_BANK_NAME_LENGTH} 桁以内です: "${source.source_bank_name}" (${source.source_bank_name.length}桁)`,
    );
  }

  // 振込元支店コード（3桁）
  if (!isDigitString(source.source_branch_code, 3)) {
    errors.push(
      `振込元支店コードは3桁の数字である必要があります: "${source.source_branch_code}"`,
    );
  }

  // 振込元支店名（半角、15桁以内）
  if (!source.source_branch_name || source.source_branch_name.length === 0) {
    errors.push("振込元支店名が空です");
  } else if (!isAllHalfWidth(source.source_branch_name)) {
    errors.push(
      `振込元支店名に全角文字が含まれています（半角で指定してください）: "${source.source_branch_name}"`,
    );
  } else if (source.source_branch_name.length > MAX_BRANCH_NAME_LENGTH) {
    errors.push(
      `振込元支店名は半角 ${MAX_BRANCH_NAME_LENGTH} 桁以内です: "${source.source_branch_name}" (${source.source_branch_name.length}桁)`,
    );
  }

  // 振込元預金種目（1/2/4）
  if (!VALID_ACCOUNT_TYPES.includes(source.source_account_type)) {
    errors.push(
      `振込元預金種目は 1(普通) / 2(当座) / 4(貯蓄) のいずれかです: "${source.source_account_type}"`,
    );
  }

  // 振込元口座番号（1〜7桁）
  if (!isDigitStringUpTo(source.source_account_number, 7)) {
    errors.push(
      `振込元口座番号は1〜7桁の数字である必要があります: "${source.source_account_number}"`,
    );
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}
