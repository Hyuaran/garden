export const COMPANY_ABBREVIATIONS = {
  "COMP-001": "HR",
  "COMP-002": "CR",
  "COMP-003": "LKS",
  "COMP-004": "ART",
  "COMP-005": "TIY",
  "COMP-006": "ICHI",
  "COMP-007": "SB",
  ALL: "ALL",
} as const;
export type ContractCompany = {
  company_id: string;
  company_name: string;
  representative: string | null;
  address: string | null;
};
export type ContractDraft = {
  counterparty: string;
  companyId: string;
  contractType: string;
  concludedOn: string;
  note: string;
  partyA: string;
  partyB: string;
  ownParty: "A" | "B" | null;
  ownPartyWarning: boolean;
  scanned: boolean;
};
export type ContractRow = {
  id: string;
  counterparty: string;
  company_id: string;
  contract_type: string;
  concluded_on: string;
  note: string | null;
  drive_file_id: string | null;
  drive_url: string | null;
  drive_folder_name: string | null;
  template_file_id: string | null;
  template_url: string | null;
  template_generated_at: string | null;
  created_at: string;
  root_companies?: ContractCompany | null;
};
export const MAX_CONTRACT_SIZE = 20 * 1024 * 1024;
export function companyAbbreviation(companyId: string) {
  return (
    COMPANY_ABBREVIATIONS[companyId as keyof typeof COMPANY_ABBREVIATIONS] ??
    "ALL"
  );
}
export function validateContractUpload(input: {
  counterparty?: string;
  companyId?: string;
  contractType?: string;
  concludedOn?: string;
  file?: File | null;
}) {
  if (
    !input.counterparty?.trim() ||
    !input.companyId ||
    !input.contractType?.trim() ||
    !input.concludedOn ||
    !input.file
  )
    return "必須項目を入力してください。";
  if (input.file.type !== "application/pdf")
    return "PDFファイルを選択してください。";
  if (input.file.size > MAX_CONTRACT_SIZE)
    return "PDFは20MB以下にしてください。";
  return null;
}
