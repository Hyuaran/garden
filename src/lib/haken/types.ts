export type HakenParty = {
  id: string;
  name: string;
  office_name: string;
  address: string;
  permit_no: string;
  manager_name: string;
  manager_tel: string;
  complaint_name: string;
  complaint_tel: string;
  invoice_delivery: "mail" | "portal";
  basic_contract_on: string | null;
  note: string;
  issue_defaults: Record<string, string>;
  updated_at: string;
};
export type HakenOffice = {
  id: string;
  company_id: string;
  name: string;
  address: string;
  training_note: string;
  cafeteria_note: string;
  rest_room_note: string;
  changing_room_note: string;
};
export type HakenContract = {
  id: string;
  side: "ukeire" | "haken";
  party_id: string;
  office_id: string;
  org_unit: string;
  work_content: string;
  responsibility: string;
  period_start: string;
  period_end: string | null;
  work_days: string;
  work_hours: string;
  break_note: string;
  supervisor_name: string;
  commander_name: string;
  complaint_owner_name: string;
  is_introduction: boolean;
  no_limit_reason: string;
  notified_conflict_on: string | null;
  updated_at: string;
};
export type HakenWorker = {
  id: string;
  contract_id: string;
  employee_id: string | null;
  name: string;
  gender: string | null;
  is_indefinite: boolean;
  is_over_60: boolean;
  is_agreement: boolean;
  health_insurance: boolean;
  pension: boolean;
  employment_insurance: boolean;
  insurance_reason: string;
  party_notice_on: string | null;
  start_on: string;
  end_on: string | null;
  end_reason: string;
  deleted_at: string | null;
};
export type HakenDocument = {
  id: string;
  contract_id: string | null;
  party_id: string | null;
  doc_type: string;
  document_status: string;
  issued_on: string;
  file_name: string;
  drive_url: string | null;
  save_error: string | null;
};
export type HakenEvent = {
  id: string;
  worker_id: string;
  on_date: string;
  kind: "training" | "complaint";
  content: string;
  handler: string;
  result: string;
  party_contact: string;
};
export type HakenData = {
  parties: HakenParty[];
  offices: HakenOffice[];
  contracts: HakenContract[];
  workers: HakenWorker[];
  documents: HakenDocument[];
  events: HakenEvent[];
  employees: {
    employee_id: string;
    name: string;
    haken_party_id: string | null;
  }[];
  companies: { company_id: string; company_name: string }[];
};
export const DOCUMENT_LABELS: Record<string, string> = {
  basic: "基本契約書",
  individual: "個別契約書",
  conflict_notice: "抵触日通知書",
  treatment: "待遇情報提供書",
  reply: "個別契約の回答書",
  party_notice: "派遣元からの通知",
  other: "その他",
};
export const PARTY_FIELDS = [
  ["name", "会社名"],
  ["office_name", "事業所"],
  ["address", "所在地"],
  ["permit_no", "許可番号"],
  ["manager_name", "派遣元責任者"],
  ["manager_tel", "責任者の連絡先"],
  ["complaint_name", "苦情の担当"],
  ["complaint_tel", "苦情の担当の連絡先"],
  ["basic_contract_on", "基本契約書の締結日"],
  ["note", "備考"],
] as const;
export const DEFAULT_FIELDS = [
  ["org_unit", "組織単位"],
  ["work_content", "業務内容"],
  ["responsibility", "責任の程度"],
  ["work_days", "就業日"],
  ["work_hours", "就業時間"],
  ["break_note", "休憩"],
  ["commander_name", "指揮命令者"],
  ["supervisor_name", "派遣先責任者"],
  ["complaint_owner_name", "苦情の申出を受ける者"],
  ["closing_day", "締め日"],
  ["payment_day", "支払日"],
  ["timecard_delivery", "タイムカードの送付"],
  ["overtime", "残業割増"],
  ["invoice_destination", "請求書の送付先"],
  ["invoice_due", "請求書の提出期日"],
  ["questions", "貴社へのご確認事項"],
] as const;
