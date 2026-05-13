/**
 * Garden-Bud / Phase D #09 口座情報バリデーター
 *
 * 対応 spec: docs/specs/2026-04-26-bud-phase-d-09-bank-accounts.md
 * 対応 migration CHECK 制約と論理同等の TS 側ガード（Server Action / form 入力時の早期検出用）
 *
 * 純関数のみ。DB アクセスなし。
 *
 * 対応バリデーション:
 *   - bank_code: 4 桁数字
 *   - branch_code: 3 桁数字
 *   - account_number: 1-8 桁数字
 *   - account_type: enum 一致
 *   - account_holder_kana: 半角カナ（全角カナ混入検出）
 *   - applies_month: 月初日 (YYYY-MM-01) フォーマット
 *   - recipient_type と employee_id の整合性
 */

import {
  ACCOUNT_TYPES,
  PAYMENT_RECIPIENT_TYPES,
  type AccountType,
  type PaymentRecipientType,
} from "./bank-account-types";

// ============================================================
// バリデーション結果型
// ============================================================

export interface ValidationResult {
  ok: boolean;
  errors: string[];
}

function ok(): ValidationResult {
  return { ok: true, errors: [] };
}

function err(...messages: string[]): ValidationResult {
  return { ok: false, errors: messages };
}

function combine(...results: ValidationResult[]): ValidationResult {
  const errors = results.flatMap((r) => r.errors);
  return errors.length === 0 ? ok() : { ok: false, errors };
}

// ============================================================
// 単一フィールド バリデーター
// ============================================================

const BANK_CODE_RE = /^[0-9]{4}$/;
const BRANCH_CODE_RE = /^[0-9]{3}$/;
const ACCOUNT_NUMBER_RE = /^[0-9]{1,8}$/;
// 半角カナ範囲: 0xFF65 (｡) - 0xFF9F (ﾟ) + 0xFF66-0xFF9D (主要文字) + 半角スペース・濁点等
// 通常の FB データ向け半角カナは ｱ-ﾝ + ﾞ + ﾟ + 0-9 + - + . + 半角スペース
const HANKAKU_KANA_RE = /^[｡-ﾟ0-9A-Z \-.]+$/; // 半角カナ + 数字 + 大文字英 + 半角スペース・記号

export function validateBankCode(value: string): ValidationResult {
  if (!value) return err("bank_code は必須");
  if (!BANK_CODE_RE.test(value)) return err(`bank_code は 4 桁数字（実値: "${value}"）`);
  return ok();
}

export function validateBranchCode(value: string): ValidationResult {
  if (!value) return err("branch_code は必須");
  if (!BRANCH_CODE_RE.test(value)) return err(`branch_code は 3 桁数字（実値: "${value}"）`);
  return ok();
}

export function validateAccountNumber(value: string): ValidationResult {
  if (!value) return err("account_number は必須");
  if (!ACCOUNT_NUMBER_RE.test(value)) {
    return err(`account_number は 1-8 桁数字（実値: "${value}"）`);
  }
  return ok();
}

export function validateAccountType(value: string): ValidationResult {
  if (!ACCOUNT_TYPES.includes(value as AccountType)) {
    return err(`account_type は ${ACCOUNT_TYPES.join(" / ")} のいずれか（実値: "${value}"）`);
  }
  return ok();
}

export function validateAccountHolderKana(value: string): ValidationResult {
  if (!value) return err("account_holder_kana は必須");
  if (value.length === 0) return err("account_holder_kana は空文字不可");
  if (!HANKAKU_KANA_RE.test(value)) {
    return err(
      `account_holder_kana は半角カナ + 数字 + 半角スペース + 記号のみ（全角カナ・小文字英・ひらがな・漢字混入の可能性、実値: "${value}"）`,
    );
  }
  return ok();
}

export function validateRecipientType(value: string): ValidationResult {
  if (!PAYMENT_RECIPIENT_TYPES.includes(value as PaymentRecipientType)) {
    return err(
      `recipient_type は ${PAYMENT_RECIPIENT_TYPES.join(" / ")} のいずれか（実値: "${value}"）`,
    );
  }
  return ok();
}

