import type { SubmissionType } from "./submission-types";
export const submissionFields: Record<
  SubmissionType,
  Array<[string, string, string, boolean?]>
> = {
  dependents: [
    ["count", "変更後の扶養の人数", "number"],
    ["details", "変更の内容", "textarea"],
    ["effectiveDate", "変更の日", "date"],
    ["note", "補足（任意）", "textarea", true],
  ],
  emergency_contact: [
    ["selfAddress", "現住所", "text"],
    ["selfPhone", "個人の電話番号（携帯等）", "tel"],
    ["ecName", "緊急連絡先の氏名", "text"],
    ["ecRelationship", "本人との続柄", "text"],
    ["ecAddress", "緊急連絡先の住所（同一の場合は「同上」）", "text"],
    ["ecPhone", "緊急連絡先の電話番号", "tel"],
  ],
  commute_route: [
    ["station", "新しい最寄り駅", "text"],
    ["effectiveDate", "適用希望日", "date"],
    ["note", "補足（任意）", "textarea", true],
  ],
  bank_account: [
    ["bankName", "銀行名", "text"],
    ["bankCode", "金融機関コード（4桁）", "text"],
    ["branchName", "支店名", "text"],
    ["branchCode", "支店コード（3桁）", "text"],
    ["accountNumber", "口座番号（8桁以内）", "text"],
    ["holderKana", "口座名義カナ", "text"],
  ],
  resignation: [
    ["desiredDate", "退職希望日", "date"],
    ["reason", "理由（任意）", "textarea", true],
  ],
  nda: [
    ["pledgeDate", "誓約日", "date"],
    ["address", "住所", "text"],
    ["signature", "氏名（電子署名）", "text"],
  ],
};
