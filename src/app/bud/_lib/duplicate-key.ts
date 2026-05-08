/**
 * Garden-Bud / 振込の重複検出キー生成
 *
 * PostgreSQL の bud_transfers.duplicate_key（GENERATED 列）と同じロジック。
 * UI 側で「このデータで登録すると重複扱いになります」と事前警告を出すため。
 *
 * フォーマット: YYYYMMDD,銀行コード,支店コード,口座番号,金額
 * 例: "20260425,0179,685,1207991,24980"
 *
 * 必須フィールドがいずれか欠けている場合は null を返し、UI 側で
 * 「まだ重複判定できません」として扱う。
 */

export interface DuplicateKeyInput {
  scheduled_date: string | null; // ISO 日付（"2026-04-25"）or "/" 区切り or null
  payee_bank_code: string;
  payee_branch_code: string;
  payee_account_number: string;
  amount: number;
}

function normalizeDate(dateStr: string): string {
  // "2026-04-25" or "2026/04/25" → "20260425"
  return dateStr.replace(/[-/]/g, "");
}

export function buildDuplicateKey(input: DuplicateKeyInput): string | null {
  if (
    !input.scheduled_date ||
    !input.payee_bank_code ||
    !input.payee_branch_code ||
    !input.payee_account_number
  ) {
    return null;
  }

  const datePart = normalizeDate(input.scheduled_date);

  return [
    datePart,
    input.payee_bank_code,
    input.payee_branch_code,
    input.payee_account_number,
    input.amount.toString(),
  ].join(",");
}