/**
 * applies_month が月初日 (YYYY-MM-01) フォーマットか検証。
 * NULL は OK（通年継続支払）。
 */
export function validateAppliesMonth(value: string | null | undefined): ValidationResult {
  if (value === null || value === undefined) return ok();
  if (!/^\d{4}-\d{2}-01$/.test(value)) {
    return err(`applies_month は YYYY-MM-01（月初日）形式必須（実値: "${value}"）`);
  }
  // 月の範囲確認
  const month = Number(value.slice(5, 7));
  if (month < 1 || month > 12) {
    return err(`applies_month の月部分が不正（実値: "${value}"）`);
  }
  return ok();
}

/**
 * recipient_type と employee_id の整合性検証（spec §3.2 CHECK 制約相当）
 *   external_company / individual_special: employee_id NULL 必須
 *   employee_special: employee_id NOT NULL 必須
 */
export function validateRecipientTypeAndEmployeeId(
  recipientType: PaymentRecipientType,
  employeeId: string | null,
): ValidationResult {
  switch (recipientType) {
    case "external_company":
    case "individual_special":
      if (employeeId !== null) {
        return err(
          `recipient_type='${recipientType}' のとき employee_id は NULL 必須（実値: "${employeeId}"）`,
        );
      }
      return ok();
    case "employee_special":
      if (employeeId === null) {
        return err(
          `recipient_type='employee_special' のとき employee_id は NOT NULL 必須（NULL は不可）`,
        );
      }
      return ok();
  }
}

/**
 * 効果期間（effective_from <= effective_to）の整合性
 */
export function validateEffectiveDates(
  effectiveFrom: string,
  effectiveTo: string | null,
): ValidationResult {
  if (effectiveTo === null) return ok();
  if (effectiveFrom > effectiveTo) {
    return err(
      `effective_from (${effectiveFrom}) は effective_to (${effectiveTo}) 以前である必要あり`,
    );
  }
  return ok();
}

// ============================================================
// 複合バリデーター（口座 1 件まとめて検証）
// ============================================================

export interface BankAccountInput {
  bankCode: string;
  branchCode: string;
  accountType: string;
  accountNumber: string;
  accountHolderKana: string;
  effectiveFrom: string;
  effectiveTo: string | null;
}

export function validateEmployeeBankAccount(
  input: BankAccountInput,
): ValidationResult {
  return combine(
    validateBankCode(input.bankCode),
    validateBranchCode(input.branchCode),
    validateAccountType(input.accountType),
    validateAccountNumber(input.accountNumber),
    validateAccountHolderKana(input.accountHolderKana),
    validateEffectiveDates(input.effectiveFrom, input.effectiveTo),
  );
}

export interface PaymentRecipientInput {
  recipientType: string;
  employeeId: string | null;
  bankCode: string;
  branchCode: string;
  accountType: string;
  accountNumber: string;
  accountHolderKana: string;
  appliesMonth: string | null;
  amount: number | null;
}

export function validatePaymentRecipient(
  input: PaymentRecipientInput,
): ValidationResult {
  const typeResult = validateRecipientType(input.recipientType);
  if (!typeResult.ok) return typeResult;

  const recipientType = input.recipientType as PaymentRecipientType;
  const integrityResult = validateRecipientTypeAndEmployeeId(
    recipientType,
    input.employeeId,
  );

  // amount は null OK、負数のみ NG
  const amountResult: ValidationResult =
    input.amount !== null && input.amount < 0
      ? err(`amount は 0 以上必須（実値: ${input.amount}）`)
      : ok();

  return combine(
    integrityResult,
    validateBankCode(input.bankCode),
    validateBranchCode(input.branchCode),
    validateAccountType(input.accountType),
    validateAccountNumber(input.accountNumber),
    validateAccountHolderKana(input.accountHolderKana),
    validateAppliesMonth(input.appliesMonth),
    amountResult,
  );
}
