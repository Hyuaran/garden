export const SUBMISSION_LABELS = {
  dependents: "扶養の変更",
  emergency_contact: "緊急連絡先変更",
  commute_route: "通勤経路変更",
  bank_account: "給与受取口座の変更",
  resignation: "退職届",
  nda: "秘密保持誓約書",
} as const;
export type SubmissionType = keyof typeof SUBMISSION_LABELS;
/** 届出の状態の言葉（受信箱・LINE の申告ページ・マイページで共通）。 */
export const SUBMISSION_STATUS_LABELS: Record<string, string> = {
  received: "受付済み",
  in_progress: "対応中",
  amount_proposing: "金額提案中",
  awaiting_employee: "本人承諾待ち",
  completed: "完了",
  confirmed: "確定",
  withdrawn: "取り下げ",
};
export type SubmissionStatus =
  | "received"
  | "in_progress"
  | "amount_proposing"
  | "awaiting_employee"
  | "completed"
  | "confirmed"
  | "withdrawn";
export type PdfStatus = "not_applicable" | "generated" | "skipped" | "failed";
export type SubmissionRow = {
  id: string;
  employee_id: string;
  submission_type: SubmissionType;
  payload: Record<string, unknown>;
  status: SubmissionStatus;
  proposed_one_way: number | null;
  kintone_status: string;
  kintone_note: string | null;
  pdf_drive_file_id?: string | null;
  pdf_drive_url?: string | null;
  pdf_status?: PdfStatus;
  pdf_note?: string | null;
  created_at: string;
  root_employees?: {
    employee_number?: string;
    name?: string;
    kot_employee_id?: string | null;
    commute_monthly_cap?: number | null;
    company_id?: string | null;
  } | null;
};
export function validateSubmission(
  type: SubmissionType,
  payload: Record<string, unknown>,
) {
  const required: Record<SubmissionType, string[]> = {
    emergency_contact: [
      "kind",
      "selfAddress",
      "selfPhone",
      "ecName",
      "ecRelationship",
      "ecAddress",
      "ecPhone",
    ],
    dependents: ["count", "details", "effectiveDate"],
    commute_route: ["station", "effectiveDate"],
    bank_account: [
      "bankName",
      "bankCode",
      "branchName",
      "branchCode",
      "accountNumber",
      "holderKana",
    ],
    resignation: ["desiredDate"],
    nda: ["kind", "pledgeDate", "address", "signature"],
  };
  if (
    !required[type] ||
    required[type].some((key) => !String(payload[key] ?? "").trim())
  )
    return "必須項目を入力してください。";
  if (
    type === "emergency_contact" &&
    !["new", "change"].includes(String(payload.kind))
  )
    return "区分を選択してください。";
  if (type === "nda" && !["new", "resubmit"].includes(String(payload.kind)))
    return "区分を選択してください。";
  if (
    type === "bank_account" &&
    (!/^\d{4}$/.test(String(payload.bankCode)) ||
      !/^\d{3}$/.test(String(payload.branchCode)) ||
      !/^\d{1,8}$/.test(String(payload.accountNumber)))
  )
    return "金融機関コード・支店コード・口座番号の桁数をご確認ください。";
  if (type === "dependents") {
    const count = payload.count;
    if ((typeof count !== "string" && typeof count !== "number") ||
      !/^\d+$/.test(String(count)) || !Number.isSafeInteger(Number(count)))
      return "扶養の人数は0以上の整数で入力してください。";
    const date = String(payload.effectiveDate);
    const parsed = new Date(date + "T00:00:00Z");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date)
      return "変更の日を正しい日付で入力してください。";
  }
  if (type === "nda" && payload.agreed !== true)
    return "内容への同意が必要です。";
  return null;
}
