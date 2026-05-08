export interface RegularFormInput {
  request_company_id: string;
  execute_company_id: string;
  source_account_id: string;
  vendor_id?: string | null;
  payee_name: string;
  payee_bank_code: string;
  payee_branch_code: string;
  payee_account_type: string;
  payee_account_number: string;
  payee_account_holder_kana: string;
  fee_bearer?: string | null;
  amount: number;
  description?: string | null;
  scheduled_date: string;
  due_date?: string | null;
  payee_mismatch_confirmed?: boolean;
  invoice_pdf_url?: string | null;
  scan_image_url?: string | null;
}

export interface CashbackFormInput extends RegularFormInput {
  cashback_applicant_name: string;
  cashback_applicant_name_kana: string;
  cashback_applicant_phone?: string | null;
  cashback_customer_id?: string | null;
  cashback_order_date?: string | null;
  cashback_opened_date?: string | null;
  cashback_product_name: string;
  cashback_channel_name: string;
  cashback_partner_code?: string | null;
}

export interface ValidationErrors {
  [field: string]: string;
}

export interface FormValidationResult {
  valid: boolean;
  errors: ValidationErrors;
}

function validateShared(input: RegularFormInput, errors: ValidationErrors): void {
  if (!input.request_company_id) errors.request_company_id = "依頼会社を選択してください";
  if (!input.execute_company_id) errors.execute_company_id = "実行会社を選択してください";
  if (!input.source_account_id) errors.source_account_id = "振込元口座を選択してください";
  if (!input.payee_name || input.payee_name.trim() === "")
    errors.payee_name = "お支払い先を入力してください";
  if (!/^\d{4}$/.test(input.payee_bank_code))
    errors.payee_bank_code = "銀行コードは 4 桁数字です";
  if (!/^\d{3}$/.test(input.payee_branch_code))
    errors.payee_branch_code = "支店コードは 3 桁数字です";
  if (!["1", "2", "4"].includes(input.payee_account_type))
    errors.payee_account_type = "預金種目を選択してください";
  if (!/^\d{1,7}$/.test(input.payee_account_number))
    errors.payee_account_number = "口座番号は 1〜7 桁数字です";
  if (!input.payee_account_holder_kana || input.payee_account_holder_kana.trim() === "")
    errors.payee_account_holder_kana = "口座名義カナを入力してください";
  if (!Number.isInteger(input.amount) || input.amount <= 0)
    errors.amount = "金額は 1 円以上の整数です";
  if (input.amount > 9_999_999_999)
    errors.amount = "金額が上限（9,999,999,999 円）を超えています";
  if (!input.scheduled_date)
    errors.scheduled_date = "支払期日（振込予定日）を選択してください";
}

export function validateRegularForm(input: RegularFormInput): FormValidationResult {
  const errors: ValidationErrors = {};
  validateShared(input, errors);
  return { valid: Object.keys(errors).length === 0, errors };
}

export function validateCashbackForm(input: CashbackFormInput): FormValidationResult {
  const errors: ValidationErrors = {};
  validateShared(input, errors);
  if (!input.cashback_applicant_name || input.cashback_applicant_name.trim() === "")
    errors.cashback_applicant_name = "申込者名を入力してください";
  if (!input.cashback_applicant_name_kana || input.cashback_applicant_name_kana.trim() === "")
    errors.cashback_applicant_name_kana = "申込者名カナを入力してください";
  if (!input.cashback_product_name || input.cashback_product_name.trim() === "")
    errors.cashback_product_name = "商材名を入力してください";
  if (!input.cashback_channel_name || input.cashback_channel_name.trim() === "")
    errors.cashback_channel_name = "商流名を入力してください";
  return { valid: Object.keys(errors).length === 0, errors };
}
